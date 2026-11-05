#!/usr/bin/env python3
"""Preserve the application pairing identity in FC.SDK's PTP/IP handshake.
Applied to pinned FC.SDK source only in CI; fail closed on upstream changes."""
from pathlib import Path
p = Path("fc-sdk/src/FC.SDK/Transport/PtpIpTransport.cs")
s = p.read_text(encoding="utf-8")
old = '''internal PtpIpTransport(string host, int port = PtpIpPort, string? clientName = null)
    {
        _host = host;
        _port = port;
        _clientGuid = Guid.NewGuid();
        _clientName = clientName ?? "FC.SDK";
    }'''
new = '''internal PtpIpTransport(string host, int port = PtpIpPort, string? clientName = null)
    {
        _host = host;
        _port = port;
        var persisted = Environment.GetEnvironmentVariable("DEMI_CANON_PAIRING_GUID");
        _clientGuid = Guid.TryParse(persisted, out var saved) ? saved : Guid.NewGuid();
        _clientName = clientName ?? "FC.SDK";
    }'''
if s.count(old) != 1:
    raise SystemExit("FC.SDK PtpIpTransport code changed; cannot safely apply pairing patch")
s = s.replace(old,new)
# Deterministic PTP/IP stage tracing, without printing the camera/client GUID.
stages = [
    ("await _commandClient.ConnectAsync(_host, _port, ct);", 'Console.Error.WriteLine("[PTP-IP] Command TCP connected");'),
    ("await _commandStream.WriteAsync(initRequest, ct);", 'Console.Error.WriteLine("[PTP-IP] InitCommandRequest sent");'),
    ("if (ackType is not PtpIpPacketType.InitCommandAck)", 'Console.Error.WriteLine("[PTP-IP] Reply to InitCommandRequest: " + ackType);'),
    ("await _eventClient.ConnectAsync(_host, _port, ct);", 'Console.Error.WriteLine("[PTP-IP] Event TCP connected");'),
    ("await _eventStream.WriteAsync(eventRequest, ct);", 'Console.Error.WriteLine("[PTP-IP] InitEventRequest sent");'),
    ("if (eventAckType is not PtpIpPacketType.InitEventAck)", 'Console.Error.WriteLine("[PTP-IP] Reply to InitEventRequest: " + eventAckType);'),
]
for needle, statement in stages:
    if s.count(needle) != 1:
        raise SystemExit("FC.SDK stage tracing marker changed: " + needle)
    s = s.replace(needle, needle + "\n        " + statement)
p.write_text(s,encoding="utf-8")
print("PTP/IP pairing now uses persistent GUID passed by Demi Tether Studio")
