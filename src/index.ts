#!/usr/bin/env node
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

export const VERSION = '1.1.2';
const REQUEST_TIMEOUT_MS = 30_000;

export function formatCatchError(error: unknown, prefix: string): string {
  if (error instanceof DOMException && error.name === 'TimeoutError') {
    return `${prefix}: Request timed out after ${REQUEST_TIMEOUT_MS / 1000} seconds. The ValidKit API may be slow or unreachable. Try again.`;
  }
  const message = error instanceof Error ? error.message : 'Unknown error';
  return `${prefix}: ${message}`;
}

export function getApiBaseUrl(): string {
  const raw = process.env.VALIDKIT_API_URL || 'https://api.validkit.com';
  if (!raw.startsWith('https://')) {
    throw new Error(
      `VALIDKIT_API_URL must use https:// (got "${raw}")`
    );
  }
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(
      `VALIDKIT_API_URL is not a valid URL (got "${raw}")`
    );
  }
  if (parsed.pathname !== '/' && parsed.pathname !== '') {
    throw new Error(
      `VALIDKIT_API_URL must be an origin URL without a path (got "${raw}"). Use "https://api.validkit.com" not "https://api.validkit.com/v1"`
    );
  }
  if (parsed.search || parsed.hash) {
    throw new Error(
      `VALIDKIT_API_URL must not include query parameters or fragments (got "${raw}")`
    );
  }
  return raw.replace(/\/+$/, '');
}

export function getApiKey(): string {
  const key = process.env.VALIDKIT_API_KEY;
  if (!key || key.trim() === '') {
    throw new Error(
      'VALIDKIT_API_KEY environment variable is required. Get your free API key at https://validkit.com/get-started'
    );
  }
  return key.trim();
}

export async function callApi(
  path: string,
  method: 'GET' | 'POST',
  body?: unknown
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const apiKey = getApiKey();

  let serializedBody: string | undefined;
  if (body !== undefined) {
    try {
      serializedBody = JSON.stringify(body);
    } catch {
      throw new Error('Failed to serialize request body');
    }
  }

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    method,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: {
      'X-API-Key': apiKey,
      'User-Agent': `validkit-mcp/${VERSION}`,
      ...(serializedBody !== undefined
        ? { 'Content-Type': 'application/json' }
        : {}),
    },
    ...(serializedBody !== undefined ? { body: serializedBody } : {}),
  });

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    return {
      ok: false,
      status: response.status,
      data: {
        error: {
          message: `Non-JSON response (HTTP ${response.status})`,
        },
      },
    };
  }

  return { ok: response.ok, status: response.status, data };
}

export function formatApiError(
  status: number,
  data: unknown
): { text: string; isError: true } {
  const message =
    (data as { error?: { message?: string } })?.error?.message ||
    'Unknown error';

  switch (status) {
    case 401:
      return {
        text: `Authentication failed: ${message}. Check your VALIDKIT_API_KEY is correct. Get a key at https://validkit.com/get-started`,
        isError: true,
      };
    case 403:
      return {
        text: `Quota exceeded: ${message}. Upgrade your plan at https://validkit.com/pricing`,
        isError: true,
      };
    case 429:
      return {
        text: `Rate limited: ${message}. Wait a moment and try again.`,
        isError: true,
      };
    default:
      return {
        text: `API error (${status}): ${message}. Try again later.`,
        isError: true,
      };
  }
}

export function createServer(): McpServer {
  const server = new McpServer({
    name: 'validkit',
    version: VERSION,
  });

  server.registerTool(
    'validate_email',
    {
      title: 'Validate Email',
      description:
        'Validate a single email address. Returns deliverability status, syntax/DNS/MX checks, disposable/role/free detection, and typo suggestions.',
      inputSchema: z.object({
        email: z.string().describe('Email address to validate'),
      }),
    },
    async ({ email }) => {
      try {
        const { ok, status, data } = await callApi('/api/v1/verify', 'POST', {
          email,
        });

        if (!ok) {
          const error = formatApiError(status, data);
          return {
            content: [{ type: 'text' as const, text: error.text }],
            isError: true,
          };
        }

        return {
          content: [
            { type: 'text' as const, text: JSON.stringify(data, null, 2) },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: formatCatchError(error, 'Failed to validate email'),
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    'validate_emails_bulk',
    {
      title: 'Validate Emails (Bulk)',
      description:
        'Validate multiple email addresses in a single request (up to 1000). Returns individual results and a summary with valid/invalid/unknown counts.',
      inputSchema: z.object({
        emails: z
          .array(z.string())
          .min(1, 'At least one email is required')
          .max(1000, 'Maximum 1000 emails per request')
          .describe('Array of email addresses to validate'),
      }),
    },
    async ({ emails }) => {
      try {
        const { ok, status, data } = await callApi(
          '/api/v1/verify/bulk',
          'POST',
          { emails }
        );

        if (!ok) {
          const error = formatApiError(status, data);
          return {
            content: [{ type: 'text' as const, text: error.text }],
            isError: true,
          };
        }

        return {
          content: [
            { type: 'text' as const, text: JSON.stringify(data, null, 2) },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: formatCatchError(error, 'Failed to validate emails'),
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.registerTool(
    'check_usage',
    {
      title: 'Check Usage',
      description:
        'Check your ValidKit API usage stats for the current period. Returns total requests, valid/invalid counts, average response time, and rate limit.',
    },
    async () => {
      try {
        const { ok, status, data } = await callApi('/api/v1/stats', 'GET');

        if (!ok) {
          const error = formatApiError(status, data);
          return {
            content: [{ type: 'text' as const, text: error.text }],
            isError: true,
          };
        }

        return {
          content: [
            { type: 'text' as const, text: JSON.stringify(data, null, 2) },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: formatCatchError(error, 'Failed to check usage'),
            },
          ],
          isError: true,
        };
      }
    }
  );

  return server;
}

/* v8 ignore start */
async function main() {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

const currentFile = fileURLToPath(import.meta.url);
const isDirectRun =
  process.argv[1] && realpathSync(process.argv[1]) === currentFile;

if (isDirectRun) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
/* v8 ignore stop */
