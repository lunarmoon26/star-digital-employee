# Python Patterns and Anti-Patterns Reference

## Creational Patterns

### Factory Pattern

Use factory functions or classes to encapsulate object creation logic.

```python
from abc import ABC, abstractmethod
from typing import Literal

class Serializer(ABC):
    @abstractmethod
    def serialize(self, data: dict) -> str: ...

class JsonSerializer(Serializer):
    def serialize(self, data: dict) -> str:
        import json
        return json.dumps(data)

class XmlSerializer(Serializer):
    def serialize(self, data: dict) -> str:
        # XML serialization logic
        ...

def get_serializer(format: Literal["json", "xml"]) -> Serializer:
    """Factory function for serializers."""
    serializers = {
        "json": JsonSerializer,
        "xml": XmlSerializer,
    }
    return serializers[format]()
```

### Singleton Pattern

Use module-level instances or `functools.lru_cache` for singletons.

```python
# Module-level singleton
class _DatabaseConnection:
    def __init__(self):
        self._connection = None

    def get_connection(self):
        if self._connection is None:
            self._connection = create_connection()
        return self._connection

db = _DatabaseConnection()

# Or with lru_cache
from functools import lru_cache

@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings.from_env()
```

### Builder Pattern

Use method chaining for complex object construction.

```python
@dataclass
class QueryBuilder:
    _table: str = ""
    _columns: list[str] = field(default_factory=list)
    _conditions: list[str] = field(default_factory=list)

    def select(self, *columns: str) -> "QueryBuilder":
        self._columns.extend(columns)
        return self

    def from_table(self, table: str) -> "QueryBuilder":
        self._table = table
        return self

    def where(self, condition: str) -> "QueryBuilder":
        self._conditions.append(condition)
        return self

    def build(self) -> str:
        cols = ", ".join(self._columns) or "*"
        sql = f"SELECT {cols} FROM {self._table}"
        if self._conditions:
            sql += " WHERE " + " AND ".join(self._conditions)
        return sql

# Usage
query = (QueryBuilder()
    .select("id", "name", "email")
    .from_table("users")
    .where("active = true")
    .where("role = 'admin'")
    .build())
```

## Structural Patterns

### Decorator Pattern (Class-Based)

```python
from abc import ABC, abstractmethod

class DataSource(ABC):
    @abstractmethod
    def read(self) -> str: ...

    @abstractmethod
    def write(self, data: str) -> None: ...

class FileDataSource(DataSource):
    def __init__(self, filename: str):
        self.filename = filename

    def read(self) -> str:
        with open(self.filename) as f:
            return f.read()

    def write(self, data: str) -> None:
        with open(self.filename, "w") as f:
            f.write(data)

class DataSourceDecorator(DataSource):
    def __init__(self, source: DataSource):
        self._source = source

    def read(self) -> str:
        return self._source.read()

    def write(self, data: str) -> None:
        self._source.write(data)

class EncryptionDecorator(DataSourceDecorator):
    def read(self) -> str:
        return decrypt(self._source.read())

    def write(self, data: str) -> None:
        self._source.write(encrypt(data))

class CompressionDecorator(DataSourceDecorator):
    def read(self) -> str:
        return decompress(self._source.read())

    def write(self, data: str) -> None:
        self._source.write(compress(data))

# Usage
source = CompressionDecorator(EncryptionDecorator(FileDataSource("data.txt")))
```

### Adapter Pattern

```python
class LegacyPaymentGateway:
    def process_payment_xml(self, xml_data: str) -> str:
        # Legacy XML-based API
        ...

class ModernPaymentAdapter:
    """Adapts legacy XML gateway to modern JSON interface."""

    def __init__(self, legacy_gateway: LegacyPaymentGateway):
        self._gateway = legacy_gateway

    def process_payment(self, payment: dict) -> dict:
        xml_request = self._dict_to_xml(payment)
        xml_response = self._gateway.process_payment_xml(xml_request)
        return self._xml_to_dict(xml_response)

    def _dict_to_xml(self, data: dict) -> str: ...
    def _xml_to_dict(self, xml: str) -> dict: ...
```

## Behavioral Patterns

### Strategy Pattern

```python
from abc import ABC, abstractmethod
from typing import Callable

class SortStrategy(ABC):
    @abstractmethod
    def sort(self, data: list) -> list: ...

class QuickSort(SortStrategy):
    def sort(self, data: list) -> list:
        # Quicksort implementation
        ...

class MergeSort(SortStrategy):
    def sort(self, data: list) -> list:
        # Mergesort implementation
        ...

class Sorter:
    def __init__(self, strategy: SortStrategy):
        self._strategy = strategy

    def sort(self, data: list) -> list:
        return self._strategy.sort(data)

# Or use functions directly
SortFunc = Callable[[list], list]

def create_sorter(strategy: SortFunc) -> Callable[[list], list]:
    def sort(data: list) -> list:
        return strategy(data)
    return sort
```

### Observer Pattern

```python
from abc import ABC, abstractmethod
from typing import Any

class Observer(ABC):
    @abstractmethod
    def update(self, event: str, data: Any) -> None: ...

class Subject:
    def __init__(self):
        self._observers: list[Observer] = []

    def attach(self, observer: Observer) -> None:
        self._observers.append(observer)

    def detach(self, observer: Observer) -> None:
        self._observers.remove(observer)

    def notify(self, event: str, data: Any = None) -> None:
        for observer in self._observers:
            observer.update(event, data)

# Modern approach with callbacks
from dataclasses import dataclass, field
from collections.abc import Callable

EventHandler = Callable[[str, Any], None]

@dataclass
class EventEmitter:
    _handlers: dict[str, list[EventHandler]] = field(default_factory=dict)

    def on(self, event: str, handler: EventHandler) -> None:
        self._handlers.setdefault(event, []).append(handler)

    def emit(self, event: str, data: Any = None) -> None:
        for handler in self._handlers.get(event, []):
            handler(event, data)
```

## Common Anti-Patterns

### Mutable Default Arguments

```python
# WRONG - mutable default is shared across calls
def add_item(item, items=[]):
    items.append(item)
    return items

# CORRECT - use None and create new list
def add_item(item, items=None):
    if items is None:
        items = []
    items.append(item)
    return items
```

### Bare Except Clauses

```python
# WRONG - catches everything including KeyboardInterrupt
try:
    risky_operation()
except:
    pass

# CORRECT - catch specific exceptions
try:
    risky_operation()
except SpecificError as e:
    logger.error("Operation failed: %s", e)
    handle_error(e)
```

### Using `type()` Instead of `isinstance()`

```python
# WRONG - doesn't work with inheritance
if type(obj) == list:
    ...

# CORRECT - works with subclasses
if isinstance(obj, list):
    ...

# EVEN BETTER - use abstract types for duck typing
from collections.abc import Sequence
if isinstance(obj, Sequence):
    ...
```

### String Concatenation in Loops

```python
# WRONG - creates new string objects each iteration
result = ""
for item in items:
    result += str(item) + ", "

# CORRECT - use join
result = ", ".join(str(item) for item in items)
```

### Not Using Context Managers

```python
# WRONG - resource may not be closed on exception
f = open("file.txt")
data = f.read()
f.close()

# CORRECT - always use context manager
with open("file.txt") as f:
    data = f.read()
```

### Checking for None with ==

```python
# WRONG - can be fooled by objects implementing __eq__
if value == None:
    ...

# CORRECT - use is/is not for None checks
if value is None:
    ...
```

## Pythonic Idioms

### Unpacking

```python
# Swap variables
a, b = b, a

# Ignore values with underscore
first, *_, last = items

# Unpack in loops
for key, value in dictionary.items():
    ...
```

### EAFP (Easier to Ask Forgiveness than Permission)

```python
# LBYL style (Look Before You Leap) - less Pythonic
if key in dictionary:
    value = dictionary[key]
else:
    value = default

# EAFP style - more Pythonic
try:
    value = dictionary[key]
except KeyError:
    value = default

# Even better - use dict.get()
value = dictionary.get(key, default)
```

### Truthiness

```python
# WRONG - explicit comparison to empty/zero
if len(items) == 0:
    ...
if value == "":
    ...

# CORRECT - use truthiness
if not items:
    ...
if not value:
    ...
```

### Enumerate for Index Access

```python
# WRONG - manual index tracking
index = 0
for item in items:
    print(f"{index}: {item}")
    index += 1

# CORRECT - use enumerate
for index, item in enumerate(items):
    print(f"{index}: {item}")

# With custom start
for index, item in enumerate(items, start=1):
    print(f"{index}: {item}")
```

### Zip for Parallel Iteration

```python
# Iterate over multiple sequences
for name, age in zip(names, ages):
    print(f"{name} is {age} years old")

# Use strict=True (Python 3.10+) to catch length mismatches
for name, age in zip(names, ages, strict=True):
    ...
```

## Async Patterns

### Concurrent Execution

```python
import asyncio

async def fetch_all(urls: list[str]) -> list[Response]:
    async with aiohttp.ClientSession() as session:
        tasks = [fetch_url(session, url) for url in urls]
        return await asyncio.gather(*tasks)

# With error handling
async def fetch_all_safe(urls: list[str]) -> list[Response | Exception]:
    async with aiohttp.ClientSession() as session:
        tasks = [fetch_url(session, url) for url in urls]
        return await asyncio.gather(*tasks, return_exceptions=True)
```

### Semaphore for Rate Limiting

```python
async def fetch_with_limit(urls: list[str], max_concurrent: int = 10):
    semaphore = asyncio.Semaphore(max_concurrent)

    async def fetch_one(url: str):
        async with semaphore:
            return await fetch_url(url)

    return await asyncio.gather(*[fetch_one(url) for url in urls])
```

### Task Groups (Python 3.11+)

```python
async def process_batch(items: list[Item]) -> list[Result]:
    results = []
    async with asyncio.TaskGroup() as tg:
        for item in items:
            tg.create_task(process_item(item, results))
    return results
```
