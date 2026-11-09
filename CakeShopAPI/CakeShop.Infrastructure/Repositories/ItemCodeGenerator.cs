
using CakeShop.Application.Interfaces;
using CakeShop.Infrastructure.Data;

namespace CakeShop.Infrastructure.Repositories;

// Generates codes like "BDY-001", "BDY-002", "YOG-001" — sequential per category,
// based on how many products already exist under that category's prefix.
public class ItemCodeGenerator : IItemCodeGenerator
{
    private readonly SqliteConnectionFactory _factory;

    public ItemCodeGenerator(SqliteConnectionFactory factory)
    {
        _factory = factory;
    }

    public async Task<string> GenerateAsync(string categoryId)
    {
        using var connection = _factory.CreateConnection();

        using var prefixCmd = connection.CreateCommand();
        prefixCmd.CommandText = "SELECT code_prefix FROM categories WHERE id = $id;";
        prefixCmd.Parameters.AddWithValue("$id", categoryId);
        var prefixResult = await prefixCmd.ExecuteScalarAsync();

        if (prefixResult == null)
            throw new InvalidOperationException("Category not found — cannot generate item code.");

        var prefix = prefixResult.ToString()!;

        // Count existing products under this prefix (including inactive ones,
        // so deleted items don't free up their number for reuse).
        using var countCmd = connection.CreateCommand();
        countCmd.CommandText = "SELECT COUNT(*) FROM products WHERE item_code LIKE $pattern;";
        countCmd.Parameters.AddWithValue("$pattern", $"{prefix}-%");
        var count = Convert.ToInt32(await countCmd.ExecuteScalarAsync());

        var nextNumber = count + 1;
        return $"{prefix}-{nextNumber:D3}"; // BDY-001, BDY-002, ... BDY-999, BDY-1000
    }
}