---
name: python
description: This skill should be used when the user asks to "write python code", "python best practices", "PEP 8 style", "pythonic code", "python type hints", "python async", "python testing", "python dataclasses", "python patterns", or needs guidance on professional Python development.
---

# Python Development Best Practices

Apply these standards when writing Python code to ensure maintainability, readability, and professional quality.

## Code Style and PEP 8 Compliance

Follow PEP 8 as the foundational style guide for all Python code. Use 4 spaces for indentation—never tabs. Limit lines to 88 characters when using Black formatter, or 79 characters for strict PEP 8 compliance. Place two blank lines before top-level function and class definitions, and one blank line between method definitions within a class.

Name modules and packages using short, all-lowercase names without underscores when possible. Name classes using CapWords convention (e.g., `HttpClient`, `DataProcessor`). Name functions and variables using snake_case (e.g., `calculate_total`, `user_count`). Name constants using UPPER_CASE_WITH_UNDERSCORES (e.g., `MAX_RETRIES`, `DEFAULT_TIMEOUT`).

Use meaningful, descriptive names that reveal intent. Avoid single-letter variables except for counters (`i`, `j`, `k`), coordinates (`x`, `y`, `z`), or well-established conventions (`e` for exceptions, `f` for files). Prefix private attributes and methods with a single underscore (`_internal_method`). Use double underscore prefix only for name mangling when necessary (`__private`).

## Type Hints and Static Typing

Add type hints to all function signatures for parameters and return values. This enables static analysis tools to catch errors before runtime and serves as executable documentation.

```python
def process_user(user_id: int, options: dict[str, Any] | None = None) -> User:
    """Process a user with the given ID and optional configuration."""
    ...
```

Import types from the `typing` module for complex annotations. Use `TypeVar` for generic functions, `Protocol` for structural subtyping, and `TypedDict` for typed dictionary structures. Prefer `collections.abc` types (`Sequence`, `Mapping`, `Iterable`) over concrete types (`list`, `dict`) in function parameters to accept broader inputs.

Use the `|` union syntax (Python 3.10+) instead of `Union`. Use `X | None` instead of `Optional[X]`. Enable postponed evaluation of annotations with `from __future__ import annotations` when supporting Python 3.9 or earlier.

Run mypy or pyright in strict mode as part of the CI pipeline. Configure type checkers to disallow untyped definitions and require explicit `Any` usage. Address all type errors rather than suppressing them with `# type: ignore` unless absolutely necessary and documented.

## Context Managers and Resource Management

Use context managers (`with` statement) for all resources that require cleanup: files, database connections, locks, network connections, and temporary resources. This guarantees proper cleanup even when exceptions occur.

```python
with open("data.json", "r", encoding="utf-8") as f:
    data = json.load(f)
```

Create custom context managers using `@contextmanager` decorator for simple cases or by implementing `__enter__` and `__exit__` methods for class-based managers. Use `contextlib.ExitStack` when managing multiple dynamic resources.

Never rely on garbage collection for resource cleanup. Avoid leaving file handles or connections open longer than necessary. Use `contextlib.suppress` to elegantly ignore specific exceptions when appropriate.

## List Comprehensions and Generator Expressions

Prefer list comprehensions over `map()` and `filter()` with lambdas for simple transformations. Keep comprehensions readable—if they span multiple lines or become complex, refactor to a regular loop.

```python
# Preferred
squares = [x ** 2 for x in numbers if x > 0]

# Instead of
squares = list(map(lambda x: x ** 2, filter(lambda x: x > 0, numbers)))
```

Use generator expressions for memory efficiency when iterating once over large datasets. Use `()` instead of `[]` to create generators. Chain generators for data processing pipelines.

```python
total = sum(line_total for order in orders for line_total in order.line_totals)
```

Use dictionary and set comprehensions where they improve clarity. Avoid nested comprehensions beyond two levels—extract to helper functions instead.

## Async/Await Patterns

Use `async`/`await` for I/O-bound concurrent operations. Define coroutines with `async def` and await other coroutines, tasks, or awaitables.

```python
async def fetch_user_data(user_id: int) -> dict[str, Any]:
    async with aiohttp.ClientSession() as session:
        async with session.get(f"/users/{user_id}") as response:
            return await response.json()
```

Use `asyncio.gather()` to run multiple coroutines concurrently. Use `asyncio.create_task()` to schedule coroutines as tasks. Use `asyncio.wait_for()` to apply timeouts. Use `asyncio.TaskGroup` (Python 3.11+) for structured concurrency with automatic cancellation.

Never mix blocking and async code without proper isolation. Use `asyncio.to_thread()` or `loop.run_in_executor()` to run blocking operations in thread pools. Use async context managers (`async with`) and async iterators (`async for`) for async resources.

Handle cancellation gracefully using try/finally blocks. Clean up resources when `CancelledError` is raised. Configure proper exception handling for task groups.

## Dataclasses and Data Structures

Use `@dataclass` decorator for classes that primarily store data. Dataclasses automatically generate `__init__`, `__repr__`, `__eq__`, and optionally other methods.

```python
from dataclasses import dataclass, field

@dataclass(frozen=True)
class User:
    id: int
    name: str
    email: str
    roles: list[str] = field(default_factory=list)
```

Use `frozen=True` to create immutable dataclasses. Use `field(default_factory=...)` for mutable default values. Use `slots=True` (Python 3.10+) for memory efficiency. Use `kw_only=True` (Python 3.10+) to require keyword arguments.

Consider `NamedTuple` for simple immutable records or when tuple unpacking is desired. Use Pydantic models when data validation, serialization, or schema generation is needed. Use `attrs` library as an alternative with more features than stdlib dataclasses.

## Exception Handling

Catch specific exceptions rather than bare `except:` or broad `except Exception:`. Handle exceptions at the appropriate abstraction level. Let exceptions propagate when the current context cannot meaningfully handle them.

```python
try:
    result = fetch_data(url)
except httpx.TimeoutException:
    logger.warning("Request timed out, using cached data")
    result = get_cached_data(url)
except httpx.HTTPStatusError as e:
    logger.error("HTTP error %d: %s", e.response.status_code, e.response.text)
    raise DataFetchError(f"Failed to fetch from {url}") from e
```

Create custom exception hierarchies for application-specific errors. Inherit from appropriate base exceptions (`ValueError`, `TypeError`, `RuntimeError`). Use exception chaining with `raise ... from ...` to preserve context.

Use `else` clause for code that should run only if no exception occurred. Use `finally` for cleanup that must always run. Log exceptions with full context using `logger.exception()` or `exc_info=True`.

## Testing with pytest

Structure tests using pytest conventions. Name test files with `test_` prefix. Name test functions with `test_` prefix. Group related tests in classes prefixed with `Test`.

```python
class TestUserService:
    def test_create_user_with_valid_data(self, db_session):
        service = UserService(db_session)
        user = service.create(name="Alice", email="alice@example.com")

        assert user.id is not None
        assert user.name == "Alice"

    def test_create_user_with_duplicate_email_raises_error(self, db_session):
        service = UserService(db_session)
        service.create(name="Alice", email="alice@example.com")

        with pytest.raises(DuplicateEmailError):
            service.create(name="Bob", email="alice@example.com")
```

Use fixtures for test setup and dependency injection. Define fixtures in `conftest.py` for shared fixtures. Use `@pytest.mark.parametrize` for data-driven tests. Use `pytest.raises` as a context manager to assert exceptions.

Mock external dependencies using `unittest.mock` or `pytest-mock`. Use `monkeypatch` fixture for simple attribute/environment patching. Prefer dependency injection over excessive mocking. Test behavior, not implementation details.

Aim for high coverage but prioritize meaningful tests over coverage metrics. Test edge cases, error conditions, and boundary values. Keep tests fast, isolated, and deterministic.

## Code Organization and Imports

Organize imports in three groups separated by blank lines: standard library, third-party packages, local application imports. Sort imports alphabetically within each group. Use absolute imports for clarity.

```python
import json
from collections.abc import Sequence
from typing import Any

import httpx
from pydantic import BaseModel

from myapp.core import settings
from myapp.models import User
```

Use `isort` to automatically format imports. Configure it to match Black's formatting. Import specific names rather than entire modules when only a few items are needed. Avoid wildcard imports (`from module import *`).

Structure packages with clear public APIs. Use `__all__` to explicitly declare public names. Keep modules focused on a single responsibility. Limit circular imports by restructuring dependencies or using lazy imports.

## Tooling and Development Environment

Configure a standard set of development tools for consistent code quality:

- **Black**: Uncompromising code formatter. Configure line length to 88.
- **isort**: Import sorter. Configure profile to "black".
- **Ruff**: Fast linter combining Flake8, isort, and more. Enable rules progressively.
- **mypy** or **pyright**: Static type checker. Enable strict mode.
- **pytest**: Test runner with rich plugin ecosystem.
- **pre-commit**: Git hooks for automated checks before commits.

Configure all tools in `pyproject.toml` for centralized configuration. Run formatters and linters in CI to enforce standards. Generate type stubs for untyped dependencies.

Use virtual environments for project isolation. Prefer `venv` for simplicity or `conda` for data science projects. Pin dependencies with specific versions in `requirements.txt` or use lock files with Poetry/PDM. Separate development dependencies from production dependencies.

## Documentation and Docstrings

Write docstrings for all public modules, classes, functions, and methods. Follow Google style, NumPy style, or reStructuredText style consistently throughout the project.

```python
def calculate_discount(price: Decimal, rate: float) -> Decimal:
    """Calculate discounted price.

    Args:
        price: Original price before discount.
        rate: Discount rate as a decimal (e.g., 0.1 for 10%).

    Returns:
        The discounted price, rounded to 2 decimal places.

    Raises:
        ValueError: If rate is negative or greater than 1.
    """
    if not 0 <= rate <= 1:
        raise ValueError(f"Discount rate must be between 0 and 1, got {rate}")
    return (price * (1 - Decimal(str(rate)))).quantize(Decimal("0.01"))
```

Document module-level behavior at the top of files. Document class purpose and usage in class docstrings. Keep docstrings updated when code changes. Generate documentation with Sphinx or MkDocs.

## Additional Resources

For detailed patterns and anti-patterns, consult:
- **`references/patterns.md`** - Comprehensive Python patterns and examples
