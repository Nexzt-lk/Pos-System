using CakeShop.Application.Interfaces;
using CakeShop.Domain.Entities;
using CakeShop.Infrastructure.Data;
using Microsoft.Data.Sqlite;

namespace CakeShop.Infrastructure.Repositories;

public class ShopRepository : IShopRepository
{
    private readonly SqliteConnectionFactory _factory;
    public ShopRepository(SqliteConnectionFactory factory) => _factory = factory;

    public async Task<Shop?> GetCurrentShopAsync()
    {
        using var connection = _factory.CreateConnection();
        using var cmd = connection.CreateCommand();
        cmd.CommandText = "SELECT * FROM shops LIMIT 1;";
        using var reader = await cmd.ExecuteReaderAsync();
        return await reader.ReadAsync() ? Map(reader) : null;
    }

    public async Task UpsertAsync(Shop shop)
    {
        using var connection = _factory.CreateConnection();
        using var cmd = connection.CreateCommand();
        cmd.CommandText = @"
            INSERT INTO shops (id, name, branch_code, address, phone, email, currency, receipt_footer, created_at, updated_at)
            VALUES ($id, $name, $code, $address, $phone, $email, $currency, $footer, $created, $updated)
            ON CONFLICT(id) DO UPDATE SET
                name = $name,
                branch_code = $code,
                address = $address,
                phone = $phone,
                email = $email,
                currency = $currency,
                receipt_footer = $footer,
                updated_at = $updated;";

        cmd.Parameters.AddWithValue("$id", shop.Id);
        cmd.Parameters.AddWithValue("$name", shop.Name);
        cmd.Parameters.AddWithValue("$code", shop.BranchCode);
        cmd.Parameters.AddWithValue("$address", (object?)shop.Address ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$phone", (object?)shop.Phone ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$email", (object?)shop.Email ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$currency", shop.Currency);
        cmd.Parameters.AddWithValue("$footer", shop.ReceiptFooter);
        cmd.Parameters.AddWithValue("$created", shop.CreatedAt.ToString("o"));
        cmd.Parameters.AddWithValue("$updated", shop.UpdatedAt.ToString("o"));
        await cmd.ExecuteNonQueryAsync();
    }

    private static Shop Map(SqliteDataReader r) => new()
    {
        Id = r.GetString(r.GetOrdinal("id")),
        Name = r.GetString(r.GetOrdinal("name")),
        BranchCode = r.GetString(r.GetOrdinal("branch_code")),
        Address = r.IsDBNull(r.GetOrdinal("address")) ? null : r.GetString(r.GetOrdinal("address")),
        Phone = r.IsDBNull(r.GetOrdinal("phone")) ? null : r.GetString(r.GetOrdinal("phone")),
        Email = r.IsDBNull(r.GetOrdinal("email")) ? null : r.GetString(r.GetOrdinal("email")),
        Currency = r.GetString(r.GetOrdinal("currency")),
        ReceiptFooter = r.GetString(r.GetOrdinal("receipt_footer")),
        CreatedAt = DateTime.Parse(r.GetString(r.GetOrdinal("created_at"))),
        UpdatedAt = DateTime.Parse(r.GetString(r.GetOrdinal("updated_at")))
    };
}
