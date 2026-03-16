# ValidKit MCP Server

Email validation for AI coding assistants. Validate emails directly from Claude Code, Cursor, Windsurf, and any MCP-compatible tool.

## Setup

### Claude Code

```bash
claude mcp add validkit -e VALIDKIT_API_KEY=your_key -- npx -y @validkit/mcp-server
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

Sign up for free at [validkit.com/get-started](https://validkit.com/get-started) — 1,000 validations/month included.

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

Check your API usage — validations used, limit, remaining, and reset date.

```
"How many validations do I have left?"
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

## License

MIT
