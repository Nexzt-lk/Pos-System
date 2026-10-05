using System.Text.Json.Serialization;

namespace CakeShop.Application.DTOs;

public class ProductDto
{
    public string Id { get; set; } = string.Empty;

    private string? _shopId;

    [JsonPropertyName("shopId")]
    public string? ShopId
    {
        get => _shopId;
        set { if (!string.IsNullOrWhiteSpace(value) || _shopId == null) _shopId = value; }
    }

    [JsonPropertyName("shop_id")]
    public string? ShopIdSnake
    {
        get => _shopId;
        set { if (!string.IsNullOrWhiteSpace(value)) _shopId = value; }
    }

    public string? CategoryId { get; set; }
    public string? CategoryName { get; set; }
    public string ItemCode { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public decimal Price { get; set; }
    public decimal? CostPrice { get; set; }
    public string? Barcode { get; set; }

    private string? _imagePath;

    [JsonPropertyName("imagePath")]
    public string? ImagePath
    {
        get => _imagePath;
        set { if (!string.IsNullOrWhiteSpace(value) || _imagePath == null) _imagePath = value; }
    }

    [JsonPropertyName("image_path")]
    public string? ImagePathSnake
    {
        get => _imagePath;
        set { if (!string.IsNullOrWhiteSpace(value)) _imagePath = value; }
    }

    public string Unit { get; set; } = "pcs";
    public bool TrackInventory { get; set; }
    public bool IsActive { get; set; }
    public decimal CurrentStock { get; set; }
    public bool IsLowStock { get; set; }
}

// Used for both barcode-scanned and manually-entered products.
// If Barcode is null/empty, the product is treated as manual-entry only.
public class CreateProductRequest
{
    private string? _shopId;

    [JsonPropertyName("shopId")]
    public string? ShopId
    {
        get => _shopId;
        set { if (!string.IsNullOrWhiteSpace(value) || _shopId == null) _shopId = value; }
    }

    [JsonPropertyName("shop_id")]
    public string? ShopIdSnake
    {
        get => _shopId;
        set { if (!string.IsNullOrWhiteSpace(value)) _shopId = value; }
    }

    public string CategoryId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public decimal Price { get; set; }
    public decimal? CostPrice { get; set; }
    public string? Barcode { get; set; }              // null = no barcode, manual entry

    private string? _imagePath;

    [JsonPropertyName("imagePath")]
    public string? ImagePath
    {
        get => _imagePath;
        set { if (!string.IsNullOrWhiteSpace(value) || _imagePath == null) _imagePath = value; }
    }

    [JsonPropertyName("image_path")]
    public string? ImagePathSnake
    {
        get => _imagePath;
        set { if (!string.IsNullOrWhiteSpace(value)) _imagePath = value; }
    }

    public string Unit { get; set; } = "pcs";
    public bool TrackInventory { get; set; } = true;
    public decimal InitialStock { get; set; } = 0;
    public decimal MinStockAlert { get; set; } = 5;
}

public class UpdateProductRequest
{
    private string? _shopId;

    [JsonPropertyName("shopId")]
    public string? ShopId
    {
        get => _shopId;
        set { if (!string.IsNullOrWhiteSpace(value) || _shopId == null) _shopId = value; }
    }

    [JsonPropertyName("shop_id")]
    public string? ShopIdSnake
    {
        get => _shopId;
        set { if (!string.IsNullOrWhiteSpace(value)) _shopId = value; }
    }

    public string? CategoryId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public decimal Price { get; set; }
    public decimal? CostPrice { get; set; }
    public string? Barcode { get; set; }

    private string? _imagePath;

    [JsonPropertyName("imagePath")]
    public string? ImagePath
    {
        get => _imagePath;
        set { if (!string.IsNullOrWhiteSpace(value) || _imagePath == null) _imagePath = value; }
    }

    [JsonPropertyName("image_path")]
    public string? ImagePathSnake
    {
        get => _imagePath;
        set { if (!string.IsNullOrWhiteSpace(value)) _imagePath = value; }
    }

    public string Unit { get; set; } = "pcs";
    public bool TrackInventory { get; set; }
    public bool IsActive { get; set; }
}
