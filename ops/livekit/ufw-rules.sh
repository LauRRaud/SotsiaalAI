#!/usr/bin/env bash
set -euo pipefail

# HTTPS for Nginx/Certbot and LiveKit signaling over WebSocket.
ufw allow 80/tcp comment "Let's Encrypt HTTP-01 challenge"
ufw allow 443/tcp comment "HTTPS LiveKit signaling via Nginx"

# LiveKit WebRTC media ports. See docs/livekit-runbook.md for rationale.
ufw allow 7881/tcp comment "LiveKit ICE/TCP fallback"
ufw allow 50000:60000/udp comment "LiveKit ICE/UDP media"

ufw status verbose
