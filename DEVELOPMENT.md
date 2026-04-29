# Development Guide

Quick reference for working on the polymarket-mcp project.

## Project Structure

```
polymarket-mcp/
├── src/
│   ├── index.ts              # MCP server entry point
│   │                         # - Registers tools
│   │                         # - Handles tool calls via CallToolRequestSchema
│   ├── tools.ts              # Tool implementations
│   │                         # - analyzeMarketTool: calls EC2 + ingests to DKG
│   │                         # - ingestToDkgTool: writes assertion to DKG WM
│   ├── dkg-client.ts         # DKG HTTP API wrapper
│   │                         # - POST /api/assertion/create
│   │                         # - GET /api/assertion/:name
│   └── polymarket-client.ts  # EC2 service HTTP client
│                             # - POST /analyze
├── dist/                     # Compiled JavaScript (generated)
├── package.json              # Dependencies & scripts
├── tsconfig.json             # TypeScript config
├── README.md                 # User documentation
├── LICENSE                   # MIT
└── .gitignore
```

## Key Concepts

### MCP (Model Context Protocol)

- **Tools** = functions that Claude/AI can call
- **Transport** = how the AI talks to the server (stdio, HTTP, etc.)
- **Server** = your app that exposes tools

In this project:
- **Server** = `src/index.ts` (listens on stdio)
- **Tools** = `analyze_market`, `ingest_to_dkg`
- **Transport** = stdio (reads from stdin, writes to stdout)

### Data Flow

```
User's DKG / Claude Code
         ↓
    MCP call
         ↓
  src/index.ts (dispatcher)
         ↓
  src/tools.ts (execute)
    ├─ Calls src/polymarket-client.ts
    │  ↓ POST https://ec2.umanitek.io/analyze
    │  ↓ Gets: { risk_score, comments, movers, lunarcrush }
    │
    └─ Calls src/dkg-client.ts
       ↓ POST http://127.0.0.1:9200/api/assertion/create
       ↓ Creates assertion in WM
         ↓
      Returns success message
```

## Commands

### Build

```bash
npm run build
# Compiles src/*.ts → dist/*.js
```

### Run (development)

```bash
npm run dev
# Builds + runs: node dist/index.js
# Server listens on stdio, ready for MCP calls
```

### Test

```bash
npm test
# (Currently placeholder, add tests as needed)
```

### Clean

```bash
npm run clean
# Removes dist/ and tsconfig.tsbuildinfo
```

## Making Changes

### Adding a New Tool

1. **Define the tool** in `src/index.ts` (in the `tools` array):
   ```typescript
   {
     name: 'my_tool',
     description: '...',
     inputSchema: { type: 'object', properties: { ... } }
   }
   ```

2. **Implement** in `src/tools.ts`:
   ```typescript
   export async function myToolTool(args: any) {
     try {
       // ... do work
       return { content: [{ type: 'text', text: '...' }] };
     } catch (error) {
       return { isError: true, content: [{ type: 'text', text: '...' }] };
     }
   }
   ```

3. **Handle** in `src/index.ts`:
   ```typescript
   if (name === 'my_tool') {
     return await myToolTool(args as any);
   }
   ```

### Updating DKG Integration

If the DKG API changes (e.g., `/api/assertion/create` response format):

1. Update `src/dkg-client.ts` types
2. Update response handling in `src/tools.ts`
3. Update test expectations

### Updating EC2 Service Contract

If the analysis service changes (e.g., new fields in response):

1. Update `AnalysisResponse` interface in `src/polymarket-client.ts`
2. Update how results are ingested in `src/tools.ts`
3. Update README example output

## Testing Locally

### Prerequisites

```bash
npm install
npm run build
```

### Test MCP Server Startup

```bash
node dist/index.js
```

Should print:
```
[polymarket-mcp] Server started on stdio
```

If it hangs, that's normal — it's waiting for MCP calls on stdin.

### Test with curl (manual)

You'll need to manually craft MCP protocol messages. This is complex; use a proper MCP client instead.

### Test in Claude Code / Cursor

Add to your MCP config:
```json
{
  "polymarket": {
    "command": "node",
    "args": ["/path/to/polymarket-mcp/dist/index.js"],
    "env": {
      "DKG_API_URL": "http://127.0.0.1:9200",
      "POLYMARKET_API_KEY": "test-key",
      "LUNARCRUSH_API_KEY": "test-key",
      "POLYMARKET_SERVICE_URL": "http://localhost:8000"  # local service
    }
  }
}
```

Then in Claude Code:
```
User: "Call analyze_market with https://polymarket.com/event/... and context_graph_id abc123"
Claude: [invokes tool via MCP]
```

## Environment Variables (Development)

Create `.env` for local testing:

```bash
DKG_API_URL=http://127.0.0.1:9200
POLYMARKET_API_KEY=your-test-key
LUNARCRUSH_API_KEY=your-test-key
POLYMARKET_SERVICE_URL=http://localhost:8000
```

Note: `.env` is in `.gitignore`, so it won't be committed.

## Debugging

### Enable Verbose Logging

The MCP SDK logs to stderr. To see it:

```bash
npm run dev 2>&1
```

Both stdout (MCP protocol) and stderr (logs) will print.

### Add Console Logs

In `src/tools.ts`, we already log to stderr:

```typescript
console.error('[analyze_market] Starting analysis...');
```

These appear in your console/logs but don't interfere with MCP protocol on stdout.

### Check DKG Node Status

```bash
curl http://127.0.0.1:9200/api/status
```

Should return JSON with `peerId`, `networkName`, etc.

## Publishing to npm

When ready to release:

```bash
# 1. Update version in package.json
npm version patch  # or minor/major

# 2. Build
npm run build

# 3. Publish
npm publish
```

The `"publishConfig": { "access": "public" }` in `package.json` ensures it's published as a public package.

## Troubleshooting

### "Cannot find module '@modelcontextprotocol/sdk'"

```bash
npm install
```

### "DKG assertion creation failed"

Check:
1. Is DKG node running? `curl http://127.0.0.1:9200/api/status`
2. Is `DKG_API_URL` correct?
3. Does the context graph exist?

### "Polymarket analysis failed"

Check:
1. Is EC2 service running? `curl https://ec2.umanitek.io/analyze`
2. Is `POLYMARKET_SERVICE_URL` correct?
3. Are `POLYMARKET_API_KEY` and `LUNARCRUSH_API_KEY` valid?

## Further Reading

- [MCP Specification](https://modelcontextprotocol.io/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [DKG V10 API](../../umanitek-polymarket/dkg-v10/packages/cli/skills/dkg-node/SKILL.md)
