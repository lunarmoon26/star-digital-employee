# C# Patterns and Anti-Patterns Reference

## Creational Patterns

### Factory Pattern

```csharp
// Abstract factory with DI
public interface INotificationFactory
{
    INotification Create(NotificationType type);
}

public class NotificationFactory : INotificationFactory
{
    private readonly IServiceProvider _serviceProvider;

    public NotificationFactory(IServiceProvider serviceProvider)
    {
        _serviceProvider = serviceProvider;
    }

    public INotification Create(NotificationType type) => type switch
    {
        NotificationType.Email => _serviceProvider.GetRequiredService<EmailNotification>(),
        NotificationType.Sms => _serviceProvider.GetRequiredService<SmsNotification>(),
        NotificationType.Push => _serviceProvider.GetRequiredService<PushNotification>(),
        _ => throw new ArgumentOutOfRangeException(nameof(type))
    };
}

// Registration
services.AddTransient<EmailNotification>();
services.AddTransient<SmsNotification>();
services.AddTransient<PushNotification>();
services.AddSingleton<INotificationFactory, NotificationFactory>();
```

### Builder Pattern

```csharp
public class EmailBuilder
{
    private string _to = "";
    private string _from = "";
    private string _subject = "";
    private string _body = "";
    private readonly List<string> _cc = [];
    private readonly List<Attachment> _attachments = [];

    public EmailBuilder To(string address)
    {
        _to = address;
        return this;
    }

    public EmailBuilder From(string address)
    {
        _from = address;
        return this;
    }

    public EmailBuilder Subject(string subject)
    {
        _subject = subject;
        return this;
    }

    public EmailBuilder Body(string body)
    {
        _body = body;
        return this;
    }

    public EmailBuilder Cc(string address)
    {
        _cc.Add(address);
        return this;
    }

    public EmailBuilder Attach(Attachment attachment)
    {
        _attachments.Add(attachment);
        return this;
    }

    public Email Build()
    {
        if (string.IsNullOrEmpty(_to))
            throw new InvalidOperationException("Recipient is required");
        if (string.IsNullOrEmpty(_from))
            throw new InvalidOperationException("Sender is required");

        return new Email(_to, _from, _subject, _body, _cc, _attachments);
    }
}

// Usage
var email = new EmailBuilder()
    .To("user@example.com")
    .From("noreply@company.com")
    .Subject("Welcome!")
    .Body("Welcome to our service.")
    .Cc("manager@company.com")
    .Build();
```

### Options Pattern

```csharp
// Configuration class
public class SmtpOptions
{
    public const string SectionName = "Smtp";

    public required string Host { get; init; }
    public int Port { get; init; } = 587;
    public required string Username { get; init; }
    public required string Password { get; init; }
    public bool UseSsl { get; init; } = true;
}

// Registration
services.Configure<SmtpOptions>(configuration.GetSection(SmtpOptions.SectionName));

// Usage with IOptions
public class EmailService
{
    private readonly SmtpOptions _options;

    public EmailService(IOptions<SmtpOptions> options)
    {
        _options = options.Value;
    }
}

// Validation
services.AddOptions<SmtpOptions>()
    .Bind(configuration.GetSection(SmtpOptions.SectionName))
    .ValidateDataAnnotations()
    .ValidateOnStart();
```

## Structural Patterns

### Repository Pattern

```csharp
// Generic repository interface
public interface IRepository<T> where T : class, IEntity
{
    Task<T?> GetByIdAsync(string id, CancellationToken ct = default);
    Task<IReadOnlyList<T>> GetAllAsync(CancellationToken ct = default);
    Task<T> AddAsync(T entity, CancellationToken ct = default);
    Task UpdateAsync(T entity, CancellationToken ct = default);
    Task DeleteAsync(string id, CancellationToken ct = default);
}

// Specification pattern for queries
public interface ISpecification<T>
{
    Expression<Func<T, bool>> Criteria { get; }
    List<Expression<Func<T, object>>> Includes { get; }
    Expression<Func<T, object>>? OrderBy { get; }
    Expression<Func<T, object>>? OrderByDescending { get; }
    int? Take { get; }
    int? Skip { get; }
}

// Extended repository with specifications
public interface IRepository<T> where T : class, IEntity
{
    Task<IReadOnlyList<T>> ListAsync(
        ISpecification<T> specification,
        CancellationToken ct = default);

    Task<T?> FirstOrDefaultAsync(
        ISpecification<T> specification,
        CancellationToken ct = default);

    Task<int> CountAsync(
        ISpecification<T> specification,
        CancellationToken ct = default);
}
```

### Unit of Work Pattern

```csharp
public interface IUnitOfWork : IDisposable
{
    IRepository<User> Users { get; }
    IRepository<Order> Orders { get; }
    IRepository<Product> Products { get; }

    Task<int> SaveChangesAsync(CancellationToken ct = default);
    Task BeginTransactionAsync(CancellationToken ct = default);
    Task CommitTransactionAsync(CancellationToken ct = default);
    Task RollbackTransactionAsync(CancellationToken ct = default);
}

public class UnitOfWork : IUnitOfWork
{
    private readonly AppDbContext _context;
    private IDbContextTransaction? _transaction;

    public UnitOfWork(AppDbContext context)
    {
        _context = context;
        Users = new Repository<User>(context);
        Orders = new Repository<Order>(context);
        Products = new Repository<Product>(context);
    }

    public IRepository<User> Users { get; }
    public IRepository<Order> Orders { get; }
    public IRepository<Product> Products { get; }

    public Task<int> SaveChangesAsync(CancellationToken ct = default)
        => _context.SaveChangesAsync(ct);

    public async Task BeginTransactionAsync(CancellationToken ct = default)
    {
        _transaction = await _context.Database.BeginTransactionAsync(ct);
    }

    public async Task CommitTransactionAsync(CancellationToken ct = default)
    {
        await _transaction?.CommitAsync(ct)!;
    }

    public async Task RollbackTransactionAsync(CancellationToken ct = default)
    {
        await _transaction?.RollbackAsync(ct)!;
    }

    public void Dispose()
    {
        _transaction?.Dispose();
        _context.Dispose();
    }
}
```

## Behavioral Patterns

### Mediator Pattern (MediatR)

```csharp
// Command
public record CreateOrderCommand(
    string CustomerId,
    IReadOnlyList<OrderItem> Items) : IRequest<Order>;

// Handler
public class CreateOrderHandler : IRequestHandler<CreateOrderCommand, Order>
{
    private readonly IOrderRepository _orderRepository;
    private readonly IPublisher _publisher;

    public CreateOrderHandler(
        IOrderRepository orderRepository,
        IPublisher publisher)
    {
        _orderRepository = orderRepository;
        _publisher = publisher;
    }

    public async Task<Order> Handle(
        CreateOrderCommand request,
        CancellationToken ct)
    {
        var order = new Order(request.CustomerId, request.Items);
        await _orderRepository.AddAsync(order, ct);

        await _publisher.Publish(new OrderCreatedEvent(order.Id), ct);

        return order;
    }
}

// Event
public record OrderCreatedEvent(string OrderId) : INotification;

// Event handler
public class OrderCreatedEventHandler : INotificationHandler<OrderCreatedEvent>
{
    private readonly IEmailService _emailService;

    public async Task Handle(
        OrderCreatedEvent notification,
        CancellationToken ct)
    {
        await _emailService.SendOrderConfirmationAsync(notification.OrderId, ct);
    }
}
```

### Pipeline Behavior (Cross-Cutting Concerns)

```csharp
// Validation behavior
public class ValidationBehavior<TRequest, TResponse>
    : IPipelineBehavior<TRequest, TResponse>
    where TRequest : notnull
{
    private readonly IEnumerable<IValidator<TRequest>> _validators;

    public ValidationBehavior(IEnumerable<IValidator<TRequest>> validators)
    {
        _validators = validators;
    }

    public async Task<TResponse> Handle(
        TRequest request,
        RequestHandlerDelegate<TResponse> next,
        CancellationToken ct)
    {
        var context = new ValidationContext<TRequest>(request);

        var failures = _validators
            .Select(v => v.Validate(context))
            .SelectMany(r => r.Errors)
            .Where(f => f != null)
            .ToList();

        if (failures.Count > 0)
            throw new ValidationException(failures);

        return await next();
    }
}

// Logging behavior
public class LoggingBehavior<TRequest, TResponse>
    : IPipelineBehavior<TRequest, TResponse>
    where TRequest : notnull
{
    private readonly ILogger<LoggingBehavior<TRequest, TResponse>> _logger;

    public async Task<TResponse> Handle(
        TRequest request,
        RequestHandlerDelegate<TResponse> next,
        CancellationToken ct)
    {
        var requestName = typeof(TRequest).Name;

        _logger.LogInformation("Handling {RequestName}", requestName);

        var stopwatch = Stopwatch.StartNew();
        var response = await next();
        stopwatch.Stop();

        _logger.LogInformation(
            "Handled {RequestName} in {ElapsedMs}ms",
            requestName,
            stopwatch.ElapsedMilliseconds);

        return response;
    }
}
```

## Common Anti-Patterns

### Service Locator Anti-Pattern

```csharp
// WRONG - Service locator
public class OrderService
{
    public void ProcessOrder(Order order)
    {
        var repository = ServiceLocator.Get<IOrderRepository>();
        var emailService = ServiceLocator.Get<IEmailService>();
        // Hidden dependencies, hard to test
    }
}

// CORRECT - Constructor injection
public class OrderService
{
    private readonly IOrderRepository _repository;
    private readonly IEmailService _emailService;

    public OrderService(
        IOrderRepository repository,
        IEmailService emailService)
    {
        _repository = repository;
        _emailService = emailService;
    }
}
```

### Async Void

```csharp
// WRONG - async void loses exceptions
public async void ProcessOrderAsync(Order order)
{
    await _repository.SaveAsync(order);
    // Exceptions are lost, caller can't await
}

// CORRECT - return Task
public async Task ProcessOrderAsync(Order order)
{
    await _repository.SaveAsync(order);
}

// Event handlers are the exception
private async void Button_Click(object sender, EventArgs e)
{
    try
    {
        await ProcessAsync();
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "Processing failed");
        ShowError(ex.Message);
    }
}
```

### Blocking on Async Code

```csharp
// WRONG - can cause deadlocks
public User GetUser(string id)
{
    return GetUserAsync(id).Result;  // Deadlock risk!
}

public User GetUser2(string id)
{
    return GetUserAsync(id).GetAwaiter().GetResult();  // Still risky
}

// CORRECT - async all the way
public async Task<User> GetUserAsync(string id)
{
    return await _repository.GetByIdAsync(id);
}

// If sync is truly needed (legacy code), use proper patterns
public User GetUserSync(string id)
{
    return Task.Run(() => GetUserAsync(id)).GetAwaiter().GetResult();
}
```

### Catch and Swallow

```csharp
// WRONG - hiding errors
try
{
    await ProcessOrderAsync(order);
}
catch (Exception)
{
    // Silent failure - debugging nightmare
}

// WRONG - logging but continuing as if nothing happened
try
{
    await ProcessOrderAsync(order);
}
catch (Exception ex)
{
    _logger.LogError(ex, "Error processing order");
    // Continues execution in broken state
}

// CORRECT - handle appropriately
try
{
    await ProcessOrderAsync(order);
}
catch (TransientException ex)
{
    _logger.LogWarning(ex, "Transient error, will retry");
    await RetryAsync(() => ProcessOrderAsync(order));
}
catch (ValidationException ex)
{
    _logger.LogInformation(ex, "Validation failed");
    throw;  // Let caller handle validation errors
}
```

## Result Pattern

```csharp
// Result type for operations that can fail
public class Result<T>
{
    private readonly T? _value;
    private readonly Error? _error;

    private Result(T value)
    {
        _value = value;
        IsSuccess = true;
    }

    private Result(Error error)
    {
        _error = error;
        IsSuccess = false;
    }

    public bool IsSuccess { get; }
    public bool IsFailure => !IsSuccess;

    public T Value => IsSuccess
        ? _value!
        : throw new InvalidOperationException("Cannot access value of failed result");

    public Error Error => !IsSuccess
        ? _error!
        : throw new InvalidOperationException("Cannot access error of successful result");

    public static Result<T> Success(T value) => new(value);
    public static Result<T> Failure(Error error) => new(error);

    public Result<TOut> Map<TOut>(Func<T, TOut> mapper) =>
        IsSuccess ? Result<TOut>.Success(mapper(Value)) : Result<TOut>.Failure(Error);

    public async Task<Result<TOut>> MapAsync<TOut>(Func<T, Task<TOut>> mapper) =>
        IsSuccess ? Result<TOut>.Success(await mapper(Value)) : Result<TOut>.Failure(Error);
}

public record Error(string Code, string Message);

// Usage
public async Task<Result<Order>> CreateOrderAsync(CreateOrderRequest request)
{
    var validationResult = _validator.Validate(request);
    if (!validationResult.IsValid)
        return Result<Order>.Failure(new Error("ValidationFailed", validationResult.ToString()));

    var customer = await _customerRepository.GetByIdAsync(request.CustomerId);
    if (customer is null)
        return Result<Order>.Failure(new Error("CustomerNotFound", "Customer does not exist"));

    var order = new Order(customer.Id, request.Items);
    await _orderRepository.AddAsync(order);

    return Result<Order>.Success(order);
}
```

## Polly Resilience Patterns

```csharp
// Retry with exponential backoff
var retryPolicy = Policy
    .Handle<HttpRequestException>()
    .Or<TimeoutException>()
    .WaitAndRetryAsync(
        retryCount: 3,
        sleepDurationProvider: attempt => TimeSpan.FromSeconds(Math.Pow(2, attempt)),
        onRetry: (exception, timeSpan, retryCount, context) =>
        {
            _logger.LogWarning(
                exception,
                "Retry {RetryCount} after {Delay}s",
                retryCount,
                timeSpan.TotalSeconds);
        });

// Circuit breaker
var circuitBreakerPolicy = Policy
    .Handle<HttpRequestException>()
    .CircuitBreakerAsync(
        exceptionsAllowedBeforeBreaking: 5,
        durationOfBreak: TimeSpan.FromSeconds(30),
        onBreak: (ex, duration) =>
            _logger.LogWarning("Circuit broken for {Duration}s", duration.TotalSeconds),
        onReset: () => _logger.LogInformation("Circuit reset"));

// Combined policy
var resilientPolicy = Policy.WrapAsync(retryPolicy, circuitBreakerPolicy);

// Usage with HttpClient
services.AddHttpClient<IExternalService, ExternalService>()
    .AddPolicyHandler(resilientPolicy);
```

## Specification Pattern Implementation

```csharp
public abstract class Specification<T>
{
    public abstract Expression<Func<T, bool>> ToExpression();

    public bool IsSatisfiedBy(T entity)
    {
        var predicate = ToExpression().Compile();
        return predicate(entity);
    }

    public Specification<T> And(Specification<T> other)
        => new AndSpecification<T>(this, other);

    public Specification<T> Or(Specification<T> other)
        => new OrSpecification<T>(this, other);

    public Specification<T> Not()
        => new NotSpecification<T>(this);
}

public class AndSpecification<T> : Specification<T>
{
    private readonly Specification<T> _left;
    private readonly Specification<T> _right;

    public AndSpecification(Specification<T> left, Specification<T> right)
    {
        _left = left;
        _right = right;
    }

    public override Expression<Func<T, bool>> ToExpression()
    {
        var leftExpr = _left.ToExpression();
        var rightExpr = _right.ToExpression();

        var parameter = Expression.Parameter(typeof(T));
        var body = Expression.AndAlso(
            Expression.Invoke(leftExpr, parameter),
            Expression.Invoke(rightExpr, parameter));

        return Expression.Lambda<Func<T, bool>>(body, parameter);
    }
}

// Concrete specifications
public class ActiveUserSpecification : Specification<User>
{
    public override Expression<Func<User, bool>> ToExpression()
        => user => user.IsActive;
}

public class PremiumUserSpecification : Specification<User>
{
    public override Expression<Func<User, bool>> ToExpression()
        => user => user.SubscriptionLevel == SubscriptionLevel.Premium;
}

// Usage
var spec = new ActiveUserSpecification().And(new PremiumUserSpecification());
var premiumActiveUsers = await _userRepository.ListAsync(spec);
```
