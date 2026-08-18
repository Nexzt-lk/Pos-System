
using CakeShop.Application.Interfaces;
using CakeShop.Domain.Entities;
using CakeShop.Infrastructure.Data;
using Microsoft.Data.Sqlite;

namespace CakeShop.Infrastructure.Repositories;

public class CategoryRepository : ICategoryRepository
{
    private readonly SqliteConnectionFactory _factory;
    public CategoryRepository(SqliteConnectionFactory factory) => _factory = factory;

    public async Task<List<Category>> GetAllAsync()
    {
        using var connection = _factory.CreateConnection();
        using var cmd = connection.CreateCommand();
        cmd.CommandText = "SELECT * FROM categories WHERE is_active = 1 ORDER BY sort_order, name;";
        using var reader = await cmd.ExecuteReaderAsync();

        var result = new List<Category>();
        while (await reader.ReadAsync())
            result.Add(Map(reader));
        return result;
    }

    public async Task<Category?> GetByIdAsync(string id)
    {
        using var connection = _factory.CreateConnection();
        using var cmd = connection.CreateCommand();
        cmd.CommandText = "SELECT * FROM categories WHERE id = $id;";
        cmd.Parameters.AddWithValue("$id", id);
        using var reader = await cmd.ExecuteReaderAsync();
        return await reader.ReadAsync() ? Map(reader) : null;
    }

    public async Task<Category?> GetByPrefixAsync(string prefix)
    {
        using var connection = _factory.CreateConnection();
        using var cmd = connection.CreateCommand();
        cmd.CommandText = "SELECT * FROM categories WHERE code_prefix = $prefix;";
        cmd.Parameters.AddWithValue("$prefix", prefix);
        using var reader = await cmd.ExecuteReaderAsync();
        return await reader.ReadAsync() ? Map(reader) : null;
    }

    public async Task AddAsync(Category category)
    {
        using var connection = _factory.CreateConnection();
        using var cmd = connection.CreateCommand();
        cmd.CommandText = @"
            INSERT INTO categories (id, name, code_prefix, color, icon, sort_order, is_active, created_at)
            VALUES ($id, $name, $prefix, $color, $icon, $sort, 1, $created);";
        cmd.Parameters.AddWithValue("$id", category.Id);
        cmd.Parameters.AddWithValue("$name", category.Name);
        cmd.Parameters.AddWithValue("$prefix", category.CodePrefix);
        cmd.Parameters.AddWithValue("$color", category.Color);
        cmd.Parameters.AddWithValue("$icon", category.Icon);
        cmd.Parameters.AddWithValue("$sort", category.SortOrder);
        cmd.Parameters.AddWithValue("$created", category.CreatedAt.ToString("o"));
        await cmd.ExecuteNonQueryAsync();
    }

    public async Task UpdateAsync(Category category)
    {
        using var connection = _factory.CreateConnection();
        using var cmd = connection.CreateCommand();
        cmd.CommandText = @"
            UPDATE categories SET name = $name, color = $color, icon = $icon,
                sort_order = $sort WHERE id = $id;";
        cmd.Parameters.AddWithValue("$id", category.Id);
        cmd.Parameters.AddWithValue("$name", category.Name);
        cmd.Parameters.AddWithValue("$color", category.Color);
        cmd.Parameters.AddWithValue("$icon", category.Icon);
        cmd.Parameters.AddWithValue("$sort", category.SortOrder);
        await cmd.ExecuteNonQueryAsync();
    }

    public async Task DeleteAsync(string id)
    {
        using var connection = _factory.CreateConnection();
        using var cmd = connection.CreateCommand();
        cmd.CommandText = "UPDATE categories SET is_active = 0 WHERE id = $id;";
        cmd.Parameters.AddWithValue("$id", id);
        await cmd.ExecuteNonQueryAsync();
    }

    private static Category Map(SqliteDataReader r) => new()
    {
        Id = r.GetString(r.GetOrdinal("id")),
        Name = r.GetString(r.GetOrdinal("name")),
        CodePrefix = r.GetString(r.GetOrdinal("code_prefix")),
        Color = r.GetString(r.GetOrdinal("color")),
        Icon = r.GetString(r.GetOrdinal("icon")),
        SortOrder = r.GetInt32(r.GetOrdinal("sort_order")),
        IsActive = r.GetInt32(r.GetOrdinal("is_active")) == 1,
        CreatedAt = DateTime.Parse(r.GetString(r.GetOrdinal("created_at")))
    };
}