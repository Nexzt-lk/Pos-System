import React from 'react'
import { X, Keyboard, Sparkles } from 'lucide-react'

interface KeyboardShortcutsModalProps {
  isOpen: boolean
  onClose: () => void
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null

  const shortcutSections = [
    {
      title: 'POS Billing & Actions',
      shortcuts: [
        { key: 'F4 / Alt+P / Ctrl+Enter', desc: 'Pay & Print Bill (Checkout)' },
        { key: 'F3 / Ctrl+D / Alt+D', desc: 'Open Order Discount Dialog' },
        { key: 'F2 / / / Ctrl+K', desc: 'Search Products & Catalog' },
        { key: 'F9 / Ctrl+Del / Alt+X', desc: 'Clear Active Cart' },
        { key: 'F1 / Ctrl+H / ?', desc: 'Show this Keyboard Shortcuts Guide' }
      ]
    },
    {
      title: 'Product Catalog & Navigation',
      shortcuts: [
        { key: '↑ / ↓ / ← / →', desc: 'Navigate products in grid' },
        { key: 'Enter', desc: 'Select focused product (open weight/qty dialog)' },
        { key: 'Alt + 1', desc: 'Filter: All Items' },
        { key: 'Alt + 2..9', desc: 'Filter: Select Category by number' },
        { key: 'Esc', desc: 'Clear search / Cancel' }
      ]
    },
    {
      title: 'Weight & Quantity Dialog (Cakes / Items)',
      shortcuts: [
        { key: '0-9, .', desc: 'Directly type weight (e.g. 1.25) or count' },
        { key: '↑ / +', desc: 'Increase weight (+250g) or count (+1)' },
        { key: '↓ / -', desc: 'Decrease weight (-250g) or count (-1)' },
        { key: 'K / G', desc: 'Toggle Kilograms (kg) vs Grams (g)' },
        { key: 'Enter', desc: 'Confirm & Add to Ticket' },
        { key: 'Esc', desc: 'Cancel and Close dialog' }
      ]
    },
    {
      title: 'Payment & Checkout Dialog',
      shortcuts: [
        { key: '0-9', desc: 'Type Cash Tendered directly' },
        { key: 'F1 / Alt+1', desc: 'Select Cash payment' },
        { key: 'F2 / Alt+2', desc: 'Select Card payment' },
        { key: 'F3 / Alt+3', desc: 'Select Bank Transfer' },
        { key: 'F5..F8 / Alt+5..8', desc: 'Select Quick Cash Presets' },
        { key: 'F10 / Enter / Alt+S', desc: 'Complete Sale & Print Receipt' },
        { key: 'Esc', desc: 'Close Payment Dialog' }
      ]
    }
  ]

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1200 }}>
      <div
        className="modal-box"
        style={{
          maxWidth: 620,
          borderRadius: 24,
          boxShadow: '0 25px 60px rgba(0,0,0,0.25)',
          border: '1.5px solid #e2e8f0',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="modal-header"
          style={{
            padding: '18px 24px',
            background: 'linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)',
            borderBottom: '1.5px solid #e2e8f0'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: '#fdf2f8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#db2777'
              }}
            >
              <Keyboard size={22} />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 900, color: '#0f172a' }}>
                POS Keyboard Shortcuts
              </div>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>
                High-speed cashier keyboard navigation guide
              </div>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div
          className="modal-body"
          style={{
            padding: '20px 24px',
            maxHeight: '65vh',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 18
          }}
        >
          {shortcutSections.map((sec, idx) => (
            <div key={idx}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  color: '#be185d',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  marginBottom: 8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <Sparkles size={13} />
                <span>{sec.title}</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 14,
                  padding: '10px 14px'
                }}
              >
                {sec.shortcuts.map((sc, sIdx) => (
                  <div
                    key={sIdx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '5px 0',
                      borderBottom: sIdx === sec.shortcuts.length - 1 ? 'none' : '1px solid #f1f5f9'
                    }}
                  >
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: '#334155' }}>
                      {sc.desc}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        fontFamily: 'monospace',
                        color: '#0f172a',
                        background: '#ffffff',
                        border: '1.5px solid #cbd5e1',
                        boxShadow: '0 2px 0 #cbd5e1',
                        borderRadius: 6,
                        padding: '3px 8px',
                        letterSpacing: '0.02em'
                      }}
                    >
                      {sc.key}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div
          className="modal-footer"
          style={{
            padding: '14px 24px',
            borderTop: '1.5px solid #f1f5f9',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#ffffff'
          }}
        >
          <span style={{ fontSize: 11.5, color: '#94a3b8', fontWeight: 600 }}>
            Press <kbd style={{ padding: '2px 6px', background: '#f1f5f9', borderRadius: 4, border: '1px solid #e2e8f0', fontWeight: 800 }}>Esc</kbd> anytime to close
          </span>
          <button
            type="button"
            onClick={onClose}
            className="pay-btn"
            style={{
              padding: '10px 20px',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 800
            }}
          >
            Got it (Esc)
          </button>
        </div>
      </div>
    </div>
  )
}
