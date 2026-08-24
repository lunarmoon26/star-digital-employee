# sample-plugin

A basic example plugin demonstrating the structure for star-digital-employee plugin collection.

## Purpose

This plugin serves as a template and reference for creating new plugins in the star-digital-employee collection.

## Installation

```bash
cc --plugin-dir ./plugins/sample-plugin
```

## Commands

- `/hello` - Simple greeting command to verify plugin is working

## Structure

```
sample-plugin/
├── .claude-plugin/
│   └── plugin.json
├── commands/
│   └── hello.md
└── README.md
```

## Extending This Plugin

To add more functionality:

1. **Add Commands**: Create `.md` files in `commands/` directory
2. **Add Skills**: Create skill directories in `skills/` with `SKILL.md`
3. **Add Agents**: Create agent definitions in `agents/` directory
4. **Add Hooks**: Create `hooks/hooks.json` for event-driven automation
5. **Add MCP**: Create `.mcp.json` for external integrations

See the [plugin-dev documentation](https://github.com/anthropics/claude-plugins-official/tree/main/plugins/plugin-dev) for detailed guidance.

## License

MIT
