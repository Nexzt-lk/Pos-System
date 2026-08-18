
namespace CakeShop.Infrastructure.Data;

// Runs the local_schema_sqlite.sql script against the local database on startup.
// Safe to run every time the app starts — every statement uses "IF NOT EXISTS".
public class DatabaseInitializer
{
    private readonly SqliteConnectionFactory _factory;
    private readonly string _schemaFilePath;

    public DatabaseInitializer(SqliteConnectionFactory factory, string schemaFilePath)
    {
        _factory = factory;
        _schemaFilePath = schemaFilePath;
    }

    public void Initialize()
    {
        var schemaSql = File.ReadAllText(_schemaFilePath);

        using var connection = _factory.CreateConnection();
        using var command = connection.CreateCommand();
        command.CommandText = schemaSql;
        command.ExecuteNonQuery();

        SeedDefaultCategoriesIfEmpty(connection);
    }

    // Seeds the three categories mentioned in requirements so the app isn't
    // empty on first run. Safe to remove/edit — shop can add more via the API.
    private static void SeedDefaultCategoriesIfEmpty(Microsoft.Data.Sqlite.SqliteConnection connection)
    {
        using var checkCmd = connection.CreateCommand();
        checkCmd.CommandText = "SELECT COUNT(*) FROM categories;";
        var count = Convert.ToInt32(checkCmd.ExecuteScalar());
        if (count > 0) return;

        var defaults = new (string Name, string Prefix)[]
        {
            ("Birthday Items", "BDY"),
            ("Yogurt", "YOG"),
            ("Sweet Items", "SWT")
        };

        foreach (var (name, prefix) in defaults)
        {
            using var insertCmd = connection.CreateCommand();
            insertCmd.CommandText = @"
                INSERT INTO categories (id, name, code_prefix)
                VALUES ($id, $name, $prefix);";
            insertCmd.Parameters.AddWithValue("$id", Guid.NewGuid().ToString());
            insertCmd.Parameters.AddWithValue("$name", name);
            insertCmd.Parameters.AddWithValue("$prefix", prefix);
            insertCmd.ExecuteNonQuery();
        }
    }
}