#!/usr/bin/env python3
"""Correct USB-PTP <-> PTP/IP framing in pinned FC.SDK transport.
This is a narrowly targeted vendor-patch, not a change to the USB transport."""
from pathlib import Path
p=Path("fc-sdk/src/FC.SDK/Transport/PtpIpTransport.cs")
s=p.read_text(encoding="utf-8")
start=s.index("    public async ValueTask SendAsync(")
end=s.index("    private static async Task<int> ReadPtpIpPacketAsync(",start)
replacement=r'''    private ushort _operationCode;
    private uint _transactionId;

    private static byte[] BuildPacket(PtpIpPacketType type, ReadOnlySpan<byte> payload)
    {
        var packet = new byte[8 + payload.Length];
        BinaryPrimitives.WriteUInt32LittleEndian(packet, (uint)packet.Length);
        BinaryPrimitives.WriteUInt32LittleEndian(packet.AsSpan(4), (uint)type);
        payload.CopyTo(packet.AsSpan(8));
        return packet;
    }

    public async ValueTask SendAsync(ReadOnlyMemory<byte> packet, CancellationToken ct = default)
    {
        if (_commandStream is null) throw new InvalidOperationException("Transport not connected.");
        if (packet.Length < 12) throw new IOException("PTP command too short");
        var src = packet.Span;
        var kind = (PtpContainerType)BinaryPrimitives.ReadUInt16LittleEndian(src.Slice(4,2));
        ushort code = BinaryPrimitives.ReadUInt16LittleEndian(src.Slice(6,2));
        uint tx = BinaryPrimitives.ReadUInt32LittleEndian(src.Slice(8,4));
        if (kind is PtpContainerType.Command)
        {
            _operationCode = code;
            _transactionId = tx;
            // Wire layout: length(4),type(4),dataPhase(4),opCode(2),txId(4),params(4*N).
            // The previous FC.SDK code reserved six extra bytes; it also left them zero.
            byte[] request = new byte[18 + packet.Length - 12];
            BinaryPrimitives.WriteUInt32LittleEndian(request, (uint)request.Length);
            BinaryPrimitives.WriteUInt32LittleEndian(request.AsSpan(4), (uint)PtpIpPacketType.OperationRequest);
            BinaryPrimitives.WriteUInt32LittleEndian(request.AsSpan(8), 1u); // no data / data in
            BinaryPrimitives.WriteUInt16LittleEndian(request.AsSpan(12), code);
            BinaryPrimitives.WriteUInt32LittleEndian(request.AsSpan(14), tx);
            packet.Slice(12).CopyTo(request.AsMemory(18));
            Console.Error.WriteLine("[PTP-IP] OperationRequest opcode=0x" + code.ToString("X4") + " tx=" + tx);
            await _commandStream.WriteAsync(request, ct);
        }
        else if (kind is PtpContainerType.Data)
        {
            // Data-out phase: StartDataPacket followed by EndDataPacket.
            var bytes = packet.Slice(12);
            byte[] start = new byte[20];
            BinaryPrimitives.WriteUInt32LittleEndian(start, 20);
            BinaryPrimitives.WriteUInt32LittleEndian(start.AsSpan(4), (uint)PtpIpPacketType.StartDataPacket);
            BinaryPrimitives.WriteUInt32LittleEndian(start.AsSpan(8), tx);
            BinaryPrimitives.WriteUInt64LittleEndian(start.AsSpan(12), (ulong)bytes.Length);
            await _commandStream.WriteAsync(start, ct);
            var end = new byte[12 + bytes.Length];
            BinaryPrimitives.WriteUInt32LittleEndian(end, (uint)end.Length);
            BinaryPrimitives.WriteUInt32LittleEndian(end.AsSpan(4), (uint)PtpIpPacketType.EndDataPacket);
            BinaryPrimitives.WriteUInt32LittleEndian(end.AsSpan(8), tx);
            bytes.CopyTo(end.AsMemory(12));
            await _commandStream.WriteAsync(end, ct);
        }
        else throw new IOException("Unsupported PTP container type: " + kind);
    }

    private static int WritePtp(Memory<byte> target, PtpContainerType kind, ushort code, uint tx, ReadOnlySpan<byte> payload)
    {
        int length = 12 + payload.Length;
        if (length > target.Length) throw new IOException("PTP result too large for receive buffer: " + length);
        var dst = target.Span;
        BinaryPrimitives.WriteUInt32LittleEndian(dst, (uint)length);
        BinaryPrimitives.WriteUInt16LittleEndian(dst.Slice(4), (ushort)kind);
        BinaryPrimitives.WriteUInt16LittleEndian(dst.Slice(6), code);
        BinaryPrimitives.WriteUInt32LittleEndian(dst.Slice(8), tx);
        payload.CopyTo(dst.Slice(12));
        return length;
    }

    public async ValueTask<int> ReceiveAsync(Memory<byte> buffer, CancellationToken ct = default)
    {
        if (_commandStream is null) throw new InvalidOperationException("Transport not connected.");
        var incoming = new byte[buffer.Length + 64];
        while (true)
        {
            int received = await ReadPtpIpPacketAsync(_commandStream, incoming, ct);
            if (received < 8) throw new IOException("PTP/IP socket closed while reading operation");
            var kind = (PtpIpPacketType)BinaryPrimitives.ReadUInt32LittleEndian(incoming.AsSpan(4));
            if (kind is PtpIpPacketType.OperationResponse)
            {
                if (received < 14) throw new IOException("Short OperationResponse");
                ushort status = BinaryPrimitives.ReadUInt16LittleEndian(incoming.AsSpan(8));
                uint tx = BinaryPrimitives.ReadUInt32LittleEndian(incoming.AsSpan(10));
                Console.Error.WriteLine("[PTP-IP] OperationResponse code=0x" + status.ToString("X4") + " tx=" + tx);
                return WritePtp(buffer, PtpContainerType.Response, status, tx, incoming.AsSpan(14,received-14));
            }
            if (kind is PtpIpPacketType.StartDataPacket)
            {
                if (received < 20) throw new IOException("Short StartDataPacket");
                uint tx = BinaryPrimitives.ReadUInt32LittleEndian(incoming.AsSpan(8));
                using var data = new MemoryStream();
                while (true)
                {
                    int n = await ReadPtpIpPacketAsync(_commandStream, incoming, ct);
                    if (n < 12) throw new IOException("Unexpected end of PTP/IP data phase");
                    var dataKind = (PtpIpPacketType)BinaryPrimitives.ReadUInt32LittleEndian(incoming.AsSpan(4));
                    if (dataKind is not (PtpIpPacketType.DataPacket or PtpIpPacketType.EndDataPacket))
                        throw new IOException("Unexpected packet during data phase: "+dataKind);
                    data.Write(incoming,12,n-12);
                    if (data.Length+12 > buffer.Length)
                        throw new IOException("PTP/IP data exceeds receive buffer: "+data.Length);
                    if (dataKind is PtpIpPacketType.EndDataPacket) break;
                }
                Console.Error.WriteLine("[PTP-IP] DataReceived opcode=0x" + _operationCode.ToString("X4") + " bytes=" + data.Length);
                return WritePtp(buffer,PtpContainerType.Data,_operationCode,tx,data.ToArray());
            }
            if (kind is PtpIpPacketType.ProbeRequest)
            {
                await _commandStream.WriteAsync(BuildPacket(PtpIpPacketType.ProbeResponse,[]),ct);
                continue;
            }
            throw new IOException("Unexpected PTP/IP packet: " + kind);
        }
    }

    public async ValueTask<int> ReceiveEventAsync(Memory<byte> buffer, CancellationToken ct = default)
    {
        if (_eventStream is null) throw new InvalidOperationException("Transport not connected.");
        if (!_eventStream.DataAvailable) return 0;
        var incoming = new byte[buffer.Length + 64];
        int received = await ReadPtpIpPacketAsync(_eventStream,incoming,ct);
        if (received < 8) return 0;
        var kind = (PtpIpPacketType)BinaryPrimitives.ReadUInt32LittleEndian(incoming.AsSpan(4));
        if (kind is PtpIpPacketType.ProbeRequest)
        {
            await _eventStream.WriteAsync(BuildPacket(PtpIpPacketType.ProbeResponse,[]),ct);
            return 0;
        }
        if (kind is not PtpIpPacketType.Event || received < 14) return 0;
        ushort code=BinaryPrimitives.ReadUInt16LittleEndian(incoming.AsSpan(8));
        uint tx=BinaryPrimitives.ReadUInt32LittleEndian(incoming.AsSpan(10));
        return WritePtp(buffer,PtpContainerType.Event,code,tx,incoming.AsSpan(14,received-14));
    }

'''
s=s[:start]+replacement+s[end:]
p.write_text(s,encoding="utf-8")
print("PTP/IP operation framing corrected; PTP command and data responses reconstructed")
