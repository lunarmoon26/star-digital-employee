---
name: csharp
description: This skill should be used when the user asks to "write c# code", "csharp best practices", "dotnet development", "c# async patterns", "c# nullable types", "LINQ queries", "c# records", "c# testing", or needs guidance on professional C# and .NET development.
---

# C# Development Best Practices

Apply these standards when writing C# code to ensure maintainability, performance, and professional quality.

## Naming Conventions

Follow Microsoft's .NET naming guidelines consistently throughout the codebase.

Use PascalCase for:
- Classes, structs, records, interfaces, enums: `UserService`, `IRepository`, `OrderStatus`
- Public methods, properties, events: `GetUserById`, `IsActive`, `OnDataReceived`
- Constants: `MaxRetryCount`, `DefaultTimeout`
- Enum values: `OrderStatus.Pending`, `LogLevel.Warning`

Use camelCase for:
- Private fields (with underscore prefix): `_userRepository`, `_logger`
- Local variables and parameters: `userId`, `orderCount`

Use I prefix for interfaces: `IUserService`, `IRepository<T>`. Use Async suffix for async methods: `GetUserAsync`, `SaveChangesAsync`. Use meaningful names that reveal intent—avoid abbreviations except for widely understood terms.

```csharp
// Good naming examples
public class OrderProcessingService
{
    private readonly IOrderRepository _orderRepository;
    private readonly ILogger<OrderProcessingService> _logger;

    public async Task<OrderResult> ProcessOrderAsync(
        OrderRequest request,
        CancellationToken cancellationToken = default)
    {
        var order = await _orderRepository.GetByIdAsync(request.OrderId, cancellationToken);
        // Processing logic
    }
}
```

## Nullable Reference Types

Enable nullable reference types in all projects to catch null reference errors at compile time.

```xml
<PropertyGroup>
  <Nullable>enable</Nullable>
</PropertyGroup>
```

Annotate reference types explicitly. Use `?` suffix for nullable types. Use null-forgiving operator (`!`) only when certain the value is not null.

```csharp
// Nullable annotations
public class User
{
    public required string Id { get; init; }
    public required string Name { get; init; }
    public string? Email { get; init; }  // Nullable
    public Address? Address { get; init; }
}

// Null handling patterns
public string GetDisplayName(User? user)
{
    // Null conditional operator
    var name = user?.Name;

    // Null coalescing
    return name ?? "Anonymous";

    // Null coalescing assignment
    // user ??= CreateDefaultUser();
}

// Pattern matching for null checks
public void ProcessUser(User? user)
{
    if (user is null)
    {
        throw new ArgumentNullException(nameof(user));
    }

    // user is not null here (compiler knows)
    Console.WriteLine(user.Name);
}
```

Use `required` modifier (C# 11+) for properties that must be set during initialization. Use `ArgumentNullException.ThrowIfNull()` for guard clauses.

## LINQ Best Practices

Use LINQ for declarative data transformations. Prefer method syntax for simple queries and query syntax for complex joins.

```csharp
// Method syntax - preferred for simple operations
var activeUsers = users
    .Where(u => u.IsActive)
    .OrderBy(u => u.Name)
    .Select(u => new UserDto(u.Id, u.Name))
    .ToList();

// Query syntax - preferred for joins
var orderDetails =
    from order in orders
    join customer in customers on order.CustomerId equals customer.Id
    where order.Status == OrderStatus.Completed
    orderby order.CreatedAt descending
    select new { order.Id, customer.Name, order.Total };
```

Materialize queries with `ToList()`, `ToArray()`, or `ToDictionary()` when needed. Avoid multiple enumerations—store results in variables. Use `Any()` instead of `Count() > 0` for existence checks.

```csharp
// Efficient existence check
if (users.Any(u => u.IsAdmin))
{
    // Has at least one admin
}

// Avoid this - enumerates entire collection
if (users.Count(u => u.IsAdmin) > 0)
{
    // Inefficient
}
```

Use `FirstOrDefault()` with null handling or `First()` when element must exist. Use `Single()` and `SingleOrDefault()` when exactly one match is expected.

## Async/Await Patterns

Use async/await for all I/O-bound operations. Follow the async all the way pattern—don't mix sync and async code.

```csharp
// Proper async method signature
public async Task<User> GetUserByIdAsync(
    string userId,
    CancellationToken cancellationToken = default)
{
    var user = await _dbContext.Users
        .FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);

    if (user is null)
    {
        throw new NotFoundException($"User {userId} not found");
    }

    return user;
}
```

Always pass and honor `CancellationToken`. Use `ConfigureAwait(false)` in library code. Avoid `async void` except for event handlers.

```csharp
// Concurrent operations
public async Task<UserWithOrders> GetUserWithOrdersAsync(
    string userId,
    CancellationToken ct)
{
    // Run concurrently
    var userTask = _userRepository.GetByIdAsync(userId, ct);
    var ordersTask = _orderRepository.GetByUserIdAsync(userId, ct);

    await Task.WhenAll(userTask, ordersTask);

    return new UserWithOrders(userTask.Result, ordersTask.Result);
}

// Error handling in async context
public async Task ProcessBatchAsync(IEnumerable<Item> items)
{
    var tasks = items.Select(ProcessItemAsync);
    var results = await Task.WhenAll(tasks);

    var failures = results.Where(r => !r.Success);
    if (failures.Any())
    {
        throw new AggregateException(failures.Select(f => f.Exception!));
    }
}
```

## Records and Immutable Types

Use records for immutable data types, DTOs, and value objects. Records provide value-based equality, `with` expressions, and concise syntax.

```csharp
// Record with positional parameters
public record User(string Id, string Name, string Email);

// Record with properties (more flexibility)
public record Order
{
    public required string Id { get; init; }
    public required string CustomerId { get; init; }
    public required decimal Total { get; init; }
    public OrderStatus Status { get; init; } = OrderStatus.Pending;
    public IReadOnlyList<OrderLine> Lines { get; init; } = [];
}

// Creating modified copies
var updatedOrder = existingOrder with { Status = OrderStatus.Completed };

// Record struct for small value types
public readonly record struct Point(double X, double Y);
```

Use `init` accessors for properties that should only be set during initialization. Use `required` modifier for mandatory properties. Prefer immutable collections (`IReadOnlyList<T>`, `IReadOnlyDictionary<TKey, TValue>`).

## Pattern Matching

Use pattern matching for type checks, null checks, and complex conditionals.

```csharp
// Type patterns
public decimal CalculateDiscount(Customer customer) => customer switch
{
    PremiumCustomer { YearsAsMember: > 5 } => 0.20m,
    PremiumCustomer => 0.15m,
    RegularCustomer { OrderCount: > 100 } => 0.10m,
    RegularCustomer => 0.05m,
    _ => 0m
};

// Property patterns
public string GetStatusMessage(Order order) => order switch
{
    { Status: OrderStatus.Pending, Total: > 1000 } => "Large order pending review",
    { Status: OrderStatus.Pending } => "Order pending",
    { Status: OrderStatus.Shipped, TrackingNumber: not null } => $"Shipped: {order.TrackingNumber}",
    { Status: OrderStatus.Shipped } => "Shipped (no tracking)",
    { Status: OrderStatus.Delivered } => "Delivered",
    { Status: OrderStatus.Cancelled } => "Cancelled",
    _ => "Unknown status"
};

// List patterns (C# 11+)
public bool IsValidSequence(int[] values) => values switch
{
    [1, 2, 3] => true,
    [1, .., 3] => true,  // Starts with 1, ends with 3
    [_, _, ..] => true,  // At least 2 elements
    [] => false,
    _ => false
};
```

## Exception Handling

Create typed exceptions for domain-specific errors. Use exception filters for conditional catching. Let exceptions propagate when appropriate.

```csharp
// Custom exception hierarchy
public abstract class DomainException : Exception
{
    protected DomainException(string message) : base(message) { }
    protected DomainException(string message, Exception inner) : base(message, inner) { }
}

public class NotFoundException : DomainException
{
    public string ResourceType { get; }
    public string ResourceId { get; }

    public NotFoundException(string resourceType, string resourceId)
        : base($"{resourceType} with ID '{resourceId}' not found")
    {
        ResourceType = resourceType;
        ResourceId = resourceId;
    }
}

// Exception filter
try
{
    await ProcessOrderAsync(order);
}
catch (HttpRequestException ex) when (ex.StatusCode == HttpStatusCode.NotFound)
{
    _logger.LogWarning("Resource not found: {Message}", ex.Message);
    throw new NotFoundException("Order", order.Id);
}
catch (HttpRequestException ex) when (ex.StatusCode == HttpStatusCode.TooManyRequests)
{
    _logger.LogWarning("Rate limited, retrying...");
    await Task.Delay(TimeSpan.FromSeconds(5));
    await ProcessOrderAsync(order);
}
```

## Dependency Injection

Use constructor injection for required dependencies. Use the built-in DI container or a mature framework like Autofac.

```csharp
public class OrderService : IOrderService
{
    private readonly IOrderRepository _orderRepository;
    private readonly IPaymentService _paymentService;
    private readonly ILogger<OrderService> _logger;

    public OrderService(
        IOrderRepository orderRepository,
        IPaymentService paymentService,
        ILogger<OrderService> logger)
    {
        _orderRepository = orderRepository;
        _paymentService = paymentService;
        _logger = logger;
    }

    public async Task<Order> CreateOrderAsync(CreateOrderRequest request)
    {
        _logger.LogInformation("Creating order for customer {CustomerId}", request.CustomerId);
        // Implementation
    }
}

// Registration in Program.cs
builder.Services.AddScoped<IOrderService, OrderService>();
builder.Services.AddScoped<IOrderRepository, OrderRepository>();
builder.Services.AddSingleton<IPaymentService, StripePaymentService>();
```

Prefer interfaces over concrete types. Use `AddScoped` for request-scoped services, `AddSingleton` for stateless services, and `AddTransient` for lightweight stateless services.

## Testing with xUnit

Use xUnit for unit testing. Structure tests using Arrange-Act-Assert pattern. Use meaningful test names that describe the scenario.

```csharp
public class OrderServiceTests
{
    private readonly Mock<IOrderRepository> _orderRepositoryMock;
    private readonly Mock<IPaymentService> _paymentServiceMock;
    private readonly OrderService _sut;  // System Under Test

    public OrderServiceTests()
    {
        _orderRepositoryMock = new Mock<IOrderRepository>();
        _paymentServiceMock = new Mock<IPaymentService>();
        _sut = new OrderService(
            _orderRepositoryMock.Object,
            _paymentServiceMock.Object,
            NullLogger<OrderService>.Instance);
    }

    [Fact]
    public async Task CreateOrderAsync_WithValidRequest_ReturnsCreatedOrder()
    {
        // Arrange
        var request = new CreateOrderRequest
        {
            CustomerId = "cust-1",
            Items = [new OrderItem { ProductId = "prod-1", Quantity = 2 }]
        };
        _orderRepositoryMock
            .Setup(r => r.CreateAsync(It.IsAny<Order>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Order o, CancellationToken _) => o with { Id = "order-1" });

        // Act
        var result = await _sut.CreateOrderAsync(request);

        // Assert
        Assert.NotNull(result);
        Assert.Equal("order-1", result.Id);
        Assert.Equal(request.CustomerId, result.CustomerId);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public async Task CreateOrderAsync_WithInvalidQuantity_ThrowsValidationException(int quantity)
    {
        // Arrange
        var request = new CreateOrderRequest
        {
            CustomerId = "cust-1",
            Items = [new OrderItem { Quantity = quantity }]
        };

        // Act & Assert
        await Assert.ThrowsAsync<ValidationException>(
            () => _sut.CreateOrderAsync(request));
    }
}
```

Use `[Theory]` with `[InlineData]` for parameterized tests. Use FluentAssertions for more readable assertions. Use NSubstitute or Moq for mocking.

## Code Analysis and Formatting

Configure code analysis rules in `.editorconfig` or `Directory.Build.props`. Use built-in analyzers and StyleCop.

```xml
<!-- Directory.Build.props -->
<Project>
  <PropertyGroup>
    <TreatWarningsAsErrors>true</TreatWarningsAsErrors>
    <EnforceCodeStyleInBuild>true</EnforceCodeStyleInBuild>
    <AnalysisLevel>latest-recommended</AnalysisLevel>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="StyleCop.Analyzers" Version="1.2.0-beta.507">
      <PrivateAssets>all</PrivateAssets>
    </PackageReference>
  </ItemGroup>
</Project>
```

Configure `.editorconfig` for consistent formatting:

```ini
[*.cs]
# Formatting
indent_style = space
indent_size = 4

# Naming conventions
dotnet_naming_rule.private_fields_should_be_camel_case.symbols = private_fields
dotnet_naming_rule.private_fields_should_be_camel_case.style = camel_case_underscore
dotnet_naming_rule.private_fields_should_be_camel_case.severity = error

dotnet_naming_symbols.private_fields.applicable_kinds = field
dotnet_naming_symbols.private_fields.applicable_accessibilities = private

dotnet_naming_style.camel_case_underscore.required_prefix = _
dotnet_naming_style.camel_case_underscore.capitalization = camel_case

# Code style
csharp_style_var_for_built_in_types = false:warning
csharp_style_var_when_type_is_apparent = true:suggestion
csharp_prefer_simple_using_statement = true:suggestion
csharp_style_expression_bodied_methods = when_on_single_line:suggestion
```

## Documentation with XML Comments

Document public APIs with XML documentation comments. Include `<summary>`, `<param>`, `<returns>`, and `<exception>` tags.

```csharp
/// <summary>
/// Processes an order and initiates payment.
/// </summary>
/// <param name="orderId">The unique identifier of the order to process.</param>
/// <param name="cancellationToken">Token to cancel the operation.</param>
/// <returns>The processed order with updated status.</returns>
/// <exception cref="NotFoundException">Thrown when the order is not found.</exception>
/// <exception cref="PaymentFailedException">Thrown when payment processing fails.</exception>
/// <example>
/// <code>
/// var processedOrder = await orderService.ProcessOrderAsync("order-123");
/// Console.WriteLine(processedOrder.Status);
/// </code>
/// </example>
public async Task<Order> ProcessOrderAsync(
    string orderId,
    CancellationToken cancellationToken = default)
{
    // Implementation
}
```

Generate documentation with `GenerateDocumentationFile` in project settings. Use tools like DocFX for API documentation sites.

## Additional Resources

For detailed patterns and anti-patterns, consult:
- **`references/patterns.md`** - Comprehensive C# patterns and examples
