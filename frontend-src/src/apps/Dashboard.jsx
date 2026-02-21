import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Calendar, ClipboardList, Clock, TrendingUp } from 'lucide-react'

export default function Dashboard() {
  const { user, API } = useAuth()
  const navigate = useNavigate()
  const [data, setData] = useState(null)

  useEffect(() => {
    fetch(`${API}/dashboard`, { credentials: 'include' })
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
  }, [API])

  const today = new Date()
  const greeting = today.getHours() < 12 ? 'Good morning' : today.getHours() < 17 ? 'Good afternoon' : 'Good evening'
  const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div>
      {/* Welcome */}
      <div style={{
        background: 'linear-gradient(135deg, var(--plum) 0%, var(--plum-light) 100%)',
        borderRadius: 'var(--radius-lg)',
        padding: '2rem',
        color: 'white',
        marginBottom: '1.5rem',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', right: -20, top: -20,
          width: 200, height: 200,
          background: 'rgba(255,255,255,0.06)',
          borderRadius: '50%',
        }} />
        <div style={{
          position: 'absolute', right: 60, bottom: -40,
          width: 120, height: 120,
          background: 'rgba(255,255,255,0.04)',
          borderRadius: '50%',
        }} />
        <p style={{ fontSize: '0.875rem', opacity: 0.8, marginBottom: '0.375rem' }}>{dateStr}</p>
        <h1 style={{ fontSize: '1.75rem', fontFamily: "'Playfair Display', serif", marginBottom: '0.5rem' }}>
          {greeting}, {user?.name?.split(' ')[0]}! 👋
        </h1>
        <p style={{ opacity: 0.85, fontSize: '0.9375rem' }}>
          {user?.centers?.length === 1
            ? `Managing ${user.centers[0].name}`
            : `Managing ${user?.centers?.length || 0} centers`
          }
        </p>
      </div>

      {/* Quick access cards */}
      <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '0.75rem' }}>Quick Access</h2>
      <div className="grid-2" style={{ marginBottom: '2rem' }}>
        <QuickCard
          icon={<ClipboardList size={22} />}
          title="Waiting List"
          desc="View and manage your enrollment queue"
          color="var(--plum)"
          onClick={() => navigate('/waitlist')}
        />
        <QuickCard
          icon={<Calendar size={22} />}
          title="Center Calendar"
          desc="Upcoming events and important dates"
          color="var(--sage)"
          onClick={() => navigate('/calendar')}
        />
      </div>

      {/* Upcoming events */}
      {data?.upcomingEvents?.length > 0 && (
        <>
          <h2 style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Upcoming This Week</h2>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {data.upcomingEvents.map((event, i) => (
              <div key={event.id} style={{
                display: 'flex', alignItems: 'center', gap: '1rem',
                padding: '0.875rem 1.25rem',
                borderBottom: i < data.upcomingEvents.length - 1 ? '1px solid var(--border)' : 'none',
              }}>
                <div style={{
                  width: 40, height: 40,
                  background: event.category === 'family' ? '#FFF3E0' : 'var(--plum-bg)',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Calendar size={18} color={event.category === 'family' ? '#B45309' : 'var(--plum)'} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, fontSize: '0.9rem', marginBottom: '0.125rem' }}>{event.title}</div>
                  {event.description && <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{event.description}</div>}
                </div>
                <div style={{ flexShrink: 0 }}>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', textAlign: 'right' }}>
                    {new Date(event.start_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                  <span className={`badge badge-${event.category}`} style={{ fontSize: '0.6875rem', marginTop: '0.125rem' }}>
                    {event.category}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {data?.upcomingEvents?.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
          <Calendar size={32} style={{ margin: '0 auto 0.75rem', opacity: 0.3 }} />
          <p style={{ fontSize: '0.875rem' }}>No upcoming events this week.</p>
        </div>
      )}
    </div>
  )
}

function QuickCard({ icon, title, desc, color, onClick }) {
  return (
    <button
      onClick={onClick}
      className="card"
      style={{
        display: 'flex', alignItems: 'flex-start', gap: '1rem',
        cursor: 'pointer', border: 'none',
        transition: 'all 0.15s',
        textAlign: 'left',
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; e.currentTarget.style.transform = 'none' }}
    >
      <div style={{
        width: 44, height: 44,
        background: `${color}18`,
        borderRadius: 'var(--radius-sm)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color,
        flexShrink: 0,
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontWeight: 600, fontSize: '0.9375rem', marginBottom: '0.25rem' }}>{title}</div>
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{desc}</div>
      </div>
    </button>
  )
}
