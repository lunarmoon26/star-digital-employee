---
name: typescript
description: This skill should be used when the user asks to "write typescript code", "typescript best practices", "type safety", "ts generics", "typescript interfaces", "ts async patterns", "typescript testing", "eslint configuration", or needs guidance on professional TypeScript development.
---

# TypeScript Development Best Practices

Apply these standards when writing TypeScript code to ensure type safety, maintainability, and professional quality.

## Strict Type Configuration

Enable strict mode in `tsconfig.json` to catch errors at compile time. Use the strictest settings the project can support.

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true
  }
}
```

Never use `@ts-ignore` without documenting the reason. Prefer `@ts-expect-error` when suppression is necessary as it fails if the error is fixed. Address type errors properly rather than suppressing them. Use `unknown` instead of `any` when the type is truly unknown.

Avoid type assertions (`as`) except when narrowing from `unknown` after proper validation. Never use double assertions (`as unknown as Target`). Use type guards to narrow types safely.

## Interfaces vs Types

Use interfaces for object shapes that may be extended or implemented. Use type aliases for unions, intersections, primitives, tuples, and mapped types.

```typescript
// Interface - for object shapes
interface User {
  id: string;
  name: string;
  email: string;
}

// Extending interface
interface AdminUser extends User {
  permissions: string[];
}

// Type alias - for unions and complex types
type Status = 'pending' | 'active' | 'suspended';
type Result<T> = { success: true; data: T } | { success: false; error: Error };
type UserRecord = Record<string, User>;
```

Prefer interfaces when declaration merging is needed (module augmentation). Use types for function signatures when they need to be reused. Keep interfaces focused and single-purpose. Follow the Interface Segregation Principle.

## Generics

Use generics to create reusable, type-safe abstractions. Name generic parameters descriptively when their purpose isn't obvious.

```typescript
// Single generic with conventional name
function identity<T>(value: T): T {
  return value;
}

// Multiple generics with descriptive names
function mapObject<TInput, TOutput>(
  obj: Record<string, TInput>,
  mapper: (value: TInput) => TOutput
): Record<string, TOutput> {
  const result: Record<string, TOutput> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = mapper(value);
  }
  return result;
}
```

Use constraints to limit generic parameters. Use `extends` for upper bounds, `keyof` for key types, and conditional types for advanced patterns.

```typescript
// Constrained generic
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

// Conditional type
type Awaited<T> = T extends Promise<infer U> ? U : T;

// Generic with default
interface ApiResponse<T = unknown> {
  data: T;
  status: number;
}
```

Avoid overly complex generic signatures. Extract utility types for reuse. Document complex generic patterns with examples.

## Union Types and Discriminated Unions

Use discriminated unions for state management and handling different cases exhaustively.

```typescript
// Discriminated union with literal discriminant
type LoadingState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: Error };

function handleState<T>(state: LoadingState<T>): string {
  switch (state.status) {
    case 'idle':
      return 'Not started';
    case 'loading':
      return 'Loading...';
    case 'success':
      return `Loaded: ${JSON.stringify(state.data)}`;
    case 'error':
      return `Error: ${state.error.message}`;
  }
}
```

Use the `never` type to ensure exhaustive checking. Create helper functions to enforce exhaustiveness at compile time.

```typescript
function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${value}`);
}

function processAction(action: Action): void {
  switch (action.type) {
    case 'create':
      // handle create
      break;
    case 'update':
      // handle update
      break;
    default:
      assertNever(action); // Compile error if case missed
  }
}
```

## Null and Undefined Handling

Enable `strictNullChecks` to explicitly handle nullable values. Use optional chaining (`?.`) and nullish coalescing (`??`) operators.

```typescript
// Optional chaining
const city = user?.address?.city;

// Nullish coalescing (only for null/undefined)
const name = user.name ?? 'Anonymous';

// Non-null assertion (use sparingly, only when certain)
const element = document.getElementById('app')!;

// Type guard for null
function isNotNull<T>(value: T | null): value is T {
  return value !== null;
}
```

Prefer `undefined` over `null` for missing values in most cases. Be explicit about nullable types in function signatures. Use `Required<T>` and `NonNullable<T>` utility types when needed.

## Async Patterns

Use `async`/`await` consistently. Always specify return types for async functions. Handle promise rejections properly.

```typescript
// Explicit return type
async function fetchUser(id: string): Promise<User> {
  const response = await fetch(`/api/users/${id}`);
  if (!response.ok) {
    throw new ApiError('Failed to fetch user', response.status);
  }
  return response.json() as Promise<User>;
}

// Concurrent execution
async function fetchUserWithPosts(userId: string): Promise<UserWithPosts> {
  const [user, posts] = await Promise.all([
    fetchUser(userId),
    fetchUserPosts(userId),
  ]);
  return { ...user, posts };
}
```

Use `Promise.allSettled` when all operations should complete regardless of failures. Use `Promise.race` for timeouts. Avoid mixing callbacks and promises.

```typescript
// Handle partial failures
async function fetchMultipleUsers(ids: string[]): Promise<Map<string, User | Error>> {
  const results = await Promise.allSettled(ids.map(fetchUser));
  const userMap = new Map<string, User | Error>();

  results.forEach((result, index) => {
    userMap.set(
      ids[index],
      result.status === 'fulfilled' ? result.value : result.reason
    );
  });

  return userMap;
}
```

## Type Guards and Narrowing

Create custom type guards for runtime type checking. Use `is` return type for type predicates.

```typescript
// User-defined type guard
function isUser(value: unknown): value is User {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'name' in value &&
    typeof (value as User).id === 'string' &&
    typeof (value as User).name === 'string'
  );
}

// Assertion function (throws if invalid)
function assertUser(value: unknown): asserts value is User {
  if (!isUser(value)) {
    throw new TypeError('Value is not a User');
  }
}

// Using assertion
function processUser(data: unknown): void {
  assertUser(data);
  // TypeScript knows data is User here
  console.log(data.name);
}
```

Use `in` operator for property checks. Use `instanceof` for class instances. Combine guards with discriminated unions for complex narrowing.

## Error Handling

Create typed error classes for different error categories. Use error boundaries and result types for expected failures.

```typescript
// Custom error class
class ApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Result type for expected failures
type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

function parseJson<T>(json: string): Result<T, SyntaxError> {
  try {
    return { ok: true, value: JSON.parse(json) as T };
  } catch (error) {
    return { ok: false, error: error as SyntaxError };
  }
}

// Usage
const result = parseJson<Config>(configString);
if (result.ok) {
  console.log(result.value);
} else {
  console.error('Parse failed:', result.error.message);
}
```

## Module Organization

Use ES modules with explicit exports. Prefer named exports for better refactoring support. Organize imports consistently.

```typescript
// Named exports (preferred)
export interface Config { /* ... */ }
export function loadConfig(): Config { /* ... */ }
export const DEFAULT_CONFIG: Config = { /* ... */ };

// Re-export for public API
export { User, type UserRole } from './user';
export * from './errors';

// Default export only for main entry or when conventional
export default function createApp() { /* ... */ }
```

Use barrel files (`index.ts`) to define public APIs. Keep internal modules private. Use path aliases for cleaner imports. Avoid circular dependencies.

```typescript
// tsconfig.json paths
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "@components/*": ["./src/components/*"]
    }
  }
}

// Clean imports
import { Button } from '@components/Button';
import { formatDate } from '@/utils';
```

## Testing with Type Safety

Use testing libraries that support TypeScript. Write type-safe mocks and test utilities.

```typescript
import { describe, it, expect, vi } from 'vitest';

// Type-safe mock
const mockUserService = {
  getUser: vi.fn<[string], Promise<User>>(),
  createUser: vi.fn<[CreateUserDto], Promise<User>>(),
};

describe('UserController', () => {
  it('should return user for valid id', async () => {
    const expectedUser: User = { id: '1', name: 'Alice', email: 'alice@example.com' };
    mockUserService.getUser.mockResolvedValue(expectedUser);

    const controller = new UserController(mockUserService);
    const result = await controller.getUser('1');

    expect(result).toEqual(expectedUser);
    expect(mockUserService.getUser).toHaveBeenCalledWith('1');
  });
});

// Test type inference
it('should have correct type inference', () => {
  const users: User[] = [];
  // Type error if push receives wrong type
  users.push({ id: '1', name: 'Test', email: 'test@example.com' });

  expectTypeOf(users[0]).toMatchTypeOf<User>();
});
```

## Utility Types

Master built-in utility types for common transformations.

```typescript
// Pick and Omit for object manipulation
type UserPreview = Pick<User, 'id' | 'name'>;
type UserWithoutEmail = Omit<User, 'email'>;

// Partial and Required for optionality
type UpdateUserDto = Partial<User>;
type CompleteUser = Required<User>;

// Record for object types
type StatusLabels = Record<Status, string>;

// Extract and Exclude for union manipulation
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';
type SafeMethods = Extract<HttpMethod, 'GET'>;
type UnsafeMethods = Exclude<HttpMethod, 'GET'>;

// ReturnType and Parameters for function types
type ConfigLoader = () => Promise<Config>;
type LoaderReturn = ReturnType<ConfigLoader>; // Promise<Config>
type LoaderParams = Parameters<typeof loadConfig>; // []
```

## ESLint and Prettier Configuration

Configure ESLint with TypeScript-specific rules. Use Prettier for formatting. Integrate with CI/CD.

```json
// .eslintrc.json
{
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-type-checked",
    "prettier"
  ],
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "project": true
  },
  "rules": {
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "@typescript-eslint/explicit-function-return-type": "warn",
    "@typescript-eslint/no-floating-promises": "error",
    "@typescript-eslint/no-misused-promises": "error"
  }
}
```

Run type checking separately from linting for better error messages. Use `tsc --noEmit` in CI. Configure import sorting with `eslint-plugin-import` or `@trivago/prettier-plugin-sort-imports`.

## Documentation with TSDoc

Use TSDoc comments for public APIs. Document parameters, return values, and thrown exceptions.

```typescript
/**
 * Fetches a user by their unique identifier.
 *
 * @param id - The user's unique identifier
 * @returns A promise that resolves to the user object
 * @throws {@link NotFoundError} When no user exists with the given ID
 * @throws {@link ApiError} When the API request fails
 *
 * @example
 * ```typescript
 * const user = await fetchUser('123');
 * console.log(user.name);
 * ```
 */
async function fetchUser(id: string): Promise<User> {
  // implementation
}
```

Generate documentation with TypeDoc. Keep documentation synchronized with code. Document breaking changes in CHANGELOG.

## Additional Resources

For detailed patterns and anti-patterns, consult:
- **`references/patterns.md`** - Comprehensive TypeScript patterns and examples
