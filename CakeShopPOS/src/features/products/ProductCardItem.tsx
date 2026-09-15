import React, { useState } from 'react'
import {
  Cake,
  Edit3,
  Trash2,
  Barcode,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  XCircle
} from 'lucide-react'
import { Popconfirm } from 'antd'
import { Product } from '../../types/product'
import { formatCurrency, formatStockQty } from '../../lib/formatters'
import { getProductImageSrc } from '../../lib/imageHelper'

interface ProductCardItemProps {
  product: Product
  onEdit: (product: Product) => void
  onDelete: (product: Product) => void
}

export const ProductCardItem: React.FC<ProductCardItemProps> = ({
  product,
  onEdit,
  onDelete
}) => {
  const [hasImgError, setHasImgError] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  const isTracked = Boolean(product.track_inventory)
  const stockNum = product.current_stock ?? 0
  const isOut = isTracked && stockNum <= 0
  const isLow = isTracked && stockNum <= 5 && stockNum > 0
  const catColor = product.category_color || '#16a34a'

  // Margin calculation
  const hasCost = Boolean(product.cost_price && product.cost_price > 0)
  const costPrice = product.cost_price || 0
  const profit = product.price - costPrice
  const marginPct = hasCost && product.price > 0 ? ((profit / product.price) * 100).toFixed(1) : null

  const imgSrc = getProductImageSrc(product.image_path, product.name, product.category_name) || undefined

  return (
    <div
      style={{
        background: '#ffffff',
        borderRadius: 16,
        border: isHovered ? '1.5px solid #94a3b8' : '1px solid #e2e8f0',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: isHovered
          ? '0 12px 28px -6px rgba(15, 23, 42, 0.1), 0 4px 8px -2px rgba(15, 23, 42, 0.04)'
          : '0 1px 3px rgba(0, 0, 0, 0.03)',
        transform: isHovered ? 'translateY(-3px)' : 'translateY(0)',
        transition: 'all 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
        cursor: 'pointer',
        position: 'relative'
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onEdit(product)}
    >
      {/* ── Image & Top Badges ── */}
      <div
        style={{
          width: '100%',
          height: 155,
          position: 'relative',
          background: `linear-gradient(135deg, ${catColor}12 0%, #f8fafc 100%)`,
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderBottom: '1px solid #f1f5f9'
        }}
      >
        {imgSrc && !hasImgError ? (
          <img
            src={imgSrc}
            alt={product.name}
            loading="lazy"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: isHovered ? 'scale(1.06)' : 'scale(1)',
              transition: 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
            onError={() => setHasImgError(true)}
          />
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              color: catColor,
              opacity: 0.85
            }}
          >
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 14,
                background: `${catColor}20`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Cake size={28} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>
              {product.category_name || 'Bakery Item'}
            </span>
          </div>
        )}

        {/* Category Pill (Top-Left) */}
        <div
          style={{
            position: 'absolute',
            top: 10,
            left: 10,
            background: 'rgba(255, 255, 255, 0.94)',
            backdropFilter: 'blur(8px)',
            borderRadius: 99,
            padding: '3px 10px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            boxShadow: '0 2px 6px rgba(0, 0, 0, 0.08)',
            border: '1px solid rgba(226, 232, 240, 0.8)',
            zIndex: 2
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: catColor,
              flexShrink: 0
            }}
          />
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: '#1e293b',
              maxWidth: 120,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
          >
            {product.category_name || 'General'}
          </span>
        </div>

        {/* Stock Badge (Top-Right) */}
        <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 2 }}>
          {isTracked ? (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '3px 9px',
                borderRadius: 99,
                fontSize: 11,
                fontWeight: 700,
                background: isOut
                  ? 'rgba(254, 242, 242, 0.95)'
                  : isLow
                  ? 'rgba(254, 243, 199, 0.95)'
                  : 'rgba(240, 253, 244, 0.95)',
                color: isOut ? '#991b1b' : isLow ? '#92400e' : '#166534',
                border: `1px solid ${isOut ? '#fca5a5' : isLow ? '#fde68a' : '#86efac'}`,
                backdropFilter: 'blur(6px)',
                boxShadow: '0 2px 6px rgba(0,0,0,0.06)'
              }}
            >
              {isOut ? (
                <>
                  <XCircle size={12} style={{ color: '#ef4444' }} />
                  <span>Out of Stock</span>
                </>
              ) : isLow ? (
                <>
                  <AlertTriangle size={12} style={{ color: '#f59e0b' }} />
                  <span>Low: {formatStockQty(product.current_stock, product.unit)}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={12} style={{ color: '#16a34a' }} />
                  <span>{formatStockQty(product.current_stock, product.unit)}</span>
                </>
              )}
            </span>
          ) : (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '3px 9px',
                borderRadius: 99,
                fontSize: 10.5,
                fontWeight: 600,
                background: 'rgba(241, 245, 249, 0.92)',
                color: '#475569',
                border: '1px solid #cbd5e1',
                backdropFilter: 'blur(6px)',
                boxShadow: '0 2px 6px rgba(0,0,0,0.04)'
              }}
            >
              Service Item
            </span>
          )}
        </div>
      </div>

      {/* ── Card Content ── */}
      <div
        style={{
          padding: '14px 16px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          flex: 1
        }}
      >
        {/* Barcode & Unit Sub-header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
          {product.barcode ? (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                background: '#f1f5f9',
                border: '1px solid #e2e8f0',
                borderRadius: 6,
                padding: '2px 7px',
                fontSize: 11,
                fontWeight: 700,
                color: '#334155',
                fontFamily: 'monospace'
              }}
            >
              <Barcode size={13} style={{ color: '#64748b' }} />
              <span>{product.barcode}</span>
            </div>
          ) : (
            <span style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>
              No Barcode
            </span>
          )}

          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: '#475569',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              padding: '2px 8px',
              borderRadius: 6
            }}
          >
            Unit: <strong>{product.unit || 'pcs'}</strong>
          </span>
        </div>

        {/* Product Name */}
        <div
          title={product.name}
          style={{
            fontSize: 14.5,
            fontWeight: 700,
            color: '#0f172a',
            lineHeight: 1.35,
            minHeight: 38,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden'
          }}
        >
          {product.name}
        </div>

        {/* Description snippet if present */}
        {product.description && (
          <div
            style={{
              fontSize: 11.5,
              color: '#64748b',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              marginTop: -3
            }}
            title={product.description}
          >
            {product.description}
          </div>
        )}

        {/* Financial & Price Card */}
        <div
          style={{
            marginTop: 'auto',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 12,
            padding: '10px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 6
          }}
        >
          {/* Selling Price */}
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              Selling Price
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
              <span style={{ fontSize: 16, fontWeight: 900, color: 'var(--primary-dark)', letterSpacing: '-0.02em' }}>
                {formatCurrency(product.price)}
              </span>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: '#94a3b8' }}>
                /{product.unit || 'pcs'}
              </span>
            </div>
          </div>

          {/* Cost Price & Margin Line */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: 5,
              borderTop: '1px dashed #e2e8f0',
              fontSize: 11
            }}
          >
            <div style={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontWeight: 600 }}>Cost:</span>
              <span style={{ fontWeight: 700, color: '#334155' }}>
                {hasCost ? formatCurrency(costPrice) : '—'}
              </span>
            </div>

            {marginPct !== null ? (
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  color: profit >= 0 ? '#15803d' : '#b91c1c',
                  background: profit >= 0 ? '#dcfce7' : '#fee2e2',
                  padding: '1px 6px',
                  borderRadius: 6,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3
                }}
              >
                <TrendingUp size={10} />
                <span>{profit >= 0 ? `+${marginPct}%` : `${marginPct}%`}</span>
              </span>
            ) : (
              <span style={{ fontSize: 10, color: '#94a3b8', fontStyle: 'italic' }}>
                No cost set
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Actions Bar ── */}
      <div
        style={{
          padding: '10px 14px',
          borderTop: '1px solid #f1f5f9',
          background: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}
        onClick={(e) => e.stopPropagation()} // Prevent card click when clicking actions
      >
        <button
          type="button"
          onClick={() => onEdit(product)}
          style={{
            flex: 1,
            height: 34,
            borderRadius: 8,
            border: '1.5px solid #e2e8f0',
            background: '#ffffff',
            color: '#334155',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            transition: 'all 0.15s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--primary)'
            e.currentTarget.style.color = 'var(--primary)'
            e.currentTarget.style.background = 'var(--primary-bg)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#e2e8f0'
            e.currentTarget.style.color = '#334155'
            e.currentTarget.style.background = '#ffffff'
          }}
        >
          <Edit3 size={13} />
          <span>Edit Product</span>
        </button>

        <Popconfirm
          title="Remove Product"
          description={`Are you sure you want to remove "${product.name}" from the active catalog?`}
          onConfirm={() => onDelete(product)}
          okText="Yes, Remove"
          cancelText="Cancel"
          okButtonProps={{ danger: true, style: { fontWeight: 700 } }}
        >
          <button
            type="button"
            title="Delete Product"
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              border: '1.5px solid #fee2e2',
              background: '#fff5f5',
              color: '#ef4444',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#fee2e2'
              e.currentTarget.style.borderColor = '#fca5a5'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#fff5f5'
              e.currentTarget.style.borderColor = '#fee2e2'
            }}
          >
            <Trash2 size={14} />
          </button>
        </Popconfirm>
      </div>
    </div>
  )
}
