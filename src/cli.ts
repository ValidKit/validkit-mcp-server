#!/usr/bin/env node
import { spawn } from 'child_process';
import readline from 'readline';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🚀 ValidKit MCP Server Test CLI');
console.log('================================\n');

// Check for API key
if (!process.env.VALIDKIT_API_KEY) {
  console.log('⚠️  No API key found. Set VALIDKIT_API_KEY environment variable.');
  console.log('   Get your free key at: https://validkit.com\n');
  console.log('   Example: export VALIDKIT_API_KEY=vk_live_your_key_here\n');
}

// Start the MCP server
const serverPath = join(__dirname, 'index.js');
const server = spawn('node', [serverPath], {
  stdio: ['pipe', 'pipe', 'inherit'],
  env: process.env
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

let requestId = 1;

// Handle server responses
server.stdout.on('data', (data) => {
  try {
    const lines = data.toString().split('\n').filter(line => line.trim());
    lines.forEach(line => {
      try {
        const response = JSON.parse(line);
        if (response.result) {
          console.log('\n✅ Response:');
          if (response.result.tools) {
            console.log('Available tools:');
            response.result.tools.forEach((tool: any) => {
              console.log(`  - ${tool.name}: ${tool.description}`);
            });
          } else if (response.result.content) {
            response.result.content.forEach((content: any) => {
              console.log(content.text);
            });
          }
          console.log('');
        } else if (response.error) {
          console.log('\n❌ Error:', response.error.message, '\n');
        }
      } catch (e) {
        // Not JSON, ignore
      }
    });
  } catch (error) {
    console.error('Parse error:', error);
  }
});

// List tools on startup
setTimeout(() => {
  const listRequest = {
    jsonrpc: '2.0',
    id: requestId++,
    method: 'tools/list',
    params: {}
  };
  server.stdin.write(JSON.stringify(listRequest) + '\n');
}, 500);

console.log('Commands:');
console.log('  verify <email>           - Validate a single email');
console.log('  bulk <email1,email2,...> - Validate multiple emails');
console.log('  list                     - List available tools');
console.log('  exit                     - Quit\n');

// Command prompt
const prompt = () => {
  rl.question('> ', async (input) => {
    const [command, ...args] = input.trim().split(' ');
    
    switch (command) {
      case 'verify':
        if (args.length === 0) {
          console.log('Usage: verify <email>');
        } else {
          const request = {
            jsonrpc: '2.0',
            id: requestId++,
            method: 'tools/call',
            params: {
              name: 'validate_email',
              arguments: {
                email: args[0],
                detailed: args[1] === '--detailed'
              }
            }
          };
          server.stdin.write(JSON.stringify(request) + '\n');
        }
        break;
        
      case 'bulk':
        if (args.length === 0) {
          console.log('Usage: bulk <email1,email2,...>');
        } else {
          const emails = args[0].split(',').map(e => e.trim());
          const request = {
            jsonrpc: '2.0',
            id: requestId++,
            method: 'tools/call',
            params: {
              name: 'validate_emails_bulk',
              arguments: {
                emails: emails,
                detailed: args[1] === '--detailed'
              }
            }
          };
          server.stdin.write(JSON.stringify(request) + '\n');
        }
        break;
        
      case 'list':
        const listRequest = {
          jsonrpc: '2.0',
          id: requestId++,
          method: 'tools/list',
          params: {}
        };
        server.stdin.write(JSON.stringify(listRequest) + '\n');
        break;
        
      case 'exit':
      case 'quit':
        server.kill();
        process.exit(0);
        break;
        
      default:
        if (command) {
          console.log('Unknown command:', command);
          console.log('Type "help" for available commands');
        }
    }
    
    prompt();
  });
};

prompt();