# @umanitek/polymarket-mcp

**Polymarket Analysis Bot** — MCP server for DKG V10

Analyzes Polymarket markets for coordination patterns, bot behavior, and off-platform amplification. Ingests findings directly into your DKG context graph's Working Memory.

## What It Does

1. **Analyzes** a Polymarket market for:
   - Risk score (0–100)
   - Suspicious comment patterns
   - Top market movers and exposure
   - LunarCrush social media overlaps

2. **Ingests** results as a **Knowledge Assertion** into your DKG Working Memory

3. **Enables** querying, sharing, and on-chain publishing via DKG governance

## Installation

### Prerequisites

- A running DKG V10 node (`dkg start`)
- Node.js 18+

### Via DKG CLI

```bash
dkg integration install polymarket-analysis
```

The installer will:
- Prompt for `POLYMARKET_API_KEY` and `LUNARCRUSH_API_KEY`
- Spawn this MCP server process
- Wire it into your node

### Via npm (for development)

```bash
npm install -g @umanitek/polymarket-mcp
polymarket-mcp
```

Set env vars:

```bash
export DKG_API_URL=http://127.0.0.1:9200
export POLYMARKET_API_KEY=your-key
export LUNARCRUSH_API_KEY=your-key
export POLYMARKET_SERVICE_URL=https://ec2.umanitek.io  # or your service URL
```

### Via Claude Code / Cursor

Add to your MCP config:

```json
{
  "mcpServers": {
    "polymarket": {
      "command": "npx",
      "args": ["-y", "@umanitek/polymarket-mcp@latest"],
      "env": {
        "DKG_API_URL": "http://127.0.0.1:9200",
        "POLYMARKET_API_KEY": "...",
        "LUNARCRUSH_API_KEY": "...",
        "POLYMARKET_SERVICE_URL": "https://ec2.umanitek.io"
      }
    }
  }
}
```

## Usage

### Via Claude Code

```
User: "Analyze polymarket #12345"
Claude: [calls analyze_market tool]
Result: Analysis ingests to your DKG WM
```

### Via DKG CLI

```bash
dkg call polymarket:analyze_market \
  market_url="https://polymarket.com/event/..." \
  context_graph_id="your-context-graph-id"
```

### Via DKG UI

1. Open http://127.0.0.1:9200/ui
2. Left sidebar → Integrations → Polymarket Analysis
3. Input form: paste market URL
4. Click "Analyze"
5. Results appear in your project's Working Memory

## Tools

### `analyze_market`

Analyzes a Polymarket and ingests findings to DKG.

**Parameters:**
- `market_url` (string): Full Polymarket URL or market ID
- `context_graph_id` (string): DKG context graph where results are stored

**Returns:**
```json
{
  "market_id": "12345",
  "risk_score": 42,
  "suspicious_comment_count": 15,
  "market_movers": [...],
  "lunarcrush_overlap": {...}
}
```

Results are automatically ingested as an Assertion in your Working Memory.

### `ingest_to_dkg`

Writes analysis results to DKG (called automatically by `analyze_market`).

**Parameters:**
- `context_graph_id` (string): Target context graph
- `analysis` (object): Analysis result object

## Environment Variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `DKG_API_URL` | Yes | `http://127.0.0.1:9200` | Local DKG node API |
| `POLYMARKET_API_KEY` | Yes | — | Polymarket API key |
| `LUNARCRUSH_API_KEY` | Yes | — | LunarCrush API key |
| `POLYMARKET_SERVICE_URL` | No | `https://ec2.umanitek.io` | Analysis service endpoint |

## Development

### Build

```bash
npm run build
```

### Run locally

```bash
npm run dev
```

### Test

```bash
npm test
```

## Architecture

```
┌─────────────────────────────────────────┐
│  DKG V10 Node / Claude Code / CLI       │
└────────────────┬────────────────────────┘
                 │ (MCP call)
                 ▼
        ┌─────────────────────┐
        │  polymarket-mcp     │
        │  (this package)     │
        │                     │
        │ • analyze_market    │
        │ • ingest_to_dkg     │
        └────────┬────────────┘
                 │
        ┌────────┴──────────────────────┐
        │                               │
        ▼                               ▼
   ┌──────────────┐            ┌────────────────┐
   │  Polymarket  │            │  DKG V10 API   │
   │  EC2 Service │            │  /api/assertion│
   │  /analyze    │            │  /create       │
   └──────────────┘            └────────────────┘
        │                               │
        ▼                               ▼
   analysis JSON           Working Memory
   (main.py pipeline)      (stored in local
   runs on your EC2        context graph)
```

## Data Flow

1. **User calls** `analyze_market(market_url, context_graph_id)`
2. **MCP server** POSTs to `POLYMARKET_SERVICE_URL/analyze` with market_url
3. **EC2 service** (your main.py wrapper) returns JSON analysis
4. **MCP server** POSTs to `DKG_API_URL/api/assertion/create` with results
5. **DKG node** stores assertion in user's WM
6. **User opens** DKG UI → sees new assertion in their project

## Registry Entry

This package is registered in the [DKG Integrations Registry](https://github.com/OriginTrail/dkg-integrations):

```json
{
  "slug": "polymarket-analysis",
  "name": "Polymarket Analysis Bot",
  "install": {
    "kind": "mcp",
    "command": "npx",
    "args": ["-y", "@umanitek/polymarket-mcp@1.0.0"],
    "envRequired": ["DKG_API_URL", "POLYMARKET_API_KEY", "LUNARCRUSH_API_KEY"]
  }
}
```

Users discover this via `dkg integration list` or the DKG UI.

## Security

- **Read-only** against DKG node (no admin token required)
- **Assertions written only** to the user's selected context graph
- **Network access** limited to Polymarket, LunarCrush, and your EC2 service
- **Credentials** passed via env vars, never logged

## License

MIT

## Support

- Issues: [GitHub Issues](https://github.com/KilianTrunk/polymarket-mcp/issues)
- Docs: [Umanitek Integration Guide](https://github.com/KilianTrunk/umanitek-polymarket/tree/main/docs/dkg-v10-polymarket-integration)

---

**Built for DKG V10.** Start analyzing.
