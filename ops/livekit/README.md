# SotsiaalAI LiveKit Self-Hosted Runbook

Target:
- `ruum.sotsiaal.ai`
- public IP: `217.146.72.147`
- app env: `LIVEKIT_URL=https://ruum.sotsiaal.ai`

This phase deploys only LiveKit signaling/media for audio calls. Do not deploy LiveKit Egress, SIP, recording, transcription, or video-specific UI.

## DNS

Verified locally:

```powershell
Resolve-DnsName ruum.sotsiaal.ai -Type A
nslookup ruum.sotsiaal.ai
```

Expected A record:

```text
ruum.sotsiaal.ai -> 217.146.72.147
```

## Server Install

On the server, install a recent LiveKit server binary and create a dedicated user:

```bash
sudo useradd --system --home /var/lib/livekit --shell /usr/sbin/nologin livekit || true
sudo install -d -o livekit -g livekit -m 0750 /etc/livekit /var/lib/livekit
```

Generate API credentials on the server only:

```bash
livekit-server generate-keys
```

Copy `ops/livekit/livekit.yaml.template` to `/etc/livekit/livekit.yaml`, replace `<LIVEKIT_API_KEY>` and `<LIVEKIT_API_SECRET>` on the server, and restrict the file:

```bash
sudo chown root:livekit /etc/livekit/livekit.yaml
sudo chmod 0640 /etc/livekit/livekit.yaml
```

Install systemd unit:

```bash
sudo cp ops/livekit/livekit.service /etc/systemd/system/livekit.service
sudo systemctl daemon-reload
sudo systemctl enable --now livekit.service
sudo systemctl status livekit.service
journalctl -u livekit.service -f
```

## Nginx and TLS

Install the Nginx site config and request a Let's Encrypt certificate:

```bash
sudo mkdir -p /var/www/certbot
sudo cp ops/livekit/nginx-ruum.sotsiaal.ai.conf /etc/nginx/sites-available/ruum.sotsiaal.ai
sudo ln -sfn /etc/nginx/sites-available/ruum.sotsiaal.ai /etc/nginx/sites-enabled/ruum.sotsiaal.ai
sudo nginx -t
sudo systemctl reload nginx
sudo certbot certonly --webroot -w /var/www/certbot -d ruum.sotsiaal.ai
sudo nginx -t
sudo systemctl reload nginx
```

The proxy must preserve WebSocket upgrade headers because LiveKit SDK clients connect through secure WebSocket signaling.

## Firewall

LiveKit's official self-hosting docs list these relevant ports:
- TCP 7880: LiveKit API/WebSocket behind a TLS-terminating proxy. Do not expose directly when Nginx terminates TLS.
- TCP 443: public HTTPS/WSS via Nginx.
- TCP 7881: ICE/TCP fallback for WebRTC clients behind restrictive networks.
- UDP 50000-60000: ICE/UDP media candidates; preferred path for WebRTC audio.
- TCP 80: only for Let's Encrypt HTTP-01 challenges and redirect.

Apply UFW rules:

```bash
sudo bash ops/livekit/ufw-rules.sh
```

If Zone/cloud firewall is active, mirror the same inbound rules there:
- allow TCP 80
- allow TCP 443
- allow TCP 7881
- allow UDP 50000-60000

## SotsiaalAI Production Env

Set these values in the app server secret environment, not in Git:

```bash
CALL_PROVIDER=livekit
LIVEKIT_URL=https://ruum.sotsiaal.ai
LIVEKIT_API_KEY=<server_generated_key>
LIVEKIT_API_SECRET=<server_generated_secret>
CALL_MAX_PARTICIPANTS=8
```

Restart the SotsiaalAI app after changing env values.

## Smoke Checks

```bash
curl -I https://ruum.sotsiaal.ai
systemctl status livekit.service
journalctl -u livekit.service -n 100 --no-pager
```

Functional test in SotsiaalAI:
- room member starts a call;
- second and third room members join the same call;
- participants hear each other;
- mic mute/unmute changes the local audio track and server participant state;
- leaving disconnects from LiveKit;
- last participant leaving marks the call ended;
- non-room member cannot get a token;
- browser does not ask for camera permission.
