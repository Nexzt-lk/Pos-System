using CakeShop.Application.DTOs;
using CakeShop.Application.Interfaces;
using CakeShop.Domain.Entities;
using CakeShop.Domain.Enums;

namespace CakeShop.Application.Services;

public class InventoryService
{
    private readonly IInventoryRepository _inventory;
    private readonly IStockMovementRepository _movements;
    private readonly IProductRepository _products;

    public InventoryService(
        IInventoryRepository inventory,
        IStockMovementRepository movements,
        IProductRepository products)
    {
        _inventory = inventory;
        _movements = movements;
        _products = products;
    }

    public async Task<StockMovementDto> RecordMovementAsync(RecordStockMovementRequest request)
    {
        var product = await _products.GetByIdAsync(request.ProductId)
            ?? throw new InvalidOperationException("Product not found");

        var currentInv = await _inventory.GetByProductIdAsync(request.ProductId);
        decimal qtyBefore = currentInv?.Quantity ?? 0;
        decimal qtyAfter = qtyBefore;

        if (!Enum.TryParse<StockMovementType>(request.Type, true, out var movementType))
        {
            movementType = StockMovementType.In;
        }

        switch (movementType)
        {
            case StockMovementType.In:
            case StockMovementType.Return:
                qtyAfter = qtyBefore + request.Quantity;
                break;
            case StockMovementType.Out:
            case StockMovementType.Sale:
            case StockMovementType.Damage:
                qtyAfter = Math.Max(0, qtyBefore - request.Quantity);
                break;
            case StockMovementType.Adjust:
                qtyAfter = request.Quantity;
                break;
        }

        var invItem = new InventoryItem
        {
            Id = currentInv?.Id ?? Guid.NewGuid().ToString(),
            ProductId = request.ProductId,
            Quantity = qtyAfter,
            MinQuantity = currentInv?.MinQuantity ?? 5,
            UpdatedAt = DateTime.UtcNow
        };

        await _inventory.UpsertAsync(invItem);

        var movement = new StockMovement
        {
            Id = Guid.NewGuid().ToString(),
            ProductId = request.ProductId,
            Type = movementType,
            Quantity = request.Quantity,
            QuantityBefore = qtyBefore,
            QuantityAfter = qtyAfter,
            Note = request.Note,
            CostPerUnit = request.CostPerUnit,
            DoneBy = request.DoneBy,
            CreatedAt = DateTime.UtcNow
        };

        await _movements.AddAsync(movement);

        return new StockMovementDto
        {
            Id = movement.Id,
            ProductId = movement.ProductId,
            Type = movement.Type.ToString().ToUpperInvariant(),
            Quantity = movement.Quantity,
            QuantityBefore = movement.QuantityBefore,
            QuantityAfter = movement.QuantityAfter,
            ReferenceId = movement.ReferenceId,
            Note = movement.Note,
            CostPerUnit = movement.CostPerUnit,
            DoneBy = movement.DoneBy,
            CreatedAt = movement.CreatedAt
        };
    }

    public async Task<List<StockMovementDto>> GetMovementsByProductAsync(string productId)
    {
        var list = await _movements.GetByProductAsync(productId);
        return list.Select(m => new StockMovementDto
        {
            Id = m.Id,
            ProductId = m.ProductId,
            Type = m.Type.ToString().ToUpperInvariant(),
            Quantity = m.Quantity,
            QuantityBefore = m.QuantityBefore,
            QuantityAfter = m.QuantityAfter,
            ReferenceId = m.ReferenceId,
            Note = m.Note,
            CostPerUnit = m.CostPerUnit,
            DoneBy = m.DoneBy,
            CreatedAt = m.CreatedAt
        }).ToList();
    }
}
