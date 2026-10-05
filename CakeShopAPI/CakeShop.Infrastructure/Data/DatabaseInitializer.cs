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

        EnsureColumnsExist(connection);
        SeedDefaultShopIfEmpty(connection);
        SeedBranch2IfMissing(connection);
        SeedDefaultUsersIfEmpty(connection);
        SeedDefaultCategoriesIfEmpty(connection);
    }

    private static void EnsureColumnsExist(SqliteConnection connection)
    {
        var migrations = new[]
        {
            "ALTER TABLE products ADD COLUMN shop_id TEXT DEFAULT 'b0000000-0000-0000-0000-000000000001';",
            "ALTER TABLE orders ADD COLUMN shop_id TEXT DEFAULT 'b0000000-0000-0000-0000-000000000001';",
            "ALTER TABLE expenses ADD COLUMN shop_id TEXT DEFAULT 'b0000000-0000-0000-0000-000000000001';",
            "ALTER TABLE inventory ADD COLUMN shop_id TEXT DEFAULT 'b0000000-0000-0000-0000-000000000001';",
            "ALTER TABLE stock_movements ADD COLUMN shop_id TEXT DEFAULT 'b0000000-0000-0000-0000-000000000001';",
            "UPDATE products SET shop_id = 'b0000000-0000-0000-0000-000000000001' WHERE shop_id IS NULL OR shop_id = '';",
            "UPDATE orders SET shop_id = 'b0000000-0000-0000-0000-000000000001' WHERE shop_id IS NULL OR shop_id = '';",
            "UPDATE expenses SET shop_id = 'b0000000-0000-0000-0000-000000000001' WHERE shop_id IS NULL OR shop_id = '';"
        };
        foreach (var sql in migrations)
        {
            try
            {
                using var cmd = connection.CreateCommand();
                cmd.CommandText = sql;
                cmd.ExecuteNonQuery();
            }
            catch { /* already exists */ }
        }

        try
        {
            using var checkCmd = connection.CreateCommand();
            checkCmd.CommandText = "SELECT sql FROM sqlite_master WHERE type='table' AND name='products';";
            var currentSql = checkCmd.ExecuteScalar()?.ToString() ?? "";

            if (currentSql.Contains("UNIQUE(barcode)") || currentSql.Contains("UNIQUE (barcode)") ||
                currentSql.Contains("UNIQUE(item_code)") || currentSql.Contains("UNIQUE (item_code)"))
            {
                using var rebuildCmd = connection.CreateCommand();
                rebuildCmd.CommandText = @"
                    CREATE TABLE products_new (
                        id              TEXT PRIMARY KEY,
                        category_id     TEXT REFERENCES categories(id) ON DELETE SET NULL,
                        item_code       TEXT NOT NULL,
                        name            TEXT NOT NULL,
                        description     TEXT,
                        price           REAL NOT NULL,
                        cost_price      REAL,
                        barcode         TEXT,
                        image_path      TEXT,
                        unit            TEXT DEFAULT 'pcs',
                        track_inventory INTEGER DEFAULT 1,
                        is_active       INTEGER DEFAULT 1,
                        shop_id         TEXT DEFAULT 'b0000000-0000-0000-0000-000000000001',
                        created_at      TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
                        updated_at      TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
                        local_id        TEXT,
                        sync_status     TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending','synced','conflict'))
                    );

                    INSERT INTO products_new (
                        id, category_id, item_code, name, description, price, cost_price,
                        barcode, image_path, unit, track_inventory, is_active, shop_id,
                        created_at, updated_at, local_id, sync_status
                    )
                    SELECT 
                        id, category_id, item_code, name, description, price, cost_price,
                        barcode, image_path, unit, track_inventory, is_active,
                        COALESCE(shop_id, 'b0000000-0000-0000-0000-000000000001'),
                        created_at, updated_at,
                        NULL,
                        sync_status
                    FROM products;

                    DROP TABLE products;
                    ALTER TABLE products_new RENAME TO products;
                ";
                rebuildCmd.ExecuteNonQuery();
            }

            using var idxCmd = connection.CreateCommand();
            idxCmd.CommandText = @"
                CREATE UNIQUE INDEX IF NOT EXISTS idx_products_shop_barcode 
                ON products(shop_id, barcode) 
                WHERE barcode IS NOT NULL AND barcode != '';

                CREATE UNIQUE INDEX IF NOT EXISTS idx_products_shop_item_code 
                ON products(shop_id, item_code) 
                WHERE item_code IS NOT NULL AND item_code != '';

                CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
                CREATE INDEX IF NOT EXISTS idx_products_shop ON products(shop_id);
            ";
            idxCmd.ExecuteNonQuery();
        }
        catch { }
    }

    private static void SeedBranch2IfMissing(SqliteConnection connection)
    {
        try
        {
            using var cmd = connection.CreateCommand();
            cmd.CommandText = @"
                INSERT OR IGNORE INTO shops (id, name, branch_code, address, phone, email, currency, receipt_footer)
                VALUES (
                  'b0000000-0000-0000-0000-000000000002',
                  'Wasana Cake - Poojapitiya',
                  'B2',
                  'Wasana Cake, Poojapitiya Road, Poojapitiya',
                  '071-1172201',
                  'poojapitiya@wasanacake.com',
                  'LKR',
                  'Thank you for visiting Wasana Cake - Poojapitiya! 🎂'
                );
                UPDATE shops
                SET name = 'Wasana Cake - Poojapitiya',
                    branch_code = 'B2',
                    address = 'Wasana Cake, Poojapitiya Road, Poojapitiya',
                    phone = '071-1172201',
                    email = 'poojapitiya@wasanacake.com',
                    receipt_footer = 'Thank you for visiting Wasana Cake - Poojapitiya! 🎂'
                WHERE id = 'b0000000-0000-0000-0000-000000000002';

                INSERT OR IGNORE INTO users (id, shop_id, name, email, pin_hash, password_hash, role, is_active)
                VALUES (
                  'u0000000-0000-0000-0000-000000000005',
                  'b0000000-0000-0000-0000-000000000002',
                  'Wasana Cake - Poojapitiya',
                  'branch2@wasanacake.com',
                  '886655',
                  '886655',
                  'cashier',
                  1
                );
                UPDATE users
                SET shop_id = 'b0000000-0000-0000-0000-000000000002',
                    name = 'Wasana Cake - Poojapitiya',
                    email = 'branch2@wasanacake.com',
                    pin_hash = '886655',
                    password_hash = '886655',
                    role = 'cashier',
                    is_active = 1
                WHERE id = 'u0000000-0000-0000-0000-000000000005';
            ";
            cmd.ExecuteNonQuery();
        }
        catch { }
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