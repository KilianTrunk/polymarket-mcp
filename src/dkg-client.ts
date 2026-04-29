/**
 * DKG HTTP Client
 * Handles all communication with the local DKG V10 node API
 */

export interface CreateAssertionParams {
  name: string;
  context: string;
  visibility: 'WM' | 'SWM' | 'VM';
  content: Record<string, any>;
}

export interface CreateAssertionResponse {
  assertionUri: string;
  assertionName: string;
  contextGraphId: string;
}

export class DkgClient {
  private apiUrl: string;

  constructor(apiUrl?: string) {
    this.apiUrl = apiUrl || process.env.DKG_API_URL || 'http://127.0.0.1:9200';
  }

  async createAssertion(params: CreateAssertionParams): Promise<CreateAssertionResponse> {
    const url = `${this.apiUrl}/api/assertion/create`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `DKG assertion creation failed: ${response.status} ${response.statusText}. ${errorText}`
      );
    }

    return await response.json();
  }

  async getAssertionUri(assertionName: string, contextGraphId: string): Promise<string> {
    const url = `${this.apiUrl}/api/assertion/${encodeURIComponent(assertionName)}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch assertion: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.assertionUri || data.uri;
  }
}
