#!/usr/bin/env bash
# One-shot health check for the live AI-MVP backend.
# Usage:  bash scripts/healthcheck.sh  [base_url]
# Default base_url = https://ai-mvp-psi.vercel.app
set -euo pipefail
unset SSL_CERT_FILE 2>/dev/null || true   # macOS curl quirk

BASE="${1:-https://ai-mvp-psi.vercel.app}"
URL="$BASE/api/health"

echo "🔎 检查 $URL"
body="$(curl -s -m 30 -w $'\n%{http_code}' "$URL")" || { echo "❌ 请求失败(网络/部署问题)"; exit 1; }
code="$(printf '%s' "$body" | tail -1)"
json="$(printf '%s' "$body" | sed '$d')"

if command -v jq >/dev/null 2>&1; then
  printf '%s' "$json" | jq .
else
  printf '%s\n' "$json"
fi

if [ "$code" = "200" ]; then
  echo "✅ 全绿,后端健康"
else
  echo "🔴 HTTP $code — 后端有问题,看上面 detail 字段"
  exit 1
fi
