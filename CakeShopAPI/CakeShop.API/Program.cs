using CakeShop.Application.Interfaces;
using CakeShop.Application.Services;
using CakeShop.Infrastructure.Data;
using CakeShop.Infrastructure.Repositories;
using CakeShop.Infrastructure.Services;

var builder = WebApplication.CreateBuilder(args);

// ------------------------------------------------------------
// Local SQLite database location — stored in the user's AppData
// folder so it survives app updates and isn't tied to the install path.
// ------------------------------------------------------------
var appDataFolder = Path.Combine(
    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
    "CakeShopAPI");
Directory.CreateDirectory(appDataFolder);
var dbPath = Path.Combine(appDataFolder, "cakeshop_local.db");

// Schema file is copied to the output directory on build (see .csproj).
var schemaFilePath = Path.Combine(AppContext.BaseDirectory, "database", "local_schema_sqlite.sql");

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
builder.Services.AddHostedService<ScheduledBackupService>();

builder.Services.AddScoped<ProductService>();
builder.Services.AddScoped<CategoryService>();
builder.Services.AddScoped<OrderService>();
builder.Services.AddScoped<ExpenseService>();
builder.Services.AddScoped<ReportService>();
builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<ShopService>();

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