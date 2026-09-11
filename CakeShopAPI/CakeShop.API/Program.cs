using CakeShop.Application.Interfaces;
using CakeShop.Application.Services;
using CakeShop.Infrastructure.Data;
using CakeShop.Infrastructure.Repositories;
using CakeShop.Infrastructure.Services;

var builder = WebApplication.CreateBuilder(args);

// ------------------------------------------------------------
// Local SQLite database location — stored in dedicated database/cakeshop_local.db
// ------------------------------------------------------------
string dbPath = "";

// Search upwards from current directory and AppContext.BaseDirectory for the project root containing database/cakeshop_local.db
var searchDirs = new List<string>();

var cur = new DirectoryInfo(Directory.GetCurrentDirectory());
while (cur != null)
{
    searchDirs.Add(cur.FullName);
    cur = cur.Parent;
}

var baseDir = new DirectoryInfo(AppContext.BaseDirectory);
while (baseDir != null)
{
    searchDirs.Add(baseDir.FullName);
    baseDir = baseDir.Parent;
}

foreach (var dir in searchDirs)
{
    var candidate = Path.Combine(dir, "database", "cakeshop_local.db");
    // Ensure we don't pick up a temporary bin\database
    if (!dir.Contains(@"\bin\") && !dir.EndsWith(@"\bin") && (File.Exists(candidate) || (Directory.Exists(Path.Combine(dir, "CakeShopPOS")) && Directory.Exists(Path.Combine(dir, "database")))))
    {
        dbPath = Path.GetFullPath(candidate);
        break;
    }
}

if (string.IsNullOrEmpty(dbPath))
{
    var configuredDbPath = builder.Configuration["Database:SqlitePath"];
    if (!string.IsNullOrWhiteSpace(configuredDbPath))
    {
        dbPath = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, configuredDbPath));
    }
    else
    {
        dbPath = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "database", "cakeshop_local.db"));
    }
}

var dbParent = Path.GetDirectoryName(dbPath);
if (!string.IsNullOrEmpty(dbParent))
{
    Directory.CreateDirectory(dbParent);
}

Console.WriteLine($"[Database] SQLite Database Location: {dbPath}");

// Schema file location
string schemaFilePath = Path.Combine(AppContext.BaseDirectory, "database", "local_schema_sqlite.sql");
if (!File.Exists(schemaFilePath))
{
    var altSchema = Path.Combine(Path.GetDirectoryName(dbPath)!, "local_schema_sqlite.sql");
    if (File.Exists(altSchema))
    {
        schemaFilePath = altSchema;
    }
}

// ------------------------------------------------------------
// Dependency injection — wiring Infrastructure implementations
// to Application interfaces, and registering the services.
// ------------------------------------------------------------
builder.Services.AddSingleton(new SqliteConnectionFactory(dbPath));
builder.Services.AddSingleton(sp => new DatabaseInitializer(
    sp.GetRequiredService<SqliteConnectionFactory>(), schemaFilePath));

builder.Services.AddScoped<ICategoryRepository, CategoryRepository>();
builder.Services.AddScoped<IProductRepository, ProductRepository>();
builder.Services.AddScoped<IInventoryRepository, InventoryRepository>();
builder.Services.AddScoped<IStockMovementRepository, StockMovementRepository>();
builder.Services.AddScoped<IOrderRepository, OrderRepository>();
builder.Services.AddScoped<IExpenseRepository, ExpenseRepository>();
builder.Services.AddScoped<IUserRepository, UserRepository>();
builder.Services.AddScoped<IShopRepository, ShopRepository>();
builder.Services.AddScoped<IItemCodeGenerator, ItemCodeGenerator>();
builder.Services.AddScoped<IBackupService, BackupService>();
builder.Services.AddScoped<ISyncService, SupabaseSyncService>();
builder.Services.AddHostedService<ScheduledBackupService>();
builder.Services.AddHostedService<ScheduledSyncService>();

builder.Services.AddScoped<ProductService>();
builder.Services.AddScoped<CategoryService>();
builder.Services.AddScoped<OrderService>();
builder.Services.AddScoped<ExpenseService>();
builder.Services.AddScoped<ReportService>();
builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<ShopService>();
builder.Services.AddScoped<InventoryService>();
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// ------------------------------------------------------------
// CORS — this API only ever serves the local Electron app, so a
// permissive local policy is fine (nothing is exposed to the internet).
// ------------------------------------------------------------
builder.Services.AddCors(options =>
{
    options.AddPolicy("ElectronLocal", policy =>
    {
        policy.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader();
    });
});

var app = builder.Build();

// Run the schema script on startup — safe to run every time (IF NOT EXISTS).
using (var scope = app.Services.CreateScope())
{
    var initializer = scope.ServiceProvider.GetRequiredService<DatabaseInitializer>();
    initializer.Initialize();
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(); // browse to /swagger to test endpoints without Electron
}

app.UseCors("ElectronLocal");
app.UseAuthorization();
app.MapControllers();

// Fixed local port so Electron always knows where to find the API.
app.Run("http://127.0.0.1:5292");