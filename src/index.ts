#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const API_KEY = process.env.VALIDKIT_API_KEY;
const API_BASE_URL = process.env.VALIDKIT_API_URL || 'https://api.validkit.com';
const IS_DEMO_MODE = !API_KEY || API_KEY === 'demo';

interface ValidKitResponse {
  email: string;
  valid: boolean;
  status: 'valid' | 'invalid' | 'unknown';
  reason?: string;
  checks?: {
    syntax: boolean;
    dns: boolean;
    mx: boolean;
    disposable: boolean;
    role: boolean;
    free: boolean;
  };
  metadata?: {
    domain: string;
    provider?: string;
    did_you_mean?: string;
  };
}

interface BulkValidKitResponse {
  results: ValidKitResponse[];
  summary: {
    total: number;
    valid: number;
    invalid: number;
    unknown: number;
  };
}

class ValidKitMCPServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'validkit-mcp',
        vendor: 'ValidKit',
        version: '1.0.0',
        description: 'Email validation through ValidKit API',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
    
    // Error handling
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'validate_email',
          description: 'Validate a single email address using ValidKit API',
          inputSchema: {
            type: 'object',
            properties: {
              email: {
                type: 'string',
                description: 'Email address to validate',
              },
              detailed: {
                type: 'boolean',
                description: 'Return detailed validation checks (default: false)',
                default: false,
              },
            },
            required: ['email'],
          },
        },
        {
          name: 'validate_emails_bulk',
          description: 'Validate multiple email addresses in bulk (up to 1000)',
          inputSchema: {
            type: 'object',
            properties: {
              emails: {
                type: 'array',
                items: {
                  type: 'string',
                },
                description: 'Array of email addresses to validate',
                maxItems: 1000,
              },
              detailed: {
                type: 'boolean',
                description: 'Return detailed validation checks for each email (default: false)',
                default: false,
              },
            },
            required: ['emails'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (IS_DEMO_MODE) {
        console.error('[ValidKit] Running in DEMO mode. Set VALIDKIT_API_KEY to use real API.');
      }

      switch (request.params.name) {
        case 'validate_email':
          return this.validateEmail(request.params.arguments);
        
        case 'validate_emails_bulk':
          return this.validateEmailsBulk(request.params.arguments);
        
        default:
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${request.params.name}`
          );
      }
    });
  }

  private async validateEmail(args: any) {
    const { email, detailed = false } = args;

    if (!email || typeof email !== 'string') {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Email parameter is required and must be a string'
      );
    }

    // Demo mode - return mock data
    if (IS_DEMO_MODE) {
      const mockResponse: ValidKitResponse = {
        email,
        valid: !email.includes('invalid') && email.includes('@'),
        status: email.includes('invalid') ? 'invalid' : 'valid',
        reason: email.includes('invalid') ? 'Domain does not exist' : undefined,
        checks: {
          syntax: email.includes('@'),
          dns: !email.includes('invalid'),
          mx: !email.includes('invalid'),
          disposable: email.includes('disposable'),
          role: email.startsWith('admin@') || email.startsWith('info@'),
          free: email.includes('gmail.com') || email.includes('yahoo.com'),
        },
        metadata: {
          domain: email.split('@')[1] || '',
        },
      };

      if (detailed) {
        return {
          content: [
            {
              type: 'text',
              text: `[DEMO MODE]\n${JSON.stringify(mockResponse, null, 2)}`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: `[DEMO MODE]
Email: ${mockResponse.email}
Status: ${mockResponse.status}
Valid: ${mockResponse.valid}${mockResponse.reason ? `\nReason: ${mockResponse.reason}` : ''}`,
          },
        ],
      };
    }

    try {
      const response = await axios.post(
        `${API_BASE_URL}/v1/verify`,
        { email },
        {
          headers: {
            'X-API-Key': API_KEY,
            'Content-Type': 'application/json',
            'User-Agent': 'ValidKit-MCP/1.0.0',
          },
        }
      );

      const data = response.data as ValidKitResponse;

      if (detailed) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      // Compact response for token efficiency
      const summary = `Email: ${data.email}
Status: ${data.status}
Valid: ${data.valid}${data.reason ? `\nReason: ${data.reason}` : ''}${
        data.metadata?.did_you_mean
          ? `\nDid you mean: ${data.metadata.did_you_mean}`
          : ''
      }`;

      return {
        content: [
          {
            type: 'text',
            text: summary,
          },
        ],
      };
    } catch (error: any) {
      if (error.response) {
        throw new McpError(
          ErrorCode.InternalError,
          `ValidKit API error: ${error.response.data?.error?.message || error.response.statusText}`
        );
      }
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to validate email: ${error.message}`
      );
    }
  }

  private async validateEmailsBulk(args: any) {
    const { emails, detailed = false } = args;

    if (!emails || !Array.isArray(emails)) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Emails parameter is required and must be an array'
      );
    }

    if (emails.length === 0) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Emails array cannot be empty'
      );
    }

    if (emails.length > 1000) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Maximum 1000 emails allowed per bulk request'
      );
    }

    try {
      const response = await axios.post(
        `${API_BASE_URL}/v1/verify/batch`,
        { emails },
        {
          headers: {
            'X-API-Key': API_KEY,
            'Content-Type': 'application/json',
            'User-Agent': 'ValidKit-MCP/1.0.0',
          },
        }
      );

      const data = response.data as BulkValidKitResponse;

      if (detailed) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      // Compact summary for token efficiency
      const validEmails = data.results
        .filter((r) => r.valid)
        .map((r) => r.email);
      const invalidEmails = data.results
        .filter((r) => !r.valid)
        .map((r) => `${r.email} (${r.reason || 'invalid'})`);

      const summary = `Bulk Validation Results:
Total: ${data.summary.total}
Valid: ${data.summary.valid}
Invalid: ${data.summary.invalid}

Valid emails:
${validEmails.join('\n') || 'None'}

Invalid emails:
${invalidEmails.join('\n') || 'None'}`;

      return {
        content: [
          {
            type: 'text',
            text: summary,
          },
        ],
      };
    } catch (error: any) {
      if (error.response) {
        throw new McpError(
          ErrorCode.InternalError,
          `ValidKit API error: ${error.response.data?.error?.message || error.response.statusText}`
        );
      }
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to validate emails: ${error.message}`
      );
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('ValidKit MCP server running on stdio');
  }
}

// Start the server
const server = new ValidKitMCPServer();
server.run().catch(console.error);