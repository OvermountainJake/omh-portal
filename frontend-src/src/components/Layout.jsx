import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  LayoutDashboard, ClipboardList, BookOpen, Calendar, ShieldCheck,
  UtensilsCrossed, TrendingUp, Clock, DollarSign, Users, UserSquare2,
  LogOut, ChevronLeft, ChevronRight, Settings, Menu, X
} from 'lucide-react'

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard, always: true },
  { divider: 'Tools' },
  { path: '/waitlist', label: 'Waiting List', icon: ClipboardList, always: true },
  { path: '/calendar', label: 'Center Calendar', icon: Calendar, always: true },
  { path: '/handbook', label: "Director's Handbook", icon: BookOpen, always: true },
  { path: '/compliance', label: 'Teacher Compliance', icon: ShieldCheck, always: true },
  { divider: 'Operations' },
  { path: '/food-pricing', label: 'Food Pricing', icon: UtensilsCrossed, always: true },
  { path: '/competitive', label: 'Competitive Analysis', icon: TrendingUp, always: true },
  { path: '/time-off', label: 'Time Off Tracker', icon: Clock, always: true },
  { divider: 'Admin', adminOnly: true },
  { path: '/financials', label: 'Financial Performance', icon: DollarSign, adminOnly: true },
  { path: '/staffing', label: 'Staffing Schedule', icon: Users, adminOnly: true },
  { path: '/directory', label: 'Employee Directory', icon: UserSquare2, adminOnly: true },
  { path: '/users', label: 'User Management', icon: Settings, adminOnly: true },
]

function NavItem({ item, collapsed }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.path}
      end={item.path === '/'}
      style={({ isActive }) => ({
        display: 'flex',
        alignItems: 'center',
        gap: collapsed ? 0 : '0.75rem',
        padding: collapsed ? '0.625rem' : '0.625rem 0.875rem',
        borderRadius: 'var(--radius-sm)',
        fontSize: '0.875rem',
        fontWeight: 500,
        color: isActive ? 'var(--plum)' : 'var(--text-muted)',
        background: isActive ? 'var(--plum-bg)' : 'transparent',
        transition: 'all 0.15s',
        justifyContent: collapsed ? 'center' : 'flex-start',
        textDecoration: 'none',
        position: 'relative',
        opacity: item.coming ? 0.55 : 1,
      })}
      title={collapsed ? item.label : undefined}
    >
      {({ isActive }) => (
        <>
          <Icon size={18} strokeWidth={isActive ? 2.5 : 2} style={{ flexShrink: 0 }} />
          {!collapsed && (
            <>
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.coming && (
                <span style={{
                  fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.04em',
                  background: 'var(--border)', color: 'var(--text-muted)',
                  padding: '0.125rem 0.375rem', borderRadius: 999,
                  textTransform: 'uppercase',
                }}>Soon</span>
              )}
            </>
          )}
        </>
      )}
    </NavLink>
  )
}

export default function Layout({ children }) {
  const { user, logout } = useAuth()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const visibleItems = NAV_ITEMS.filter(item =>
    !item.adminOnly || user?.role === 'admin'
  )

  const sidebarContent = (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
    }}>
      {/* Brand */}
      <div style={{
        display: 'flex', alignItems: 'center',
        gap: collapsed ? 0 : '0.75rem',
        padding: collapsed ? '1.25rem 0.75rem' : '1.25rem 1rem',
        justifyContent: collapsed ? 'center' : 'flex-start',
        borderBottom: '1px solid var(--border)',
        marginBottom: '0.75rem',
      }}>
        <div style={{
          width: 36, height: 36,
          background: 'var(--plum)',
          borderRadius: '10px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
        </div>
        {!collapsed && (
          <div>
            <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--plum-dark)', lineHeight: 1.2 }}>OMH Portal</div>
            <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Director Dashboard</div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '0 0.75rem', overflowY: 'auto' }}>
        {visibleItems.map((item, i) => {
          if (item.divider) {
            if (collapsed) return null
            return (
              <div key={i} style={{
                fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em',
                textTransform: 'uppercase', color: 'var(--text-light)',
                padding: '1rem 0.25rem 0.375rem',
              }}>
                {item.divider}
              </div>
            )
          }
          return <NavItem key={item.path} item={item} collapsed={collapsed} />
        })}
      </nav>

      {/* Footer */}
      <div style={{ borderTop: '1px solid var(--border)', padding: '0.75rem' }}>
        {!collapsed && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.625rem',
            padding: '0.5rem 0.375rem',
            marginBottom: '0.5rem',
          }}>
            <div style={{
              width: 32, height: 32,
              background: 'var(--plum-bg)',
              borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.8125rem', fontWeight: 700, color: 'var(--plum)',
              flexShrink: 0,
            }}>
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.name}
              </div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{user?.role}</div>
            </div>
          </div>
        )}
        <button
          onClick={logout}
          className="btn btn-ghost"
          style={{
            width: '100%',
            justifyContent: collapsed ? 'center' : 'flex-start',
            fontSize: '0.8125rem',
          }}
          title={collapsed ? 'Sign out' : undefined}
        >
          <LogOut size={16} />
          {!collapsed && 'Sign out'}
        </button>
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Desktop sidebar */}
      <aside style={{
        width: collapsed ? 68 : 240,
        flexShrink: 0,
        background: 'var(--white)',
        borderRight: '1px solid var(--border)',
        transition: 'width 0.2s ease',
        display: 'flex', flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {sidebarContent}
        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(c => !c)}
          style={{
            position: 'absolute', top: '1.25rem', right: -12,
            width: 24, height: 24,
            background: 'var(--white)',
            border: '1.5px solid var(--border)',
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: 'var(--text-muted)',
            zIndex: 10,
            boxShadow: 'var(--shadow-sm)',
          }}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed
            ? <ChevronRight size={13} />
            : <ChevronLeft size={13} />
          }
        </button>
      </aside>

      {/* Main content */}
      <main style={{
        flex: 1, overflow: 'auto',
        display: 'flex', flexDirection: 'column',
        background: 'var(--surface)',
      }}>
        {/* Top bar */}
        <div style={{
          background: 'var(--white)',
          borderBottom: '1px solid var(--border)',
          padding: '0.875rem 1.5rem',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div /> {/* Breadcrumb placeholder */}
          <CenterSelector />
        </div>

        {/* Page content */}
        <div style={{ flex: 1, padding: '1.75rem', maxWidth: 1280, margin: '0 auto', width: '100%' }}>
          {children}
        </div>
      </main>
    </div>
  )
}

function CenterSelector() {
  const { user, API } = useAuth()
  const [center, setCenter] = useState(user?.centers?.[0] || null)

  if (!user?.centers?.length) return null

  if (user.centers.length === 1) {
    return (
      <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--sage)', display: 'inline-block' }} />
        {user.centers[0].name}
      </div>
    )
  }

  return (
    <select
      value={center?.id || ''}
      onChange={e => setCenter(user.centers.find(c => c.id === parseInt(e.target.value)))}
      style={{
        padding: '0.375rem 0.75rem',
        borderRadius: 'var(--radius-sm)',
        border: '1.5px solid var(--border)',
        fontSize: '0.8125rem',
        color: 'var(--text)',
        background: 'var(--white)',
        cursor: 'pointer',
        outline: 'none',
      }}
    >
      {user.centers.map(c => (
        <option key={c.id} value={c.id}>{c.name}</option>
      ))}
    </select>
  )
}
