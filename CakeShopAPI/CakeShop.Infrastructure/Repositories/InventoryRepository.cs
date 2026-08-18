
using CakeShop.Application.Interfaces;
using CakeShop.Domain.Entities;
using CakeShop.Infrastructure.Data;
using Microsoft.Data.Sqlite;

namespace CakeShop.Infrastructure.Repositories;

public class InventoryRepository : IInventoryRepository
{
    private readonly SqliteConnectionFactory _factory;
    public InventoryRepository(SqliteConnectionFactory factory) => _factory = factory;

    public async Task<InventoryItem?> GetByProductIdAsync(string productId)
    {
        using var connection = _factory.CreateConnection();
        using var cmd = connection.CreateCommand();
        cmd.CommandText = "SELECT * FROM inventory WHERE product_id = $pid;";
        cmd.Parameters.AddWithValue("$pid", productId);
        using var reader = await cmd.ExecuteReaderAsync();
        return await reader.ReadAsync() ? Map(reader) : null;
    }

    public async Task<List<InventoryItem>> GetLowStockAsync()
    {
        using var connection = _factory.CreateConnection();
        using var cmd = connection.CreateCommand();
        cmd.CommandText = "SELECT * FROM inventory WHERE quantity <= min_quantity;";
        using var reader = await cmd.ExecuteReaderAsync();

        var result = new List<InventoryItem>();
        while (await reader.ReadAsync())
            result.Add(Map(reader));
        return result;
    }

    public async Task UpsertAsync(InventoryItem item)
    {
        using var connection = _factory.CreateConnection();
        using var cmd = connection.CreateCommand();
        cmd.CommandText = @"
            INSERT INTO inventory (id, product_id, quantity, min_quantity, updated_at)
            VALUES ($id, $pid, $qty, $min, $updated)
            ON CONFLICT(product_id) DO UPDATE SET
                quantity = $qty, min_quantity = $min, updated_at = $updated;";
        cmd.Parameters.AddWithValue("$id", item.Id);
        cmd.Parameters.AddWithValue("$pid", item.ProductId);
        cmd.Parameters.AddWithValue("$qty", item.Quantity);
        cmd.Parameters.AddWithValue("$min", item.MinQuantity);
        cmd.Parameters.AddWithValue("$updated", DateTime.UtcNow.ToString("o"));
        await cmd.ExecuteNonQueryAsync();
    }

    private static InventoryItem Map(SqliteDataReader r) => new()
    {
        Id = r.GetString(r.GetOrdinal("id")),
        ProductId = r.GetString(r.GetOrdinal("product_id")),
        Quantity = Convert.ToDecimal(r.GetDouble(r.GetOrdinal("quantity"))),
        MinQuantity = Convert.ToDecimal(r.GetDouble(r.GetOrdinal("min_quantity"))),
        UpdatedAt = DateTime.Parse(r.GetString(r.GetOrdinal("updated_at")))
    };
}