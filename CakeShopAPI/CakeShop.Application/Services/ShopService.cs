using CakeShop.Application.DTOs;
using CakeShop.Application.Interfaces;
using CakeShop.Domain.Entities;

namespace CakeShop.Application.Services;

public class ShopService
{
    private readonly IShopRepository _shops;

    public ShopService(IShopRepository shops)
    {
        _shops = shops;
    }

    public async Task<ShopDto> GetCurrentShopAsync()
    {
        var shop = await _shops.GetCurrentShopAsync();
        if (shop == null)
        {
            return new ShopDto
            {
                Id = "b0000000-0000-0000-0000-000000000001",
                Name = "Rasa Cake House — Main Branch",
                BranchCode = "B1",
                Address = "No. 45, Peradeniya Road, Kandy",
                Phone = "+94 81 223 4567",
                Email = "kandy@rasacakes.lk",
                Currency = "LKR",
                ReceiptFooter = "Thank you for visiting Rasa Cake House! 🎂"
            };
        }

        return new ShopDto
        {
            Id = shop.Id,
            Name = shop.Name,
            BranchCode = shop.BranchCode,
            Address = shop.Address,
            Phone = shop.Phone,
            Email = shop.Email,
            Currency = shop.Currency,
            ReceiptFooter = shop.ReceiptFooter
        };
    }

    public async Task<ShopDto> UpdateCurrentShopAsync(UpdateShopRequest req)
    {
        var existing = await _shops.GetCurrentShopAsync();
        var shop = new Shop
        {
            Id = existing?.Id ?? Guid.NewGuid().ToString(),
            Name = req.Name,
            BranchCode = req.BranchCode,
            Address = req.Address,
            Phone = req.Phone,
            Email = req.Email,
            Currency = req.Currency,
            ReceiptFooter = req.ReceiptFooter,
            UpdatedAt = DateTime.UtcNow
        };

        await _shops.UpsertAsync(shop);
        return new ShopDto
        {
            Id = shop.Id,
            Name = shop.Name,
            BranchCode = shop.BranchCode,
            Address = shop.Address,
            Phone = shop.Phone,
            Email = shop.Email,
            Currency = shop.Currency,
            ReceiptFooter = shop.ReceiptFooter
        };
    }
}
