#!/usr/bin/env bash
set -eu
cd "$(dirname "$0")"

if [[ ! -f .env ]]; then
    node infrastructure/setup.mjs init
fi

node --input-type=module <<'NODE'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { parseEnv } from 'node:util'

const path = '.env'
const current = readFileSync(path, 'utf8')
const updated = /^STATSD_ENABLED=/m.test(current)
    ? current.replace(/^STATSD_ENABLED=.*$/gm, 'STATSD_ENABLED=true')
    : `${current.replace(/\n?$/, '\n')}STATSD_ENABLED=true\n`
if (updated !== current) writeFileSync(path, updated)
mkdirSync(parseEnv(updated).STATSD_DATA_DIR || './statsd', { recursive: true, mode: 0o700 })
NODE

agent="$(node infrastructure/statsd.mjs)"
if [[ -z "$agent" ]]; then
    STATSD_ENABLED=true node infrastructure/compose.mjs development up --no-deps --detach --wait statsd
    agent="$(node infrastructure/statsd.mjs)"
fi
if [[ -z "$agent" ]]; then
    echo 'System Stats did not start.' >&2
    exit 1
fi

if ! status="$(docker exec "$agent" /app/statsd status 2>&1)"; then
    printf '%s\n' "$status" >&2
    exit 1
fi
if [[ "$status" == *'AUTHORIZATION: Authorized'* ]]; then
    echo 'System Stats is already paired.'
    exit 0
fi
if [[ "$status" != *'AUTHORIZATION: Not Authorized'* ]]; then
    printf 'Could not determine System Stats authorization state:\n%s\n' "$status" >&2
    exit 1
fi

# The agent expires unused device codes after about five minutes. Restarting an
# unpaired agent requests a fresh code without removing its local configuration.
restart_since="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
docker restart "$agent"

latest_pairing_url() {
    node -e "
let input = ''
process.stdin.on('data', (chunk) => { input += chunk })
process.stdin.on('end', () => {
    const urls = [...input.matchAll(/https:\/\/[^\s\x1b]+/g)]
    for (const match of urls.reverse()) {
        try {
            const url = new URL(match[0])
            if (url.hostname === 'system-stats.com' || url.hostname.endsWith('.system-stats.com')) {
                process.stdout.write(url.href)
                return
            }
        } catch {}
    }
})
"
}

pairing_url=''
for attempt in {1..10}; do
    if ! logs="$(docker logs --since "$restart_since" --tail 20 "$agent" 2>&1)"; then
        printf '%s\n' "$logs" >&2
        exit 1
    fi
    pairing_url="$(printf '%s\n' "$logs" | latest_pairing_url)"
    if [[ -n "$pairing_url" ]]; then
        printf '%s\n' "$logs"
        break
    fi
    sleep 1
done

if [[ -z "$pairing_url" ]]; then
    printf '%s\n' "$logs" >&2
    echo 'No fresh System Stats pairing link appeared. Check pnpm dev:logs statsd.' >&2
    exit 1
fi

if [[ "$(uname -s)" == Darwin ]]; then
    if ! open "$pairing_url"; then
        echo 'Could not open the browser. Use the System Stats pairing link shown above.' >&2
    fi
elif command -v xdg-open >/dev/null 2>&1; then
    if ! xdg-open "$pairing_url"; then
        echo 'Could not open the browser. Use the System Stats pairing link shown above.' >&2
    fi
else
    echo 'Open the System Stats pairing link shown above in your browser.'
fi
