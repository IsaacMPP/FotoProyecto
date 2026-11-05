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
p.write_text(s.replace(old,new),encoding="utf-8")
print("PTP/IP pairing now uses persistent GUID passed by Demi Tether Studio")
