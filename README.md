# @kiliantrunk/polymarket-mcp

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
- Configure MCP to use your local DKG node
- Point to the live Polymarket analysis service on EC2
- Spawn this MCP server process
- Wire it into your node

**Note:** API keys (POLYMARKET_API_KEY, LUNARCRUSH_API_KEY) are used by the EC2 service, not by this MCP. They're already configured on the service.

### Via npm

```bash
npm install -g @kiliantrunk/polymarket-mcp
```

Set env vars:

```bash
export DKG_API_URL=http://127.0.0.1:9200
export POLYMARKET_SERVICE_URL=http://ec2-3-127-230-231.eu-central-1.compute.amazonaws.com:8000

polymarket-mcp
```

### From source (for development)

```bash
git clone https://github.com/KilianTrunk/polymarket-mcp.git
cd polymarket-mcp
npm install
npm run build

# Set env vars
export DKG_API_URL=http://127.0.0.1:9200
export POLYMARKET_SERVICE_URL=http://ec2-3-127-230-231.eu-central-1.compute.amazonaws.com:8000

# Run
npm run dev
```

That's it! The MCP only needs to know:
- Where your local DKG node is (`DKG_API_URL`)
- Where the analysis service is (`POLYMARKET_SERVICE_URL`)

### Via Claude Code / Cursor

Add to your MCP config:

```json
{
  "mcpServers": {
    "polymarket": {
      "command": "npx",
      "args": ["-y", "@kiliantrunk/polymarket-mcp@latest"],
      "env": {
        "DKG_API_URL": "http://127.0.0.1:9200",
        "POLYMARKET_SERVICE_URL": "http://ec2-3-127-230-231.eu-central-1.compute.amazonaws.com:8000"
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
  "market_id": "next-french-presidential-election",
  "market_url": "https://polymarket.com/event/next-french-presidential-election",
  "analysis": {
    "market": {
      "id": "79987",
      "title": "Next French Presidential Election",
      "liquidity": 4875104.08,
      "volume": 54207765.07,
      "outcomes": ["Yes", "No"]
    },
    "risk_score": 3.2,
    "risk_level": "normal",
    "market_movers": [
      {
        "wallet": "0xa5ef39c3d3e10d0b27...",
        "outcome": "No",
        "shares": 229541.0999,
        "exposure_usd": 228508.16
      }
    ],
    "bot_activity": {
      "coordination_score": 9.0,
      "flagged_accounts": [],
      "clusters": []
    },
    "social_context": {
      "interactions_24h": 0,
      "posts_active": 0,
      "sentiment": {}
    }
  },
  "analyzed_at": "2026-04-29T09:54:03.431760"
}
```

Results are automatically ingested as an Assertion in your Working Memory with the complete analysis graph.

### `ingest_to_dkg`

Writes analysis results to DKG (called automatically by `analyze_market`).

**Parameters:**
- `context_graph_id` (string): Target context graph
- `analysis` (object): Analysis result object

## Environment Variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `DKG_API_URL` | Yes | `http://127.0.0.1:9200` | Your local DKG V10 node API endpoint |
| `POLYMARKET_SERVICE_URL` | No | `http://ec2-3-127-230-231.eu-central-1.compute.amazonaws.com:8000` | Umanitek's analysis service endpoint (EC2) |

**Note:** `POLYMARKET_API_KEY` and `LUNARCRUSH_API_KEY` are used by the EC2 service only, not by this MCP. They're already configured on the service.

## Getting Started (Local Testing)

See [E2E_TEST_GUIDE.md](../../docs/dkg-v10-polymarket-integration/E2E_TEST_GUIDE.md) for complete setup instructions to test locally with DKG V10.

## Development

### Build

```bash
npm run build
```

### Run locally

```bash
npm run dev
```

Verify with:
```bash
curl http://localhost:8000/health
```

### Test

```bash
npm test
```

## Architecture

```
┌──────────────────────────────────────────────┐
│  DKG V10 Node (local)                        │
│  http://127.0.0.1:9200                       │
│  • Node UI                                   │
│  • Working Memory                            │
│  • Context Graphs                            │
└─────────────┬────────────────────────────────┘
              │ (MCP call via DKG daemon)
              ▼
     ┌────────────────────────┐
     │  polymarket-mcp        │
     │  (this package)        │
     │                        │
     │ • analyze_market()     │
     │ • ingest_to_dkg()      │
     └───────┬──────┬─────────┘
             │      │
    ┌────────▼──┐   └──────────────────────┐
    │            │                         │
    ▼            ▼                         ▼
┌───────────────────────┐    ┌──────────────────────┐
│  Polymarket EC2 API   │    │  DKG V10 API         │
│  Port 8000            │    │  /api/assertion      │
│  /analyze endpoint    │    │  /create             │
│ (runs full analysis   │    │                      │
│  pipeline + reports)  │    │  (stores in WM)      │
└───────────────────────┘    └──────────────────────┘
        │                             │
        ▼                             ▼
   Full analysis JSON           Knowledge Assertion
   (risk score, movers,        (queryable in DKG UI)
    bot clusters, social)
```

## Data Flow

1. **User** opens DKG V10 UI → Integrations → Polymarket Analysis
2. **User** enters market URL + context graph ID
3. **DKG daemon** spawns this MCP server process
4. **MCP server** receives `analyze_market(market_url, context_graph_id)` call
5. **MCP server** POSTs to `POLYMARKET_SERVICE_URL/analyze` with market_url
   - Endpoint: `http://ec2-3-127-230-231.eu-central-1.compute.amazonaws.com:8000/analyze`
6. **EC2 service** runs full analysis pipeline:
   - Fetches market data from Polymarket
   - Analyzes comments (243+ comments for active markets)
   - Detects bot coordination patterns
   - Resolves top 10 market movers
   - Fetches LunarCrush social metrics
   - Calculates risk score and finds suspicious activity
7. **EC2 service** returns comprehensive JSON analysis report
8. **MCP server** POSTs results to `DKG_API_URL/api/assertion/create`
   - Endpoint: `http://127.0.0.1:9200/api/assertion/create`
9. **DKG node** creates Knowledge Assertion in user's Working Memory
10. **User opens** DKG Memory Explorer → sees new assertion with full analysis
11. **User can** query, share, or publish results via DKG governance

## Registry Entry & Installation for Users

This package is registered in the [DKG Integrations Registry](https://github.com/OriginTrail/dkg-integrations):

```json
{
  "slug": "polymarket-analysis",
  "name": "Polymarket Analysis Bot",
  "description": "Analyzes Polymarket events for bot coordination, misinformation, and market manipulation signals. Ingests findings to your DKG Working Memory.",
  "author": "Umanitek",
  "repository": "https://github.com/KilianTrunk/polymarket-mcp",
  "install": {
    "kind": "mcp",
    "command": "npx",
    "args": ["-y", "@kiliantrunk/polymarket-mcp@latest"]
  },
  "envDefaults": {
    "DKG_API_URL": "http://127.0.0.1:9200",
    "POLYMARKET_SERVICE_URL": "http://ec2-3-127-230-231.eu-central-1.compute.amazonaws.com:8000"
  }
}
```

**No additional credentials needed!** The analysis service (EC2) already has all required API keys configured.

**For End Users:**

Once registered, installation is one command:

```bash
dkg integrations add polymarket-analysis
```

The DKG CLI will:
1. Download latest `@kiliantrunk/polymarket-mcp` from npm
2. Configure the MCP to point to your local DKG node
3. Set the analysis service endpoint to Umanitek's EC2
4. Spawn the service automatically

**No API keys to enter!** Everything is already configured.

Then access via:
- **DKG UI**: http://127.0.0.1:9200/ui → Integrations → Polymarket Analysis
- **CLI**: `dkg tools call analyze_market --url "..." --context-graph-id "..."`
- **Claude Code**: Works with MCP config (see Installation section)

## Security

- **Read-only** against DKG node (no admin token required)
- **Assertions written only** to the user's selected context graph
- **Network access** limited to Polymarket, LunarCrush, and your EC2 service
- **Credentials** passed via env vars, never logged

## License

MIT

## Status & Support

✅ **Production Ready** — Tested with DKG V10, EC2 API live and operational

- **Repository**: https://github.com/KilianTrunk/polymarket-mcp
- **Issues**: [GitHub Issues](https://github.com/KilianTrunk/polymarket-mcp/issues)
- **Docs**: 
  - [Complete E2E Testing Guide](https://github.com/KilianTrunk/umanitek-polymarket/blob/main/docs/dkg-v10-polymarket-integration/E2E_TEST_GUIDE.md)
  - [Umanitek Integration Guide](https://github.com/KilianTrunk/umanitek-polymarket/tree/main/docs/dkg-v10-polymarket-integration)
  - [API Deployment Details](https://github.com/KilianTrunk/umanitek-polymarket/blob/main/docs/API_DEPLOYMENT.md)

- **API Service**: http://ec2-3-127-230-231.eu-central-1.compute.amazonaws.com:8000
  - Health check: `GET /health`
  - Analyze endpoint: `POST /analyze`
  - Swagger UI: `GET /docs`

## What Gets Ingested to DKG

Each analysis creates a rich Knowledge Assertion in your Working Memory containing:

- **Market metadata** — Event ID, title, liquidity, volume, outcomes
- **Risk assessment** — Risk score (0–100), risk level, confidence statement
- **Market movers** — Top 10+ holders with wallet addresses, exposure USD, shares, position
- **Bot activity** — Coordination patterns, flagged accounts, suspicious clusters, timeline
- **Social context** — LunarCrush metrics, sentiment by platform, top posts, creators, amplification
- **Evidence** — Key findings, recommended actions, narrative analysis
- **Relationships** — Links between market movers and suspicious comments

You can then:
- **Query** via SPARQL in DKG Memory Explorer
- **Govern** via consensus protocols
- **Share** with context graph stakeholders
- **Publish** to Verified Memory (on-chain via Knowledge Asset)

---

**Built for DKG V10.** Production-ready. [Get started →](../../docs/dkg-v10-polymarket-integration/E2E_TEST_GUIDE.md)
