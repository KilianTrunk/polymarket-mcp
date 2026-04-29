#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';

import { analyzeMarketTool, ingestToDkgTool } from './tools.js';

const server = new Server(
  {
    name: 'polymarket-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

// Define the tools
const tools: Tool[] = [
  {
    name: 'analyze_market',
    description:
      'Analyze a Polymarket for coordination patterns and market manipulation. Ingests findings directly into your DKG context graph Working Memory.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        market_url: {
          type: 'string',
          description:
            'Full Polymarket URL or market ID (e.g., https://polymarket.com/event/...)',
        },
        context_graph_id: {
          type: 'string',
          description:
            'DKG Context Graph ID where results will be ingested (Working Memory)',
        },
      },
      required: ['market_url', 'context_graph_id'],
    },
  },
  {
    name: 'ingest_to_dkg',
    description:
      'Write analysis results as an Assertion into the DKG context graph Working Memory.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        context_graph_id: {
          type: 'string',
          description: 'DKG Context Graph ID where results will be ingested',
        },
        analysis: {
          type: 'object',
          description: 'Analysis result object from analyze_market',
        },
      },
      required: ['context_graph_id', 'analysis'],
    },
  },
];

// List tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools,
}));

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'analyze_market') {
    return await analyzeMarketTool(args as any);
  }

  if (name === 'ingest_to_dkg') {
    return await ingestToDkgTool(args as any);
  }

  return {
    isError: true,
    content: [{ type: 'text', text: `Unknown tool: ${name}` }],
  };
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[polymarket-mcp] Server started on stdio');
}

main().catch((error) => {
  console.error('[polymarket-mcp] Fatal error:', error);
  process.exit(1);
});
