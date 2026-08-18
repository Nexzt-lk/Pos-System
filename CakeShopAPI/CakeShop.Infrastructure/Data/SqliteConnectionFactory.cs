
using Microsoft.Data.Sqlite;

namespace CakeShop.Infrastructure.Data;

public class SqliteConnectionFactory
{
    private readonly string _connectionString;

    public SqliteConnectionFactory(string dbPath)
    {
        _connectionString = $"Data Source={dbPath}";
    }

    public SqliteConnection CreateConnection()
    {
        var connection = new SqliteConnection(_connectionString);
        connection.Open();
        // Enforce FK constraints on every connection — SQLite has them off by default.
        using var pragma = connection.CreateCommand();
        pragma.CommandText = "PRAGMA foreign_keys = ON;";
        pragma.ExecuteNonQuery();
        return connection;
    }
}