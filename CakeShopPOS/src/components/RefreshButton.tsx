import React from 'react'
import { RefreshCw } from 'lucide-react'

interface RefreshButtonProps {
  onClick: () => void
  isLoading?: boolean
  label?: string
}

export const RefreshButton: React.FC<RefreshButtonProps> = ({ 
  onClick, 
  isLoading = false,
  label = 'Refresh'
}) => {
  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      title="Refresh Data"
      style={{
        height: 38,
        padding: '0 12px',
        borderRadius: 10,
        border: '1.5px solid var(--border)',
        background: '#ffffff',
        color: 'var(--text-secondary)',
        cursor: isLoading ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 12,
        fontWeight: 600,
        transition: 'all 0.15s ease'
      }}
      onMouseEnter={(e) => {
        if (isLoading) return
        e.currentTarget.style.borderColor = 'var(--primary)'
        e.currentTarget.style.color = 'var(--primary)'
      }}
      onMouseLeave={(e) => {
        if (isLoading) return
        e.currentTarget.style.borderColor = 'var(--border)'
        e.currentTarget.style.color = 'var(--text-secondary)'
      }}
    >
      <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
      <span>{label}</span>
    </button>
  )
}
