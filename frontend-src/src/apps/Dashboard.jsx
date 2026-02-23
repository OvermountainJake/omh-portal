import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  Calendar, ClipboardList, Clock, TrendingUp, ShieldCheck,
  BookOpen, UtensilsCrossed, DollarSign, Users, UserSquare2,
  Star, FileText, CloudSun, AlertTriangle, CheckCircle, XCircle,
} from 'lucide-react'

const APP_LINKS = [
  { path: '/waitlist',   label: 'Waiting List',       icon: ClipboardList, color: 'var(--plum)' },
  { path: '/calendar',  label: 'Center Calendar',     icon: Calendar,      color: 'var(--sage)' },
  { path: '/handbook',  label: 'Handbooks',           icon: BookOpen,      color: '#C2410C' },
  { path: '/compliance',label: 'Compliance',          icon: ShieldCheck,   color: '#0369A1' },
  { path: '/food-pricing',label:'Food Program',       icon: UtensilsCrossed,color: '#065F46' },
  { path: '/competitive',label:'Competitive Analysis',icon: TrendingUp,    color: '#7C3AED' },
  { path: '/time-off',  label: 'Time Off Tracker',    icon: Clock,         color: '#92400E' },
  { path: '/directory', label: 'Employee Directory',  icon: UserSquare2,   color: '#1D4ED8' },
  { path: '/financials',label: 'Financials',          icon: DollarSign,    color: '#166534', adminOnly: true },
  { path: '/staff-points',label:'Staff Points',       icon: Star,          color: '#B45309', directorOk: true },
  { path: '/staff-reviews',label:'Staff Reviews',     icon: FileText,      color: '#6B21A8', directorOk: true },
]

function daysUntil(dateStr) {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24))
}

function ComplianceStatusIcon({ days }) {
  if (days === null) return <AlertTriangle size={14} color="#D97706" />
  if (days < 0) return <XCircle size={14} color="#B91C1C" />
  if (days < 30) return <AlertTriangle size={14} color="#D97706" />
  return <CheckCircle size={14} color="#22C55E" />
}

export default function Dashboard() {
  const { user, API } = useAuth()
  const navigate = useNavigate()
  const [calEvents, setCalEvents] = useState([])
  const [compliance, setCompliance] = useState([])
  const [waitlist, setWaitlist] = useState([])
  const [weather, setWeather] = useState(null)
  const [weatherLoading, setWeatherLoading] = useState(true)

  const center = user?.centers?.[0]

  useEffect(() => {
    if (!center) return
    // Calendar events (next 7 days)
    fetch(`${API}/centers/${center.id}/calendar`, { credentials: 'include' })
      .then(r => r.json()).then(d => setCalEvents(Array.isArray(d) ? d : [])).catch(() => {})
    // Compliance
    fetch(`${API}/compliance/center/${center.id}`, { credentials: 'include' })
      .then(r => r.json()).then(d => setCompliance(d || {})).catch(() => {})
    // Waitlist
    fetch(`${API}/centers/${center.id}/waitlist`, { credentials: 'include' })
      .then(r => r.json()).then(d => setWaitlist(Array.isArray(d) ? d : [])).catch(() => {})
  }, [center, API])

  // Weather
  useEffect(() => {
    const city = center?.city || 'Chicago'
    fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1`)
      .then(r => r.json())
      .then(d => {
        const cur = d.current_condition?.[0]
        const hourly = d.weather?.[0]?.hourly
        const uvIndex = hourly ? Math.max(...hourly.map(h => parseInt(h.uvIndex || 0))) : null
        setWeather({
          temp: cur ? `${cur.temp_F}°F` : null,
          feels: cur ? `Feels like ${cur.FeelsLikeF}°F` : null,
          desc: cur?.weatherDesc?.[0]?.value || null,
          humidity: cur ? `${cur.humidity}% humidity` : null,
          uvIndex,
          city,
        })
        setWeatherLoading(false)
      })
      .catch(() => { setWeather(null); setWeatherLoading(false) })
  }, [center])

  const today = new Date()
  const greeting = today.getHours() < 12 ? 'Good morning' : today.getHours() < 17 ? 'Good afternoon' : 'Good evening'
  const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  // Next 7 days events
  const todayStr = today.toISOString().split('T')[0]
  const nextWeek = new Date(today); nextWeek.setDate(today.getDate() + 7)
  const nextWeekStr = nextWeek.toISOString().split('T')[0]
  const upcomingEvents = calEvents
    .filter(e => e.start_date >= todayStr && e.start_date <= nextWeekStr)
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
    .slice(0, 6)

  // Upcoming compliance items (expired/soon)
  const { matrix = [] } = compliance
  const complianceItems = matrix.flatMap(({ staff, compliance: items }) =>
    items
      .filter(c => c.status !== 'current' || (c.record?.expiry_date && daysUntil(c.record.expiry_date) < 60))
      .map(c => ({
        name: `${staff.name} — ${c.requirement.name}`,
        days: c.record?.expiry_date ? daysUntil(c.record.expiry_date) : null,
        status: c.status,
      }))
  ).sort((a, b) => (a.days ?? -999) - (b.days ?? -999)).slice(0, 5)

  // Added this month
  const thisMonth = waitlist.filter(e => {
    const d = new Date(e.signed_up_at)
    return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear()
  }).length

  const visibleApps = APP_LINKS.filter(app => {
    if (app.adminOnly) return user?.role === 'admin'
    if (app.directorOk) return user?.role === 'admin' || user?.role === 'director'
    return true
  })

  const EVENT_COLORS = {
    management: { bg: 'var(--plum-bg)', color: 'var(--plum)', label: 'Management' },
    family:     { bg: '#FFF3E0',        color: '#B45309',      label: 'Family' },
  }

  return (
    <div>
      {/* Welcome banner */}
      <div style={{
        background: 'linear-gradient(135deg, var(--plum) 0%, var(--plum-light) 100%)',
        borderRadius: 'var(--radius-lg)', padding: '2rem', color: 'white',
        marginBottom: '1.5rem', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', right: -20, top: -20, width: 200, height: 200, background: 'rgba(255,255,255,0.06)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', right: 60, bottom: -40, width: 120, height: 120, background: 'rgba(255,255,255,0.04)', borderRadius: '50%' }} />
        <p style={{ fontSize: '0.875rem', opacity: 0.8, marginBottom: '0.375rem' }}>{dateStr}</p>
        <h1 style={{ fontSize: '1.75rem', fontFamily: "'Playfair Display', serif", marginBottom: '0.5rem' }}>
          {greeting}, {user?.name?.split(' ')[0]}! 👋
        </h1>
        <p style={{ opacity: 0.85, fontSize: '0.9375rem' }}>
          {center ? `Managing ${center.name}` : `Managing ${user?.centers?.length || 0} centers`}
          {thisMonth > 0 && <span style={{ marginLeft: '1rem', background: 'rgba(255,255,255,0.15)', padding: '0.2rem 0.625rem', borderRadius: 999, fontSize: '0.8125rem' }}>📋 +{thisMonth} on waitlist this month</span>}
        </p>
      </div>

      {/* 3-column widgets */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.25rem', marginBottom: '1.5rem' }}>

        {/* Upcoming events */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Calendar size={15} color="var(--plum)" /> Next 7 Days
            </div>
            <button className="btn btn-ghost btn-sm" style={{ fontSize: '0.75rem' }} onClick={() => navigate('/calendar')}>View all →</button>
          </div>
          {upcomingEvents.length === 0 ? (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>No events this week</div>
          ) : (
            upcomingEvents.map((event, i) => {
              const cfg = EVENT_COLORS[event.category] || EVENT_COLORS.management
              return (
                <div key={event.id} style={{ padding: '0.75rem 1.25rem', borderBottom: i < upcomingEvents.length - 1 ? '1px solid var(--border)' : 'none', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                  <div style={{ width: 32, height: 32, background: cfg.bg, borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Calendar size={15} color={cfg.color} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 500, fontSize: '0.8125rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{event.title}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {new Date(event.start_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Weather widget */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ fontWeight: 700, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.875rem' }}>
            <CloudSun size={15} color="var(--sage)" /> Weather — {weather?.city || center?.city || 'Loading…'}
          </div>
          {weatherLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '1.5rem' }}><div className="spinner" /></div>
          ) : !weather ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', textAlign: 'center', padding: '1rem' }}>Weather unavailable</div>
          ) : (
            <div>
              <div style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--plum)', lineHeight: 1, marginBottom: '0.25rem' }}>{weather.temp}</div>
              <div style={{ fontSize: '0.9rem', color: 'var(--text)', marginBottom: '0.125rem' }}>{weather.desc}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>{weather.feels} · {weather.humidity}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                {weather.uvIndex !== null && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>☀️ UV Index</span>
                    <span style={{ fontWeight: 600, color: weather.uvIndex >= 8 ? '#B91C1C' : weather.uvIndex >= 5 ? '#D97706' : '#22C55E' }}>
                      {weather.uvIndex} {weather.uvIndex >= 8 ? '— High' : weather.uvIndex >= 5 ? '— Moderate' : '— Low'}
                    </span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>🌳 Outdoor Play</span>
                  <span style={{ fontWeight: 600, color: weather.uvIndex >= 8 ? '#D97706' : '#22C55E' }}>
                    {weather.uvIndex >= 8 ? 'Use sunscreen' : 'Good to go'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Upcoming compliance */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShieldCheck size={15} color="#0369A1" /> Compliance Alerts
            </div>
            <button className="btn btn-ghost btn-sm" style={{ fontSize: '0.75rem' }} onClick={() => navigate('/compliance')}>View all →</button>
          </div>
          {complianceItems.length === 0 ? (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              <CheckCircle size={24} color="#22C55E" style={{ margin: '0 auto 0.5rem', display: 'block' }} />
              All compliance current ✓
            </div>
          ) : (
            complianceItems.map((item, i) => {
              const isOverdue = item.days !== null && item.days < 0
              const isSoon = item.days !== null && item.days < 30
              const color = isOverdue ? '#B91C1C' : isSoon ? '#D97706' : '#22C55E'
              const bg = isOverdue ? '#FEF2F2' : isSoon ? '#FEF3C7' : 'var(--surface)'
              return (
                <div key={i} style={{ padding: '0.75rem 1.25rem', borderBottom: i < complianceItems.length - 1 ? '1px solid var(--border)' : 'none', background: bg }}>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text)', marginBottom: '0.125rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                  <div style={{ fontSize: '0.75rem', color, fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <ComplianceStatusIcon days={item.days} />
                    {item.days === null ? 'No date set' : item.days < 0 ? `Overdue by ${Math.abs(item.days)}d` : item.days === 0 ? 'Due today' : `Due in ${item.days}d`}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Quick access grid */}
      <h2 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Quick Access</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem' }}>
        {visibleApps.map(app => {
          const Icon = app.icon
          return (
            <button
              key={app.path}
              onClick={() => navigate(app.path)}
              className="card"
              style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.875rem 1rem', cursor: 'pointer', border: 'none', textAlign: 'left', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; e.currentTarget.style.transform = 'none' }}
            >
              <div style={{ width: 36, height: 36, background: `${app.color}18`, borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: app.color, flexShrink: 0 }}>
                <Icon size={18} />
              </div>
              <div style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text)' }}>{app.label}</div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
