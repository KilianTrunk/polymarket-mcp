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
  assertionName?: string;
  contextGraphId: string;
}

interface AssertionLookupResponse {
  assertionUri?: string;
  uri?: string;
}

interface Quad {
  subject: string;
  predicate: string;
  object: string;
  graph: string;
}

const POLYMARKET_ONTOLOGY = 'http://dkg.io/ontology/polymarket/';

function literal(value: unknown): string {
  return JSON.stringify(typeof value === 'string' ? value : JSON.stringify(value));
}

function iriPart(value: string): string {
  const sanitized = value.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  return sanitized || 'analysis';
}

function contentToQuads(subject: string, content: Record<string, any>): Quad[] {
  const graphQuads = content.dkgGraphQuads;
  if (Array.isArray(graphQuads)) {
    const quads = graphQuads.flatMap((quad): Quad[] => {
      if (!quad || typeof quad !== 'object') return [];
      const { subject, predicate, object } = quad as Record<string, unknown>;
      if (typeof subject !== 'string' || typeof predicate !== 'string' || typeof object !== 'string') {
        return [];
      }
      return [{ subject, predicate, object, graph: '' }];
    });
    if (quads.length > 0) return quads;
  }

  const quads: Quad[] = [
    {
      subject,
      predicate: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
      object: `${POLYMARKET_ONTOLOGY}PolymarketAnalysis`,
      graph: '',
    },
  ];

  const skipKeys = new Set(['@context', '@id', '@type', 'dkgGraphQuads']);
  for (const [key, value] of Object.entries(content)) {
    if (skipKeys.has(key) || value === undefined || value === null) continue;
    quads.push({
      subject,
      predicate: `${POLYMARKET_ONTOLOGY}${key}`,
      object: literal(value),
      graph: '',
    });
  }
  return quads;
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
      body: JSON.stringify({
        contextGraphId: params.context,
        name: params.name,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `DKG assertion creation failed: ${response.status} ${response.statusText}. ${errorText}`
      );
    }

    const result = await response.json() as CreateAssertionResponse;
    const subject = typeof params.content['@id'] === 'string'
      ? params.content['@id']
      : `urn:dkg:polymarket-analysis:${iriPart(params.name)}`;
    const writeUrl = `${this.apiUrl}/api/assertion/${encodeURIComponent(params.name)}/write`;
    const writeResponse = await fetch(writeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contextGraphId: params.context,
        quads: contentToQuads(subject, params.content),
      }),
    });

    if (!writeResponse.ok) {
      const errorText = await writeResponse.text();
      throw new Error(
        `DKG assertion write failed: ${writeResponse.status} ${writeResponse.statusText}. ${errorText}`
      );
    }

    return {
      assertionUri: result.assertionUri,
      assertionName: params.name,
      contextGraphId: params.context,
    };
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

    const data = await response.json() as AssertionLookupResponse;
    const assertionUri = data.assertionUri || data.uri;
    if (!assertionUri) {
      throw new Error('Assertion response did not include an assertion URI');
    }
    return assertionUri;
  }
}
