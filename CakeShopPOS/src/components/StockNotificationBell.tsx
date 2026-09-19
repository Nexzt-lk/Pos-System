import React from 'react'
import { Badge, Popover } from 'antd'
import { Bell, ArrowRight, CheckCircle2, Layers } from 'lucide-react'
import { useStockAlertStore, StockAlertItem } from '../store/stockAlertStore'
import { formatStockQty } from '../lib/formatters'

interface StockNotificationBellProps {
  onNavigateToInventory: () => void
}

export const StockNotificationBell: React.FC<StockNotificationBellProps> = ({ onNavigateToInventory }) => {
  const alertItems = useStockAlertStore((s) => s.alertItems)
  const isPopoverOpen = useStockAlertStore((s) => s.isPopoverOpen)
  const setIsPopoverOpen = useStockAlertStore((s) => s.setIsPopoverOpen)
  const openAlertModal = useStockAlertStore((s) => s.openAlertModal)

  const count = alertItems.length
  const hasAlerts = count > 0

  const popoverContent = (
    <div style={{ width: 330, margin: '-4px' }}>
      {/* ── Popover Header ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: 10,
          borderBottom: '1px solid #f1f5f9',
          marginBottom: 10
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontWeight: 800, fontSize: 13.5, color: '#0f172a' }}>Stock Alerts</span>
          {hasAlerts && (
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                color: '#ffffff',
                background: '#ea580c',
                padding: '1px 6px',
                borderRadius: 99
              }}
            >
              {count}
            </span>
          )}
        </div>

        {hasAlerts && (
          <button
            type="button"
            onClick={openAlertModal}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--primary)',
              fontSize: 11.5,
              fontWeight: 700,
              cursor: 'pointer',
              padding: 0
            }}
          >
            Expand Alert
          </button>
        )}
      </div>

      {/* ── Items List ── */}
      {hasAlerts ? (
        <div style={{ maxHeight: 250, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {alertItems.slice(0, 10).map((item: StockAlertItem) => (
            <div
              key={item.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 10px',
                borderRadius: 8,
                background: item.isOutOfStock ? '#fef2f2' : '#fffbeb',
                border: `1px solid ${item.isOutOfStock ? '#fecaca' : '#fde68a'}`
              }}
            >
              <div style={{ minWidth: 0, flex: 1, paddingRight: 8 }}>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 12.5,
                    color: item.isOutOfStock ? '#991b1b' : '#92400e',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                >
                  {item.name}
                </div>
                <div style={{ fontSize: 10, color: '#94a3b8' }}>
                  {item.barcode ? `Code: ${item.barcode}` : item.categoryName || 'General'}
                </div>
              </div>

              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div
                  style={{
                    fontWeight: 800,
                    fontSize: 12,
                    color: item.isOutOfStock ? '#dc2626' : '#d97706',
                    fontFamily: 'monospace'
                  }}
                >
                  {formatStockQty(item.currentStock, item.unit)}
                </div>
                <span
                  style={{
                    fontSize: 9.5,
                    fontWeight: 700,
                    color: item.isOutOfStock ? '#dc2626' : '#b45309'
                  }}
                >
                  {item.isOutOfStock ? 'Out of Stock' : 'Low Stock'}
                </span>
              </div>
            </div>
          ))}

          {count > 10 && (
            <div style={{ textAlign: 'center', fontSize: 11, color: '#64748b', padding: '4px 0' }}>
              + {count - 10} more items
            </div>
          )}
        </div>
      ) : (
        <div style={{ padding: '24px 12px', textAlign: 'center' }}>
          <CheckCircle2 size={32} color="#16a34a" style={{ margin: '0 auto 8px', opacity: 0.8 }} />
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>All Stock Healthy</div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
            No items are running low on stock at this moment.
          </div>
        </div>
      )}

      {/* ── Popover Footer ── */}
      <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid #f1f5f9' }}>
        <button
          type="button"
          onClick={() => {
            setIsPopoverOpen(false)
            onNavigateToInventory()
          }}
          style={{
            width: '100%',
            padding: '8px 12px',
            borderRadius: 7,
            border: 'none',
            background: hasAlerts ? '#16a34a' : '#f1f5f9',
            color: hasAlerts ? '#ffffff' : '#334155',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            transition: 'background 0.15s ease'
          }}
        >
          <Layers size={13} />
          <span>Manage Stock in Inventory</span>
          <ArrowRight size={13} />
        </button>
      </div>
    </div>
  )

  return (
    <Popover
      content={popoverContent}
      trigger="click"
      open={isPopoverOpen}
      onOpenChange={setIsPopoverOpen}
      placement="bottomRight"
    >
      <button
        type="button"
        title={hasAlerts ? `${count} stock items need attention` : 'Stock Notifications'}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 38,
          height: 38,
          borderRadius: 10,
          border: hasAlerts ? '1.5px solid #fed7aa' : '1px solid var(--border)',
          background: hasAlerts ? '#fff7ed' : '#ffffff',
          color: hasAlerts ? '#ea580c' : '#64748b',
          cursor: 'pointer',
          position: 'relative',
          transition: 'all 0.15s ease',
          boxShadow: hasAlerts ? '0 2px 8px rgba(234, 88, 12, 0.15)' : '0 1px 2px rgba(0,0,0,0.03)'
        }}
      >
        <Badge
          count={count}
          overflowCount={99}
          size="small"
          offset={[4, -4]}
          style={{
            backgroundColor: '#ea580c',
            color: '#ffffff',
            boxShadow: '0 0 0 2px #fff',
            fontWeight: 700,
            fontSize: 10
          }}
        >
          <Bell size={18} />
        </Badge>
      </button>
    </Popover>
  )
}
