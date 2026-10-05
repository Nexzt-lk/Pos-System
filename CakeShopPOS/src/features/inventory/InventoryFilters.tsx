import React, { useState, useEffect } from 'react'
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
  const [localSearch, setLocalSearch] = useState(searchQuery)

  useEffect(() => {
    setLocalSearch(searchQuery)
  }, [searchQuery])

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(localSearch)
    }, 300)
    return () => clearTimeout(timer)
  }, [localSearch, setSearchQuery])

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
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder={searchPlaceholder}
            style={{ fontSize: 13 }}
          />
          {localSearch && (
            <button
              onClick={() => setLocalSearch('')}
              title="Clear search"
              style={{
                width: 20,
                height: 20,
                borderRadius: '50%',
                border: 'none',
                background: '#e2e8f0',
                cursor: 'pointer',
                color: '#64748b',
                fontSize: 11,
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#cbd5e1'
                e.currentTarget.style.color = '#1e293b'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#e2e8f0'
                e.currentTarget.style.color = '#64748b'
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
            border: '1px solid',
            borderColor: selectedCategory === 'all' ? '#16a34a' : '#e2e8f0',
            background: selectedCategory === 'all' ? '#16a34a' : '#ffffff',
            color: selectedCategory === 'all' ? '#ffffff' : '#475569',
            transition: 'all 0.15s ease',
            boxShadow: selectedCategory === 'all' ? '0 2px 6px rgba(22, 163, 74, 0.28)' : '0 1px 2px rgba(0,0,0,0.02)'
          }}
          onMouseEnter={(e) => {
            if (selectedCategory !== 'all') {
              e.currentTarget.style.borderColor = '#cbd5e1'
              e.currentTarget.style.background = '#f8fafc'
              e.currentTarget.style.color = '#1e293b'
            }
          }}
          onMouseLeave={(e) => {
            if (selectedCategory !== 'all') {
              e.currentTarget.style.borderColor = '#e2e8f0'
              e.currentTarget.style.background = '#ffffff'
              e.currentTarget.style.color = '#475569'
            }
          }}
        >
          <span>All Categories</span>
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              padding: '1px 7px',
              borderRadius: 99,
              background: selectedCategory === 'all' ? 'rgba(255,255,255,0.25)' : '#f1f5f9',
              color: selectedCategory === 'all' ? '#ffffff' : '#64748b',
              transition: 'all 0.15s ease'
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
                border: '1px solid',
                borderColor: isSelected ? '#16a34a' : '#e2e8f0',
                background: isSelected ? '#16a34a' : '#ffffff',
                color: isSelected ? '#ffffff' : '#475569',
                transition: 'all 0.15s ease',
                boxShadow: isSelected ? '0 2px 6px rgba(22, 163, 74, 0.28)' : '0 1px 2px rgba(0,0,0,0.02)'
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.borderColor = '#cbd5e1'
                  e.currentTarget.style.background = '#f8fafc'
                  e.currentTarget.style.color = '#1e293b'
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.borderColor = '#e2e8f0'
                  e.currentTarget.style.background = '#ffffff'
                  e.currentTarget.style.color = '#475569'
                }
              }}
            >
              <span>{cat.name}</span>
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  padding: '1px 7px',
                  borderRadius: 99,
                  background: isSelected ? 'rgba(255,255,255,0.25)' : '#f1f5f9',
                  color: isSelected ? '#ffffff' : '#64748b',
                  transition: 'all 0.15s ease'
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
