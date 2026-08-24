# Architect Plugin

Scaffold and evolve star-digital-employee plugins with marketplace integration.

## Overview

The architect plugin provides tooling for creating new Claude Code plugins in this collection. It wraps the official `plugin-dev:create-plugin` workflow while adding project-specific functionality like folder selection and automatic marketplace registration.

## Commands

### `/architect:scaffold-plugin`

Scaffold a new plugin with full marketplace integration.

**Usage**:
```bash
# With description
/architect:scaffold-plugin "A plugin for managing todo lists"

# Interactive mode
/architect:scaffold-plugin
```

**Workflow**:
1. **Initial Setup**: Asks where to create the plugin (plugins/ or external_plugins/), validates name uniqueness
2. **Plugin Creation**: Delegates to Claude's official `plugin-dev:create-plugin` for the full plugin design workflow
3. **Marketplace Registration**: Adds the new plugin to `.claude-plugin/marketplace.json`
4. **Completion**: Provides summary and next steps

## Skills

### plugin-scaffolding

Provides schema knowledge for:
- `plugin.json` manifest files
- `marketplace.json` registry entries
- Naming conventions and validation rules

This skill is automatically loaded when scaffolding plugins and can be triggered by questions like "how do I create a plugin" or "what fields are in marketplace.json".

## Folder Structure

```
architect/
├── .claude-plugin/
│   └── plugin.json           # Plugin manifest
├── commands/
│   └── scaffold-plugin.md    # Main scaffolding command
├── skills/
│   └── plugin-scaffolding/
│       ├── SKILL.md          # Core schema knowledge
│       └── references/
│           ├── marketplace-schema.md
│           └── plugin-schema.md
└── README.md                 # This file
```

## Future Commands

The following commands are planned for future implementation:

- **scaffold-skill**: Scaffold a new skill within an existing plugin
- **scaffold-command**: Scaffold a new command within an existing plugin
- **scaffold-agent**: Scaffold a new agent within an existing plugin

## Integration

This plugin integrates with:

- **plugin-dev:create-plugin**: Claude's official plugin creation workflow
- **marketplace.json**: The project's plugin registry at `.claude-plugin/marketplace.json`

## Development

### Testing

After making changes, test by running:
```bash
/architect:scaffold-plugin "Test plugin for verification"
```

Then verify:
1. Plugin folder is created in the chosen location
2. plugin.json contains correct metadata
3. marketplace.json is updated with new entry
4. All JSON files are valid

### Schema Updates

If you discover new valid fields for plugin.json or marketplace.json:
1. Verify they exist in working plugins
2. Update the skill references at `skills/plugin-scaffolding/references/`
3. Update `SKILL.md` with the new fields
