
using CakeShop.Application.DTOs;
using CakeShop.Application.Interfaces;
using CakeShop.Domain.Entities;
using CakeShop.Domain.Enums;

namespace CakeShop.Application.Services;

// Handles the core "make a sale" flow: builds the order, snapshots product
// prices, deducts stock, records the payment (cash or card), and writes an
// audit-trail stock movement — all in one place so nothing gets out of sync.
public class OrderService
{
    private readonly IOrderRepository _orders;
    private readonly IProductRepository _products;
    private readonly IInventoryRepository _inventory;
    private readonly IStockMovementRepository _movements;

    public OrderService(
        IOrderRepository orders,
        IProductRepository products,
        IInventoryRepository inventory,
        IStockMovementRepository movements)
    {
        _orders = orders;
        _products = products;
        _inventory = inventory;
        _movements = movements;
    }

    public async Task<OrderDto> CreateSaleAsync(CreateSaleRequest request, string? headerIdempotencyKey = null)
    {
        if (request.Items.Count == 0)
            throw new InvalidOperationException("A sale must have at least one item.");

        // Resolve Idempotency Key: HTTP Header > Request Body IdempotencyKey > Request Body LocalId
        var idempotencyKey = !string.IsNullOrWhiteSpace(headerIdempotencyKey)
            ? headerIdempotencyKey.Trim()
            : (!string.IsNullOrWhiteSpace(request.IdempotencyKey)
                ? request.IdempotencyKey.Trim()
                : request.LocalId?.Trim());

        // IDEMPOTENCY CHECK: If already processed with this key, return existing order (replay without double-charging or deducting stock twice)
        if (!string.IsNullOrWhiteSpace(idempotencyKey))
        {
            var existingOrder = await _orders.GetByLocalIdAsync(idempotencyKey);
            if (existingOrder != null)
            {
                return MapToDto(existingOrder);
            }
        }

        var order = new Order
        {
            LocalId = !string.IsNullOrWhiteSpace(idempotencyKey) ? idempotencyKey : Guid.NewGuid().ToString(),
            CashierId = request.CashierId,
            OrderNo = await _orders.GetNextOrderNumberAsync(request.TerminalId),
            DiscountType = request.DiscountType,
            DiscountAmount = request.DiscountAmount,
            TaxAmount = request.TaxAmount,
            Note = request.Note
        };

        decimal subtotal = 0;

        foreach (var line in request.Items)
        {
            var product = await _products.GetByIdAsync(line.ProductId)
                ?? throw new InvalidOperationException($"Product {line.ProductId} not found.");

            var lineSubtotal = (product.Price * line.Quantity) - line.Discount;
            subtotal += lineSubtotal;

            order.Items.Add(new OrderItem
            {
                OrderId = order.Id,
                ProductId = product.Id,
                ProductName = product.Name,     // snapshot — survives future renames
                ItemCode = product.ItemCode,
                UnitPrice = product.Price,       // snapshot — survives future price changes
                CostPrice = product.CostPrice,
                Quantity = line.Quantity,
                Discount = line.Discount,
                Subtotal = lineSubtotal
            });

            if (product.TrackInventory)
            {
                var stock = await _inventory.GetByProductIdAsync(product.Id);
                var before = stock?.Quantity ?? 0;
                var after = before - line.Quantity;

                await _inventory.UpsertAsync(new InventoryItem
                {
                    ProductId = product.Id,
                    Quantity = after,
                    MinQuantity = stock?.MinQuantity ?? 5
                });

                await _movements.AddAsync(new StockMovement
                {
                    ProductId = product.Id,
                    Type = StockMovementType.Sale,
                    Quantity = line.Quantity,
                    QuantityBefore = before,
                    QuantityAfter = after,
                    ReferenceId = order.Id,
                    Note = $"Sale {order.OrderNo}"
                });
            }
        }

        order.Subtotal = subtotal;
        order.TotalAmount = subtotal - request.DiscountAmount + request.TaxAmount;

        // Basic v1: one payment method per sale (cash or card).
        var payment = new Payment
        {
            OrderId = order.Id,
            Method = request.PaymentMethod.ToUpperInvariant(),
            Amount = order.TotalAmount
        };

        if (payment.Method == "CASH")
        {
            payment.CashGiven = request.CashGiven ?? order.TotalAmount;
            payment.ChangeGiven = (payment.CashGiven ?? 0) - order.TotalAmount;

            if (payment.ChangeGiven < 0)
                throw new InvalidOperationException("Cash given is less than the total amount.");
        }
        else if (payment.Method == "CARD")
        {
            payment.ReferenceNo = request.CardReferenceNo;
        }
        else
        {
            throw new InvalidOperationException("Payment method must be CASH or CARD.");
        }

        order.Payments.Add(payment);

        await _orders.AddAsync(order); // persists order + items + payment in one transaction

        return MapToDto(order);
    }

    public async Task<OrderDto?> GetByIdAsync(string id)
    {
        var order = await _orders.GetByIdAsync(id);
        return order == null ? null : MapToDto(order);
    }

    public async Task<List<OrderDto>> GetAllAsync(int limit = 100)
    {
        var orders = await _orders.GetAllAsync(limit);
        return orders.Select(MapToDto).ToList();
    }

    public async Task<List<OrderDto>> GetByDateRangeAsync(DateTime fromUtc, DateTime toUtc)
    {
        var orders = await _orders.GetByDateRangeAsync(fromUtc, toUtc);
        return orders.Select(MapToDto).ToList();
    }

    private static OrderDto MapToDto(Order order) => new()
    {
        Id = order.Id,
        LocalId = order.LocalId,
        OrderNo = order.OrderNo,
        CashierId = order.CashierId,
        Subtotal = order.Subtotal,
        DiscountAmount = order.DiscountAmount,
        TaxAmount = order.TaxAmount,
        TotalAmount = order.TotalAmount,
        Status = order.Status,
        CreatedAt = order.CreatedAt,
        Items = order.Items.Select(i => new OrderItemDto
        {
            ProductName = i.ProductName,
            ItemCode = i.ItemCode,
            UnitPrice = i.UnitPrice,
            Quantity = i.Quantity,
            Discount = i.Discount,
            Subtotal = i.Subtotal
        }).ToList(),
        Payments = order.Payments.Select(p => new PaymentDto
        {
            Method = p.Method,
            Amount = p.Amount,
            CashGiven = p.CashGiven,
            ChangeGiven = p.ChangeGiven
        }).ToList()
    };
}