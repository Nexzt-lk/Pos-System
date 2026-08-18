
using CakeShop.Application.Interfaces;
using CakeShop.Domain.Entities;
using CakeShop.Domain.Enums;
using CakeShop.Infrastructure.Data;
using Microsoft.Data.Sqlite;

namespace CakeShop.Infrastructure.Repositories;

public class StockMovementRepository : IStockMovementRepository
{
    private readonly SqliteConnectionFactory _factory;
    public StockMovementRepository(SqliteConnectionFactory factory) => _factory = factory;

    public async Task AddAsync(StockMovement movement)
    {
        using var connection = _factory.CreateConnection();
        using var cmd = connection.CreateCommand();
        cmd.CommandText = @"
            INSERT INTO stock_movements
                (id, product_id, type, quantity, quantity_before, quantity_after,
                 reference_id, note, cost_per_unit, done_by, created_at, local_id, sync_status)
            VALUES
                ($id, $pid, $type, $qty, $before, $after,
                 $ref, $note, $cost, $by, $created, $localId, 'pending');";
        cmd.Parameters.AddWithValue("$id", movement.Id);
        cmd.Parameters.AddWithValue("$pid", movement.ProductId);
        cmd.Parameters.AddWithValue("$type", movement.Type.ToString().ToUpperInvariant());
        cmd.Parameters.AddWithValue("$qty", movement.Quantity);
        cmd.Parameters.AddWithValue("$before", movement.QuantityBefore);
        cmd.Parameters.AddWithValue("$after", movement.QuantityAfter);
        cmd.Parameters.AddWithValue("$ref", (object?)movement.ReferenceId ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$note", (object?)movement.Note ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$cost", (object?)movement.CostPerUnit ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$by", (object?)movement.DoneBy ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$created", movement.CreatedAt.ToString("o"));
        cmd.Parameters.AddWithValue("$localId", movement.LocalId);
        await cmd.ExecuteNonQueryAsync();
    }

    public async Task<List<StockMovement>> GetByProductAsync(string productId)
    {
        using var connection = _factory.CreateConnection();
        using var cmd = connection.CreateCommand();
        cmd.CommandText = "SELECT * FROM stock_movements WHERE product_id = $pid ORDER BY created_at DESC;";
        cmd.Parameters.AddWithValue("$pid", productId);
        using var reader = await cmd.ExecuteReaderAsync();

        var result = new List<StockMovement>();
        while (await reader.ReadAsync())
        {
            result.Add(new StockMovement
            {
                Id = reader.GetString(reader.GetOrdinal("id")),
                ProductId = reader.GetString(reader.GetOrdinal("product_id")),
                Type = Enum.Parse<StockMovementType>(reader.GetString(reader.GetOrdinal("type")), true),
                Quantity = Convert.ToDecimal(reader.GetDouble(reader.GetOrdinal("quantity"))),
                QuantityBefore = Convert.ToDecimal(reader.GetDouble(reader.GetOrdinal("quantity_before"))),
                QuantityAfter = Convert.ToDecimal(reader.GetDouble(reader.GetOrdinal("quantity_after"))),
                ReferenceId = reader.IsDBNull(reader.GetOrdinal("reference_id")) ? null : reader.GetString(reader.GetOrdinal("reference_id")),
                Note = reader.IsDBNull(reader.GetOrdinal("note")) ? null : reader.GetString(reader.GetOrdinal("note")),
                CreatedAt = DateTime.Parse(reader.GetString(reader.GetOrdinal("created_at")))
            });
        }
        return result;
    }
}