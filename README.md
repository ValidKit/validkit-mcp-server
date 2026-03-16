# ValidKit MCP Server

[![npm version](https://badge.fury.io/js/@validkit%2Fmcp-server.svg)](https://www.npmjs.com/package/@validkit/mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Model Context Protocol (MCP) server for ValidKit email validation. This allows any MCP-compatible AI assistant or tool to validate emails directly through ValidKit's API.

## 🚀 Quick Start

### 1. Install the MCP Server

```bash
npm install -g @validkit/mcp-server
```

Or install from source:
```bash
git clone https://github.com/jesselpalmer/validkit-mcp-server.git
cd validkit-mcp-server
npm install
npm run build
npm link
```

### 2. Get Your API Key

Sign up for free at [validkit.com](https://validkit.com) to get your API key.

### 3. Configure Your MCP Client

#### For Claude Desktop
Add to your configuration (`~/Library/Application Support/Claude/claude_desktop_config.json` on Mac):

```json
{
  "mcpServers": {
    "validkit": {
      "command": "npx",
      "args": ["-y", "@validkit/mcp-server"],
      "env": {
        "VALIDKIT_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

#### For Other MCP Clients
Consult your MCP client's documentation for configuration details. The server runs on stdio transport.

See `config-examples.json` in this repository for example configurations.

### 4. Restart Your MCP Client

The ValidKit tools will now be available!

## 📋 Available Tools

### `validate_email`
Validate a single email address.

**Parameters:**
- `email` (required): Email address to validate
- `detailed` (optional): Return detailed validation checks (default: false)

**Example usage in Claude:**
```
Can you validate the email address test@example.com?
```

### `validate_emails_bulk`
Validate multiple email addresses (up to 1000).

**Parameters:**
- `emails` (required): Array of email addresses
- `detailed` (optional): Return detailed validation checks (default: false)

**Example usage in Claude:**
```
Please validate these emails:
- john@gmail.com
- fake@nonexistentdomain.com
- disposable@10minutemail.com
```

## 🔧 Configuration

### Environment Variables

- `VALIDKIT_API_KEY` (required): Your ValidKit API key
- `VALIDKIT_API_URL` (optional): API base URL (default: https://api.validkit.com)

### Using with .env file

Create a `.env` file in your project:
```env
VALIDKIT_API_KEY=vk_live_your_api_key_here
```

## 📖 Response Formats

### Compact Response (Default)
Optimized for token efficiency:
```
Email: test@example.com
Status: valid
Valid: true
```

### Detailed Response
Full validation details when `detailed: true`:
```json
{
  "email": "test@example.com",
  "valid": true,
  "status": "valid",
  "checks": {
    "syntax": true,
    "dns": true,
    "mx": true,
    "disposable": false,
    "role": false,
    "free": false
  },
  "metadata": {
    "domain": "example.com",
    "provider": "Example Mail"
  }
}
```

## 🛠️ Development

### Running locally:
```bash
npm install
npm run dev
```

### Building:
```bash
npm run build
```

### Testing the MCP Server:

#### Interactive Test CLI:
```bash
# Test without installing
npx @validkit/mcp-server validkit-mcp-test

# Or after installing globally
validkit-mcp-test
```

#### MCP Inspector:
```bash
npx @modelcontextprotocol/inspector npx -y @validkit/mcp-server
```

#### Demo Mode:
The server runs in demo mode when no API key is set, allowing you to test without an account.

## 🔗 Links

- [ValidKit Homepage](https://validkit.com)
- [API Documentation](https://docs.validkit.com)
- [MCP Documentation](https://modelcontextprotocol.io)
- [GitHub Repository](https://github.com/jesselpalmer/validkit-mcp-server)

## 📄 License

MIT License - see LICENSE file for details.

## 🤝 Support

- Email: support@validkit.com
- Documentation: [docs.validkit.com](https://docs.validkit.com)
- Issues: [GitHub Issues](https://github.com/jesselpalmer/validkit-mcp-server/issues)