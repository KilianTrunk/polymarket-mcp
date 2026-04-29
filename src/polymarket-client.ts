/**
 * Polymarket Analysis Service Client
 * Calls the EC2 service that runs the Umanitek analysis pipeline
 */

export interface AnalysisRequest {
  market_url: string;
}

export interface AnalysisResponse {
  market_id: string;
  market_url: string;
  analysis?: Record<string, any>;
  risk_score?: number;
  suspicious_comment_count?: number;
  suspicious_comments?: Array<{
    author: string;
    text: string;
    likes: number;
  }>;
  market_movers?: Array<{
    address: string;
    balance: string;
    position: string;
  }>;
  lunarcrush_overlap?: {
    mentioned_creators: string[];
    amplification_score: number;
  };
  analyzed_at: string;
}

export class PolymarketClient {
  private serviceUrl: string;

  constructor(serviceUrl?: string) {
    this.serviceUrl =
      serviceUrl || process.env.POLYMARKET_SERVICE_URL || 'https://ec2.umanitek.io';
  }

  async analyzeMarket(request: AnalysisRequest): Promise<AnalysisResponse> {
    const url = `${this.serviceUrl}/analyze`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Polymarket analysis failed: ${response.status} ${response.statusText}. ${errorText}`
      );
    }

    const data = await response.json();
    return data as AnalysisResponse;
  }
}
