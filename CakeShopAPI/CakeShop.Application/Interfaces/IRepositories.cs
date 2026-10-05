
using CakeShop.Domain.Entities;

namespace CakeShop.Application.Interfaces;

public interface ICategoryRepository
{
    Task<List<Category>> GetAllAsync();
    Task<Category?> GetByIdAsync(string id);
    Task<Category?> GetByPrefixAsync(string prefix);
    Task AddAsync(Category category);
    Task UpdateAsync(Category category);
    Task DeleteAsync(string id);
}

public interface IProductRepository
{
    Task<List<Product>> GetAllAsync(bool includeInactive = false, string? shopId = null);
    Task<Product?> GetByIdAsync(string id);
    Task<Product?> GetByBarcodeAsync(string barcode, string? shopId = null);
    Task<int> CountByCategoryAsync(string categoryId);
    Task AddAsync(Product product);
    Task UpdateAsync(Product product);
    Task DeleteAsync(string id); // soft delete (is_active = 0)
}

public interface IInventoryRepository
{
    Task<InventoryItem?> GetByProductIdAsync(string productId);
    Task<List<InventoryItem>> GetLowStockAsync();
    Task UpsertAsync(InventoryItem item);
}

public interface IStockMovementRepository
{
    Task AddAsync(StockMovement movement);
    Task<List<StockMovement>> GetByProductAsync(string productId);
}

public interface IOrderRepository
{
    Task<string> GetNextOrderNumberAsync(string terminalId);
    Task AddAsync(Order order); // saves order + items + payments in one transaction
    Task<Order?> GetByIdAsync(string id);
    Task<Order?> GetByLocalIdAsync(string localId); // idempotency check
    Task<List<Order>> GetByDateRangeAsync(DateTime fromUtc, DateTime toUtc, string? shopId = null);
    Task<List<Order>> GetAllAsync(int limit = 100, string? shopId = null);
}

public interface IExpenseRepository
{
    Task AddAsync(Expense expense);
    Task<List<Expense>> GetAllAsync(string? shopId = null);
    Task<List<Expense>> GetByDateRangeAsync(DateOnly from, DateOnly to, string? shopId = null);
    Task UpdateAsync(Expense expense);
    Task DeleteAsync(string id);
}

public interface IUserRepository
{
    Task<List<User>> GetAllAsync(bool includeInactive = false);
    Task<User?> GetByIdAsync(string id);
    Task<User?> GetByEmailAsync(string email);
    Task<User?> GetByPinAsync(string pin);
    Task AddAsync(User user);
    Task UpdateAsync(User user);
    Task DeleteAsync(string id);
}

public interface IShopRepository
{
    Task<Shop?> GetCurrentShopAsync();
    Task UpsertAsync(Shop shop);
}