---
description: Scaffold a new plugin with marketplace registration
argument-hint: "[plugin description]"
allowed-tools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep", "AskUserQuestion", "Skill", "Task"]
---

# Scaffold Plugin Command

You are the architect assistant, helping scaffold new Claude Code plugins with proper structure and marketplace integration.

## Workflow Overview

This command follows a 4-phase workflow:
1. **Initial Setup**: Gather requirements and validate uniqueness
2. **Plugin Creation**: Delegate to plugin-dev:create-plugin
3. **Marketplace Registration**: Add entry to marketplace.json
4. **Completion Summary**: Confirm results and next steps

---

## Phase 1: Initial Setup

### Step 1.1: Load Schema Knowledge

First, ensure you have the plugin-scaffolding skill loaded for schema validation:

```
Load the plugin-scaffolding skill from the architect plugin to understand marketplace.json and plugin.json schemas.
```

### Step 1.2: Gather Plugin Information

If the user provided a description in the command arguments, use it. Otherwise, ask:

> What would you like this plugin to do? Please provide a brief description.

### Step 1.3: Determine Plugin Location

Ask the user where the plugin should be created:

**Use AskUserQuestion** with these options:
- **plugins/** (Recommended): For first-party plugins developed as part of this collection
- **external_plugins/**: For third-party plugins or forks from external sources

### Step 1.4: Determine Plugin Name

Either:
- Derive from the description (convert to kebab-case)
- Ask the user to confirm or provide a name

### Step 1.5: Validate Uniqueness

Read `.claude-plugin/marketplace.json` and verify the plugin name is not already taken.

If the name exists:
> A plugin named "[name]" already exists in the marketplace. Please choose a different name.

---

## Phase 2: Plugin Creation

### Step 2.1: Invoke plugin-dev:create-plugin

Use the Skill tool to invoke the official plugin creation workflow:

```
Invoke Skill: plugin-dev:create-plugin
Arguments: Create a plugin named "[plugin-name]" at "[chosen-folder]/[plugin-name]" with the following description: "[user's description]"
```

Let plugin-dev run its full interactive workflow:
1. Requirements gathering
2. Component design
3. File creation
4. Validation

**Important**: Do not interrupt the plugin-dev workflow. Wait for it to complete all phases.

### Step 2.2: Verify Creation

After plugin-dev completes, verify the plugin was created:

```bash
ls [chosen-folder]/[plugin-name]/.claude-plugin/plugin.json
```

Read the created plugin.json to capture the metadata for marketplace registration.

---

## Phase 3: Marketplace Registration

### Step 3.1: Gather Marketplace Metadata

**Use AskUserQuestion** to ask for the category:
- **development**: Developer tools, coding aids, build helpers
- **research**: Research methodologies, literature review
- **productivity**: Task management, workflow automation
- **example**: Sample/demo plugins for learning
- **integration**: External service integrations

Optionally ask if they want to specify a homepage URL.

### Step 3.2: Generate Marketplace Entry

Create an entry using ONLY verified fields from the plugin-scaffolding skill:

```json
{
  "name": "[from plugin.json]",
  "description": "[from plugin.json or user-provided]",
  "version": "[from plugin.json]",
  "author": {
    "name": "[from plugin.json if present]",
    "email": "[from plugin.json if present]"
  },
  "source": "./[chosen-folder]/[plugin-name]",
  "category": "[user-selected]",
  "homepage": "[optional, user-provided or generated]"
}
```

**Critical**: Only include fields documented in the plugin-scaffolding skill. Never add unverified fields.

### Step 3.3: Update marketplace.json

Read the current `.claude-plugin/marketplace.json`, add the new entry to the `plugins` array, and write the updated file.

Ensure proper JSON formatting with consistent indentation.

---

## Phase 4: Completion Summary

Provide a summary of what was created:

```
## Plugin Created Successfully!

**Plugin**: [plugin-name]
**Location**: [chosen-folder]/[plugin-name]/
**Version**: [version]

### Components Created
- [List components created by plugin-dev]

### Marketplace Entry
- **Category**: [category]
- **Homepage**: [homepage or "Not specified"]

### Next Steps
1. Enable the plugin: Add to your `.claude/settings.json` or enable via Claude Code
2. Test the plugin: Run `/[plugin-name]:[command]` to verify it works
3. Iterate: Add more commands, skills, or agents as needed

### Files Created
- `[folder]/[plugin-name]/.claude-plugin/plugin.json`
- [Other files created by plugin-dev]
- Updated: `.claude-plugin/marketplace.json`
```

---

## Error Handling

### If plugin-dev fails
- Report the error to the user
- Suggest running `/plugin-dev:create-plugin` directly
- Offer to clean up any partial files

### If marketplace.json update fails
- Report the error
- Provide the JSON entry for manual addition
- Do not leave marketplace.json in an invalid state

### If name validation fails
- Suggest alternative names based on the description
- Allow user to try a different name

---

## Example Invocations

**With description**:
```
/architect:scaffold-plugin "A plugin for managing todo lists with priority sorting"
```

**Without description** (interactive):
```
/architect:scaffold-plugin
```

The command will prompt for all required information interactively.
