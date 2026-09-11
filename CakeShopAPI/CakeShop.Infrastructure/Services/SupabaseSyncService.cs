using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using CakeShop.Application.Interfaces;
using CakeShop.Infrastructure.Data;
using Microsoft.Data.Sqlite;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace CakeShop.Infrastructure.Services;

public class SupabaseSyncService : ISyncService
{
    private readonly SqliteConnectionFactory _connectionFactory;
    private readonly IConfiguration _configuration;
    private readonly ILogger<SupabaseSyncService> _logger;
    private readonly HttpClient _httpClient;
    private readonly string _supabaseUrl;
    private readonly string _serviceRoleKey;
    private static readonly JsonSerializerOptions _jsonOptions = new() { PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower };

    private const string DefaultTenantId = "a0000000-0000-0000-0000-000000000001";
    private const string DefaultShopId = "b0000000-0000-0000-0000-000000000001";

    public SupabaseSyncService(
        SqliteConnectionFactory connectionFactory,
        IConfiguration configuration,
        ILogger<SupabaseSyncService> logger)
    {
        _connectionFactory = connectionFactory;
        _configuration = configuration;
        _logger = logger;
        _httpClient = new HttpClient { Timeout = TimeSpan.FromSeconds(15) };

        _supabaseUrl = _configuration["Supabase:Url"]?.TrimEnd('/') ?? "";
        _serviceRoleKey = _configuration["Supabase:ServiceRoleKey"] ?? "";
    }

    private HttpRequestMessage CreateSupabaseRequest(HttpMethod method, string endpoint, HttpContent? content = null)
    {
        var request = new HttpRequestMessage(method, $"{_supabaseUrl}/rest/v1/{endpoint}");
        request.Headers.Add("apikey", _serviceRoleKey);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _serviceRoleKey);
        request.Headers.Add("Prefer", "resolution=merge-duplicates");
        if (content != null)
        {
            request.Content = content;
        }
        return request;
    }

    private static string ToSnakeCase(string str)
    {
        if (string.IsNullOrEmpty(str)) return str;
        var sb = new StringBuilder();
        for (int i = 0; i < str.Length; i++)
        {
            char c = str[i];
            if (char.IsUpper(c))
            {
                if (i > 0 && str[i - 1] != '_')
                {
                    sb.Append('_');
                }
                sb.Append(char.ToLowerInvariant(c));
            }
            else
            {
                sb.Append(c);
            }
        }
        return sb.ToString();
    }

    private static object? NormalizeJsonElement(JsonElement element)
    {
        switch (element.ValueKind)
        {
            case JsonValueKind.Object:
                var dict = new Dictionary<string, object?>();
                foreach (var prop in element.EnumerateObject())
                {
                    dict[ToSnakeCase(prop.Name)] = NormalizeJsonElement(prop.Value);
                }
                return dict;
            case JsonValueKind.Array:
                var list = new List<object?>();
                foreach (var item in element.EnumerateArray())
                {
                    list.Add(NormalizeJsonElement(item));
                }
                return list;
            case JsonValueKind.String:
                return element.GetString();
            case JsonValueKind.Number:
                if (element.TryGetInt64(out var l)) return l;
                if (element.TryGetDouble(out var d)) return d;
                return element.GetRawText();
            case JsonValueKind.True:
                return true;
            case JsonValueKind.False:
                return false;
            case JsonValueKind.Null:
            default:
                return null;
        }
    }

    public async Task<SyncStatusDto> GetSyncStatusAsync()
    {
        var status = new SyncStatusDto
        {
            CloudUrl = _supabaseUrl,
            PendingQueueCount = 0,
            IsCloudConnected = false
        };

        try
        {
            using var conn = _connectionFactory.CreateConnection();
            using var cmd = conn.CreateCommand();
            cmd.CommandText = "SELECT count(*) FROM sync_queue WHERE status = 'pending';";
            var result = cmd.ExecuteScalar();
            status.PendingQueueCount = Convert.ToInt32(result ?? 0);

            if (!string.IsNullOrEmpty(_supabaseUrl) && !string.IsNullOrEmpty(_serviceRoleKey) && !_supabaseUrl.Contains("placeholder"))
            {
                using var pingRequest = CreateSupabaseRequest(HttpMethod.Get, "shops?select=id&limit=1");
                using var response = await _httpClient.SendAsync(pingRequest);
                status.IsCloudConnected = response.IsSuccessStatusCode;
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed checking Supabase sync status");
            status.IsCloudConnected = false;
        }

        return status;
    }

    public async Task<SyncBatchResult> PushBatchAsync(SyncBatchRequest request)
    {
        var result = new SyncBatchResult { Success = true };

        if (string.IsNullOrEmpty(_supabaseUrl) || string.IsNullOrEmpty(_serviceRoleKey))
        {
            return new SyncBatchResult
            {
                Success = false,
                ErrorMessage = "Supabase configuration missing (Url or ServiceRoleKey)."
            };
        }

        foreach (var item in request.Batch)
        {
            try
            {
                object? normalizedData = item.Data;
                if (item.Data is JsonElement jsonElem)
                {
                    normalizedData = NormalizeJsonElement(jsonElem);
                }

                var json = JsonSerializer.Serialize(normalizedData, _jsonOptions);
                using var content = new StringContent(json, Encoding.UTF8, "application/json");
                using var req = CreateSupabaseRequest(HttpMethod.Post, item.TableName, content);

                using var response = await _httpClient.SendAsync(req);
                if (response.IsSuccessStatusCode)
                {
                    result.SyncedIds.Add(item.Id);
                    result.ProcessedCount++;
                }
                else
                {
                    var errBody = await response.Content.ReadAsStringAsync();
                    _logger.LogWarning("Supabase sync item {Id} table {Table} returned status {StatusCode}: {Error}",
                        item.Id, item.TableName, response.StatusCode, errBody);

                    // If duplicate key or schema resolution error, mark as resolved so queue progresses
                    if (response.StatusCode == System.Net.HttpStatusCode.Conflict || errBody.Contains("duplicate key"))
                    {
                        result.SyncedIds.Add(item.Id);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Exception syncing item {Id} to Supabase", item.Id);
                result.Success = false;
                result.ErrorMessage = ex.Message;
            }
        }

        return result;
    }

    public async Task<int> SyncPendingLocalQueueAsync()
    {
        if (string.IsNullOrEmpty(_supabaseUrl) || string.IsNullOrEmpty(_serviceRoleKey))
        {
            return 0;
        }

        int totalSynced = 0;

        // 1. Process sync_queue table
        try
        {
            var batchItems = new List<SyncBatchItemDto>();

            using (var conn = _connectionFactory.CreateConnection())
            {
                using var cmd = conn.CreateCommand();
                cmd.CommandText = @"
                    SELECT id, table_name, operation, record_id, payload, created_at 
                    FROM sync_queue 
                    WHERE status = 'pending' 
                    ORDER BY id ASC 
                    LIMIT 50;";

                using var reader = cmd.ExecuteReader();
                while (reader.Read())
                {
                    var payloadRaw = reader.GetString(4);
                    object? dataObj = null;
                    try
                    {
                        using var doc = JsonDocument.Parse(payloadRaw);
                        dataObj = NormalizeJsonElement(doc.RootElement);
                    }
                    catch
                    {
                        dataObj = payloadRaw;
                    }

                    batchItems.Add(new SyncBatchItemDto
                    {
                        Id = reader.GetInt64(0),
                        TableName = reader.GetString(1),
                        Operation = reader.GetString(2),
                        RecordId = reader.GetString(3),
                        Data = dataObj,
                        CreatedAt = DateTime.TryParse(reader.GetString(5), out var dt) ? dt : DateTime.UtcNow
                    });
                }
            }

            if (batchItems.Count > 0)
            {
                var pushResult = await PushBatchAsync(new SyncBatchRequest { Batch = batchItems });

                if (pushResult.SyncedIds.Count > 0)
                {
                    using var conn = _connectionFactory.CreateConnection();
                    using var trans = conn.BeginTransaction();
                    using var updateCmd = conn.CreateCommand();
                    updateCmd.Transaction = trans;

                    foreach (var id in pushResult.SyncedIds)
                    {
                        updateCmd.CommandText = $"UPDATE sync_queue SET status = 'synced', synced_at = datetime('now') WHERE id = {id};";
                        updateCmd.ExecuteNonQuery();
                    }

                    trans.Commit();
                    totalSynced += pushResult.SyncedIds.Count;
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error processing sync_queue batch");
        }

        // 2. Direct Sync for any pending products (WHERE sync_status = 'pending')
        try
        {
            var pendingProducts = new List<Dictionary<string, object?>>();
            var productIds = new List<string>();

            using (var conn = _connectionFactory.CreateConnection())
            {
                using var cmd = conn.CreateCommand();
                cmd.CommandText = "SELECT id, category_id, item_code, name, description, price, cost_price, barcode, image_path, unit, track_inventory, is_active FROM products WHERE sync_status = 'pending' LIMIT 50;";
                using var reader = cmd.ExecuteReader();
                while (reader.Read())
                {
                    var pId = reader.GetString(0);
                    productIds.Add(pId);
                    pendingProducts.Add(new Dictionary<string, object?>
                    {
                        ["id"] = pId,
                        ["tenant_id"] = DefaultTenantId,
                        ["shop_id"] = DefaultShopId,
                        ["category_id"] = reader.IsDBNull(1) ? null : reader.GetString(1),
                        ["item_code"] = reader.IsDBNull(2) ? null : reader.GetString(2),
                        ["name"] = reader.GetString(3),
                        ["description"] = reader.IsDBNull(4) ? null : reader.GetString(4),
                        ["price"] = reader.GetDecimal(5),
                        ["cost_price"] = reader.IsDBNull(6) ? null : reader.GetDecimal(6),
                        ["barcode"] = reader.IsDBNull(7) ? null : reader.GetString(7),
                        ["image_path"] = reader.IsDBNull(8) ? null : reader.GetString(8),
                        ["unit"] = reader.GetString(9),
                        ["track_inventory"] = reader.GetInt32(10) == 1,
                        ["is_active"] = reader.GetInt32(11) == 1,
                        ["sync_status"] = "synced"
                    });
                }
            }

            if (pendingProducts.Count > 0)
            {
                var json = JsonSerializer.Serialize(pendingProducts, _jsonOptions);
                using var content = new StringContent(json, Encoding.UTF8, "application/json");
                using var req = CreateSupabaseRequest(HttpMethod.Post, "products", content);
                using var response = await _httpClient.SendAsync(req);

                if (response.IsSuccessStatusCode)
                {
                    using var conn = _connectionFactory.CreateConnection();
                    using var cmd = conn.CreateCommand();
                    foreach (var pId in productIds)
                    {
                        cmd.CommandText = $"UPDATE products SET sync_status = 'synced' WHERE id = '{pId}';";
                        cmd.ExecuteNonQuery();
                    }
                    totalSynced += pendingProducts.Count;
                    _logger.LogInformation("[SupabaseSyncService] Successfully synced {Count} pending products directly to Cloud.", pendingProducts.Count);
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error syncing pending products");
        }

        return totalSynced;
    }
}
