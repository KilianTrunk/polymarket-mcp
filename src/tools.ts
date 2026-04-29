/**
 * MCP Tool Implementations
 * - analyze_market: Calls EC2 service and ingests results to DKG
 * - ingest_to_dkg: Writes analysis to DKG Working Memory
 */

import { DkgClient } from './dkg-client.js';
import { PolymarketClient, AnalysisResponse } from './polymarket-client.js';

const dkg = new DkgClient();
const polymarket = new PolymarketClient();

function reportFromAnalysis(analysis: AnalysisResponse): Record<string, any> {
  return analysis.analysis && typeof analysis.analysis === 'object' ? analysis.analysis : analysis as any;
}

function graphQuadsFromReport(report: Record<string, any>): unknown[] {
  const graph = report.dkg_graph;
  if (!graph || typeof graph !== 'object' || !Array.isArray(graph.quads)) return [];
  return graph.quads;
}

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

    const report = reportFromAnalysis(analysis);
    console.error(`[analyze_market] Got analysis result: risk_score=${report.risk_score ?? analysis.risk_score ?? 0}`);

    // 2. Ingest to DKG
    await ingestToDkgTool({
      context_graph_id: args.context_graph_id,
      analysis,
    });

    const summary = `✓ **Market Analyzed**

**Risk Score:** ${report.risk_score ?? analysis.risk_score ?? 0}/100
**Suspicious Comments:** ${report.suspicious_comment_count ?? analysis.suspicious_comment_count ?? 0}
**Market Movers:** ${(report.market_movers ?? analysis.market_movers ?? []).length}
**Graph Quads:** ${graphQuadsFromReport(report).length}
**LunarCrush Amplification:** ${Number((report.lunarcrush_overlap ?? analysis.lunarcrush_overlap ?? {}).amplification_score ?? 0).toFixed(2)}

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
    const report = reportFromAnalysis(args.analysis);
    const graphQuads = graphQuadsFromReport(report);

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
        riskScore: report.risk_score ?? args.analysis.risk_score,
        suspiciousCommentCount: report.suspicious_comment_count ?? args.analysis.suspicious_comment_count,
        suspiciousComments: report.suspicious_comments ?? args.analysis.suspicious_comments ?? [],
        marketMovers: report.market_movers ?? args.analysis.market_movers ?? [],
        lunarcrushOverlap: report.lunarcrush_overlap ?? args.analysis.lunarcrush_overlap ?? {},
        dkgGraphQuads: graphQuads,
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
