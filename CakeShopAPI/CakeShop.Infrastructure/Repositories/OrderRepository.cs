
using CakeShop.Application.Interfaces;
using CakeShop.Domain.Entities;
using CakeShop.Infrastructure.Data;
using Microsoft.Data.Sqlite;

namespace CakeShop.Infrastructure.Repositories;

public class OrderRepository : IOrderRepository
{
    private readonly SqliteConnectionFactory _factory;
    public OrderRepository(SqliteConnectionFactory factory) => _factory = factory;

    // Format: {TERMINAL}-{YYYYMMDD}-{SEQ:0000}, sequence resets daily per terminal.
    public async Task<string> GetNextOrderNumberAsync(string terminalId)
    {
        var datePart = DateTime.UtcNow.ToString("yyyyMMdd");
        var prefix = $"{terminalId}-{datePart}-";

        using var connection = _factory.CreateConnection();
        using var cmd = connection.CreateCommand();
        cmd.CommandText = "SELECT COUNT(*) FROM orders WHERE order_no LIKE $pattern;";
        cmd.Parameters.AddWithValue("$pattern", $"{prefix}%");
        var count = Convert.ToInt32(await cmd.ExecuteScalarAsync());

        return $"{prefix}{(count + 1):D4}";
    }

    // Saves the order, its line items, and its payment(s) in a single transaction —
    // if anything fails, nothing is partially written.
    public async Task AddAsync(Order order)
    {
        using var connection = _factory.CreateConnection();
        using var transaction = connection.BeginTransaction();

        try
        {
            using (var cmd = connection.CreateCommand())
            {
                cmd.Transaction = transaction;
                cmd.CommandText = @"
                    INSERT INTO orders
                        (id, order_no, cashier_id, subtotal, discount_type, discount_amount,
                         tax_amount, total_amount, status, note, created_at, local_id, sync_status)
                    VALUES
                        ($id, $orderNo, $cashierId, $subtotal, $discType, $discAmt,
                         $tax, $total, $status, $note, $created, $localId, 'pending');";
                cmd.Parameters.AddWithValue("$id", order.Id);
                cmd.Parameters.AddWithValue("$orderNo", order.OrderNo);
                cmd.Parameters.AddWithValue("$cashierId", (object?)order.CashierId ?? DBNull.Value);
                cmd.Parameters.AddWithValue("$subtotal", order.Subtotal);
                cmd.Parameters.AddWithValue("$discType", (object?)order.DiscountType ?? DBNull.Value);
                cmd.Parameters.AddWithValue("$discAmt", order.DiscountAmount);
                cmd.Parameters.AddWithValue("$tax", order.TaxAmount);
                cmd.Parameters.AddWithValue("$total", order.TotalAmount);
                cmd.Parameters.AddWithValue("$status", order.Status);
                cmd.Parameters.AddWithValue("$note", (object?)order.Note ?? DBNull.Value);
                cmd.Parameters.AddWithValue("$created", order.CreatedAt.ToString("o"));
                cmd.Parameters.AddWithValue("$localId", order.LocalId);
                await cmd.ExecuteNonQueryAsync();
            }

            foreach (var item in order.Items)
            {
                using var cmd = connection.CreateCommand();
                cmd.Transaction = transaction;
                cmd.CommandText = @"
                    INSERT INTO order_items
                        (id, order_id, product_id, product_name, item_code, unit_price,
                         cost_price, quantity, discount, subtotal)
                    VALUES
                        ($id, $orderId, $pid, $pname, $code, $price, $cost, $qty, $disc, $subtotal);";
                cmd.Parameters.AddWithValue("$id", item.Id);
                cmd.Parameters.AddWithValue("$orderId", order.Id);
                cmd.Parameters.AddWithValue("$pid", item.ProductId);
                cmd.Parameters.AddWithValue("$pname", item.ProductName);
                cmd.Parameters.AddWithValue("$code", (object?)item.ItemCode ?? DBNull.Value);
                cmd.Parameters.AddWithValue("$price", item.UnitPrice);
                cmd.Parameters.AddWithValue("$cost", (object?)item.CostPrice ?? DBNull.Value);
                cmd.Parameters.AddWithValue("$qty", item.Quantity);
                cmd.Parameters.AddWithValue("$disc", item.Discount);
                cmd.Parameters.AddWithValue("$subtotal", item.Subtotal);
                await cmd.ExecuteNonQueryAsync();
            }

            foreach (var payment in order.Payments)
            {
                using var cmd = connection.CreateCommand();
                cmd.Transaction = transaction;
                cmd.CommandText = @"
                    INSERT INTO payments
                        (id, order_id, method, amount, cash_given, change_given, reference_no, created_at)
                    VALUES
                        ($id, $orderId, $method, $amount, $cashGiven, $change, $ref, $created);";
                cmd.Parameters.AddWithValue("$id", payment.Id);
                cmd.Parameters.AddWithValue("$orderId", order.Id);
                cmd.Parameters.AddWithValue("$method", payment.Method);
                cmd.Parameters.AddWithValue("$amount", payment.Amount);
                cmd.Parameters.AddWithValue("$cashGiven", (object?)payment.CashGiven ?? DBNull.Value);
                cmd.Parameters.AddWithValue("$change", (object?)payment.ChangeGiven ?? DBNull.Value);
                cmd.Parameters.AddWithValue("$ref", (object?)payment.ReferenceNo ?? DBNull.Value);
                cmd.Parameters.AddWithValue("$created", payment.CreatedAt.ToString("o"));
                await cmd.ExecuteNonQueryAsync();
            }

            transaction.Commit();
        }
        catch
        {
            transaction.Rollback();
            throw;
        }
    }

    public async Task<Order?> GetByIdAsync(string id)
    {
        using var connection = _factory.CreateConnection();

        Order? order = null;
        using (var cmd = connection.CreateCommand())
        {
            cmd.CommandText = "SELECT * FROM orders WHERE id = $id;";
            cmd.Parameters.AddWithValue("$id", id);
            using var reader = await cmd.ExecuteReaderAsync();
            if (await reader.ReadAsync())
                order = MapOrder(reader);
        }
        if (order == null) return null;

        await AttachItemsAndPayments(connection, order);
        return order;
    }

    public async Task<Order?> GetByLocalIdAsync(string localId)
    {
        using var connection = _factory.CreateConnection();

        Order? order = null;
        using (var cmd = connection.CreateCommand())
        {
            cmd.CommandText = "SELECT * FROM orders WHERE local_id = $localId;";
            cmd.Parameters.AddWithValue("$localId", localId);
            using var reader = await cmd.ExecuteReaderAsync();
            if (await reader.ReadAsync())
                order = MapOrder(reader);
        }
        if (order == null) return null;

        await AttachItemsAndPayments(connection, order);
        return order;
    }

    public async Task<List<Order>> GetByDateRangeAsync(DateTime fromUtc, DateTime toUtc)
    {
        using var connection = _factory.CreateConnection();
        var orders = new List<Order>();

        using (var cmd = connection.CreateCommand())
        {
            cmd.CommandText = "SELECT * FROM orders WHERE created_at BETWEEN $from AND $to ORDER BY created_at DESC;";
            cmd.Parameters.AddWithValue("$from", fromUtc.ToString("o"));
            cmd.Parameters.AddWithValue("$to", toUtc.ToString("o"));
            using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
                orders.Add(MapOrder(reader));
        }

        foreach (var order in orders)
            await AttachItemsAndPayments(connection, order);

        return orders;
    }

    public async Task<List<Order>> GetAllAsync(int limit = 100)
    {
        using var connection = _factory.CreateConnection();
        var orders = new List<Order>();

        using (var cmd = connection.CreateCommand())
        {
            cmd.CommandText = "SELECT * FROM orders ORDER BY created_at DESC LIMIT $limit;";
            cmd.Parameters.AddWithValue("$limit", limit);
            using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
                orders.Add(MapOrder(reader));
        }

        foreach (var order in orders)
            await AttachItemsAndPayments(connection, order);

        return orders;
    }

    private static async Task AttachItemsAndPayments(SqliteConnection connection, Order order)
    {
        using (var cmd = connection.CreateCommand())
        {
            cmd.CommandText = "SELECT * FROM order_items WHERE order_id = $orderId;";
            cmd.Parameters.AddWithValue("$orderId", order.Id);
            using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                order.Items.Add(new OrderItem
                {
                    Id = reader.GetString(reader.GetOrdinal("id")),
                    OrderId = order.Id,
                    ProductId = reader.GetString(reader.GetOrdinal("product_id")),
                    ProductName = reader.GetString(reader.GetOrdinal("product_name")),
                    ItemCode = reader.IsDBNull(reader.GetOrdinal("item_code")) ? null : reader.GetString(reader.GetOrdinal("item_code")),
                    UnitPrice = Convert.ToDecimal(reader.GetDouble(reader.GetOrdinal("unit_price"))),
                    CostPrice = reader.IsDBNull(reader.GetOrdinal("cost_price")) ? null : Convert.ToDecimal(reader.GetDouble(reader.GetOrdinal("cost_price"))),
                    Quantity = Convert.ToDecimal(reader.GetDouble(reader.GetOrdinal("quantity"))),
                    Discount = Convert.ToDecimal(reader.GetDouble(reader.GetOrdinal("discount"))),
                    Subtotal = Convert.ToDecimal(reader.GetDouble(reader.GetOrdinal("subtotal")))
                });
            }
        }

        using (var cmd = connection.CreateCommand())
        {
            cmd.CommandText = "SELECT * FROM payments WHERE order_id = $orderId;";
            cmd.Parameters.AddWithValue("$orderId", order.Id);
            using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                order.Payments.Add(new Payment
                {
                    Id = reader.GetString(reader.GetOrdinal("id")),
                    OrderId = order.Id,
                    Method = reader.GetString(reader.GetOrdinal("method")),
                    Amount = Convert.ToDecimal(reader.GetDouble(reader.GetOrdinal("amount"))),
                    CashGiven = reader.IsDBNull(reader.GetOrdinal("cash_given")) ? null : Convert.ToDecimal(reader.GetDouble(reader.GetOrdinal("cash_given"))),
                    ChangeGiven = reader.IsDBNull(reader.GetOrdinal("change_given")) ? null : Convert.ToDecimal(reader.GetDouble(reader.GetOrdinal("change_given"))),
                    ReferenceNo = reader.IsDBNull(reader.GetOrdinal("reference_no")) ? null : reader.GetString(reader.GetOrdinal("reference_no"))
                });
            }
        }
    }

    private static Order MapOrder(SqliteDataReader r) => new()
    {
        Id = r.GetString(r.GetOrdinal("id")),
        OrderNo = r.GetString(r.GetOrdinal("order_no")),
        CashierId = r.IsDBNull(r.GetOrdinal("cashier_id")) ? null : r.GetString(r.GetOrdinal("cashier_id")),
        Subtotal = Convert.ToDecimal(r.GetDouble(r.GetOrdinal("subtotal"))),
        DiscountType = r.IsDBNull(r.GetOrdinal("discount_type")) ? null : r.GetString(r.GetOrdinal("discount_type")),
        DiscountAmount = Convert.ToDecimal(r.GetDouble(r.GetOrdinal("discount_amount"))),
        TaxAmount = Convert.ToDecimal(r.GetDouble(r.GetOrdinal("tax_amount"))),
        TotalAmount = Convert.ToDecimal(r.GetDouble(r.GetOrdinal("total_amount"))),
        Status = r.GetString(r.GetOrdinal("status")),
        Note = r.IsDBNull(r.GetOrdinal("note")) ? null : r.GetString(r.GetOrdinal("note")),
        CreatedAt = DateTime.Parse(r.GetString(r.GetOrdinal("created_at"))),
        LocalId = r.IsDBNull(r.GetOrdinal("local_id")) ? string.Empty : r.GetString(r.GetOrdinal("local_id")),
        SyncStatus = r.IsDBNull(r.GetOrdinal("sync_status")) ? "pending" : r.GetString(r.GetOrdinal("sync_status"))
    };
}