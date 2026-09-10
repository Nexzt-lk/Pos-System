
using CakeShop.Application.DTOs;
using CakeShop.Application.Interfaces;
using CakeShop.Domain.Entities;

namespace CakeShop.Application.Services;

public class ProductService
{
    private readonly IProductRepository _products;
    private readonly ICategoryRepository _categories;
    private readonly IInventoryRepository _inventory;
    private readonly IStockMovementRepository _movements;
    private readonly IItemCodeGenerator _codeGenerator;

    public ProductService(
        IProductRepository products,
        ICategoryRepository categories,
        IInventoryRepository inventory,
        IStockMovementRepository movements,
        IItemCodeGenerator codeGenerator)
    {
        _products = products;
        _categories = categories;
        _inventory = inventory;
        _movements = movements;
        _codeGenerator = codeGenerator;
    }

    public async Task<List<ProductDto>> GetAllAsync(bool includeInactive = false)
    {
        var products = await _products.GetAllAsync(includeInactive);
        var categories = await _categories.GetAllAsync();
        var result = new List<ProductDto>();

        foreach (var p in products)
        {
            var stock = await _inventory.GetByProductIdAsync(p.Id);
            var category = categories.FirstOrDefault(c => c.Id == p.CategoryId);

            result.Add(new ProductDto
            {
                Id = p.Id,
                CategoryId = p.CategoryId,
                CategoryName = category?.Name,
                ItemCode = p.ItemCode,
                Name = p.Name,
                Description = p.Description,
                Price = p.Price,
                CostPrice = p.CostPrice,
                Barcode = p.Barcode,
                Unit = p.Unit,
                TrackInventory = p.TrackInventory,
                IsActive = p.IsActive,
                CurrentStock = stock?.Quantity ?? 0,
                IsLowStock = stock?.IsLowStock ?? false
            });
        }
        return result;
    }

    public async Task<ProductDto?> GetByBarcodeAsync(string barcode)
    {
        var p = await _products.GetByBarcodeAsync(barcode);
        if (p == null) return null;

        var stock = await _inventory.GetByProductIdAsync(p.Id);
        var category = p.CategoryId != null ? await _categories.GetByIdAsync(p.CategoryId) : null;

        return new ProductDto
        {
            Id = p.Id,
            CategoryId = p.CategoryId,
            CategoryName = category?.Name,
            ItemCode = p.ItemCode,
            Name = p.Name,
            Description = p.Description,
            Price = p.Price,
            CostPrice = p.CostPrice,
            Barcode = p.Barcode,
            Unit = p.Unit,
            TrackInventory = p.TrackInventory,
            IsActive = p.IsActive,
            CurrentStock = stock?.Quantity ?? 0,
            IsLowStock = stock?.IsLowStock ?? false
        };
    }

    // Handles BOTH creation paths: scanned-barcode products and manually-entered
    // products (Barcode left null). Item code is always auto-generated regardless.
    public async Task<ProductDto> CreateAsync(CreateProductRequest request)
    {
        Category? category = null;
        if (!string.IsNullOrWhiteSpace(request.CategoryId))
        {
            category = await _categories.GetByIdAsync(request.CategoryId) 
                       ?? await _categories.GetByPrefixAsync(request.CategoryId);
        }

        if (category == null)
        {
            var allCategories = await _categories.GetAllAsync();
            category = allCategories.FirstOrDefault();
            if (category == null)
            {
                category = new Category
                {
                    Name = "General",
                    CodePrefix = "GEN",
                    Color = "#6366f1",
                    Icon = "cake",
                    SortOrder = 1
                };
                await _categories.AddAsync(category);
            }
            request.CategoryId = category.Id;
        }

        string? barcode = string.IsNullOrWhiteSpace(request.Barcode) ? null : request.Barcode.Trim();
        if (!string.IsNullOrWhiteSpace(barcode))
        {
            var existing = await _products.GetByBarcodeAsync(barcode);
            if (existing != null)
            {
                // Ensure unique barcode to prevent SQLite UNIQUE constraint failure
                barcode = $"{barcode}-{DateTime.UtcNow.Ticks % 1000}";
            }
        }

        var itemCode = await _codeGenerator.GenerateAsync(category.Id);

        var product = new Product
        {
            CategoryId = category.Id,
            ItemCode = itemCode,
            Name = request.Name,
            Description = request.Description,
            Price = request.Price,
            CostPrice = request.CostPrice,
            Barcode = barcode,
            Unit = string.IsNullOrWhiteSpace(request.Unit) ? "pcs" : request.Unit,
            TrackInventory = request.TrackInventory,
            IsActive = true
        };

        await _products.AddAsync(product);

        if (product.TrackInventory)
        {
            var inventoryItem = new InventoryItem
            {
                ProductId = product.Id,
                Quantity = request.InitialStock,
                MinQuantity = request.MinStockAlert > 0 ? request.MinStockAlert : 5
            };
            await _inventory.UpsertAsync(inventoryItem);

            if (request.InitialStock > 0)
            {
                await _movements.AddAsync(new Domain.Entities.StockMovement
                {
                    ProductId = product.Id,
                    Type = Domain.Enums.StockMovementType.In,
                    Quantity = request.InitialStock,
                    QuantityBefore = 0,
                    QuantityAfter = request.InitialStock,
                    Note = "Initial stock on product creation"
                });
            }
        }

        return new ProductDto
        {
            Id = product.Id,
            CategoryId = product.CategoryId,
            CategoryName = category.Name,
            ItemCode = product.ItemCode,
            Name = product.Name,
            Description = product.Description,
            Price = product.Price,
            CostPrice = product.CostPrice,
            Barcode = product.Barcode,
            Unit = product.Unit,
            TrackInventory = product.TrackInventory,
            IsActive = product.IsActive,
            CurrentStock = request.InitialStock,
            IsLowStock = product.TrackInventory && request.InitialStock <= request.MinStockAlert
        };
    }

    public async Task UpdateAsync(string id, UpdateProductRequest request)
    {
        var product = await _products.GetByIdAsync(id)
            ?? throw new InvalidOperationException("Product not found.");

        product.CategoryId = request.CategoryId;
        product.Name = request.Name;
        product.Description = request.Description;
        product.Price = request.Price;
        product.CostPrice = request.CostPrice;
        product.Barcode = string.IsNullOrWhiteSpace(request.Barcode) ? null : request.Barcode;
        product.Unit = request.Unit;
        product.TrackInventory = request.TrackInventory;
        product.IsActive = request.IsActive;
        product.UpdatedAt = DateTime.UtcNow;
        product.SyncStatus = "pending";

        await _products.UpdateAsync(product);
    }

    // Soft delete — keeps historical order_items referencing this product intact.
    public async Task DeleteAsync(string id) => await _products.DeleteAsync(id);
}