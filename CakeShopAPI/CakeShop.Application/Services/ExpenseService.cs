
using CakeShop.Application.DTOs;
using CakeShop.Application.Interfaces;
using CakeShop.Domain.Entities;

namespace CakeShop.Application.Services;

public class ExpenseService
{
    private readonly IExpenseRepository _expenses;

    public ExpenseService(IExpenseRepository expenses)
    {
        _expenses = expenses;
    }

    public async Task<ExpenseDto> CreateAsync(CreateExpenseRequest request)
    {
        var expense = new Expense
        {
            Category = request.Category,
            Description = request.Description,
            Amount = request.Amount,
            ExpenseDate = request.ExpenseDate,
            LinkedProductId = request.LinkedProductId
        };

        await _expenses.AddAsync(expense);

        return new ExpenseDto
        {
            Id = expense.Id,
            Category = expense.Category,
            Description = expense.Description,
            Amount = expense.Amount,
            ExpenseDate = expense.ExpenseDate,
            LinkedProductId = expense.LinkedProductId
        };
    }

    public async Task<List<ExpenseDto>> GetAllAsync()
    {
        var expenses = await _expenses.GetAllAsync();
        return expenses.Select(MapToDto).ToList();
    }

    public async Task<List<ExpenseDto>> GetByDateRangeAsync(DateOnly from, DateOnly to)
    {
        var expenses = await _expenses.GetByDateRangeAsync(from, to);
        return expenses.Select(MapToDto).ToList();
    }

    public async Task<ExpenseDto> UpdateAsync(string id, UpdateExpenseRequest request)
    {
        var all = await _expenses.GetAllAsync();
        var existing = all.FirstOrDefault(e => e.Id == id)
            ?? throw new KeyNotFoundException($"Expense {id} not found");

        existing.Category = request.Category;
        existing.Description = request.Description;
        existing.Amount = request.Amount;
        existing.ExpenseDate = request.ExpenseDate;

        await _expenses.UpdateAsync(existing);
        return MapToDto(existing);
    }

    public async Task DeleteAsync(string id) => await _expenses.DeleteAsync(id);

    private static ExpenseDto MapToDto(Expense e) => new()
    {
        Id = e.Id,
        Category = e.Category,
        Description = e.Description,
        Amount = e.Amount,
        ExpenseDate = e.ExpenseDate,
        LinkedProductId = e.LinkedProductId
    };
}