# Internal Plugins

This directory contains plugins developed specifically for the star-digital-employee collection.

## Available Plugins

### sample-plugin
Basic example demonstrating plugin structure and conventions.

**Usage:**
```bash
cc --plugin-dir ./plugins/sample-plugin
```

## Creating a New Plugin

### 1. Create Plugin Structure

```bash
mkdir -p plugins/your-plugin/.claude-plugin
mkdir -p plugins/your-plugin/commands
mkdir -p plugins/your-plugin/skills
mkdir -p plugins/your-plugin/agents
```

### 2. Create Plugin Manifest

Create `plugins/your-plugin/.claude-plugin/plugin.json`:

```json
{
  "name": "your-plugin",
  "version": "0.1.0",
  "description": "Brief description of your plugin",
  "author": {
    "name": "Your Name",
    "email": "your.email@example.com"
  },
  "keywords": ["keyword1", "keyword2"]
}
```

### 3. Add Components

**Commands** (`commands/*.md`):
```markdown
---
name: command-name
description: Command description
---

Command instructions...
```

**Skills** (`skills/skill-name/SKILL.md`):
```markdown
---
name: Skill Name
description: When to use this skill
---

Skill content...
```

**Agents** (`agents/agent-name.md`):
```markdown
---
description: Agent role and capabilities
---

Agent instructions...
```

### 4. Create README

Document your plugin's purpose, installation, usage, and any dependencies.

### 5. Add to Marketplace

Update `../.claude-plugin/marketplace.json` to include your plugin:

```json
{
  "name": "your-plugin",
  "description": "Your plugin description",
  "version": "0.1.0",
  "author": {
    "name": "Your Name",
    "email": "your.email@example.com"
  },
  "source": "./plugins/your-plugin",
  "category": "appropriate-category",
  "homepage": "https://github.com/lunarmoon26/star-digital-employee/tree/main/plugins/your-plugin"
}
```

## Plugin Development Guidelines

1. **Follow Conventions**: Match the structure of existing plugins
2. **Use Portable Paths**: Use `${CLAUDE_PLUGIN_ROOT}` for intra-plugin references
3. **Document Thoroughly**: Include comprehensive README and inline documentation
4. **Test Extensively**: Verify all components work before committing
5. **Version Properly**: Follow semantic versioning (MAJOR.MINOR.PATCH)

## Categories

### Development & Business
- **scaffolding**: Project initialization and templates
- **deployment**: Deployment automation and CI/CD
- **business**: Business operations and productivity
- **system**: System administration and maintenance
- **integration**: External service integrations

### Knowledge & Learning
- **knowledge**: Personal knowledge management and organization
- **learning**: Learning resources, tracking, and development
- **notes**: Note-taking, journaling, and documentation

### Personal Growth
- **growth**: Personal development, habits, and goals

### Other
- **example**: Examples and templates

## Reference

See [claude-plugins-official](https://github.com/anthropics/claude-plugins-official) for comprehensive examples and best practices.
