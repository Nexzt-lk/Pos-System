
using CakeShop.Application.Interfaces;
using CakeShop.Domain.Entities;

namespace CakeShop.Application.Services;

public class CategoryService
{
    private readonly ICategoryRepository _categories;

    public CategoryService(ICategoryRepository categories)
    {
        _categories = categories;
    }

    public Task<List<Category>> GetAllAsync() => _categories.GetAllAsync();

    public async Task<Category> CreateAsync(string name, string codePrefix, string color = "#6366f1", string icon = "cake")
    {
        var prefix = codePrefix.Trim().ToUpperInvariant();

        var existing = await _categories.GetByPrefixAsync(prefix);
        if (existing != null)
            throw new InvalidOperationException($"Prefix '{prefix}' is already used by another category.");

        var category = new Category
        {
            Name = name,
            CodePrefix = prefix,
            Color = color,
            Icon = icon
        };

        await _categories.AddAsync(category);
        return category;
    }

    public async Task DeleteAsync(string id) => await _categories.DeleteAsync(id);
}