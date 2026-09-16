import React from 'react'
import { Search, ArrowUpDown } from 'lucide-react'
import { Segmented, Select } from 'antd'
import { Category } from '../../types/product'

interface InventoryFiltersProps {
  searchQuery: string
  setSearchQuery: (val: string) => void
  stockFilter: 'all' | 'in_stock' | 'low_stock' | 'out_of_stock'
  setStockFilter: (val: 'all' | 'in_stock' | 'low_stock' | 'out_of_stock') => void
  sortBy: 'name_asc' | 'name_desc' | 'stock_asc' | 'stock_desc' | 'price_desc' | 'price_asc'
  setSortBy: (val: 'name_asc' | 'name_desc' | 'stock_asc' | 'stock_desc' | 'price_desc' | 'price_asc') => void
  selectedCategory: string
  setSelectedCategory: (val: string) => void
  searchPlaceholder?: string
  categories: Category[]
  categoryCounts: Record<string, number>
  trackedCount: number
  inStockCount: number
  lowStockCount: number
  outOfStockCount: number
}

export const InventoryFilters: React.FC<InventoryFiltersProps> = ({
  searchQuery,
  setSearchQuery,
  stockFilter,
  setStockFilter,
  sortBy,
  setSortBy,
  selectedCategory,
  setSelectedCategory,
  categories,
  categoryCounts,
  trackedCount,
  inStockCount,
  lowStockCount,
  outOfStockCount,
  searchPlaceholder = "Search by product name, code, barcode..."
}) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
        background: '#ffffff',
        padding: '12px 16px',
        borderRadius: 14,
        border: '1px solid var(--border)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
        flexShrink: 0
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        {/* Search Box */}
        <div
          className="search-box"
          style={{
            width: 340,
            background: '#f8fafc',
            border: '1.5px solid #e2e8f0',
            borderRadius: 10,
            padding: '7px 12px'
          }}
        >
          <Search size={16} style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={searchPlaceholder}
            style={{ fontSize: 13 }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                fontSize: 11,
                fontWeight: 700,
                padding: '2px 4px'
              }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Stock Filter Pills & Sort Select */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Stock Segmented */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginRight: 4 }}>
              Status:
            </span>
            <Segmented
              value={stockFilter}
              onChange={(val) => setStockFilter(val as any)}
              options={[
                { label: 'All', value: 'all' },
                { label: `Healthy (${inStockCount})`, value: 'in_stock' },
                { label: `Low (${lowStockCount})`, value: 'low_stock' },
                { label: `Out (${outOfStockCount})`, value: 'out_of_stock' }
              ]}
              style={{ background: '#f1f5f9', fontWeight: 600, fontSize: 12 }}
            />
          </div>

          {/* Sort Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <ArrowUpDown size={14} style={{ color: 'var(--text-muted)' }} />
            <div
              style={{
                background: '#f1f5f9',
                borderRadius: 8,
                border: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <Select
                value={sortBy}
                onChange={(val) => setSortBy(val)}
                style={{ width: 175 }}
                bordered={false}
                options={[
                  { value: 'stock_asc', label: 'Stock (Lowest First)' },
                  { value: 'stock_desc', label: 'Stock (Highest First)' },
                  { value: 'name_asc', label: 'Name (A to Z)' },
                  { value: 'name_desc', label: 'Name (Z to A)' },
                  { value: 'price_asc', label: 'Price (Lowest First)' },
                  { value: 'price_desc', label: 'Price (Highest First)' }
                ]}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Category Pills */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflowX: 'auto', paddingTop: 4, paddingBottom: 12 }}>
        <button
          onClick={() => setSelectedCategory('all')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 14px',
            borderRadius: 99,
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            border: selectedCategory === 'all' ? '1.5px solid var(--primary)' : '1px solid var(--border)',
            background: selectedCategory === 'all' ? 'var(--primary)' : '#ffffff',
            color: selectedCategory === 'all' ? '#ffffff' : 'var(--text-secondary)',
            transition: 'all 0.15s ease',
            boxShadow: selectedCategory === 'all' ? '0 2px 6px rgba(22, 163, 74, 0.25)' : 'none'
          }}
        >
          <span>All Categories</span>
          <span
            style={{
              fontSize: 10,
              padding: '1px 6px',
              borderRadius: 99,
              background: selectedCategory === 'all' ? 'rgba(255,255,255,0.25)' : 'var(--surface-2)',
              color: selectedCategory === 'all' ? '#ffffff' : 'var(--text-muted)'
            }}
          >
            {trackedCount}
          </span>
        </button>

        {categories.map((cat) => {
          const isSelected = selectedCategory === cat.id
          const count = categoryCounts[cat.id] || 0
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                borderRadius: 99,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                border: isSelected ? '1.5px solid var(--primary)' : '1px solid var(--border)',
                background: isSelected ? 'var(--primary)' : '#ffffff',
                color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                transition: 'all 0.15s ease',
                boxShadow: isSelected ? '0 2px 6px rgba(22, 163, 74, 0.25)' : 'none'
              }}
            >
              <span>{cat.name}</span>
              <span
                style={{
                  fontSize: 10,
                  padding: '1px 6px',
                  borderRadius: 99,
                  background: isSelected ? 'rgba(255,255,255,0.25)' : 'var(--surface-2)',
                  color: isSelected ? '#ffffff' : 'var(--text-muted)'
                }}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
