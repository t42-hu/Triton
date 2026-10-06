# Automatic public domain with Cloudflare Tunnel

The starter can provision its own remotely managed Cloudflare Tunnel, ingress configuration, tunnel token, and proxied DNS record. You do not need to create a tunnel or DNS record manually.

## One-time Cloudflare preparation

Your purchased domain must already appear as an **active** zone in Cloudflare and use the nameservers Cloudflare assigned to it.

Create one scoped Cloudflare API token with these permissions:

- Account → Cloudflare Tunnel → Edit (shown as Cloudflare One Connectors Write on some accounts)
- Zone → Zone → Read
- Zone → DNS → Edit

Restrict the token to the account and zone used by this application. Copy the Account ID from the Cloudflare dashboard's account overview.

The API token is necessary because an ordinary tunnel run token can start an existing tunnel, but it cannot create the tunnel, configure its public hostname, or create DNS. The starter retrieves the narrower runtime token automatically and never prints it.

## Configuration

Put these values in `.env`:

```dotenv
APP_DOMAIN=xy.com
CLOUDFLARE_ACCOUNT_ID=your-32-character-account-id
CLOUDFLARE_API_TOKEN=your-scoped-api-token
```

`APP_DOMAIN` must be a hostname without `https://` or a path. Both apex domains (`xy.com`) and subdomains (`app.xy.com`) are supported.

If development and production should be reachable simultaneously, use separate hostnames:

```dotenv
DEV_APP_DOMAIN=dev.xy.com
PROD_APP_DOMAIN=xy.com
CLOUDFLARE_ACCOUNT_ID=your-32-character-account-id
CLOUDFLARE_API_TOKEN=your-scoped-api-token
```

The per-environment variables override `APP_DOMAIN`. Custom tunnel names are optional:

```dotenv
DEV_CLOUDFLARE_TUNNEL_NAME=my-product-dev
PROD_CLOUDFLARE_TUNNEL_NAME=my-product-prod
```

## Development

Start the entire development stack and publish it:

```bash
pnpm dev:tunnel:up
```

Reach it at `https://$DEV_APP_DOMAIN`, or `https://$APP_DOMAIN` when no development override is set.

Stop it:

```bash
pnpm dev:tunnel:down
```

## Production

Build, start, wait for health checks, provision Cloudflare, and publish production:

```bash
pnpm prod:tunnel:up
```

Reach it at `https://$PROD_APP_DOMAIN`, or `https://$APP_DOMAIN` when no production override is set.

Stop it:

```bash
pnpm prod:tunnel:down
```

## What happens automatically

Every tunnel start is idempotent:

1. The setup container validates the domain and Cloudflare credentials.
2. It finds the active Cloudflare zone that owns the hostname.
3. It creates or reuses a dedicated remotely managed tunnel.
4. It configures the hostname to forward to the internal Nginx proxy.
5. It replaces only web-routing records previously marked as managed by this starter. If an unmanaged `A`, `AAAA`, or `CNAME` already owns the hostname, setup stops without deleting it. Remove or move that record deliberately, then start the tunnel again.
6. It retrieves the tunnel's runtime token into a private Docker volume that is mounted read-only into cloudflared.
7. cloudflared starts only after setup succeeds and the local proxy is healthy.

Cloudflare handles public TLS automatically. No inbound router port, public IP, certificate, tunnel dashboard configuration, or manual DNS record is required.

## Troubleshooting

Show provisioning output:

```bash
pnpm prod:tunnel:logs
```

Common failures:

- **No active zone matches the domain:** finish adding the domain to Cloudflare and activate its assigned nameservers.
- **API error 9109 or permission denied:** recreate the token with Tunnel Edit, Zone Read, and DNS Edit permissions.
- **Hostname opens the wrong environment:** do not run development and production on the same hostname simultaneously; use `DEV_APP_DOMAIN` and `PROD_APP_DOMAIN`.
- **Conflicting DNS record:** setup refuses to delete unmanaged `A`, `AAAA`, or `CNAME` records. Remove or move the conflicting record deliberately, then start the tunnel again.
