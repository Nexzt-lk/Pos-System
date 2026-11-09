namespace CakeShop.Application.Interfaces;

// Generates unique, sequential-per-category item codes, e.g. "BDY-001", "YOG-014".
public interface IItemCodeGenerator
{
    Task<string> GenerateAsync(string categoryId);
}
