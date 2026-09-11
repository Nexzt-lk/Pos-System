
using CakeShop.Application.Interfaces;
using CakeShop.Domain.Entities;
using CakeShop.Infrastructure.Data;
using Microsoft.Data.Sqlite;

namespace CakeShop.Infrastructure.Repositories;

public class ProductRepository : IProductRepository
{
    private readonly SqliteConnectionFactory _factory;
    public ProductRepository(SqliteConnectionFactory factory) => _factory = factory;

    public async Task<List<Product>> GetAllAsync(bool includeInactive = false)
    {
        using var connection = _factory.CreateConnection();
        using var cmd = connection.CreateCommand();
        cmd.CommandText = includeInactive
            ? "SELECT * FROM products ORDER BY name;"
            : "SELECT * FROM products WHERE is_active = 1 ORDER BY name;";
        using var reader = await cmd.ExecuteReaderAsync();

        var result = new List<Product>();
        while (await reader.ReadAsync())
            result.Add(Map(reader));
        return result;
    }

    public async Task<Product?> GetByIdAsync(string id)
    {
        using var connection = _factory.CreateConnection();
        using var cmd = connection.CreateCommand();
        cmd.CommandText = "SELECT * FROM products WHERE id = $id;";
        cmd.Parameters.AddWithValue("$id", id);
        using var reader = await cmd.ExecuteReaderAsync();
        return await reader.ReadAsync() ? Map(reader) : null;
    }

    public async Task<Product?> GetByBarcodeAsync(string barcode)
    {
        using var connection = _factory.CreateConnection();
        using var cmd = connection.CreateCommand();
        cmd.CommandText = "SELECT * FROM products WHERE barcode = $barcode;";
        cmd.Parameters.AddWithValue("$barcode", barcode);
        using var reader = await cmd.ExecuteReaderAsync();
        return await reader.ReadAsync() ? Map(reader) : null;
    }

    public async Task<int> CountByCategoryAsync(string categoryId)
    {
        using var connection = _factory.CreateConnection();
        using var cmd = connection.CreateCommand();
        cmd.CommandText = "SELECT COUNT(*) FROM products WHERE category_id = $catId;";
        cmd.Parameters.AddWithValue("$catId", categoryId);
        return Convert.ToInt32(await cmd.ExecuteScalarAsync());
    }

    public async Task AddAsync(Product product)
    {
        using var connection = _factory.CreateConnection();
        using var transaction = connection.BeginTransaction();

        using (var cmd = connection.CreateCommand())
        {
            cmd.Transaction = transaction;
            cmd.CommandText = @"
                INSERT INTO products
                    (id, category_id, item_code, name, description, price, cost_price,
                     barcode, image_path, unit, track_inventory, is_active,
                     created_at, updated_at, sync_status)
                VALUES
                    ($id, $catId, $code, $name, $desc, $price, $cost,
                     $barcode, $img, $unit, $track, 1,
                     $created, $updated, 'pending');";
            BindProductParams(cmd, product);
            cmd.Parameters.AddWithValue("$created", product.CreatedAt.ToString("o"));
            cmd.Parameters.AddWithValue("$updated", product.UpdatedAt.ToString("o"));
            await cmd.ExecuteNonQueryAsync();
        }

        using (var qCmd = connection.CreateCommand())
        {
            qCmd.Transaction = transaction;
            qCmd.CommandText = @"
                INSERT INTO sync_queue (table_name, operation, record_id, payload, status, created_at)
                VALUES ('products', 'INSERT', $recId, $payload, 'pending', datetime('now'));";
            qCmd.Parameters.AddWithValue("$recId", product.Id);
            qCmd.Parameters.AddWithValue("$payload", System.Text.Json.JsonSerializer.Serialize(new
            {
                id = product.Id,
                category_id = product.CategoryId,
                item_code = product.ItemCode,
                name = product.Name,
                description = product.Description,
                price = product.Price,
                cost_price = product.CostPrice,
                barcode = product.Barcode,
                image_path = product.ImagePath,
                unit = product.Unit,
                track_inventory = product.TrackInventory,
                is_active = product.IsActive
            }));
            await qCmd.ExecuteNonQueryAsync();
        }

        transaction.Commit();
    }

    public async Task UpdateAsync(Product product)
    {
        using var connection = _factory.CreateConnection();
        using var transaction = connection.BeginTransaction();

        using (var cmd = connection.CreateCommand())
        {
            cmd.Transaction = transaction;
            cmd.CommandText = @"
                UPDATE products SET
                    category_id = $catId, name = $name, description = $desc,
                    price = $price, cost_price = $cost, barcode = $barcode,
                    unit = $unit, track_inventory = $track, is_active = $active,
                    updated_at = $updated, sync_status = 'pending'
                WHERE id = $id;";
            BindProductParams(cmd, product);
            cmd.Parameters.AddWithValue("$active", product.IsActive ? 1 : 0);
            cmd.Parameters.AddWithValue("$updated", product.UpdatedAt.ToString("o"));
            await cmd.ExecuteNonQueryAsync();
        }

        using (var qCmd = connection.CreateCommand())
        {
            qCmd.Transaction = transaction;
            qCmd.CommandText = @"
                INSERT INTO sync_queue (table_name, operation, record_id, payload, status, created_at)
                VALUES ('products', 'UPDATE', $recId, $payload, 'pending', datetime('now'));";
            qCmd.Parameters.AddWithValue("$recId", product.Id);
            qCmd.Parameters.AddWithValue("$payload", System.Text.Json.JsonSerializer.Serialize(new
            {
                id = product.Id,
                category_id = product.CategoryId,
                item_code = product.ItemCode,
                name = product.Name,
                description = product.Description,
                price = product.Price,
                cost_price = product.CostPrice,
                barcode = product.Barcode,
                image_path = product.ImagePath,
                unit = product.Unit,
                track_inventory = product.TrackInventory,
                is_active = product.IsActive
            }));
            await qCmd.ExecuteNonQueryAsync();
        }

        transaction.Commit();
    }

    public async Task DeleteAsync(string id)
    {
        using var connection = _factory.CreateConnection();
        using var transaction = connection.BeginTransaction();

        using (var cmd = connection.CreateCommand())
        {
            cmd.Transaction = transaction;
            cmd.CommandText = "UPDATE products SET is_active = 0, sync_status = 'pending' WHERE id = $id;";
            cmd.Parameters.AddWithValue("$id", id);
            await cmd.ExecuteNonQueryAsync();
        }

        using (var qCmd = connection.CreateCommand())
        {
            qCmd.Transaction = transaction;
            qCmd.CommandText = @"
                INSERT INTO sync_queue (table_name, operation, record_id, payload, status, created_at)
                VALUES ('products', 'DELETE', $recId, $payload, 'pending', datetime('now'));";
            qCmd.Parameters.AddWithValue("$recId", id);
            qCmd.Parameters.AddWithValue("$payload", System.Text.Json.JsonSerializer.Serialize(new { id, is_active = false }));
            await qCmd.ExecuteNonQueryAsync();
        }

        transaction.Commit();
    }

    private static void BindProductParams(SqliteCommand cmd, Product p)
    {
        cmd.Parameters.AddWithValue("$id", p.Id);
        cmd.Parameters.AddWithValue("$catId", (object?)p.CategoryId ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$code", p.ItemCode);
        cmd.Parameters.AddWithValue("$name", p.Name);
        cmd.Parameters.AddWithValue("$desc", (object?)p.Description ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$price", p.Price);
        cmd.Parameters.AddWithValue("$cost", (object?)p.CostPrice ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$barcode", (object?)p.Barcode ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$img", (object?)p.ImagePath ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$unit", p.Unit);
        cmd.Parameters.AddWithValue("$track", p.TrackInventory ? 1 : 0);
    }

    private static Product Map(SqliteDataReader r) => new()
    {
        Id = r.GetString(r.GetOrdinal("id")),
        CategoryId = r.IsDBNull(r.GetOrdinal("category_id")) ? null : r.GetString(r.GetOrdinal("category_id")),
        ItemCode = r.GetString(r.GetOrdinal("item_code")),
        Name = r.GetString(r.GetOrdinal("name")),
        Description = r.IsDBNull(r.GetOrdinal("description")) ? null : r.GetString(r.GetOrdinal("description")),
        Price = Convert.ToDecimal(r.GetDouble(r.GetOrdinal("price"))),
        CostPrice = r.IsDBNull(r.GetOrdinal("cost_price")) ? null : Convert.ToDecimal(r.GetDouble(r.GetOrdinal("cost_price"))),
        Barcode = r.IsDBNull(r.GetOrdinal("barcode")) ? null : r.GetString(r.GetOrdinal("barcode")),
        ImagePath = r.IsDBNull(r.GetOrdinal("image_path")) ? null : r.GetString(r.GetOrdinal("image_path")),
        Unit = r.GetString(r.GetOrdinal("unit")),
        TrackInventory = r.GetInt32(r.GetOrdinal("track_inventory")) == 1,
        IsActive = r.GetInt32(r.GetOrdinal("is_active")) == 1,
        CreatedAt = DateTime.Parse(r.GetString(r.GetOrdinal("created_at"))),
        UpdatedAt = DateTime.Parse(r.GetString(r.GetOrdinal("updated_at"))),
        SyncStatus = r.GetString(r.GetOrdinal("sync_status"))
    };
}