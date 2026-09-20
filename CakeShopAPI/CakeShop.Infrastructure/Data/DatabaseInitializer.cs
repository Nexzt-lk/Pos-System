using Microsoft.Data.Sqlite;

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

        SeedDefaultShopIfEmpty(connection);
        SeedDefaultUsersIfEmpty(connection);
        SeedDefaultCategoriesIfEmpty(connection);
    }

    private static void SeedDefaultShopIfEmpty(SqliteConnection connection)
    {
        using var checkCmd = connection.CreateCommand();
        checkCmd.CommandText = "SELECT COUNT(*) FROM shops;";
        var count = Convert.ToInt32(checkCmd.ExecuteScalar());
        if (count > 0) return;

        using var insertCmd = connection.CreateCommand();
        insertCmd.CommandText = @"
            INSERT INTO shops (id, name, branch_code, address, phone, currency)
            VALUES ('b0000000-0000-0000-0000-000000000001', 'Rasa Cake House - Kandy Branch', 'B1', 'No. 45, Peradeniya Road, Kandy', '+94 81 223 4567', 'LKR');";
        insertCmd.ExecuteNonQuery();
    }

    private static void SeedDefaultUsersIfEmpty(SqliteConnection connection)
    {
        using var checkCmd = connection.CreateCommand();
        checkCmd.CommandText = "SELECT COUNT(*) FROM users;";
        var count = Convert.ToInt32(checkCmd.ExecuteScalar());
        if (count > 0) return;

        var defaultUsers = new (string Id, string Name, string Email, string Role, string Pin, string Password)[]
        {
            ("u0000000-0000-0000-0000-000000000001", "Janaka Ariyarathna (Owner)", "owner@wasanabakes.lk", "owner", "843522", "JanakaW@2024!"),
            ("u0000000-0000-0000-0000-000000000002", "Sunil Jayasinghe (Manager)", "manager@wasanabakes.lk", "manager", "843522", "manager123"),
            ("u0000000-0000-0000-0000-000000000003", "Cashier 01", "cashier1@wasanabakes.lk", "cashier", "843522", "WB_Cash1#2024"),
            ("u0000000-0000-0000-0000-000000000004", "Cashier 02", "cashier2@wasanabakes.lk", "cashier", "843522", "WB_Cash2#2024")
        };

        foreach (var u in defaultUsers)
        {
            using var insertCmd = connection.CreateCommand();
            insertCmd.CommandText = @"
                INSERT INTO users (id, shop_id, name, email, pin_hash, password_hash, role, is_active)
                VALUES ($id, 'b0000000-0000-0000-0000-000000000001', $name, $email, $pin, $pass, $role, 1);";
            insertCmd.Parameters.AddWithValue("$id", u.Id);
            insertCmd.Parameters.AddWithValue("$name", u.Name);
            insertCmd.Parameters.AddWithValue("$email", u.Email);
            insertCmd.Parameters.AddWithValue("$pin", u.Pin);
            insertCmd.Parameters.AddWithValue("$pass", u.Password);
            insertCmd.Parameters.AddWithValue("$role", u.Role);
            insertCmd.ExecuteNonQuery();
        }
    }

    private static void SeedDefaultCategoriesIfEmpty(SqliteConnection connection)
    {
        var categories = new (string Name, string Prefix, string Color, string Icon, int SortOrder)[]
        {
            ("Cakes & Gateaux", "CAK", "#ec4899", "cake", 1),
            ("Sweet Items & Desserts", "SWT", "#a855f7", "cookie", 2),
            ("Biscuits & Cookies", "BIS", "#f59e0b", "cookie", 3),
            ("Birthday Deco & Party Items", "BDY", "#3b82f6", "party-popper", 4),
            ("Ice Cream & Frozen Treats", "ICE", "#06b6d4", "ice-cream", 5),
            ("Pastries & Savories", "PAS", "#e11d48", "croissant", 6),
            ("Breads & Buns", "BRD", "#d97706", "package", 7),
            ("Beverages & Coffee", "BEV", "#10b981", "coffee", 8)
        };

        foreach (var (name, prefix, color, icon, sort) in categories)
        {
            using var checkCmd = connection.CreateCommand();
            checkCmd.CommandText = "SELECT COUNT(*) FROM categories WHERE code_prefix = $prefix OR name = $name;";
            checkCmd.Parameters.AddWithValue("$prefix", prefix);
            checkCmd.Parameters.AddWithValue("$name", name);
            var exists = Convert.ToInt32(checkCmd.ExecuteScalar()) > 0;

            if (!exists)
            {
                using var insertCmd = connection.CreateCommand();
                insertCmd.CommandText = @"
                    INSERT INTO categories (id, name, code_prefix, color, icon, sort_order)
                    VALUES ($id, $name, $prefix, $color, $icon, $sort);";
                insertCmd.Parameters.AddWithValue("$id", Guid.NewGuid().ToString());
                insertCmd.Parameters.AddWithValue("$name", name);
                insertCmd.Parameters.AddWithValue("$prefix", prefix);
                insertCmd.Parameters.AddWithValue("$color", color);
                insertCmd.Parameters.AddWithValue("$icon", icon);
                insertCmd.Parameters.AddWithValue("$sort", sort);
                insertCmd.ExecuteNonQuery();
            }
        }
    }
}