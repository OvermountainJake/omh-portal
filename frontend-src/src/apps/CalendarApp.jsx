import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

export default function CalendarApp() {
  const { user, API } = useAuth()
  const [date, setDate] = useState(new Date())
  const [events, setEvents] = useState([])
  const [selectedCenter, setSelectedCenter] = useState(user?.centers?.[0])
  const [showAdd, setShowAdd] = useState(false)
  const [selectedDay, setSelectedDay] = useState(null)

  useEffect(() => {
    if (!selectedCenter) return
    fetch(`${API}/centers/${selectedCenter.id}/calendar?month=${date.getMonth()+1}&year=${date.getFullYear()}`, { credentials: 'include' })
      .then(r => r.json())
      .then(setEvents)
      .catch(() => {})
  }, [date, selectedCenter, API])

  const year = date.getFullYear()
  const month = date.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const prevMonth = () => setDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))
  const nextMonth = () => setDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))

  const getEventsForDay = (day) => {
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
    return events.filter(e => e.start_date <= dateStr && (e.end_date ? e.end_date >= dateStr : e.start_date === dateStr))
  }

  const todayStr = new Date().toISOString().slice(0, 10)
  const isToday = (day) => {
    return `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}` === todayStr
  }

  const handleDeleteEvent = async (id) => {
    if (!confirm('Delete this event?')) return
    await fetch(`${API}/calendar/${id}`, { method: 'DELETE', credentials: 'include' })
    setEvents(ev => ev.filter(e => e.id !== id))
  }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1>Center Calendar</h1>
          <p>Upcoming events, alerts, and important dates.</p>
        </div>
        {user?.role === 'admin' && (
          <button className="btn btn-primary" onClick={() => { setSelectedDay(null); setShowAdd(true) }}>
            <Plus size={16} /> Add Event
          </button>
        )}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          <span style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--plum)', display: 'inline-block' }} />
          Management
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          <span style={{ width: 12, height: 12, borderRadius: 3, background: '#F59E0B', display: 'inline-block' }} />
          Family
        </div>
      </div>

      {/* Calendar */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {/* Nav */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '1rem 1.25rem',
          borderBottom: '1px solid var(--border)',
        }}>
          <button className="btn btn-ghost btn-sm" onClick={prevMonth}><ChevronLeft size={16} /></button>
          <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>{MONTHS[month]} {year}</h2>
          <button className="btn btn-ghost btn-sm" onClick={nextMonth}><ChevronRight size={16} /></button>
        </div>

        {/* Day headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', borderBottom: '1px solid var(--border)' }}>
          {DAYS.map(d => (
            <div key={d} style={{
              padding: '0.5rem', textAlign: 'center',
              fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)',
              textTransform: 'uppercase', letterSpacing: '0.04em',
            }}>{d}</div>
          ))}
        </div>

        {/* Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)' }}>
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} style={{ minHeight: 96, borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }} />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1
            const dayEvents = getEventsForDay(day)
            const today = isToday(day)
            return (
              <div
                key={day}
                onClick={() => { setSelectedDay(day); setShowAdd(true) }}
                style={{
                  minHeight: 96,
                  borderRight: '1px solid var(--border)',
                  borderBottom: '1px solid var(--border)',
                  padding: '0.375rem',
                  cursor: user?.role === 'admin' ? 'pointer' : 'default',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => { if (user?.role === 'admin') e.currentTarget.style.background = 'var(--plum-bg)' }}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: today ? 'var(--plum)' : 'transparent',
                  color: today ? 'white' : 'var(--text)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.8125rem', fontWeight: today ? 700 : 400,
                  marginBottom: '0.25rem',
                }}>
                  {day}
                </div>
                {dayEvents.slice(0, 3).map(ev => (
                  <div
                    key={ev.id}
                    onClick={e => { e.stopPropagation(); if (user?.role === 'admin') handleDeleteEvent(ev.id) }}
                    style={{
                      background: ev.category === 'family' ? '#FEF3C7' : 'var(--plum-bg)',
                      color: ev.category === 'family' ? '#92400E' : 'var(--plum-dark)',
                      borderLeft: `3px solid ${ev.category === 'family' ? '#F59E0B' : 'var(--plum)'}`,
                      padding: '0.125rem 0.375rem',
                      borderRadius: 4,
                      fontSize: '0.6875rem',
                      fontWeight: 500,
                      marginBottom: '0.125rem',
                      cursor: user?.role === 'admin' ? 'pointer' : 'default',
                    }}
                    title={`${ev.title}${ev.start_time ? ` · ${ev.start_time}${ev.end_time ? '–'+ev.end_time : ''}` : ''}${user?.role === 'admin' ? ' — Click to delete' : ''}`}
                  >
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.title}</div>
                    {ev.start_time && <div style={{ opacity: 0.75, fontSize: '0.625rem' }}>{ev.start_time}{ev.end_time ? `–${ev.end_time}` : ''}</div>}
                  </div>
                ))}
                {dayEvents.length > 3 && (
                  <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', paddingLeft: '0.375rem' }}>
                    +{dayEvents.length - 3} more
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Add event modal */}
      {showAdd && user?.role === 'admin' && (
        <AddEventModal
          centerId={selectedCenter?.id}
          defaultDay={selectedDay ? `${year}-${String(month+1).padStart(2,'0')}-${String(selectedDay).padStart(2,'0')}` : ''}
          API={API}
          onClose={() => { setShowAdd(false); setSelectedDay(null) }}
          onSaved={event => {
            setEvents(ev => [...ev, event])
            setShowAdd(false)
            setSelectedDay(null)
          }}
        />
      )}
    </div>
  )
}

function AddEventModal({ centerId, defaultDay, API, onClose, onSaved }) {
  const [form, setForm] = useState({ title: '', description: '', start_date: defaultDay, end_date: '', start_time: '', end_time: '', category: 'management' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch(`${API}/centers/${centerId}/calendar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onSaved(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add Calendar Event</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div style={{ color: '#B91C1C', marginBottom: '1rem', fontSize: '0.875rem' }}>{error}</div>}
            <div className="field">
              <label>Event Title</label>
              <input value={form.title} onChange={set('title')} placeholder="e.g. Spring Picture Day" required autoFocus />
            </div>
            <div className="field">
              <label>Description (optional)</label>
              <textarea value={form.description} onChange={set('description')} placeholder="Additional details…" rows={2} />
            </div>
            <div className="grid-2">
              <div className="field">
                <label>Start Date</label>
                <input type="date" value={form.start_date} onChange={set('start_date')} required />
              </div>
              <div className="field">
                <label>End Date (optional)</label>
                <input type="date" value={form.end_date} onChange={set('end_date')} />
              </div>
              <div className="field">
                <label>Start Time (optional)</label>
                <input type="time" value={form.start_time} onChange={set('start_time')} />
              </div>
              <div className="field">
                <label>End Time (optional)</label>
                <input type="time" value={form.end_time} onChange={set('end_time')} />
              </div>
            </div>
            <div className="field">
              <label>Category</label>
              <select value={form.category} onChange={set('category')}>
                <option value="management">Management</option>
                <option value="family">Family</option>
              </select>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Add Event'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
