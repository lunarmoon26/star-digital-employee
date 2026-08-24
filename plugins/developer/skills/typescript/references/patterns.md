# TypeScript Patterns and Anti-Patterns Reference

## Creational Patterns

### Factory Pattern with Type Safety

```typescript
interface Product {
  type: string;
  create(): void;
}

class ConcreteProductA implements Product {
  type = 'A' as const;
  create(): void {
    console.log('Creating Product A');
  }
}

class ConcreteProductB implements Product {
  type = 'B' as const;
  create(): void {
    console.log('Creating Product B');
  }
}

type ProductType = 'A' | 'B';

const productFactories: Record<ProductType, () => Product> = {
  A: () => new ConcreteProductA(),
  B: () => new ConcreteProductB(),
};

function createProduct(type: ProductType): Product {
  return productFactories[type]();
}
```

### Builder Pattern with Fluent Interface

```typescript
class RequestBuilder {
  private url = '';
  private method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET';
  private headers: Record<string, string> = {};
  private body?: unknown;

  setUrl(url: string): this {
    this.url = url;
    return this;
  }

  setMethod(method: 'GET' | 'POST' | 'PUT' | 'DELETE'): this {
    this.method = method;
    return this;
  }

  setHeader(key: string, value: string): this {
    this.headers[key] = value;
    return this;
  }

  setBody<T>(body: T): this {
    this.body = body;
    return this;
  }

  build(): Request {
    return new Request(this.url, {
      method: this.method,
      headers: this.headers,
      body: this.body ? JSON.stringify(this.body) : undefined,
    });
  }
}

// Usage
const request = new RequestBuilder()
  .setUrl('/api/users')
  .setMethod('POST')
  .setHeader('Content-Type', 'application/json')
  .setBody({ name: 'Alice' })
  .build();
```

### Singleton with Type Safety

```typescript
class DatabaseConnection {
  private static instance: DatabaseConnection | null = null;

  private constructor(private readonly connectionString: string) {}

  static getInstance(connectionString: string): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection(connectionString);
    }
    return DatabaseConnection.instance;
  }

  query<T>(sql: string): Promise<T[]> {
    // Implementation
    return Promise.resolve([]);
  }
}

// Or use module-level singleton
let instance: DatabaseConnection | null = null;

export function getDatabase(connectionString: string): DatabaseConnection {
  instance ??= new DatabaseConnection(connectionString);
  return instance;
}
```

## Structural Patterns

### Adapter Pattern

```typescript
// Legacy interface
interface LegacyUser {
  usr_id: number;
  usr_name: string;
  usr_email: string;
}

// Modern interface
interface User {
  id: string;
  name: string;
  email: string;
}

// Adapter
class LegacyUserAdapter implements User {
  constructor(private legacyUser: LegacyUser) {}

  get id(): string {
    return String(this.legacyUser.usr_id);
  }

  get name(): string {
    return this.legacyUser.usr_name;
  }

  get email(): string {
    return this.legacyUser.usr_email;
  }
}

// Adapter function
function adaptLegacyUser(legacy: LegacyUser): User {
  return {
    id: String(legacy.usr_id),
    name: legacy.usr_name,
    email: legacy.usr_email,
  };
}
```

### Repository Pattern

```typescript
interface Repository<T, ID = string> {
  findById(id: ID): Promise<T | null>;
  findAll(): Promise<T[]>;
  create(entity: Omit<T, 'id'>): Promise<T>;
  update(id: ID, entity: Partial<T>): Promise<T>;
  delete(id: ID): Promise<void>;
}

interface User {
  id: string;
  name: string;
  email: string;
}

class UserRepository implements Repository<User> {
  constructor(private db: Database) {}

  async findById(id: string): Promise<User | null> {
    return this.db.users.findUnique({ where: { id } });
  }

  async findAll(): Promise<User[]> {
    return this.db.users.findMany();
  }

  async create(data: Omit<User, 'id'>): Promise<User> {
    return this.db.users.create({ data });
  }

  async update(id: string, data: Partial<User>): Promise<User> {
    return this.db.users.update({ where: { id }, data });
  }

  async delete(id: string): Promise<void> {
    await this.db.users.delete({ where: { id } });
  }
}
```

## Behavioral Patterns

### Strategy Pattern

```typescript
interface PaymentStrategy {
  pay(amount: number): Promise<PaymentResult>;
}

class CreditCardPayment implements PaymentStrategy {
  constructor(private cardNumber: string) {}

  async pay(amount: number): Promise<PaymentResult> {
    // Process credit card payment
    return { success: true, transactionId: 'cc-123' };
  }
}

class PayPalPayment implements PaymentStrategy {
  constructor(private email: string) {}

  async pay(amount: number): Promise<PaymentResult> {
    // Process PayPal payment
    return { success: true, transactionId: 'pp-456' };
  }
}

class PaymentProcessor {
  constructor(private strategy: PaymentStrategy) {}

  setStrategy(strategy: PaymentStrategy): void {
    this.strategy = strategy;
  }

  async processPayment(amount: number): Promise<PaymentResult> {
    return this.strategy.pay(amount);
  }
}
```

### Observer Pattern with TypeScript

```typescript
type EventMap = {
  userCreated: { userId: string; email: string };
  userDeleted: { userId: string };
  orderPlaced: { orderId: string; total: number };
};

type EventHandler<T> = (data: T) => void | Promise<void>;

class EventEmitter<TEvents extends Record<string, unknown>> {
  private handlers = new Map<keyof TEvents, Set<EventHandler<unknown>>>();

  on<K extends keyof TEvents>(event: K, handler: EventHandler<TEvents[K]>): void {
    const handlers = this.handlers.get(event) ?? new Set();
    handlers.add(handler as EventHandler<unknown>);
    this.handlers.set(event, handlers);
  }

  off<K extends keyof TEvents>(event: K, handler: EventHandler<TEvents[K]>): void {
    this.handlers.get(event)?.delete(handler as EventHandler<unknown>);
  }

  async emit<K extends keyof TEvents>(event: K, data: TEvents[K]): Promise<void> {
    const handlers = this.handlers.get(event);
    if (handlers) {
      await Promise.all([...handlers].map((h) => h(data)));
    }
  }
}

// Usage
const emitter = new EventEmitter<EventMap>();

emitter.on('userCreated', ({ userId, email }) => {
  console.log(`User ${userId} created with email ${email}`);
});

await emitter.emit('userCreated', { userId: '123', email: 'alice@example.com' });
```

## Common Anti-Patterns

### Using `any` Type

```typescript
// WRONG - loses type safety
function processData(data: any): any {
  return data.map((item: any) => item.value);
}

// CORRECT - use proper types or generics
function processData<T extends { value: unknown }>(data: T[]): unknown[] {
  return data.map((item) => item.value);
}

// Or with unknown for truly unknown data
function processUnknownData(data: unknown): void {
  if (Array.isArray(data)) {
    // TypeScript knows data is array here
  }
}
```

### Type Assertions Instead of Guards

```typescript
// WRONG - unsafe assertion
function getUser(data: unknown): User {
  return data as User; // No runtime validation!
}

// CORRECT - runtime type guard
function isUser(data: unknown): data is User {
  return (
    typeof data === 'object' &&
    data !== null &&
    'id' in data &&
    'name' in data &&
    typeof (data as User).id === 'string' &&
    typeof (data as User).name === 'string'
  );
}

function getUser(data: unknown): User {
  if (!isUser(data)) {
    throw new TypeError('Invalid user data');
  }
  return data;
}
```

### Not Handling Promise Rejections

```typescript
// WRONG - unhandled rejection
async function fetchData(): Promise<void> {
  const data = await fetch('/api/data'); // Error not caught
}

// CORRECT - handle errors
async function fetchData(): Promise<Data | null> {
  try {
    const response = await fetch('/api/data');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return response.json() as Promise<Data>;
  } catch (error) {
    console.error('Failed to fetch data:', error);
    return null;
  }
}
```

### Mutating Function Parameters

```typescript
// WRONG - unexpected mutation
function addItem(array: string[], item: string): string[] {
  array.push(item); // Mutates original!
  return array;
}

// CORRECT - return new array
function addItem(array: readonly string[], item: string): string[] {
  return [...array, item];
}
```

### Non-Exhaustive Switch Statements

```typescript
type Status = 'pending' | 'active' | 'completed';

// WRONG - no exhaustive check
function getStatusLabel(status: Status): string {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'active':
      return 'Active';
    // 'completed' case missing - no compile error!
  }
  return 'Unknown';
}

// CORRECT - exhaustive check
function getStatusLabel(status: Status): string {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'active':
      return 'Active';
    case 'completed':
      return 'Completed';
    default:
      const _exhaustive: never = status;
      throw new Error(`Unknown status: ${_exhaustive}`);
  }
}
```

## Advanced Type Patterns

### Branded Types

```typescript
// Create nominal types from structural types
type Brand<T, B> = T & { __brand: B };

type UserId = Brand<string, 'UserId'>;
type OrderId = Brand<string, 'OrderId'>;

function createUserId(id: string): UserId {
  return id as UserId;
}

function getUser(id: UserId): User {
  // Implementation
}

// Type error: OrderId is not assignable to UserId
const orderId = 'order-123' as OrderId;
// getUser(orderId); // Error!

const userId = createUserId('user-456');
getUser(userId); // OK
```

### Template Literal Types

```typescript
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';
type ApiPath = `/api/${string}`;
type Endpoint = `${HttpMethod} ${ApiPath}`;

// Valid endpoints
const endpoint1: Endpoint = 'GET /api/users';
const endpoint2: Endpoint = 'POST /api/orders';

// Type-safe route parameters
type ExtractParams<T extends string> = T extends `${string}:${infer Param}/${infer Rest}`
  ? Param | ExtractParams<Rest>
  : T extends `${string}:${infer Param}`
    ? Param
    : never;

type UserRouteParams = ExtractParams<'/users/:userId/posts/:postId'>;
// Result: 'userId' | 'postId'
```

### Conditional Types

```typescript
// Infer array element type
type ElementOf<T> = T extends (infer E)[] ? E : never;
type StringElement = ElementOf<string[]>; // string

// Infer promise result type
type UnwrapPromise<T> = T extends Promise<infer U> ? U : T;
type Resolved = UnwrapPromise<Promise<string>>; // string

// Conditional type with inference
type GetReturnType<T> = T extends (...args: unknown[]) => infer R ? R : never;

// Distributive conditional types
type ToArray<T> = T extends unknown ? T[] : never;
type StringOrNumberArray = ToArray<string | number>; // string[] | number[]
```

### Mapped Types

```typescript
// Make all properties optional
type Partial<T> = {
  [P in keyof T]?: T[P];
};

// Make all properties readonly
type Readonly<T> = {
  readonly [P in keyof T]: T[P];
};

// Map to different property types
type Getters<T> = {
  [P in keyof T as `get${Capitalize<string & P>}`]: () => T[P];
};

interface Person {
  name: string;
  age: number;
}

type PersonGetters = Getters<Person>;
// { getName: () => string; getAge: () => number; }
```

## React Patterns (TypeScript)

### Component Props

```typescript
// Props with children
interface CardProps {
  title: string;
  children: React.ReactNode;
}

// Props extending HTML attributes
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant: 'primary' | 'secondary';
  loading?: boolean;
}

// Generic component props
interface ListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  keyExtractor: (item: T) => string;
}

function List<T>({ items, renderItem, keyExtractor }: ListProps<T>): JSX.Element {
  return (
    <ul>
      {items.map((item, index) => (
        <li key={keyExtractor(item)}>{renderItem(item, index)}</li>
      ))}
    </ul>
  );
}
```

### Custom Hooks

```typescript
// Return type inference
function useCounter(initial: number = 0) {
  const [count, setCount] = useState(initial);

  const increment = useCallback(() => setCount((c) => c + 1), []);
  const decrement = useCallback(() => setCount((c) => c - 1), []);
  const reset = useCallback(() => setCount(initial), [initial]);

  return { count, increment, decrement, reset } as const;
}

// Generic hook
function useFetch<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    fetch(url)
      .then((res) => res.json() as Promise<T>)
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [url]);

  return { data, loading, error };
}
```

### Context with Type Safety

```typescript
interface AuthContextValue {
  user: User | null;
  login: (credentials: Credentials) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

function AuthProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [user, setUser] = useState<User | null>(null);

  const login = async (credentials: Credentials): Promise<void> => {
    const user = await authService.login(credentials);
    setUser(user);
  };

  const logout = (): void => {
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
```
