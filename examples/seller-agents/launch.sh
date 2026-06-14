#!/usr/bin/env bash
#
# Launch the agent-to-agent marketplace demo:
#   1. starts both LLM seller agents (each = LLM backend + ChainPe x402 proxy)
#   2. waits for them to be healthy
#   3. (REGISTER=1) registers each on-chain with its ERC-8004 agentId
#   4. (ORCHESTRATE=1) runs the buyer orchestrator that hires + pays both
#
# Prereqs: build the workspace packages once from the repo root
#   (npm install && npm run build), then `npm install` here, and fill in .env.
#
# Mint the seller identities first (one-time), then put the ids in .env:
#   SELLER_KEY=$RESEARCH_PAYTO_KEY node mint-identity.mjs   # → RESEARCH_AGENT_ID
#   SELLER_KEY=$DIGEST_PAYTO_KEY   node mint-identity.mjs   # → DIGEST_AGENT_ID
set -euo pipefail
cd "$(dirname "$0")"

[ -f .env ] && set -a && . ./.env && set +a

RESEARCH_PROXY_PORT="${RESEARCH_PROXY_PORT:-4501}"
DIGEST_PROXY_PORT="${DIGEST_PROXY_PORT:-4502}"

pids=()
cleanup() {
  echo ""
  echo "Shutting down seller agents…"
  for pid in "${pids[@]:-}"; do kill "$pid" 2>/dev/null || true; done
}
trap cleanup EXIT INT TERM

wait_healthy() {
  local url="$1" name="$2"
  for _ in $(seq 1 30); do
    if curl -fsS "$url/health" >/dev/null 2>&1; then echo "  ✓ $name healthy"; return 0; fi
    sleep 1
  done
  echo "  ✗ $name did not become healthy at $url" >&2
  return 1
}

echo "Starting seller agents…"
node research-agent.mjs &
pids+=($!)
node news-digest-agent.mjs &
pids+=($!)

wait_healthy "http://localhost:${RESEARCH_PROXY_PORT}" "research-agent"
wait_healthy "http://localhost:${DIGEST_PROXY_PORT}" "news-digest-agent"

if [ "${REGISTER:-0}" = "1" ]; then
  echo ""
  echo "Registering sellers on-chain…"
  SELLER_KEY="${RESEARCH_PAYTO_KEY:?set RESEARCH_PAYTO_KEY to register}" \
  SELLER_NAME="${RESEARCH_NAME:-Research Agent}" \
  SELLER_ENDPOINT="${RESEARCH_PUBLIC_URL:-http://localhost:${RESEARCH_PROXY_PORT}}" \
  SELLER_PAYTO="${RESEARCH_PAYTO}" SELLER_TAGS="ai,research,agent" \
  SELLER_PRICE="${RESEARCH_PRICE:-0.01}" SELLER_AGENT_ID="${RESEARCH_AGENT_ID:-0}" \
    node register-seller.mjs

  SELLER_KEY="${DIGEST_PAYTO_KEY:?set DIGEST_PAYTO_KEY to register}" \
  SELLER_NAME="${DIGEST_NAME:-News Digest Agent}" \
  SELLER_ENDPOINT="${DIGEST_PUBLIC_URL:-http://localhost:${DIGEST_PROXY_PORT}}" \
  SELLER_PAYTO="${DIGEST_PAYTO}" SELLER_TAGS="ai,news,summarize,agent" \
  SELLER_PRICE="${DIGEST_PRICE:-0.01}" SELLER_AGENT_ID="${DIGEST_AGENT_ID:-0}" \
    node register-seller.mjs
fi

echo ""
echo "Sellers are live:"
echo "  research → http://localhost:${RESEARCH_PROXY_PORT}/research"
echo "  digest   → http://localhost:${DIGEST_PROXY_PORT}/summarize"

if [ "${ORCHESTRATE:-0}" = "1" ]; then
  echo ""
  echo "Running buyer orchestrator…"
  node orchestrator.mjs "${TOPIC:-On-chain agent payments on Avalanche in 2026}"
else
  echo ""
  echo "Run the buyer (in another shell):  npm run orchestrate -- \"your topic\""
  echo "Press Ctrl+C to stop the sellers."
  wait
fi
