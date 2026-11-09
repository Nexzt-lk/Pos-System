import React from 'react'
import { Modal } from 'antd'
import { AlertTriangle, PackageX, ArrowRight, X, AlertCircle } from 'lucide-react'
import { useStockAlertStore, StockAlertItem } from '../store/stockAlertStore'
import { formatStockQty } from '../lib/formatters'

interface LowStockAlertModalProps {
  onNavigateToInventory?: () => void
}

export const LowStockAlertModal: React.FC<LowStockAlertModalProps> = ({ onNavigateToInventory }) => {
  const isAlertModalOpen = useStockAlertStore((s) => s.isAlertModalOpen)
  const alertItems = useStockAlertStore((s) => s.alertItems)
  const dismissLoginModal = useStockAlertStore((s) => s.dismissLoginModal)

  const outOfStockCount = alertItems.filter((i) => i.isOutOfStock).length
  const lowStockCount = alertItems.filter((i) => i.isLowStock).length

  const handleGoToInventory = () => {
    dismissLoginModal()
    if (onNavigateToInventory) {
      onNavigateToInventory()
    }
  }

  return (
    <Modal
      open={isAlertModalOpen}
      onCancel={dismissLoginModal}
      footer={null}
      closable={false}
      centered
      width={640}
      styles={{
        content: {
          padding: 0,
          borderRadius: 18,
          overflow: 'hidden',
          boxShadow: '0 24px 48px -12px rgba(0, 0, 0, 0.25)',
          border: '1px solid #fed7aa'
        }
      }}
    >
      {/* ── Modal Header Banner ── */}
      <div
        style={{
          background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)',
          padding: '24px 28px 20px',
          borderBottom: '1px solid #fed7aa',
          position: 'relative'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                background: '#ea580c',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 8px 16px -4px rgba(234, 88, 12, 0.35)',
                flexShrink: 0
              }}
            >
              <AlertTriangle size={26} strokeWidth={2.4} />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#9a3412', letterSpacing: '-0.02em' }}>
                  Low Stock & Out of Stock Warning
                </h3>
                <span
                  style={{
                    background: '#ea580c',
                    color: '#ffffff',
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 99
                  }}
                >
                  {alertItems.length} Items
                </span>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#c2410c', fontWeight: 500 }}>
                අඩු තොග අනතුරු ඇඟවීම — සමහර අයිතමවල තොග අවසන් වී හෝ ඉතා අඩු මට්ටමක පවතී.
              </p>
            </div>
          </div>

          <button
            onClick={dismissLoginModal}
            title="Dismiss / Close"
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: '1px solid #fdba74',
              background: '#ffffff',
              color: '#9a3412',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Status Count Badges */}
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          {outOfStockCount > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: '#fef2f2',
                border: '1px solid #fecaca',
                padding: '4px 10px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                color: '#dc2626'
              }}
            >
              <PackageX size={14} />
              <span>{outOfStockCount} Out of Stock</span>
            </div>
          )}

          {lowStockCount > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: '#fffbeb',
                border: '1px solid #fde68a',
                padding: '4px 10px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                color: '#d97706'
              }}
            >
              <AlertCircle size={14} />
              <span>{lowStockCount} Low Stock</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Modal Content: Scrollable Items List ── */}
      <div style={{ padding: '16px 24px', maxHeight: 340, overflowY: 'auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {alertItems.map((item: StockAlertItem) => (
            <div
              key={item.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                background: item.isOutOfStock ? '#fff5f5' : '#fffaf0',
                border: `1px solid ${item.isOutOfStock ? '#fecaca' : '#fed7aa'}`,
                borderRadius: 10,
                transition: 'transform 0.1s ease'
              }}
            >
              <div style={{ minWidth: 0, flex: 1, paddingRight: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      fontWeight: 700,
                      fontSize: 13.5,
                      color: item.isOutOfStock ? '#991b1b' : '#9a3412',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    {item.name}
                  </span>
                  {item.categoryName && (
                    <span
                      style={{
                        fontSize: 10.5,
                        color: '#64748b',
                        background: '#f1f5f9',
                        padding: '1px 6px',
                        borderRadius: 4,
                        fontWeight: 600
                      }}
                    >
                      {item.categoryName}
                    </span>
                  )}
                </div>

                {item.barcode && (
                  <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace', marginTop: 2 }}>
                    Code: {item.barcode}
                  </div>
                )}
              </div>

              {/* Stock and Badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                <div style={{ textAlign: 'right' }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 800,
                      color: item.isOutOfStock ? '#dc2626' : '#d97706',
                      fontFamily: 'monospace'
                    }}
                  >
                    {formatStockQty(item.currentStock, item.unit)}
                  </div>
                  <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>
                    {item.isOutOfStock ? '0 Available' : `Threshold: ${item.threshold}`}
                  </div>
                </div>

                <span
                  style={{
                    padding: '3px 8px',
                    borderRadius: 6,
                    fontSize: 10.5,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    background: item.isOutOfStock ? '#fee2e2' : '#fef3c7',
                    color: item.isOutOfStock ? '#dc2626' : '#b45309',
                    border: `1px solid ${item.isOutOfStock ? '#fca5a5' : '#fde68a'}`
                  }}
                >
                  {item.isOutOfStock ? 'Out' : 'Low'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Modal Footer ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 24px',
          background: '#fafaf9',
          borderTop: '1px solid #e7e5e4'
        }}
      >
        <span style={{ fontSize: 12, color: '#78716c' }}>
          You can review this anytime via the top notification bell.
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            onClick={dismissLoginModal}
            style={{
              padding: '9px 18px',
              borderRadius: 8,
              border: '1.5px solid #d6d3d1',
              background: '#ffffff',
              color: '#44403c',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            Cancel & Go to System
          </button>

          <button
            type="button"
            onClick={handleGoToInventory}
            style={{
              padding: '9px 20px',
              borderRadius: 8,
              border: 'none',
              background: '#16a34a',
              color: '#ffffff',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 4px 12px rgba(22, 163, 74, 0.25)',
              transition: 'all 0.15s ease'
            }}
          >
            <span>Update Stock (Inventory)</span>
            <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </Modal>
  )
}
