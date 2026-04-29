/**
 * MCP Tool Implementations
 * - analyze_market: Calls EC2 service and ingests results to DKG
 * - ingest_to_dkg: Writes analysis to DKG Working Memory
 */

import { DkgClient } from './dkg-client.js';
import { PolymarketClient, AnalysisResponse } from './polymarket-client.js';

const dkg = new DkgClient();
const polymarket = new PolymarketClient();

export async function analyzeMarketTool(args: {
  market_url: string;
  context_graph_id: string;
}): Promise<{
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}> {
  try {
    console.error(
      `[analyze_market] Starting analysis for: ${args.market_url} → ${args.context_graph_id}`
    );

    // 1. Call EC2 service to analyze
    const analysis = await polymarket.analyzeMarket({
      market_url: args.market_url,
    });

    console.error(`[analyze_market] Got analysis result: risk_score=${analysis.risk_score}`);

    // 2. Ingest to DKG
    await ingestToDkgTool({
      context_graph_id: args.context_graph_id,
      analysis,
    });

    const summary = `✓ **Market Analyzed**

**Risk Score:** ${analysis.risk_score}/100
**Suspicious Comments:** ${analysis.suspicious_comment_count}
**Market Movers:** ${analysis.market_movers.length}
**LunarCrush Amplification:** ${analysis.lunarcrush_overlap.amplification_score.toFixed(2)}

Results ingested to your DKG Working Memory. You can:
- Query them in SPARQL
- Share with team via SWM promotion
- Anchor on-chain via VM publication`;

    return {
      content: [
        {
          type: 'text',
          text: summary,
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[analyze_market] Error:`, errorMessage);

    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: `**Error analyzing market:** ${errorMessage}`,
        },
      ],
    };
  }
}

export async function ingestToDkgTool(args: {
  context_graph_id: string;
  analysis: AnalysisResponse;
}): Promise<{
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}> {
  try {
    console.error(
      `[ingest_to_dkg] Ingesting analysis to context graph: ${args.context_graph_id}`
    );

    const assertionName = `polymarket-analysis-${args.analysis.market_id}-${Date.now()}`;

    // Create assertion in Working Memory
    const result = await dkg.createAssertion({
      name: assertionName,
      context: args.context_graph_id,
      visibility: 'WM',
      content: {
        '@context': 'https://ontology.dkg.io/polymarket',
        '@type': 'PolymarketAnalysis',
        marketId: args.analysis.market_id,
        marketUrl: args.analysis.market_url,
        riskScore: args.analysis.risk_score,
        suspiciousCommentCount: args.analysis.suspicious_comment_count,
        suspiciousComments: args.analysis.suspicious_comments,
        marketMovers: args.analysis.market_movers,
        lunarcrushOverlap: args.analysis.lunarcrush_overlap,
        analyzedAt: args.analysis.analyzed_at,
      },
    });

    console.error(`[ingest_to_dkg] Success: ${result.assertionUri}`);

    return {
      content: [
        {
          type: 'text',
          text: `✓ **Assertion Created**\n\nURI: \`${result.assertionUri}\`\n\nVisible in your project's **Working Memory**. You can promote it to Shared Memory or publish to Verified Memory from the DKG UI.`,
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[ingest_to_dkg] Error:`, errorMessage);

    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: `**Ingestion failed:** ${errorMessage}`,
        },
      ],
    };
  }
}
