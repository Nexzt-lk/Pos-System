
namespace CakeShop.Domain.Enums;

public enum StockMovementType
{
    In,
    Out,
    Sale,
    Adjust,
    Return,
    Damage
}

public enum SyncStatus
{
    Pending,
    Synced,
    Conflict
}

public enum OrderStatus
{
    Completed,
    Refunded,
    Voided
}

public enum DiscountType
{
    Percent,
    Fixed
}

public enum PaymentMethod
{
    Cash,
    Card
}