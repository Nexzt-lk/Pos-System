using CakeShop.Application.Interfaces;
using CakeShop.Domain.Entities;
using CakeShop.Infrastructure.Data;
using Microsoft.Data.Sqlite;

namespace CakeShop.Infrastructure.Repositories;

public class UserRepository : IUserRepository
{
    private readonly SqliteConnectionFactory _factory;
    public UserRepository(SqliteConnectionFactory factory) => _factory = factory;

    public async Task<List<User>> GetAllAsync(bool includeInactive = false)
    {
        using var connection = _factory.CreateConnection();
        using var cmd = connection.CreateCommand();
        cmd.CommandText = includeInactive
            ? "SELECT * FROM users ORDER BY name;"
            : "SELECT * FROM users WHERE is_active = 1 ORDER BY name;";

        using var reader = await cmd.ExecuteReaderAsync();
        var result = new List<User>();
        while (await reader.ReadAsync())
            result.Add(Map(reader));
        return result;
    }

    public async Task<User?> GetByIdAsync(string id)
    {
        using var connection = _factory.CreateConnection();
        using var cmd = connection.CreateCommand();
        cmd.CommandText = "SELECT * FROM users WHERE id = $id;";
        cmd.Parameters.AddWithValue("$id", id);
        using var reader = await cmd.ExecuteReaderAsync();
        return await reader.ReadAsync() ? Map(reader) : null;
    }

    public async Task<User?> GetByEmailAsync(string email)
    {
        using var connection = _factory.CreateConnection();
        using var cmd = connection.CreateCommand();
        cmd.CommandText = "SELECT * FROM users WHERE email = $email;";
        cmd.Parameters.AddWithValue("$email", email);
        using var reader = await cmd.ExecuteReaderAsync();
        return await reader.ReadAsync() ? Map(reader) : null;
    }

    public async Task<User?> GetByPinAsync(string pin)
    {
        using var connection = _factory.CreateConnection();
        using var cmd = connection.CreateCommand();
        cmd.CommandText = "SELECT * FROM users WHERE pin_hash = $pin AND is_active = 1 LIMIT 1;";
        cmd.Parameters.AddWithValue("$pin", pin);
        using var reader = await cmd.ExecuteReaderAsync();
        return await reader.ReadAsync() ? Map(reader) : null;
    }

    public async Task AddAsync(User user)
    {
        using var connection = _factory.CreateConnection();
        using var cmd = connection.CreateCommand();
        cmd.CommandText = @"
            INSERT INTO users (id, shop_id, name, email, pin_hash, password_hash, role, is_active, created_at)
            VALUES ($id, $shopId, $name, $email, $pin, $pwd, $role, $active, $created);";
        cmd.Parameters.AddWithValue("$id", user.Id);
        cmd.Parameters.AddWithValue("$shopId", (object?)user.ShopId ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$name", user.Name);
        cmd.Parameters.AddWithValue("$email", (object?)user.Email ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$pin", user.PinHash);
        cmd.Parameters.AddWithValue("$pwd", (object?)user.PasswordHash ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$role", user.Role);
        cmd.Parameters.AddWithValue("$active", user.IsActive ? 1 : 0);
        cmd.Parameters.AddWithValue("$created", user.CreatedAt.ToString("o"));
        await cmd.ExecuteNonQueryAsync();
    }

    public async Task UpdateAsync(User user)
    {
        using var connection = _factory.CreateConnection();
        using var cmd = connection.CreateCommand();
        cmd.CommandText = @"
            UPDATE users SET
                shop_id = $shopId,
                name = $name,
                email = $email,
                pin_hash = $pin,
                password_hash = $pwd,
                role = $role,
                is_active = $active,
                last_login = $lastLogin
            WHERE id = $id;";
        cmd.Parameters.AddWithValue("$id", user.Id);
        cmd.Parameters.AddWithValue("$shopId", (object?)user.ShopId ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$name", user.Name);
        cmd.Parameters.AddWithValue("$email", (object?)user.Email ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$pin", user.PinHash);
        cmd.Parameters.AddWithValue("$pwd", (object?)user.PasswordHash ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$role", user.Role);
        cmd.Parameters.AddWithValue("$active", user.IsActive ? 1 : 0);
        cmd.Parameters.AddWithValue("$lastLogin", user.LastLogin.HasValue ? user.LastLogin.Value.ToString("o") : (object)DBNull.Value);
        await cmd.ExecuteNonQueryAsync();
    }

    public async Task DeleteAsync(string id)
    {
        using var connection = _factory.CreateConnection();
        using var cmd = connection.CreateCommand();
        cmd.CommandText = "UPDATE users SET is_active = 0 WHERE id = $id;";
        cmd.Parameters.AddWithValue("$id", id);
        await cmd.ExecuteNonQueryAsync();
    }

    private static User Map(SqliteDataReader r) => new()
    {
        Id = r.GetString(r.GetOrdinal("id")),
        ShopId = r.IsDBNull(r.GetOrdinal("shop_id")) ? null : r.GetString(r.GetOrdinal("shop_id")),
        Name = r.GetString(r.GetOrdinal("name")),
        Email = r.IsDBNull(r.GetOrdinal("email")) ? null : r.GetString(r.GetOrdinal("email")),
        PinHash = r.GetString(r.GetOrdinal("pin_hash")),
        PasswordHash = r.IsDBNull(r.GetOrdinal("password_hash")) ? null : r.GetString(r.GetOrdinal("password_hash")),
        Role = r.GetString(r.GetOrdinal("role")),
        IsActive = r.GetInt32(r.GetOrdinal("is_active")) == 1,
        LastLogin = r.IsDBNull(r.GetOrdinal("last_login")) ? null : DateTime.Parse(r.GetString(r.GetOrdinal("last_login"))),
        CreatedAt = DateTime.Parse(r.GetString(r.GetOrdinal("created_at")))
    };
}
