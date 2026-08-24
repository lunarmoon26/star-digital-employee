---
description: Schema knowledge for scaffolding Claude Code plugins with marketplace.json and plugin.json validation. Use when creating new plugins, validating plugin structure, or registering plugins in the marketplace.
---

# Plugin Scaffolding Knowledge

This skill provides verified schema information for scaffolding Claude Code plugins in the star-digital-employee project. All field definitions are derived from existing, working entries - never add fields not documented here.

## Project Folder Structure

Plugins in this project live in two locations:

| Location | Purpose | Example |
|----------|---------|---------|
| `plugins/` | First-party plugins created for this collection | developer, researcher, sample-plugin |
| `external_plugins/` | Third-party or forked plugins | deepwiki |

When scaffolding a new plugin, always ask the user which folder is appropriate:
- **plugins/**: For new plugins being developed as part of this collection
- **external_plugins/**: For plugins forked from external sources or third-party integrations

## Plugin Directory Structure

Every plugin follows this structure:

```
[plugin-name]/
├── .claude-plugin/
│   └── plugin.json          # Required: Plugin manifest
├── commands/                 # Optional: Slash commands
│   └── *.md
├── skills/                   # Optional: Skill definitions
│   └── [skill-name]/
│       └── SKILL.md
├── agents/                   # Optional: Subagent definitions
│   └── *.md
├── hooks/                    # Optional: Event hooks
│   └── *.md
└── README.md                 # Recommended: Documentation
```

## Plugin Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Plugin name | kebab-case | `my-awesome-plugin` |
| Folder name | Same as plugin name | `my-awesome-plugin/` |
| Version | Semantic versioning | `0.1.0`, `1.2.3` |
| Command files | kebab-case | `scaffold-plugin.md` |
| Skill folders | kebab-case | `plugin-scaffolding/` |

## Schema: plugin.json

The plugin manifest is located at `[plugin-name]/.claude-plugin/plugin.json`.

### Verified Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | **Yes** | Unique plugin identifier in kebab-case |
| `version` | string | Recommended | Semantic version (e.g., "0.1.0") |
| `description` | string | Recommended | Brief description of plugin purpose |
| `author` | object | Optional | Author information |
| `author.name` | string | Yes (if author) | Author's display name |
| `author.email` | string | Optional | Author's email address |
| `keywords` | array | Optional | Array of keyword strings for discoverability |

### Example plugin.json

```json
{
  "name": "my-plugin",
  "version": "0.1.0",
  "description": "A helpful plugin that does useful things",
  "author": {
    "name": "Haochuan Zhang",
    "email": "jackchang26@gmail.com"
  },
  "keywords": ["utility", "automation", "productivity"]
}
```

## Schema: marketplace.json

The marketplace registry is at `.claude-plugin/marketplace.json` in the project root.

### Verified Fields for Plugin Entries

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | **Yes** | Must match plugin.json name |
| `description` | string | **Yes** | Can differ from plugin.json (marketplace-specific) |
| `version` | string | **Yes** | Must match plugin.json version |
| `source` | string or object | **Yes** | Path to plugin (e.g., "./plugins/my-plugin") |
| `category` | string | **Yes** | One of: development, research, productivity, example, integration |
| `author` | object | Optional | Author information |
| `author.name` | string | Yes (if author) | Author's display name |
| `author.email` | string | Optional | Author's email address |
| `homepage` | string | Optional | URL to plugin documentation/repo |

### Valid Categories

- **development**: Developer tools, coding aids, build helpers
- **research**: Research methodologies, literature review, knowledge synthesis
- **productivity**: Task management, workflow automation, personal efficiency
- **example**: Sample/demo plugins for learning
- **integration**: External service integrations, MCP servers

### Example Marketplace Entry

```json
{
  "name": "my-plugin",
  "description": "A helpful plugin that does useful things",
  "version": "0.1.0",
  "author": {
    "name": "Haochuan Zhang",
    "email": "jackchang26@gmail.com"
  },
  "source": "./plugins/my-plugin",
  "category": "productivity",
  "homepage": "https://github.com/lunarmoon26/star-digital-employee/tree/main/plugins/my-plugin"
}
```

## Validation Rules

### Name Validation
- Must be kebab-case (lowercase letters, numbers, hyphens)
- Must be unique across all marketplace entries
- Must match between plugin.json and marketplace.json

### Version Validation
- Must follow semantic versioning: MAJOR.MINOR.PATCH
- New plugins typically start at `0.1.0`
- Must match between plugin.json and marketplace.json

### Source Path Validation
- Local plugins use relative paths: `./plugins/[name]` or `./external_plugins/[name]`
- External plugins can use URL objects with `source` and `url` fields

## Critical Constraints

**NEVER add fields not documented in this skill.** The schemas above represent the complete set of verified fields from existing, working entries. Adding unverified fields may break compatibility or cause validation errors.

If you encounter a field not listed here:
1. Check existing marketplace.json entries for precedent
2. If no precedent exists, do not use the field
3. Document any newly discovered fields by updating this skill

## Integration with plugin-dev

When scaffolding plugins, this skill works alongside Claude's official `plugin-dev:create-plugin` workflow:

1. **Architect handles**: Folder selection, uniqueness validation, marketplace registration
2. **plugin-dev handles**: Interactive plugin design, component creation, file generation

The recommended workflow:
1. Use architect to determine target location and validate name
2. Delegate to plugin-dev for the actual plugin creation
3. Return to architect for marketplace.json registration
