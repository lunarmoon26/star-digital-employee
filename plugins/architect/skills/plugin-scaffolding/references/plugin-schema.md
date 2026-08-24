# Plugin.json Schema Reference

This document provides the complete schema for plugin.json manifests, derived from existing plugins in the star-digital-employee collection.

## File Location

`[plugin-name]/.claude-plugin/plugin.json`

## Schema

### Required Fields

#### `name` (string)
- **Required**: Yes
- **Format**: kebab-case (lowercase letters, numbers, hyphens only)
- **Description**: Unique identifier for the plugin
- **Constraints**: Must match the plugin folder name
- **Example**: `"developer"`, `"sample-plugin"`, `"my-awesome-plugin"`

### Recommended Fields

#### `version` (string)
- **Required**: No (but strongly recommended)
- **Format**: Semantic versioning (MAJOR.MINOR.PATCH)
- **Description**: Current version of the plugin
- **Default for new plugins**: `"0.1.0"`
- **Example**: `"0.1.0"`, `"1.2.3"`

#### `description` (string)
- **Required**: No (but strongly recommended)
- **Format**: Free text, typically 1-2 sentences
- **Description**: Brief explanation of what the plugin does
- **Example**: `"Professional development skills for Python, TypeScript, C#, and Java"`

### Optional Fields

#### `author` (object)
- **Required**: No
- **Description**: Information about the plugin author

```json
"author": {
  "name": "Author Name",
  "email": "author@example.com"
}
```

**Sub-fields**:
- `name` (string, required if author present): Author's display name
- `email` (string, optional): Author's contact email

#### `keywords` (array of strings)
- **Required**: No
- **Format**: Array of lowercase strings
- **Description**: Keywords for plugin discovery and categorization
- **Example**: `["python", "typescript", "development", "best-practices"]`

## Complete Example

```json
{
  "name": "my-plugin",
  "version": "0.1.0",
  "description": "A helpful plugin that does useful things for developers",
  "author": {
    "name": "Haochuan Zhang",
    "email": "jackchang26@gmail.com"
  },
  "keywords": ["utility", "automation", "productivity"]
}
```

## Minimal Example

```json
{
  "name": "my-plugin"
}
```

## Existing Plugin References

### developer
```json
{
  "name": "developer",
  "version": "0.1.2",
  "description": "Professional development skills for Python, TypeScript, C#, and Java with industry best practices and coding standards",
  "author": {
    "name": "Haochuan Zhang",
    "email": "jackchang26@gmail.com"
  },
  "keywords": [
    "python",
    "typescript",
    "csharp",
    "java",
    "development",
    "best-practices",
    "coding-standards"
  ]
}
```

### sample-plugin
```json
{
  "name": "sample-plugin",
  "version": "0.1.2",
  "description": "Sample plugin demonstrating the structure for the star-digital-employee collection",
  "author": {
    "name": "Haochuan Zhang",
    "email": "jackchang26@gmail.com"
  },
  "keywords": [
    "sample",
    "template",
    "example"
  ]
}
```

## Validation Rules

### Name Validation
- Must contain only lowercase letters, numbers, and hyphens
- Must start with a letter
- Must not contain consecutive hyphens
- Must not start or end with a hyphen
- Examples of valid names: `my-plugin`, `dev-tools-2`, `awesome-util`
- Examples of invalid names: `My-Plugin`, `my_plugin`, `-my-plugin`, `my--plugin`

### Version Validation
- Must follow semantic versioning: `MAJOR.MINOR.PATCH`
- MAJOR: Incremented for breaking changes
- MINOR: Incremented for new features (backwards compatible)
- PATCH: Incremented for bug fixes (backwards compatible)
- New plugins should start at `0.1.0`

### Consistency Requirements
- The `name` field must match the plugin's folder name
- The `name` and `version` must match corresponding marketplace.json entry (if registered)

## Validation Checklist

When creating a new plugin.json, verify:

- [ ] `name` is in kebab-case
- [ ] `name` matches the plugin folder name
- [ ] `version` follows semantic versioning (if provided)
- [ ] `description` is concise but informative (if provided)
- [ ] `author.name` is present if `author` object exists
- [ ] `keywords` are all lowercase strings (if provided)
- [ ] JSON syntax is valid
