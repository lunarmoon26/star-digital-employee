# External Plugins

This directory contains lightweight wrappers for external MCP servers and third-party Claude Code plugins.

## Structure

Each external plugin wrapper is a minimal plugin that primarily consists of:

1. `.claude-plugin/plugin.json` - Plugin metadata and description
2. `.mcp.json` - MCP server configuration

## Example Structure

```
external_plugins/
└── example-service/
    ├── .claude-plugin/
    │   └── plugin.json
    └── .mcp.json
```

## Adding an External Plugin

### 1. Create Plugin Directory

```bash
mkdir -p external_plugins/plugin-name/.claude-plugin
```

### 2. Create Plugin Manifest

Create `external_plugins/plugin-name/.claude-plugin/plugin.json`:

```json
{
  "name": "plugin-name",
  "description": "Description of the external service integration",
  "author": {
    "name": "Original Author"
  }
}
```

### 3. Create MCP Configuration

Create `external_plugins/plugin-name/.mcp.json`:

```json
{
  "plugin-name": {
    "type": "http",
    "url": "https://api.example.com/mcp/",
    "headers": {
      "Authorization": "Bearer ${API_TOKEN}"
    }
  }
}
```

### 4. Add to Marketplace

Add an entry to `../.claude-plugin/marketplace.json`:

```json
{
  "name": "plugin-name",
  "description": "Integration with External Service",
  "author": {
    "name": "Original Author",
    "email": "author@example.com"
  },
  "source": "./external_plugins/plugin-name",
  "category": "integration",
  "homepage": "https://example.com"
}
```

## MCP Server Types

### HTTP/SSE Server
```json
{
  "server-name": {
    "type": "http",
    "url": "https://api.example.com/mcp/",
    "headers": {
      "Authorization": "Bearer ${TOKEN}"
    }
  }
}
```

### Stdio Server
```json
{
  "server-name": {
    "type": "stdio",
    "command": "npx",
    "args": ["-y", "@example/mcp-server"]
  }
}
```

## Environment Variables

Document required environment variables in the plugin's README:

- `API_TOKEN` - Authentication token for the service
- `API_URL` - Custom API endpoint (optional)

## Examples

See the [claude-plugins-official external_plugins](https://github.com/anthropics/claude-plugins-official/tree/main/external_plugins) for reference implementations:

- github
- gitlab
- linear
- slack
- supabase
- etc.
