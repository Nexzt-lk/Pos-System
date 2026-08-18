
namespace CakeShop.Domain.Entities;

public class Category
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Name { get; set; } = string.Empty;      // "Birthday Items"
    public string CodePrefix { get; set; } = string.Empty; // "BDY" — used for item_code generation
    public string Color { get; set; } = "#6366f1";
    public string Icon { get; set; } = "cake";
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}