# ValidKit MCP Server

[![npm downloads](https://img.shields.io/npm/dw/@validkit/mcp-server)](https://www.npmjs.com/package/@validkit/mcp-server)
[![npm version](https://img.shields.io/npm/v/@validkit/mcp-server)](https://www.npmjs.com/package/@validkit/mcp-server)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0%2B-blue)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[Model Context Protocol](https://modelcontextprotocol.io/) (MCP) server for [ValidKit](https://validkit.com?utm_source=github&utm_medium=readme&utm_campaign=mcp-server) email validation. Validate emails directly from Claude Code, Cursor, Windsurf, and any MCP-compatible AI assistant -- syntax checks, MX record verification, disposable detection, and typo suggestions, all without leaving your editor.

## Setup

### Claude Code

```bash
claude mcp add validkit -e VALIDKIT_API_KEY=vk_your_api_key -- npx -y @validkit/mcp-server
```

### Cursor

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "validkit": {
      "command": "npx",
      "args": ["-y", "@validkit/mcp-server"],
      "env": {
        "VALIDKIT_API_KEY": "your_key"
      }
    }
  }
}
```

### Windsurf

Add to `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "validkit": {
      "command": "npx",
      "args": ["-y", "@validkit/mcp-server"],
      "env": {
        "VALIDKIT_API_KEY": "your_key"
      }
    }
  }
}
```

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "validkit": {
      "command": "npx",
      "args": ["-y", "@validkit/mcp-server"],
      "env": {
        "VALIDKIT_API_KEY": "your_key"
      }
    }
  }
}
```

## Get Your API Key

Sign up for free at [validkit.com/get-started](https://validkit.com/get-started?utm_source=github&utm_medium=readme&utm_campaign=mcp-server) -- 1,000 validations/month included.

## Tools

### `validate_email`

Validate a single email address. Returns deliverability status, syntax/DNS/MX checks, disposable/role/free detection, and typo suggestions.

```
"Validate the email user@example.com"
```

### `validate_emails_bulk`

Validate up to 1,000 emails in one request. Returns individual results and summary counts.

```
"Validate these emails: alice@gmail.com, bob@company.co, test@fake.xyz"
```

### `check_usage`

Check your API usage stats — total requests, valid/invalid counts, average response time, and rate limit.

```
"Show my ValidKit usage stats"
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VALIDKIT_API_KEY` | Yes | Your ValidKit API key |
| `VALIDKIT_API_URL` | No | Custom API URL (default: `https://api.validkit.com`) |

## Testing with MCP Inspector

```bash
VALIDKIT_API_KEY=vk_test_... npx @modelcontextprotocol/inspector npx -y @validkit/mcp-server
```

## Links

- [ValidKit Homepage](https://validkit.com?utm_source=github&utm_medium=readme&utm_campaign=mcp-server)
- [API Documentation](https://docs.validkit.com?utm_source=github&utm_medium=readme&utm_campaign=mcp-server)
- [GitHub Repository](https://github.com/ValidKit/validkit-mcp-server)
- [npm Package](https://www.npmjs.com/package/@validkit/mcp-server)
- [MCP Protocol](https://modelcontextprotocol.io/)

## License

MIT
