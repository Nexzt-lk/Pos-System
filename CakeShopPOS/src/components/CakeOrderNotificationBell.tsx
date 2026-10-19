import React, { useState, useEffect, useCallback } from 'react'
import { Badge, Popover, Tag, Button } from 'antd'
import { Cake, Calendar, Clock, AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react'
import { cakeOrdersApi, CakeOrderDto } from '../api/cakeOrdersApi'
import { useAppStore } from '../store/appStore'
import dayjs from 'dayjs'

interface CakeOrderNotificationBellProps {
  onNavigateToOrders: () => void
}

export const CakeOrderNotificationBell: React.FC<CakeOrderNotificationBellProps> = ({ onNavigateToOrders }) => {
  const currentShop = useAppStore((s) => s.currentShop)
  const [dueTodayOrders, setDueTodayOrders] = useState<CakeOrderDto[]>([])
  const [upcomingOrders, setUpcomingOrders] = useState<CakeOrderDto[]>([])
  const [isOpen, setIsOpen] = useState(false)

  const fetchOrders = useCallback(async () => {
    try {
      const shopId = currentShop?.id || 'b0000000-0000-0000-0000-000000000001'
      const today = dayjs().format('YYYY-MM-DD')

      const allActive = await cakeOrdersApi.getAll({
        shopId,
        startDate: today,
        status: 'all'
      })

      const dueToday = allActive.filter(
        (o) => o.pickupDate === today && o.status !== 'completed' && o.status !== 'cancelled'
      )
      const upcoming = allActive.filter(
        (o) => o.pickupDate > today && o.status !== 'completed' && o.status !== 'cancelled'
      ).slice(0, 5)

      setDueTodayOrders(dueToday)
      setUpcomingOrders(upcoming)
    } catch (e) {
      console.warn('[CakeOrderNotificationBell] fetch error:', e)
    }
  }, [currentShop?.id])

  useEffect(() => {
    fetchOrders()
    const interval = setInterval(fetchOrders, 30000)

    const handleUpdate = () => fetchOrders()
    window.addEventListener('cake-order:changed', handleUpdate)

    return () => {
      clearInterval(interval)
      window.removeEventListener('cake-order:changed', handleUpdate)
    }
  }, [fetchOrders])

  const dueCount = dueTodayOrders.length
  const hasDueToday = dueCount > 0

  const popoverContent = (
    <div style={{ width: 360, margin: '-4px' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: 10,
          borderBottom: '1px solid #e2e8f0',
          marginBottom: 10
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            background: hasDueToday ? '#0f172a' : '#f1f5f9',
            color: hasDueToday ? '#ffffff' : '#0f172a',
            borderRadius: 8,
            padding: 6,
            display: 'flex',
            alignItems: 'center'
          }}>
            <Cake size={16} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 13.5, color: '#0f172a' }}>
              Cake Orders Alert
            </div>
            <div style={{ fontSize: 11, color: '#64748b' }}>
              {hasDueToday
                ? `${dueCount} order${dueCount > 1 ? 's' : ''} to deliver today`
                : 'No pending orders due today'}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setIsOpen(false)
            onNavigateToOrders()
          }}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#16a34a',
            fontSize: 11.5,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            padding: 0
          }}
        >
          View all <ArrowRight size={12} />
        </button>
      </div>

      {/* Due Today Section */}
      {hasDueToday ? (
        <div style={{ maxHeight: 220, overflowY: 'auto', marginBottom: 10 }}>
          <div style={{
            fontSize: 11,
            fontWeight: 800,
            textTransform: 'uppercase',
            color: '#0f172a',
            letterSpacing: '0.04em',
            marginBottom: 6,
            display: 'flex',
            alignItems: 'center',
            gap: 4
          }}>
            <AlertCircle size={12} style={{ color: '#16a34a' }} /> Due Today ({dueCount})
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {dueTodayOrders.map((order) => (
              <div
                key={order.id}
                onClick={() => {
                  setIsOpen(false)
                  onNavigateToOrders()
                }}
                style={{
                  background: '#ffffff',
                  border: '1.5px solid #0f172a',
                  borderRadius: 8,
                  padding: '8px 10px',
                  cursor: 'pointer',
                  transition: 'background 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span style={{ fontWeight: 800, fontSize: 12.5, color: '#0f172a' }}>
                      #{order.orderNo} &bull; {order.customerName}
                    </span>
                    <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 1 }}>
                      {order.cakeName} ({order.weightKg} kg)
                    </div>
                  </div>
                  <Tag
                    style={{
                      margin: 0,
                      fontSize: 10,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      background: order.status === 'ready' ? '#dcfce7' : '#f1f5f9',
                      color: order.status === 'ready' ? '#15803d' : '#334155',
                      border: '1px solid #cbd5e1'
                    }}
                  >
                    {order.status}
                  </Tag>
                </div>

                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: 6,
                  paddingTop: 5,
                  borderTop: '1px dashed #e2e8f0',
                  fontSize: 11
                }}>
                  <span style={{ color: '#0f172a', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3 }}>
                    <Clock size={11} style={{ color: '#64748b' }} />
                    {order.pickupTime ? `Pickup at ${order.pickupTime}` : 'Due Today'}
                  </span>
                  <span style={{ fontWeight: 800, color: order.balanceAmount > 0 ? '#0f172a' : '#16a34a' }}>
                    {order.balanceAmount > 0
                      ? `Bal: Rs. ${order.balanceAmount.toLocaleString()}`
                      : 'Fully Paid'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Upcoming Section */}
      {upcomingOrders.length > 0 && (
        <div style={{ maxHeight: 180, overflowY: 'auto' }}>
          <div style={{
            fontSize: 11,
            fontWeight: 800,
            textTransform: 'uppercase',
            color: '#64748b',
            letterSpacing: '0.04em',
            marginBottom: 6,
            display: 'flex',
            alignItems: 'center',
            gap: 4
          }}>
            <Calendar size={12} /> Upcoming Pickups
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {upcomingOrders.map((order) => (
              <div
                key={order.id}
                onClick={() => {
                  setIsOpen(false)
                  onNavigateToOrders()
                }}
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 7,
                  padding: '7px 9px',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 12, color: '#0f172a' }}>
                    {order.customerName} &bull; {order.cakeName}
                  </div>
                  <div style={{ fontSize: 10.5, color: '#64748b' }}>
                    {order.pickupDate} {order.pickupTime ? `(${order.pickupTime})` : ''}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#0f172a' }}>
                    Rs. {order.totalAmount.toLocaleString()}
                  </div>
                  <div style={{ fontSize: 10, color: order.balanceAmount > 0 ? '#475569' : '#16a34a', fontWeight: 600 }}>
                    {order.balanceAmount > 0 ? `Bal: Rs. ${order.balanceAmount}` : 'Paid'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!hasDueToday && upcomingOrders.length === 0 && (
        <div style={{ textAlign: 'center', padding: '16px 8px', color: '#64748b' }}>
          <CheckCircle2 size={30} color="#16a34a" style={{ margin: '0 auto 8px auto', display: 'block' }} />
          <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a' }}>All Caught Up</div>
          <div style={{ fontSize: 11.5 }}>No pending custom cake orders scheduled.</div>
        </div>
      )}

      {/* Bottom Button */}
      <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid #e2e8f0' }}>
        <Button
          type="primary"
          block
          size="small"
          icon={<Cake size={13} />}
          onClick={() => {
            setIsOpen(false)
            onNavigateToOrders()
          }}
          style={{
            background: '#16a34a',
            borderColor: '#16a34a',
            borderRadius: 8,
            fontWeight: 700
          }}
        >
          Open Cake Orders Manager
        </Button>
      </div>
    </div>
  )

  return (
    <Popover
      content={popoverContent}
      trigger="click"
      open={isOpen}
      onOpenChange={setIsOpen}
      placement="bottomRight"
      overlayInnerStyle={{
        borderRadius: 12,
        padding: 12,
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)'
      }}
    >
      <button
        type="button"
        className="stock-bell-btn"
        title={hasDueToday ? `${dueCount} Cake Orders Due Today` : 'Cake Orders Notifications'}
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 36,
          height: 36,
          borderRadius: '50%',
          border: hasDueToday ? '1.5px solid #16a34a' : '1.5px solid #e2e8f0',
          background: hasDueToday ? '#f0fdf4' : '#ffffff',
          color: hasDueToday ? '#16a34a' : '#64748b',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)'
        }}
      >
        <Badge
          count={dueCount}
          offset={[4, -4]}
          size="small"
          style={{
            backgroundColor: '#16a34a',
            boxShadow: '0 0 0 2px #ffffff',
            fontWeight: 800,
            fontSize: 10
          }}
        >
          <Cake size={17} />
        </Badge>
      </button>
    </Popover>
  )
}
