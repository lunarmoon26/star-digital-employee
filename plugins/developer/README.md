# Developer Plugin

Professional development skills for Python, TypeScript, C#, and Java with industry best practices and coding standards.

## Overview

The Developer plugin provides comprehensive guidance for writing high-quality code in four major programming languages. Each skill covers language-specific best practices, modern features, patterns, testing approaches, and tooling configurations.

## Installation

Install the plugin by adding the plugin directory to your Claude Code configuration:

```bash
claude --plugin-dir path/to/plugins/developer
```

Or add it to your settings:

```json
{
  "plugins": ["path/to/plugins/developer"]
}
```

## Available Skills

### Python (`python`)

**Triggers**: "write python code", "python best practices", "PEP 8 style", "pythonic code", "python type hints", "python async", "python testing"

Topics covered:
- PEP 8 code style and naming conventions
- Type hints and static typing with mypy/pyright
- Context managers and resource management
- List comprehensions and generator expressions
- Async/await patterns with asyncio
- Dataclasses and data structures
- Exception handling best practices
- Testing with pytest
- Tooling: Black, isort, Ruff, pre-commit

### TypeScript (`typescript`)

**Triggers**: "write typescript code", "typescript best practices", "type safety", "ts generics", "typescript interfaces", "ts async patterns"

Topics covered:
- Strict type configuration
- Interfaces vs type aliases
- Generics and constraints
- Union types and discriminated unions
- Nullable handling with optional chaining
- Async patterns and Promise handling
- Type guards and narrowing
- Error handling with Result types
- Module organization
- Testing with type safety
- ESLint and Prettier configuration
- TSDoc documentation

### C# (`csharp`)

**Triggers**: "write c# code", "csharp best practices", "dotnet development", "c# async patterns", "c# nullable types", "LINQ queries"

Topics covered:
- Microsoft naming conventions
- Nullable reference types
- LINQ best practices
- Async/await with CancellationToken
- Records and immutable types
- Pattern matching
- Exception handling and custom exceptions
- Dependency injection
- Testing with xUnit
- Code analysis and .editorconfig
- XML documentation

### Java (`java`)

**Triggers**: "write java code", "java best practices", "jdk features", "java records", "java streams", "java optional"

Topics covered:
- Oracle naming conventions
- Modern Java features (JDK 17+)
- Records and sealed classes
- Pattern matching
- Streams and functional programming
- Optional usage
- Exception handling
- Dependency injection
- Testing with JUnit 5
- Concurrency with CompletableFuture
- Checkstyle and SpotBugs
- Javadoc documentation

## Skill Structure

Each skill includes:

1. **SKILL.md** - Main skill file with ~1,800 words of best practices
   - YAML frontmatter with name and trigger description
   - Comprehensive coverage of language-specific standards
   - Code examples demonstrating proper usage

2. **references/patterns.md** - Detailed patterns reference
   - Creational patterns (Factory, Builder, Singleton)
   - Structural patterns (Repository, Decorator, Adapter)
   - Behavioral patterns (Strategy, Observer, Mediator)
   - Common anti-patterns to avoid
   - Language-specific idioms

## Usage Examples

Ask Claude to apply these skills naturally:

```
"Help me write pythonic code for processing a list of users"
"What are TypeScript best practices for error handling?"
"Review this C# async code for issues"
"How should I structure Java records for my domain model?"
```

Or reference specific topics:

```
"Show me the Python async/await patterns"
"What's the TypeScript pattern for discriminated unions?"
"Help me with C# LINQ best practices"
"Explain Java Optional usage"
```

## Contributing

To add new language skills or update existing ones:

1. Create a new directory under `skills/` with the language name
2. Add `SKILL.md` with proper frontmatter and content (~1,800 words)
3. Add `references/patterns.md` with detailed patterns
4. Update this README with the new skill information

## License

MIT License - See LICENSE file for details.
