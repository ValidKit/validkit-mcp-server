#!/usr/bin/env node

/**
 * Test script for ValidKit MCP Server
 * This demonstrates how the MCP server processes requests
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Start the MCP server
const server = spawn('node', [join(__dirname, '../dist/index.js')], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: {
    ...process.env,
    VALIDKIT_API_KEY: process.env.VALIDKIT_API_KEY || 'vk_beta_test_key_123456789'
  }
});

// Handle server output
server.stdout.on('data', (data) => {
  console.log('Server output:', data.toString());
});

server.stderr.on('data', (data) => {
  console.log('Server log:', data.toString());
});

// Send test requests
async function testMCP() {
  console.log('Testing ValidKit MCP Server...\n');

  // Test 1: List available tools
  const listToolsRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/list',
    params: {}
  };

  console.log('Sending list tools request...');
  server.stdin.write(JSON.stringify(listToolsRequest) + '\n');

  // Wait a bit for response
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 2: Validate single email
  const validateEmailRequest = {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: {
      name: 'validate_email',
      arguments: {
        email: 'test@example.com',
        detailed: false
      }
    }
  };

  console.log('\nSending validate email request...');
  server.stdin.write(JSON.stringify(validateEmailRequest) + '\n');

  // Wait a bit for response
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test 3: Bulk validate emails
  const bulkValidateRequest = {
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: {
      name: 'validate_emails_bulk',
      arguments: {
        emails: [
          'valid@gmail.com',
          'invalid@nonexistentdomain.com',
          'test@example.com'
        ],
        detailed: false
      }
    }
  };

  console.log('\nSending bulk validate request...');
  server.stdin.write(JSON.stringify(bulkValidateRequest) + '\n');

  // Wait for responses
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Clean up
  server.kill();
  process.exit(0);
}

// Run tests
testMCP().catch(console.error);