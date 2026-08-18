
using CakeShop.Application.Interfaces;
using CakeShop.Domain.Entities;
using CakeShop.Infrastructure.Data;
using Microsoft.Data.Sqlite;

namespace CakeShop.Infrastructure.Repositories;

public class ExpenseRepository : IExpenseRepository
{
    private readonly SqliteConnectionFactory _factory;
    public ExpenseRepository(SqliteConnectionFactory factory) => _factory = factory;

    public async Task AddAsync(Expense expense)
    {
        using var connection = _factory.CreateConnection();
        using var cmd = connection.CreateCommand();
        cmd.CommandText = @"
            INSERT INTO expenses
                (id, category, description, amount, expense_date, linked_product_id,
                 linked_stock_movement_id, added_by, created_at, local_id, sync_status)
            VALUES
                ($id, $cat, $desc, $amount, $date, $prodId,
                 $stockMoveId, $by, $created, $localId, 'pending');";
        cmd.Parameters.AddWithValue("$id", expense.Id);
        cmd.Parameters.AddWithValue("$cat", (object?)expense.Category ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$desc", expense.Description);
        cmd.Parameters.AddWithValue("$amount", expense.Amount);
        cmd.Parameters.AddWithValue("$date", expense.ExpenseDate.ToString("yyyy-MM-dd"));
        cmd.Parameters.AddWithValue("$prodId", (object?)expense.LinkedProductId ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$stockMoveId", (object?)expense.LinkedStockMovementId ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$by", (object?)expense.AddedBy ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$created", expense.CreatedAt.ToString("o"));
        cmd.Parameters.AddWithValue("$localId", expense.LocalId);
        await cmd.ExecuteNonQueryAsync();
    }

    public async Task<List<Expense>> GetAllAsync()
    {
        using var connection = _factory.CreateConnection();
        using var cmd = connection.CreateCommand();
        cmd.CommandText = "SELECT * FROM expenses ORDER BY expense_date DESC;";
        using var reader = await cmd.ExecuteReaderAsync();

        var result = new List<Expense>();
        while (await reader.ReadAsync())
            result.Add(Map(reader));
        return result;
    }

    public async Task<List<Expense>> GetByDateRangeAsync(DateOnly from, DateOnly to)
    {
        using var connection = _factory.CreateConnection();
        using var cmd = connection.CreateCommand();
        cmd.CommandText = "SELECT * FROM expenses WHERE expense_date BETWEEN $from AND $to ORDER BY expense_date;";
        cmd.Parameters.AddWithValue("$from", from.ToString("yyyy-MM-dd"));
        cmd.Parameters.AddWithValue("$to", to.ToString("yyyy-MM-dd"));
        using var reader = await cmd.ExecuteReaderAsync();

        var result = new List<Expense>();
        while (await reader.ReadAsync())
            result.Add(Map(reader));
        return result;
    }

    public async Task UpdateAsync(Expense expense)
    {
        using var connection = _factory.CreateConnection();
        using var cmd = connection.CreateCommand();
        cmd.CommandText = @"
            UPDATE expenses SET category = $cat, description = $desc, amount = $amount,
                expense_date = $date, sync_status = 'pending' WHERE id = $id;";
        cmd.Parameters.AddWithValue("$id", expense.Id);
        cmd.Parameters.AddWithValue("$cat", (object?)expense.Category ?? DBNull.Value);
        cmd.Parameters.AddWithValue("$desc", expense.Description);
        cmd.Parameters.AddWithValue("$amount", expense.Amount);
        cmd.Parameters.AddWithValue("$date", expense.ExpenseDate.ToString("yyyy-MM-dd"));
        await cmd.ExecuteNonQueryAsync();
    }

    public async Task DeleteAsync(string id)
    {
        using var connection = _factory.CreateConnection();
        using var cmd = connection.CreateCommand();
        cmd.CommandText = "DELETE FROM expenses WHERE id = $id;";
        cmd.Parameters.AddWithValue("$id", id);
        await cmd.ExecuteNonQueryAsync();
    }

    private static Expense Map(SqliteDataReader r) => new()
    {
        Id = r.GetString(r.GetOrdinal("id")),
        Category = r.IsDBNull(r.GetOrdinal("category")) ? null : r.GetString(r.GetOrdinal("category")),
        Description = r.GetString(r.GetOrdinal("description")),
        Amount = Convert.ToDecimal(r.GetDouble(r.GetOrdinal("amount"))),
        ExpenseDate = DateOnly.Parse(r.GetString(r.GetOrdinal("expense_date"))),
        LinkedProductId = r.IsDBNull(r.GetOrdinal("linked_product_id")) ? null : r.GetString(r.GetOrdinal("linked_product_id")),
        CreatedAt = DateTime.Parse(r.GetString(r.GetOrdinal("created_at")))
    };
}