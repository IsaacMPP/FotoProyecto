#!/usr/bin/env python3
"""Avoid optional Canon property reads blocking EOS 6D Mark II Wi-Fi startup.
Applies only when DEMI_WIFI_SKIP_OPTIONAL_STARTUP=1; USB and other FC.SDK paths unchanged."""
from pathlib import Path
p=Path("fc-sdk/src/FC.SDK/Canon/CanonPtpSession.cs")
s=p.read_text(encoding="utf-8")
old="""        // 7. Ask for the values the camera does not volunteer.
        foreach (var propCode in RequestOnOpenPropertyCodes)"""
new="""        // 7. Optional metadata: on EOS 6D Mark II PTP/IP, 0x9127 may never respond
        // (observed at tx=13), even though OpenSession and SetEventMode succeeded.
        // Do not let optional Owner/Artist/Serial metadata prevent capture.
        // This flag is set exclusively by Demi's Wi-Fi bridge.
        if (Environment.GetEnvironmentVariable("DEMI_WIFI_SKIP_OPTIONAL_STARTUP") == "1")
        {
            Console.Error.WriteLine("[PTP-IP] Essential session initialized; skipping optional property reads 0x9127");
            return EdsError.OK;
        }
        // 7. Ask for the values the camera does not volunteer.
        foreach (var propCode in RequestOnOpenPropertyCodes)"""
if s.count(old)!=1:
    raise SystemExit("CanonPtpSession startup marker changed; refusing patch")
p.write_text(s.replace(old,new),encoding="utf-8")
print("EOS Wi-Fi OpenSession now bypasses only optional startup metadata requests")
