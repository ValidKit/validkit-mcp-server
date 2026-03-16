import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from './index.js';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Prevent the auto-start main() from running
vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: vi.fn(),
}));

function mockFetchResponse(status: number, data: unknown) {
  mockFetch.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  });
}

async function createTestClient() {
  const server = createServer();
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();

  const client = new Client({ name: 'test-client', version: '1.0.0' });

  await server.connect(serverTransport);
  await client.connect(clientTransport);

  return { client, server };
}

function getText(result: Awaited<ReturnType<Client['callTool']>>): string {
  return (result.content as { type: string; text: string }[])[0].text;
}

describe('ValidKit MCP Server', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    mockFetch.mockReset();
    process.env = { ...originalEnv };
    process.env.VALIDKIT_API_KEY = 'vk_test_123';
    delete process.env.VALIDKIT_API_URL;
  });

  describe('MCP protocol compliance', () => {
    it('lists exactly 3 tools', async () => {
      const { client } = await createTestClient();
      const { tools } = await client.listTools();
      expect(tools).toHaveLength(3);
      const names = tools.map((t) => t.name).sort();
      expect(names).toEqual([
        'check_usage',
        'validate_email',
        'validate_emails_bulk',
      ]);
    });

    it('validate_email has correct input schema', async () => {
      const { client } = await createTestClient();
      const { tools } = await client.listTools();
      const tool = tools.find((t) => t.name === 'validate_email');
      expect(tool?.inputSchema).toMatchObject({
        type: 'object',
        properties: {
          email: { type: 'string' },
        },
        required: ['email'],
      });
    });

    it('validate_emails_bulk has correct input schema', async () => {
      const { client } = await createTestClient();
      const { tools } = await client.listTools();
      const tool = tools.find((t) => t.name === 'validate_emails_bulk');
      expect(tool?.inputSchema).toMatchObject({
        type: 'object',
        properties: {
          emails: { type: 'array', items: { type: 'string' } },
        },
        required: ['emails'],
      });
    });

    it('check_usage has no required inputs', async () => {
      const { client } = await createTestClient();
      const { tools } = await client.listTools();
      const tool = tools.find((t) => t.name === 'check_usage');
      expect(tool?.inputSchema?.required).toBeUndefined();
    });

    it('tool responses use correct MCP content format', async () => {
      const { client } = await createTestClient();
      mockFetchResponse(200, { email: 'a@b.com', valid: true });

      const result = await client.callTool({
        name: 'validate_email',
        arguments: { email: 'a@b.com' },
      });

      const content = result.content as { type: string; text: string }[];
      expect(content).toHaveLength(1);
      expect(content[0].type).toBe('text');
      expect(typeof content[0].text).toBe('string');
    });
  });

  describe('validate_email', () => {
    it('returns successful validation result', async () => {
      const { client } = await createTestClient();
      const apiResponse = {
        email: 'test@gmail.com',
        valid: true,
        status: 'valid',
        checks: { syntax: true, dns: true, mx: true },
      };
      mockFetchResponse(200, apiResponse);

      const result = await client.callTool({
        name: 'validate_email',
        arguments: { email: 'test@gmail.com' },
      });

      expect(result.isError).toBeUndefined();
      const parsed = JSON.parse(getText(result));
      expect(parsed.email).toBe('test@gmail.com');
      expect(parsed.valid).toBe(true);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.validkit.com/v1/verify',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ email: 'test@gmail.com' }),
        })
      );
    });

    it('handles 401 with clear error message', async () => {
      const { client } = await createTestClient();
      mockFetchResponse(401, { error: { message: 'Invalid API key' } });

      const result = await client.callTool({
        name: 'validate_email',
        arguments: { email: 'test@gmail.com' },
      });

      expect(result.isError).toBe(true);
      expect(getText(result)).toContain('Authentication failed');
      expect(getText(result)).toContain('validkit.com/get-started');
    });

    it('handles 403 quota exceeded', async () => {
      const { client } = await createTestClient();
      mockFetchResponse(403, {
        error: { message: 'Monthly quota exceeded' },
      });

      const result = await client.callTool({
        name: 'validate_email',
        arguments: { email: 'test@gmail.com' },
      });

      expect(result.isError).toBe(true);
      expect(getText(result)).toContain('Quota exceeded');
      expect(getText(result)).toContain('validkit.com/pricing');
    });

    it('handles 429 rate limiting', async () => {
      const { client } = await createTestClient();
      mockFetchResponse(429, { error: { message: 'Too many requests' } });

      const result = await client.callTool({
        name: 'validate_email',
        arguments: { email: 'test@gmail.com' },
      });

      expect(result.isError).toBe(true);
      expect(getText(result)).toContain('Rate limited');
      expect(getText(result)).toContain('Wait a moment');
    });

    it('handles 500 server error', async () => {
      const { client } = await createTestClient();
      mockFetchResponse(500, { error: { message: 'Internal server error' } });

      const result = await client.callTool({
        name: 'validate_email',
        arguments: { email: 'test@gmail.com' },
      });

      expect(result.isError).toBe(true);
      expect(getText(result)).toContain('API error (500)');
      expect(getText(result)).toContain('Try again later');
    });

    it('handles network failure', async () => {
      const { client } = await createTestClient();
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await client.callTool({
        name: 'validate_email',
        arguments: { email: 'test@gmail.com' },
      });

      expect(result.isError).toBe(true);
      expect(getText(result)).toContain('Failed to validate email');
      expect(getText(result)).toContain('Network error');
    });

    it('handles API response with missing error message', async () => {
      const { client } = await createTestClient();
      mockFetchResponse(500, {});

      const result = await client.callTool({
        name: 'validate_email',
        arguments: { email: 'test@gmail.com' },
      });

      expect(result.isError).toBe(true);
      expect(getText(result)).toContain('Unknown error');
    });

    it('handles non-Error thrown exceptions', async () => {
      const { client } = await createTestClient();
      mockFetch.mockRejectedValueOnce('string error');

      const result = await client.callTool({
        name: 'validate_email',
        arguments: { email: 'test@gmail.com' },
      });

      expect(result.isError).toBe(true);
      expect(getText(result)).toContain('Unknown error');
    });

    it('validates email with unicode characters', async () => {
      const { client } = await createTestClient();
      mockFetchResponse(200, {
        email: 'ü@example.com',
        valid: false,
        status: 'invalid',
      });

      const result = await client.callTool({
        name: 'validate_email',
        arguments: { email: 'ü@example.com' },
      });

      expect(result.isError).toBeUndefined();
    });
  });

  describe('validate_emails_bulk', () => {
    it('returns successful bulk validation', async () => {
      const { client } = await createTestClient();
      const apiResponse = {
        results: [
          { email: 'a@gmail.com', valid: true, status: 'valid' },
          { email: 'b@fake.xyz', valid: false, status: 'invalid' },
        ],
        summary: { total: 2, valid: 1, invalid: 1, unknown: 0 },
      };
      mockFetchResponse(200, apiResponse);

      const result = await client.callTool({
        name: 'validate_emails_bulk',
        arguments: { emails: ['a@gmail.com', 'b@fake.xyz'] },
      });

      expect(result.isError).toBeUndefined();
      const parsed = JSON.parse(getText(result));
      expect(parsed.results).toHaveLength(2);
      expect(parsed.summary.total).toBe(2);

      // Verify correct endpoint (not /v1/verify/batch)
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.validkit.com/v1/verify/bulk',
        expect.anything()
      );
    });

    it('handles API error on bulk', async () => {
      const { client } = await createTestClient();
      mockFetchResponse(401, { error: { message: 'Invalid API key' } });

      const result = await client.callTool({
        name: 'validate_emails_bulk',
        arguments: { emails: ['test@example.com'] },
      });

      expect(result.isError).toBe(true);
    });

    it('handles network failure on bulk', async () => {
      const { client } = await createTestClient();
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await client.callTool({
        name: 'validate_emails_bulk',
        arguments: { emails: ['test@example.com'] },
      });

      expect(result.isError).toBe(true);
      expect(getText(result)).toContain('Failed to validate emails');
    });

    it('handles non-Error thrown on bulk', async () => {
      const { client } = await createTestClient();
      mockFetch.mockRejectedValueOnce(42);

      const result = await client.callTool({
        name: 'validate_emails_bulk',
        arguments: { emails: ['test@example.com'] },
      });

      expect(result.isError).toBe(true);
      expect(getText(result)).toContain('Unknown error');
    });
  });

  describe('check_usage', () => {
    it('returns usage stats', async () => {
      const { client } = await createTestClient();
      const apiResponse = {
        tier: 'free',
        used: 42,
        limit: 1000,
        remaining: 958,
        resets_at: '2026-04-01T00:00:00Z',
      };
      mockFetchResponse(200, apiResponse);

      const result = await client.callTool({
        name: 'check_usage',
        arguments: {},
      });

      expect(result.isError).toBeUndefined();
      const parsed = JSON.parse(getText(result));
      expect(parsed.tier).toBe('free');
      expect(parsed.remaining).toBe(958);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.validkit.com/v1/stats',
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('handles API error on stats', async () => {
      const { client } = await createTestClient();
      mockFetchResponse(401, { error: { message: 'Unauthorized' } });

      const result = await client.callTool({
        name: 'check_usage',
        arguments: {},
      });

      expect(result.isError).toBe(true);
    });

    it('handles network failure on stats', async () => {
      const { client } = await createTestClient();
      mockFetch.mockRejectedValueOnce(new Error('Timeout'));

      const result = await client.callTool({
        name: 'check_usage',
        arguments: {},
      });

      expect(result.isError).toBe(true);
      expect(getText(result)).toContain('Failed to check usage');
    });

    it('handles non-Error thrown on stats', async () => {
      const { client } = await createTestClient();
      mockFetch.mockRejectedValueOnce(null);

      const result = await client.callTool({
        name: 'check_usage',
        arguments: {},
      });

      expect(result.isError).toBe(true);
      expect(getText(result)).toContain('Unknown error');
    });
  });

  describe('configuration', () => {
    it('errors when VALIDKIT_API_KEY is missing', async () => {
      delete process.env.VALIDKIT_API_KEY;
      const { client } = await createTestClient();

      const result = await client.callTool({
        name: 'validate_email',
        arguments: { email: 'test@gmail.com' },
      });

      expect(result.isError).toBe(true);
      expect(getText(result)).toContain('VALIDKIT_API_KEY');
      expect(getText(result)).toContain('validkit.com/get-started');
    });

    it('errors when VALIDKIT_API_KEY is empty string', async () => {
      process.env.VALIDKIT_API_KEY = '';
      const { client } = await createTestClient();

      const result = await client.callTool({
        name: 'validate_email',
        arguments: { email: 'test@gmail.com' },
      });

      expect(result.isError).toBe(true);
      expect(getText(result)).toContain('VALIDKIT_API_KEY');
    });

    it('errors when VALIDKIT_API_KEY is whitespace', async () => {
      process.env.VALIDKIT_API_KEY = '   ';
      const { client } = await createTestClient();

      const result = await client.callTool({
        name: 'validate_email',
        arguments: { email: 'test@gmail.com' },
      });

      expect(result.isError).toBe(true);
    });

    it('uses custom VALIDKIT_API_URL', async () => {
      process.env.VALIDKIT_API_URL = 'https://custom.api.com';
      const { client } = await createTestClient();
      mockFetchResponse(200, { email: 'test@gmail.com', valid: true });

      await client.callTool({
        name: 'validate_email',
        arguments: { email: 'test@gmail.com' },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://custom.api.com/v1/verify',
        expect.anything()
      );
    });

    it('sends correct headers including User-Agent', async () => {
      process.env.VALIDKIT_API_KEY = 'vk_test_mykey';
      const { client } = await createTestClient();
      mockFetchResponse(200, { email: 'test@gmail.com', valid: true });

      await client.callTool({
        name: 'validate_email',
        arguments: { email: 'test@gmail.com' },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-API-Key': 'vk_test_mykey',
            'User-Agent': 'validkit-mcp/1.1.0',
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('GET requests do not include body or Content-Type', async () => {
      const { client } = await createTestClient();
      mockFetchResponse(200, { used: 0, limit: 1000 });

      await client.callTool({
        name: 'check_usage',
        arguments: {},
      });

      const callArgs = mockFetch.mock.calls[0][1];
      expect(callArgs.body).toBeUndefined();
      expect(callArgs.headers['Content-Type']).toBeUndefined();
    });

    it('POST requests include Content-Type', async () => {
      const { client } = await createTestClient();
      mockFetchResponse(200, { email: 'a@b.com', valid: true });

      await client.callTool({
        name: 'validate_email',
        arguments: { email: 'a@b.com' },
      });

      const callArgs = mockFetch.mock.calls[0][1];
      expect(callArgs.headers['Content-Type']).toBe('application/json');
    });

    it('rejects non-https VALIDKIT_API_URL', async () => {
      process.env.VALIDKIT_API_URL = 'http://evil.com';
      const { client } = await createTestClient();

      const result = await client.callTool({
        name: 'validate_email',
        arguments: { email: 'test@gmail.com' },
      });

      expect(result.isError).toBe(true);
      expect(getText(result)).toContain('must use https://');
    });

    it('handles non-JSON API response gracefully', async () => {
      const { client } = await createTestClient();
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 502,
        json: async () => {
          throw new SyntaxError('Unexpected token <');
        },
      });

      const result = await client.callTool({
        name: 'validate_email',
        arguments: { email: 'test@gmail.com' },
      });

      expect(result.isError).toBe(true);
      expect(getText(result)).toContain('Non-JSON response');
      expect(getText(result)).toContain('502');
    });

    it('includes abort signal for timeout', async () => {
      const { client } = await createTestClient();
      mockFetchResponse(200, { email: 'a@b.com', valid: true });

      await client.callTool({
        name: 'validate_email',
        arguments: { email: 'a@b.com' },
      });

      const callArgs = mockFetch.mock.calls[0][1];
      expect(callArgs.signal).toBeDefined();
    });

    it('missing API key error on bulk endpoint', async () => {
      delete process.env.VALIDKIT_API_KEY;
      const { client } = await createTestClient();

      const result = await client.callTool({
        name: 'validate_emails_bulk',
        arguments: { emails: ['test@example.com'] },
      });

      expect(result.isError).toBe(true);
      expect(getText(result)).toContain('VALIDKIT_API_KEY');
    });

    it('missing API key error on check_usage', async () => {
      delete process.env.VALIDKIT_API_KEY;
      const { client } = await createTestClient();

      const result = await client.callTool({
        name: 'check_usage',
        arguments: {},
      });

      expect(result.isError).toBe(true);
      expect(getText(result)).toContain('VALIDKIT_API_KEY');
    });

    it('trims whitespace from API key', async () => {
      process.env.VALIDKIT_API_KEY = '  vk_test_padded  ';
      const { client } = await createTestClient();
      mockFetchResponse(200, { email: 'a@b.com', valid: true });

      await client.callTool({
        name: 'validate_email',
        arguments: { email: 'a@b.com' },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-API-Key': 'vk_test_padded',
          }),
        })
      );
    });

    it('handles non-JSON response on 200 as error', async () => {
      const { client } = await createTestClient();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError('Unexpected token <');
        },
      });

      const result = await client.callTool({
        name: 'validate_email',
        arguments: { email: 'test@gmail.com' },
      });

      expect(result.isError).toBe(true);
      expect(getText(result)).toContain('Non-JSON response');
      expect(getText(result)).toContain('200');
    });

    it('shows user-friendly timeout error message', async () => {
      const { client } = await createTestClient();
      const timeoutError = new DOMException(
        'The operation was aborted',
        'TimeoutError'
      );
      mockFetch.mockRejectedValueOnce(timeoutError);

      const result = await client.callTool({
        name: 'validate_email',
        arguments: { email: 'test@gmail.com' },
      });

      expect(result.isError).toBe(true);
      expect(getText(result)).toContain('timed out');
      expect(getText(result)).toContain('30 seconds');
      expect(getText(result)).not.toContain('was aborted');
    });
  });
});
