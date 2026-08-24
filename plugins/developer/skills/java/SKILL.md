---
name: java
description: This skill should be used when the user asks to "write java code", "java best practices", "jdk features", "java records", "java streams", "java optional", "java testing", "java spring", "java patterns", or needs guidance on professional Java development.
---

# Java Development Best Practices

Apply these standards when writing Java code to ensure maintainability, performance, and professional quality.

## Naming Conventions

Follow Oracle's Java naming conventions consistently throughout the codebase.

Use PascalCase for:
- Classes and interfaces: `UserService`, `OrderRepository`, `Comparable`
- Enums: `OrderStatus`, `LogLevel`
- Annotation types: `Override`, `Deprecated`

Use camelCase for:
- Methods: `getUserById`, `calculateTotal`, `isActive`
- Variables and parameters: `userId`, `orderCount`, `firstName`
- Non-constant fields: `private String userName`

Use UPPER_SNAKE_CASE for:
- Constants: `MAX_RETRY_COUNT`, `DEFAULT_TIMEOUT`
- Enum constants: `OrderStatus.PENDING`, `LogLevel.WARNING`

Use lowercase with dots for packages: `com.company.project.module`. Use meaningful names that reveal intent. Avoid Hungarian notation and unnecessary prefixes.

```java
// Good naming examples
public class OrderProcessingService {
    private static final int MAX_RETRY_ATTEMPTS = 3;
    private static final Duration RETRY_DELAY = Duration.ofSeconds(5);

    private final OrderRepository orderRepository;
    private final PaymentService paymentService;
    private final Logger logger;

    public OrderResult processOrder(OrderRequest request) {
        var orderId = request.getOrderId();
        // Processing logic
    }
}
```

## Modern Java Features (JDK 17+)

### Records for Data Classes

Use records for immutable data carriers. Records provide constructors, accessors, `equals()`, `hashCode()`, and `toString()` automatically.

```java
// Simple record
public record User(String id, String name, String email) {}

// Record with validation
public record Order(String id, String customerId, BigDecimal total, List<OrderLine> lines) {
    public Order {
        Objects.requireNonNull(id, "id must not be null");
        Objects.requireNonNull(customerId, "customerId must not be null");
        if (total.compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("total must not be negative");
        }
        lines = List.copyOf(lines); // Defensive copy for immutability
    }

    // Additional methods
    public int lineCount() {
        return lines.size();
    }
}

// Usage
var user = new User("1", "Alice", "alice@example.com");
var email = user.email(); // Accessor method
```

### Sealed Classes

Use sealed classes to restrict inheritance and enable exhaustive pattern matching.

```java
public sealed interface Shape permits Circle, Rectangle, Triangle {
    double area();
}

public record Circle(double radius) implements Shape {
    @Override
    public double area() {
        return Math.PI * radius * radius;
    }
}

public record Rectangle(double width, double height) implements Shape {
    @Override
    public double area() {
        return width * height;
    }
}

public record Triangle(double base, double height) implements Shape {
    @Override
    public double area() {
        return 0.5 * base * height;
    }
}

// Exhaustive pattern matching (JDK 21+)
public String describeShape(Shape shape) {
    return switch (shape) {
        case Circle c -> "Circle with radius " + c.radius();
        case Rectangle r -> "Rectangle " + r.width() + "x" + r.height();
        case Triangle t -> "Triangle with base " + t.base();
    };
}
```

### Pattern Matching

Use pattern matching for cleaner type checks and casts.

```java
// Pattern matching for instanceof (JDK 16+)
public String formatValue(Object obj) {
    if (obj instanceof String s) {
        return "String: " + s.toUpperCase();
    } else if (obj instanceof Integer i) {
        return "Integer: " + i * 2;
    } else if (obj instanceof List<?> list && !list.isEmpty()) {
        return "List with " + list.size() + " elements";
    }
    return "Unknown: " + obj;
}

// Pattern matching in switch (JDK 21+)
public double calculateArea(Object shape) {
    return switch (shape) {
        case Circle c -> Math.PI * c.radius() * c.radius();
        case Rectangle r -> r.width() * r.height();
        case null -> 0.0;
        default -> throw new IllegalArgumentException("Unknown shape");
    };
}

// Guarded patterns
public String categorize(Integer value) {
    return switch (value) {
        case Integer i when i < 0 -> "negative";
        case Integer i when i == 0 -> "zero";
        case Integer i when i <= 100 -> "small";
        default -> "large";
    };
}
```

## Streams and Functional Programming

Use streams for declarative data processing. Keep stream pipelines readable and focused.

```java
// Collection processing
List<String> activeUserEmails = users.stream()
    .filter(User::isActive)
    .map(User::getEmail)
    .filter(email -> email.endsWith("@company.com"))
    .sorted()
    .toList();

// Grouping and collecting
Map<Department, List<Employee>> byDepartment = employees.stream()
    .collect(Collectors.groupingBy(Employee::getDepartment));

Map<Department, Double> avgSalaryByDept = employees.stream()
    .collect(Collectors.groupingBy(
        Employee::getDepartment,
        Collectors.averagingDouble(Employee::getSalary)
    ));

// Reducing
BigDecimal totalRevenue = orders.stream()
    .map(Order::getTotal)
    .reduce(BigDecimal.ZERO, BigDecimal::add);
```

Use method references when they improve readability. Avoid side effects in stream operations. Prefer `toList()` (JDK 16+) over `collect(Collectors.toList())`.

```java
// Parallel streams for CPU-bound operations on large datasets
long count = hugeList.parallelStream()
    .filter(this::expensiveComputation)
    .count();

// Use forEachOrdered for ordered processing
list.parallelStream()
    .map(this::transform)
    .forEachOrdered(System.out::println);
```

## Optional Usage

Use `Optional` for return types that may have no value. Never use `Optional` for fields, method parameters, or collection elements.

```java
// Return Optional from methods
public Optional<User> findUserById(String id) {
    return Optional.ofNullable(userMap.get(id));
}

// Chain Optional operations
public String getUserEmail(String userId) {
    return findUserById(userId)
        .map(User::getEmail)
        .orElse("unknown@example.com");
}

// Use orElseThrow for required values
public User getRequiredUser(String userId) {
    return findUserById(userId)
        .orElseThrow(() -> new UserNotFoundException(userId));
}

// Conditional execution
findUserById(userId).ifPresent(user -> {
    logger.info("Found user: {}", user.getName());
    sendWelcomeEmail(user);
});

// Filter and transform
public Optional<String> getActiveUserEmail(String userId) {
    return findUserById(userId)
        .filter(User::isActive)
        .map(User::getEmail);
}
```

Avoid `Optional.get()` without checking `isPresent()`. Use `orElse()` for default values, `orElseGet()` for computed defaults, and `orElseThrow()` for required values.

## Exception Handling

Use specific exceptions for different error categories. Create custom exceptions for domain-specific errors.

```java
// Custom exception hierarchy
public class DomainException extends RuntimeException {
    protected DomainException(String message) {
        super(message);
    }

    protected DomainException(String message, Throwable cause) {
        super(message, cause);
    }
}

public class EntityNotFoundException extends DomainException {
    private final String entityType;
    private final String entityId;

    public EntityNotFoundException(String entityType, String entityId) {
        super("%s with ID '%s' not found".formatted(entityType, entityId));
        this.entityType = entityType;
        this.entityId = entityId;
    }

    public String getEntityType() { return entityType; }
    public String getEntityId() { return entityId; }
}

// Proper exception handling
public Order processOrder(String orderId) {
    try {
        var order = orderRepository.findById(orderId)
            .orElseThrow(() -> new EntityNotFoundException("Order", orderId));

        paymentService.processPayment(order);
        return orderRepository.save(order);

    } catch (PaymentDeclinedException e) {
        logger.warn("Payment declined for order {}: {}", orderId, e.getMessage());
        throw new OrderProcessingException("Payment failed", e);
    } catch (DatabaseException e) {
        logger.error("Database error processing order {}", orderId, e);
        throw new OrderProcessingException("System error", e);
    }
}
```

Use try-with-resources for all `AutoCloseable` resources. Log exceptions with appropriate levels. Preserve exception chains with cause.

## Dependency Injection

Use constructor injection for required dependencies. Prefer immutability with final fields.

```java
@Service
public class OrderService {
    private final OrderRepository orderRepository;
    private final PaymentService paymentService;
    private final NotificationService notificationService;
    private final Logger logger;

    public OrderService(
            OrderRepository orderRepository,
            PaymentService paymentService,
            NotificationService notificationService) {
        this.orderRepository = Objects.requireNonNull(orderRepository);
        this.paymentService = Objects.requireNonNull(paymentService);
        this.notificationService = Objects.requireNonNull(notificationService);
        this.logger = LoggerFactory.getLogger(getClass());
    }

    public Order createOrder(CreateOrderRequest request) {
        logger.info("Creating order for customer {}", request.customerId());
        // Implementation
    }
}
```

Avoid field injection (`@Autowired` on fields)—it hides dependencies and complicates testing. Use interfaces for dependencies to enable mocking and alternative implementations.

## Testing with JUnit 5

Structure tests using Arrange-Act-Assert pattern. Use descriptive test names that explain the scenario.

```java
@ExtendWith(MockitoExtension.class)
class OrderServiceTest {

    @Mock
    private OrderRepository orderRepository;

    @Mock
    private PaymentService paymentService;

    @Mock
    private NotificationService notificationService;

    @Mock
    private CustomerService customerService;

    @InjectMocks
    private OrderService orderService;

    @Test
    @DisplayName("Should create order successfully with valid request")
    void createOrder_withValidRequest_returnsCreatedOrder() {
        // Arrange
        var request = new CreateOrderRequest("customer-1", List.of(
            new OrderItem("product-1", 2, new BigDecimal("10.00"))
        ));

        when(orderRepository.save(any(Order.class)))
            .thenAnswer(invocation -> {
                Order order = invocation.getArgument(0);
                return order.withId("order-1");
            });

        // Act
        Order result = orderService.createOrder(request);

        // Assert
        assertThat(result.getId()).isEqualTo("order-1");
        assertThat(result.getCustomerId()).isEqualTo("customer-1");
        assertThat(result.getLines()).hasSize(1);

        verify(orderRepository).save(any(Order.class));
        verify(notificationService).sendOrderConfirmation(any());
    }

    @Test
    @DisplayName("Should throw exception when customer not found")
    void createOrder_withInvalidCustomer_throwsException() {
        // Arrange
        var request = new CreateOrderRequest("invalid-customer", List.of());
        when(customerService.findById("invalid-customer"))
            .thenReturn(Optional.empty());

        // Act & Assert
        assertThatThrownBy(() -> orderService.createOrder(request))
            .isInstanceOf(EntityNotFoundException.class)
            .hasMessageContaining("Customer")
            .hasMessageContaining("invalid-customer");
    }

    @ParameterizedTest
    @ValueSource(ints = {0, -1, -100})
    @DisplayName("Should reject orders with invalid quantities")
    void createOrder_withInvalidQuantity_throwsValidationException(int quantity) {
        // Arrange
        var request = new CreateOrderRequest("customer-1", List.of(
            new OrderItem("product-1", quantity, new BigDecimal("10.00"))
        ));

        // Act & Assert
        assertThatThrownBy(() -> orderService.createOrder(request))
            .isInstanceOf(ValidationException.class);
    }
}
```

Use AssertJ for fluent assertions. Use `@Nested` classes to organize related tests. Use `@ParameterizedTest` for data-driven tests.

## Concurrency

Use modern concurrency utilities from `java.util.concurrent`. Prefer immutable objects to avoid synchronization.

```java
// ExecutorService for async operations
ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor(); // JDK 21+

// CompletableFuture for async composition
public CompletableFuture<OrderDetails> getOrderDetails(String orderId) {
    CompletableFuture<Order> orderFuture =
        CompletableFuture.supplyAsync(() -> orderRepository.findById(orderId).orElseThrow());

    CompletableFuture<Customer> customerFuture = orderFuture
        .thenCompose(order ->
            CompletableFuture.supplyAsync(() -> customerService.findById(order.getCustomerId())));

    CompletableFuture<List<Product>> productsFuture = orderFuture
        .thenCompose(order ->
            CompletableFuture.supplyAsync(() -> productService.findByIds(order.getProductIds())));

    return orderFuture
        .thenCombine(customerFuture, (order, customer) -> new Object[] {order, customer})
        .thenCombine(productsFuture, (arr, products) ->
            new OrderDetails((Order) arr[0], (Customer) arr[1], products));
}

// Structured concurrency (JDK 21+ preview)
OrderDetails getOrderDetailsStructured(String orderId) throws Exception {
    try (var scope = new StructuredTaskScope.ShutdownOnFailure()) {
        var orderFuture = scope.fork(() -> orderRepository.findById(orderId).orElseThrow());
        var customerFuture = scope.fork(() -> customerService.findById(customerId));

        scope.join();
        scope.throwIfFailed();

        return new OrderDetails(orderFuture.get(), customerFuture.get());
    }
}
```

Use `ConcurrentHashMap` for thread-safe maps. Use `AtomicReference` and atomic classes for simple shared state. Avoid `synchronized` blocks when possible—use higher-level abstractions.

## Code Quality Tools

Configure static analysis tools for consistent code quality.

### Checkstyle Configuration

```xml
<!-- checkstyle.xml -->
<module name="Checker">
    <module name="TreeWalker">
        <module name="ConstantName"/>
        <module name="LocalFinalVariableName"/>
        <module name="LocalVariableName"/>
        <module name="MemberName"/>
        <module name="MethodName"/>
        <module name="PackageName"/>
        <module name="ParameterName"/>
        <module name="StaticVariableName"/>
        <module name="TypeName"/>

        <module name="AvoidStarImport"/>
        <module name="IllegalImport"/>
        <module name="RedundantImport"/>
        <module name="UnusedImports"/>

        <module name="MethodLength">
            <property name="max" value="50"/>
        </module>
        <module name="ParameterNumber">
            <property name="max" value="7"/>
        </module>
    </module>
</module>
```

### SpotBugs and Error Prone

Configure SpotBugs for bug detection and Error Prone for compile-time checks.

```xml
<!-- pom.xml -->
<plugin>
    <groupId>com.github.spotbugs</groupId>
    <artifactId>spotbugs-maven-plugin</artifactId>
    <version>4.8.2.0</version>
    <configuration>
        <effort>Max</effort>
        <threshold>Low</threshold>
    </configuration>
</plugin>
```

## Documentation with Javadoc

Document all public APIs with Javadoc. Include `@param`, `@return`, `@throws`, and `@see` tags.

```java
/**
 * Processes an order and initiates payment.
 *
 * <p>This method validates the order, processes payment through the configured
 * payment gateway, and updates the order status. If payment fails, the order
 * is marked as payment-failed and no further processing occurs.
 *
 * @param orderId the unique identifier of the order to process
 * @return the processed order with updated status
 * @throws EntityNotFoundException if no order exists with the given ID
 * @throws PaymentFailedException if payment processing fails
 * @throws IllegalStateException if the order is not in a processable state
 * @see Order#getStatus()
 * @see PaymentService#processPayment(Order)
 * @since 2.0
 */
public Order processOrder(String orderId) {
    // Implementation
}
```

Use `{@code}` for inline code and `{@link}` for references. Document thread safety and null handling. Keep documentation synchronized with code changes.

## Additional Resources

For detailed patterns and anti-patterns, consult:
- **`references/patterns.md`** - Comprehensive Java patterns and examples
