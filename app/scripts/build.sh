#!/usr/bin/env bash
set -euo pipefail

app_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
output_dir="$(dirname "$app_dir")/output"

usage() {
  printf 'Usage: %s [--apk|--ipa]\n' "$0"
}

restore_package() {
  cp "$package_backup" "$app_dir/package.json"
  rm "$package_backup"
}

build_apk() {
  command -v pnpm >/dev/null || { printf 'pnpm is required for APK builds.\n' >&2; return 1; }
  command -v java >/dev/null || { printf 'Java is required for APK builds.\n' >&2; return 1; }
  if [[ -z "${ANDROID_HOME:-}" ]]; then
    if [[ "$(uname -s)" == Darwin ]]; then
      export ANDROID_HOME="$HOME/Library/Android/sdk"
    else
      export ANDROID_HOME="$HOME/Android/Sdk"
    fi
  fi
  [[ -d "$ANDROID_HOME" ]] || { printf 'Android SDK not found at %s\n' "$ANDROID_HOME" >&2; return 1; }

  package_backup="$(mktemp)"
  cp "$app_dir/package.json" "$package_backup"
  trap restore_package EXIT
  pnpm exec expo prebuild --clean --platform android --no-install
  restore_package
  trap - EXIT
  (cd android && ./gradlew :app:assembleRelease --no-daemon --console=plain)
  cp android/app/build/outputs/apk/release/app-release.apk "$output_dir/Triton-$version.apk"
  printf 'APK: %s\n' "$output_dir/Triton-$version.apk"
}

build_ipa() {
  command -v npx >/dev/null || { printf 'npx is required for IPA builds.\n' >&2; return 1; }
  command -v curl >/dev/null || { printf 'curl is required for IPA builds.\n' >&2; return 1; }
  command -v unzip >/dev/null || { printf 'unzip is required for IPA builds.\n' >&2; return 1; }
  npx eas-cli@latest build --platform ios --profile preview --wait

  local archive_url temporary_ipa
  archive_url="$(npx eas-cli@latest build:list --platform ios --build-profile preview --status finished --limit 1 --json | node -e 'const builds = JSON.parse(require("node:fs").readFileSync(0, "utf8")); const url = builds[0]?.artifacts?.buildUrl; if (!url || !new URL(url).pathname.endsWith(".ipa")) { console.error("EAS did not return an IPA URL."); process.exit(1); } process.stdout.write(url)')"
  temporary_ipa="$(mktemp "$output_dir/.Triton.XXXXXX")"
  if ! curl --fail --location --output "$temporary_ipa" "$archive_url"; then
    rm "$temporary_ipa"
    return 1
  fi
  if ! unzip -tq "$temporary_ipa" >/dev/null; then
    rm "$temporary_ipa"
    printf 'Downloaded IPA is invalid.\n' >&2
    return 1
  fi
  mv "$temporary_ipa" "$output_dir/Triton-$version.ipa"
  printf 'IPA: %s\n' "$output_dir/Triton-$version.ipa"
}

if (( $# > 1 )); then
  usage >&2
  exit 2
fi

case "${1:-}" in
  '') do_apk=true; do_ipa=true ;;
  --apk) do_apk=true; do_ipa=false ;;
  --ipa) do_apk=false; do_ipa=true ;;
  --help|-h) usage; exit 0 ;;
  *) usage >&2; exit 2 ;;
esac

command -v node >/dev/null || { printf 'Node.js is required.\n' >&2; exit 1; }
cd "$app_dir"
version="$(node -p "require('./package.json').version")"
mkdir -p "$output_dir"

if [[ "$do_apk" == true ]]; then build_apk; fi
if [[ "$do_ipa" == true ]]; then build_ipa; fi
