# Marketplace.json Schema Reference

This document provides the complete schema for marketplace.json entries, derived from existing entries in the star-digital-employee collection.

## File Location

`.claude-plugin/marketplace.json` in the project root.

## Root Structure

```json
{
  "$schema": "https://anthropic.com/claude-code/marketplace.schema.json",
  "name": "collection-name",
  "description": "Collection description",
  "owner": {
    "name": "Owner Name",
    "email": "owner@example.com"
  },
  "plugins": [
    // Plugin entries go here
  ]
}
```

## Plugin Entry Schema

### Required Fields

#### `name` (string)
- **Required**: Yes
- **Format**: kebab-case
- **Description**: Unique identifier for the plugin
- **Example**: `"sample-plugin"`, `"developer"`, `"deepwiki"`

#### `description` (string)
- **Required**: Yes
- **Format**: Free text, typically 1-2 sentences
- **Description**: Brief explanation of what the plugin does
- **Example**: `"Sample plugin demonstrating the structure for the star-digital-employee collection"`

#### `version` (string)
- **Required**: Yes
- **Format**: Semantic versioning (MAJOR.MINOR.PATCH)
- **Description**: Current version of the plugin
- **Example**: `"0.1.0"`, `"0.1.2"`, `"1.0.0"`

#### `source` (string | object)
- **Required**: Yes
- **Format**: Relative path or source object
- **Description**: Location of the plugin

**Local plugin (string)**:
```json
"source": "./plugins/my-plugin"
```

**External plugin (object)**:
```json
"source": {
  "source": "url",
  "url": "https://github.com/org/repo.git"
}
```

#### `category` (string)
- **Required**: Yes
- **Valid values**: `"development"`, `"research"`, `"productivity"`, `"example"`, `"integration"`
- **Description**: Classification for plugin discovery

### Optional Fields

#### `author` (object)
- **Required**: No
- **Description**: Author information

```json
"author": {
  "name": "Author Name",
  "email": "author@example.com"
}
```

**Sub-fields**:
- `name` (string, required if author present): Display name
- `email` (string, optional): Contact email

#### `homepage` (string)
- **Required**: No
- **Format**: Valid URL
- **Description**: Link to documentation, repository, or project page
- **Example**: `"https://github.com/lunarmoon26/star-digital-employee/tree/main/plugins/sample-plugin"`

## Existing Entries Reference

### sample-plugin
```json
{
  "name": "sample-plugin",
  "description": "Sample plugin demonstrating the structure for the star-digital-employee collection",
  "version": "0.1.2",
  "author": {
    "name": "Haochuan Zhang",
    "email": "jackchang26@gmail.com"
  },
  "source": "./plugins/sample-plugin",
  "category": "example",
  "homepage": "https://github.com/lunarmoon26/star-digital-employee/tree/main/plugins/sample-plugin"
}
```

### deepwiki (external plugin)
```json
{
  "name": "deepwiki",
  "description": "AI-powered codebase documentation and understanding...",
  "author": {
    "name": "devin"
  },
  "source": "./external_plugins/deepwiki",
  "category": "development",
  "homepage": "https://deepwiki.com",
  "version": "0.1.2"
}
```

### claude-plugins-official (URL source)
```json
{
  "name": "claude-plugins-official",
  "description": "Directory of popular Claude Code extensions...",
  "source": {
    "source": "url",
    "url": "https://github.com/anthropics/claude-plugins-official.git"
  },
  "homepage": "https://github.com/anthropics/claude-plugins-official",
  "version": "0.1.2"
}
```

### developer
```json
{
  "name": "developer",
  "description": "Professional development skills for Python, TypeScript, C#, and Java with industry best practices and coding standards",
  "version": "0.1.2",
  "author": {
    "name": "Haochuan Zhang",
    "email": "jackchang26@gmail.com"
  },
  "source": "./plugins/developer",
  "category": "development",
  "homepage": "https://github.com/lunarmoon26/star-digital-employee/tree/main/plugins/developer"
}
```

### researcher
```json
{
  "name": "researcher",
  "description": "5-phase research funnel methodology for systematic literature review...",
  "version": "0.1.2",
  "author": {
    "name": "Haochuan Zhang",
    "email": "jackchang26@gmail.com"
  },
  "source": "./plugins/researcher",
  "category": "research",
  "homepage": "https://github.com/lunarmoon26/star-digital-employee/tree/main/plugins/researcher"
}
```

## Validation Checklist

When adding a new marketplace entry, verify:

- [ ] `name` is unique across all entries
- [ ] `name` matches the plugin's plugin.json name
- [ ] `version` matches plugin.json version
- [ ] `source` path is correct (./plugins/ or ./external_plugins/)
- [ ] `category` is one of the valid values
- [ ] JSON syntax is valid (no trailing commas, proper quotes)
