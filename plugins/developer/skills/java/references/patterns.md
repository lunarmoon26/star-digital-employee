# Java Patterns and Anti-Patterns Reference

## Creational Patterns

### Factory Pattern

```java
// Factory with enum and functional interface
public interface PaymentProcessor {
    PaymentResult process(Payment payment);
}

public enum PaymentMethod {
    CREDIT_CARD(CreditCardProcessor::new),
    PAYPAL(PayPalProcessor::new),
    BANK_TRANSFER(BankTransferProcessor::new);

    private final Supplier<PaymentProcessor> factory;

    PaymentMethod(Supplier<PaymentProcessor> factory) {
        this.factory = factory;
    }

    public PaymentProcessor createProcessor() {
        return factory.get();
    }
}

// Usage
PaymentProcessor processor = paymentMethod.createProcessor();
PaymentResult result = processor.process(payment);
```

### Builder Pattern

```java
public class HttpRequest {
    private final String url;
    private final HttpMethod method;
    private final Map<String, String> headers;
    private final String body;
    private final Duration timeout;

    private HttpRequest(Builder builder) {
        this.url = Objects.requireNonNull(builder.url, "url is required");
        this.method = builder.method;
        this.headers = Map.copyOf(builder.headers);
        this.body = builder.body;
        this.timeout = builder.timeout;
    }

    // Getters...

    public static Builder builder() {
        return new Builder();
    }

    public static class Builder {
        private String url;
        private HttpMethod method = HttpMethod.GET;
        private final Map<String, String> headers = new HashMap<>();
        private String body;
        private Duration timeout = Duration.ofSeconds(30);

        public Builder url(String url) {
            this.url = url;
            return this;
        }

        public Builder method(HttpMethod method) {
            this.method = method;
            return this;
        }

        public Builder header(String name, String value) {
            this.headers.put(name, value);
            return this;
        }

        public Builder body(String body) {
            this.body = body;
            return this;
        }

        public Builder timeout(Duration timeout) {
            this.timeout = timeout;
            return this;
        }

        public HttpRequest build() {
            return new HttpRequest(this);
        }
    }
}

// Usage
HttpRequest request = HttpRequest.builder()
    .url("https://api.example.com/users")
    .method(HttpMethod.POST)
    .header("Content-Type", "application/json")
    .header("Authorization", "Bearer token")
    .body("{\"name\": \"Alice\"}")
    .timeout(Duration.ofSeconds(10))
    .build();
```

### Dependency Injection Container

```java
// Simple DI container implementation
public class Container {
    private final Map<Class<?>, Supplier<?>> factories = new ConcurrentHashMap<>();
    private final Map<Class<?>, Object> singletons = new ConcurrentHashMap<>();

    public <T> void registerSingleton(Class<T> type, Supplier<T> factory) {
        factories.put(type, () -> singletons.computeIfAbsent(type, k -> factory.get()));
    }

    public <T> void registerTransient(Class<T> type, Supplier<T> factory) {
        factories.put(type, factory);
    }

    @SuppressWarnings("unchecked")
    public <T> T resolve(Class<T> type) {
        Supplier<?> factory = factories.get(type);
        if (factory == null) {
            throw new IllegalArgumentException("No registration for " + type);
        }
        return (T) factory.get();
    }
}

// Registration
Container container = new Container();
container.registerSingleton(UserRepository.class, () -> new JpaUserRepository(dataSource));
container.registerSingleton(UserService.class, () ->
    new UserService(container.resolve(UserRepository.class)));

// Resolution
UserService userService = container.resolve(UserService.class);
```

## Structural Patterns

### Repository Pattern

```java
// Generic repository interface
public interface Repository<T, ID> {
    Optional<T> findById(ID id);
    List<T> findAll();
    T save(T entity);
    void deleteById(ID id);
    boolean existsById(ID id);
}

// Specification for queries
public interface Specification<T> {
    Predicate toPredicate(Root<T> root, CriteriaQuery<?> query, CriteriaBuilder cb);

    default Specification<T> and(Specification<T> other) {
        return (root, query, cb) -> cb.and(
            this.toPredicate(root, query, cb),
            other.toPredicate(root, query, cb)
        );
    }

    default Specification<T> or(Specification<T> other) {
        return (root, query, cb) -> cb.or(
            this.toPredicate(root, query, cb),
            other.toPredicate(root, query, cb)
        );
    }
}

// Concrete specifications
public class UserSpecifications {
    public static Specification<User> isActive() {
        return (root, query, cb) -> cb.isTrue(root.get("active"));
    }

    public static Specification<User> hasRole(String role) {
        return (root, query, cb) -> cb.isMember(role, root.get("roles"));
    }

    public static Specification<User> emailContains(String domain) {
        return (root, query, cb) -> cb.like(root.get("email"), "%" + domain + "%");
    }
}

// Usage
var spec = UserSpecifications.isActive()
    .and(UserSpecifications.hasRole("ADMIN"))
    .and(UserSpecifications.emailContains("@company.com"));

List<User> users = userRepository.findAll(spec);
```

### Decorator Pattern

```java
// Base interface
public interface DataSource {
    String read();
    void write(String data);
}

// Concrete implementation
public class FileDataSource implements DataSource {
    private final Path path;

    public FileDataSource(Path path) {
        this.path = path;
    }

    @Override
    public String read() {
        try {
            return Files.readString(path);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    @Override
    public void write(String data) {
        try {
            Files.writeString(path, data);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}

// Decorator base
public abstract class DataSourceDecorator implements DataSource {
    protected final DataSource source;

    protected DataSourceDecorator(DataSource source) {
        this.source = source;
    }

    @Override
    public String read() {
        return source.read();
    }

    @Override
    public void write(String data) {
        source.write(data);
    }
}

// Concrete decorators
public class EncryptionDecorator extends DataSourceDecorator {
    private final Cipher cipher;

    public EncryptionDecorator(DataSource source, SecretKey key) {
        super(source);
        this.cipher = createCipher(key);
    }

    @Override
    public String read() {
        return decrypt(source.read());
    }

    @Override
    public void write(String data) {
        source.write(encrypt(data));
    }

    // encryption/decryption methods...
}

public class CompressionDecorator extends DataSourceDecorator {
    public CompressionDecorator(DataSource source) {
        super(source);
    }

    @Override
    public String read() {
        return decompress(source.read());
    }

    @Override
    public void write(String data) {
        source.write(compress(data));
    }

    // compression/decompression methods...
}

// Usage - decorators can be stacked
DataSource source = new CompressionDecorator(
    new EncryptionDecorator(
        new FileDataSource(Path.of("data.txt")),
        secretKey
    )
);
```

## Behavioral Patterns

### Strategy Pattern

```java
// Strategy interface
@FunctionalInterface
public interface PricingStrategy {
    BigDecimal calculatePrice(Order order);
}

// Strategy implementations
public class RegularPricing implements PricingStrategy {
    @Override
    public BigDecimal calculatePrice(Order order) {
        return order.getSubtotal();
    }
}

public class DiscountPricing implements PricingStrategy {
    private final BigDecimal discountRate;

    public DiscountPricing(BigDecimal discountRate) {
        this.discountRate = discountRate;
    }

    @Override
    public BigDecimal calculatePrice(Order order) {
        var discount = order.getSubtotal().multiply(discountRate);
        return order.getSubtotal().subtract(discount);
    }
}

public class MembershipPricing implements PricingStrategy {
    private final MembershipLevel level;

    public MembershipPricing(MembershipLevel level) {
        this.level = level;
    }

    @Override
    public BigDecimal calculatePrice(Order order) {
        return order.getSubtotal().multiply(BigDecimal.ONE.subtract(level.getDiscountRate()));
    }
}

// Context
public class PricingService {
    private final Map<CustomerType, PricingStrategy> strategies;

    public PricingService() {
        this.strategies = Map.of(
            CustomerType.REGULAR, new RegularPricing(),
            CustomerType.PREMIUM, new DiscountPricing(new BigDecimal("0.10")),
            CustomerType.VIP, new DiscountPricing(new BigDecimal("0.20"))
        );
    }

    public BigDecimal calculatePrice(Order order, Customer customer) {
        PricingStrategy strategy = strategies.getOrDefault(
            customer.getType(),
            new RegularPricing()
        );
        return strategy.calculatePrice(order);
    }
}
```

### Observer Pattern with Events

```java
// Event types
public sealed interface DomainEvent permits OrderCreated, OrderShipped, OrderCancelled {
    String aggregateId();
    Instant occurredAt();
}

public record OrderCreated(
    String aggregateId,
    String customerId,
    List<OrderLine> lines,
    Instant occurredAt
) implements DomainEvent {}

public record OrderShipped(
    String aggregateId,
    String trackingNumber,
    Instant occurredAt
) implements DomainEvent {}

// Event publisher
public class EventPublisher {
    private final Map<Class<?>, List<Consumer<DomainEvent>>> handlers = new ConcurrentHashMap<>();

    public <T extends DomainEvent> void subscribe(Class<T> eventType, Consumer<T> handler) {
        handlers.computeIfAbsent(eventType, k -> new CopyOnWriteArrayList<>())
            .add(event -> handler.accept(eventType.cast(event)));
    }

    public void publish(DomainEvent event) {
        var eventHandlers = handlers.get(event.getClass());
        if (eventHandlers != null) {
            eventHandlers.forEach(handler -> handler.accept(event));
        }
    }
}

// Event handlers
@Component
public class OrderEventHandlers {
    private final EmailService emailService;
    private final InventoryService inventoryService;

    public OrderEventHandlers(EmailService emailService, InventoryService inventoryService) {
        this.emailService = emailService;
        this.inventoryService = inventoryService;
    }

    @PostConstruct
    public void registerHandlers(EventPublisher publisher) {
        publisher.subscribe(OrderCreated.class, this::onOrderCreated);
        publisher.subscribe(OrderShipped.class, this::onOrderShipped);
    }

    private void onOrderCreated(OrderCreated event) {
        emailService.sendOrderConfirmation(event.customerId(), event.aggregateId());
        inventoryService.reserveItems(event.lines());
    }

    private void onOrderShipped(OrderShipped event) {
        emailService.sendShippingNotification(event.aggregateId(), event.trackingNumber());
    }
}
```

## Common Anti-Patterns

### Null Returns Instead of Empty Collections

```java
// WRONG - returning null
public List<User> findActiveUsers() {
    List<User> users = repository.findByActive(true);
    if (users.isEmpty()) {
        return null;  // Caller must null-check
    }
    return users;
}

// CORRECT - return empty collection
public List<User> findActiveUsers() {
    return repository.findByActive(true);  // Never null, may be empty
}

// CORRECT - return Optional for single values
public Optional<User> findUserById(String id) {
    return Optional.ofNullable(repository.findById(id));
}
```

### Catch Generic Exception

```java
// WRONG - catches everything
try {
    processOrder(order);
} catch (Exception e) {
    logger.error("Error", e);
}

// CORRECT - catch specific exceptions
try {
    processOrder(order);
} catch (PaymentDeclinedException e) {
    logger.warn("Payment declined for order {}: {}", order.getId(), e.getMessage());
    orderService.markPaymentFailed(order);
} catch (InventoryException e) {
    logger.warn("Inventory issue for order {}", order.getId(), e);
    orderService.backorder(order);
} catch (DatabaseException e) {
    logger.error("Database error processing order {}", order.getId(), e);
    throw new ServiceException("Failed to process order", e);
}
```

### Mutable Shared State

```java
// WRONG - mutable shared state
public class Counter {
    private int count = 0;  // Not thread-safe!

    public void increment() {
        count++;
    }

    public int getCount() {
        return count;
    }
}

// CORRECT - use atomic operations
public class Counter {
    private final AtomicInteger count = new AtomicInteger(0);

    public void increment() {
        count.incrementAndGet();
    }

    public int getCount() {
        return count.get();
    }
}

// OR use immutable approach
public record Counter(int count) {
    public Counter increment() {
        return new Counter(count + 1);
    }
}
```

### String Concatenation in Loops

```java
// WRONG - creates many intermediate String objects
String result = "";
for (String item : items) {
    result += item + ", ";
}

// CORRECT - use StringBuilder
StringBuilder sb = new StringBuilder();
for (String item : items) {
    if (sb.length() > 0) {
        sb.append(", ");
    }
    sb.append(item);
}
String result = sb.toString();

// BETTER - use String.join or streams
String result = String.join(", ", items);

// OR
String result = items.stream()
    .collect(Collectors.joining(", "));
```

## Result Pattern

```java
// Result type for operations that can fail
public sealed interface Result<T> permits Result.Success, Result.Failure {

    record Success<T>(T value) implements Result<T> {}
    record Failure<T>(String error, Exception cause) implements Result<T> {
        public Failure(String error) {
            this(error, null);
        }
    }

    static <T> Result<T> success(T value) {
        return new Success<>(value);
    }

    static <T> Result<T> failure(String error) {
        return new Failure<>(error);
    }

    static <T> Result<T> failure(String error, Exception cause) {
        return new Failure<>(error, cause);
    }

    default boolean isSuccess() {
        return this instanceof Success;
    }

    default boolean isFailure() {
        return this instanceof Failure;
    }

    default T getOrThrow() {
        return switch (this) {
            case Success<T> s -> s.value();
            case Failure<T> f -> throw new ResultException(f.error(), f.cause());
        };
    }

    default T getOrElse(T defaultValue) {
        return switch (this) {
            case Success<T> s -> s.value();
            case Failure<T> f -> defaultValue;
        };
    }

    default <U> Result<U> map(Function<T, U> mapper) {
        return switch (this) {
            case Success<T> s -> Result.success(mapper.apply(s.value()));
            case Failure<T> f -> Result.failure(f.error(), f.cause());
        };
    }

    default <U> Result<U> flatMap(Function<T, Result<U>> mapper) {
        return switch (this) {
            case Success<T> s -> mapper.apply(s.value());
            case Failure<T> f -> Result.failure(f.error(), f.cause());
        };
    }
}

// Usage
public Result<Order> createOrder(CreateOrderRequest request) {
    return validateRequest(request)
        .flatMap(this::checkInventory)
        .flatMap(this::processPayment)
        .map(this::saveOrder);
}

private Result<CreateOrderRequest> validateRequest(CreateOrderRequest request) {
    if (request.items().isEmpty()) {
        return Result.failure("Order must have at least one item");
    }
    return Result.success(request);
}
```

## Retry Pattern

```java
public class Retry {
    private final int maxAttempts;
    private final Duration initialDelay;
    private final double backoffMultiplier;
    private final Set<Class<? extends Exception>> retryableExceptions;

    private Retry(Builder builder) {
        this.maxAttempts = builder.maxAttempts;
        this.initialDelay = builder.initialDelay;
        this.backoffMultiplier = builder.backoffMultiplier;
        this.retryableExceptions = Set.copyOf(builder.retryableExceptions);
    }

    public <T> T execute(Supplier<T> operation) {
        Exception lastException = null;
        Duration delay = initialDelay;

        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return operation.get();
            } catch (Exception e) {
                if (!isRetryable(e)) {
                    throw e;
                }
                lastException = e;

                if (attempt < maxAttempts) {
                    sleep(delay);
                    delay = Duration.ofMillis((long) (delay.toMillis() * backoffMultiplier));
                }
            }
        }

        throw new RetryExhaustedException(
            "Failed after " + maxAttempts + " attempts",
            lastException
        );
    }

    private boolean isRetryable(Exception e) {
        return retryableExceptions.stream()
            .anyMatch(clazz -> clazz.isInstance(e));
    }

    private void sleep(Duration duration) {
        try {
            Thread.sleep(duration.toMillis());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new RuntimeException(e);
        }
    }

    public static Builder builder() {
        return new Builder();
    }

    public static class Builder {
        private int maxAttempts = 3;
        private Duration initialDelay = Duration.ofMillis(100);
        private double backoffMultiplier = 2.0;
        private final Set<Class<? extends Exception>> retryableExceptions = new HashSet<>();

        public Builder maxAttempts(int maxAttempts) {
            this.maxAttempts = maxAttempts;
            return this;
        }

        public Builder initialDelay(Duration delay) {
            this.initialDelay = delay;
            return this;
        }

        public Builder backoffMultiplier(double multiplier) {
            this.backoffMultiplier = multiplier;
            return this;
        }

        public Builder retryOn(Class<? extends Exception> exceptionClass) {
            this.retryableExceptions.add(exceptionClass);
            return this;
        }

        public Retry build() {
            return new Retry(this);
        }
    }
}

// Usage
Retry retry = Retry.builder()
    .maxAttempts(3)
    .initialDelay(Duration.ofMillis(100))
    .backoffMultiplier(2.0)
    .retryOn(IOException.class)
    .retryOn(TimeoutException.class)
    .build();

String result = retry.execute(() -> httpClient.get(url));
```

## Circuit Breaker Pattern

```java
public class CircuitBreaker {
    private final int failureThreshold;
    private final Duration resetTimeout;
    private final AtomicInteger failureCount = new AtomicInteger(0);
    private final AtomicReference<State> state = new AtomicReference<>(State.CLOSED);
    private volatile Instant lastFailureTime;

    public enum State { CLOSED, OPEN, HALF_OPEN }

    public CircuitBreaker(int failureThreshold, Duration resetTimeout) {
        this.failureThreshold = failureThreshold;
        this.resetTimeout = resetTimeout;
    }

    public <T> T execute(Supplier<T> operation) {
        if (state.get() == State.OPEN) {
            if (shouldAttemptReset()) {
                state.set(State.HALF_OPEN);
            } else {
                throw new CircuitBreakerOpenException("Circuit breaker is open");
            }
        }

        try {
            T result = operation.get();
            onSuccess();
            return result;
        } catch (Exception e) {
            onFailure();
            throw e;
        }
    }

    private boolean shouldAttemptReset() {
        return lastFailureTime != null &&
            Instant.now().isAfter(lastFailureTime.plus(resetTimeout));
    }

    private void onSuccess() {
        failureCount.set(0);
        state.set(State.CLOSED);
    }

    private void onFailure() {
        lastFailureTime = Instant.now();
        if (failureCount.incrementAndGet() >= failureThreshold) {
            state.set(State.OPEN);
        }
    }

    public State getState() {
        return state.get();
    }
}
```
