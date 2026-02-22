import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  ChevronLeft, ChevronRight, Plus, X, Calendar,
  Clock, MapPin, Tag, Edit2, Trash2, AlignLeft, ChevronDown
} from 'lucide-react'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAYS_LONG = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const DAYS_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

const CATEGORIES = {
  management: { label: 'Management',  bg: 'var(--plum-bg)',  color: 'var(--plum-dark)', border: 'var(--plum)',  dot: '#6B3F7C' },
  family:     { label: 'Family',      bg: '#FEF3C7',          color: '#92400E',           border: '#F59E0B',      dot: '#F59E0B' },
  holiday:    { label: 'Holiday',     bg: '#FFF1F2',          color: '#BE123C',           border: '#FDA4AF',      dot: '#F43F5E' },
  staff:      { label: 'Staff',       bg: '#ECFDF5',          color: '#065F46',           border: '#6EE7B7',      dot: '#10B981' },
  training:   { label: 'Training',    bg: '#EFF6FF',          color: '#1D4ED8',           border: '#93C5FD',      dot: '#3B82F6' },
  closure:    { label: 'Closure',     bg: '#F9FAFB',          color: '#374151',           border: '#D1D5DB',      dot: '#6B7280' },
}

function formatTime(t) {
  if (!t) return null
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2,'0')} ${ampm}`
}

function formatDateLong(dateStr) {
  if (!dateStr) return ''
  const [y, mo, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, mo - 1, d)
  return dt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

export default function CalendarApp() {
  const { user, API } = useAuth()
  const [date, setDate] = useState(new Date())
  const [events, setEvents] = useState([])
  const [selectedCenter, setSelectedCenter] = useState(user?.centers?.[0])
  const [showAdd, setShowAdd] = useState(false)
  const [editEvent, setEditEvent] = useState(null)
  const [selectedDay, setSelectedDay] = useState(null)   // day number
  const [detailEvent, setDetailEvent] = useState(null)   // full event object
  const [categoryFilter, setCategoryFilter] = useState(null) // null = all
  const [view, setView] = useState('month') // month | list

  const year = date.getFullYear()
  const month = date.getMonth()

  useEffect(() => {
    if (!selectedCenter) return
    fetch(`${API}/centers/${selectedCenter.id}/calendar?month=${month+1}&year=${year}`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => setEvents(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [date, selectedCenter, API])

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const todayStr = new Date().toISOString().slice(0, 10)

  const dayStr = (day) => `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
  const isToday = (day) => dayStr(day) === todayStr

  const getEventsForDay = (day) => {
    const ds = dayStr(day)
    return events
      .filter(e => e.start_date <= ds && (e.end_date ? e.end_date >= ds : e.start_date === ds))
      .filter(e => !categoryFilter || e.category === categoryFilter)
      .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))
  }

  // Upcoming events (next 60 days from today)
  const upcomingEvents = useMemo(() => {
    const now = new Date()
    const cutoff = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000)
    const cutoffStr = cutoff.toISOString().slice(0, 10)
    return events
      .filter(e => e.start_date >= todayStr && e.start_date <= cutoffStr)
      .filter(e => !categoryFilter || e.category === categoryFilter)
      .sort((a, b) => a.start_date.localeCompare(b.start_date) || (a.start_time || '').localeCompare(b.start_time || ''))
      .slice(0, 20)
  }, [events, todayStr, categoryFilter])

  const prevMonth = () => { setDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1)); setSelectedDay(null) }
  const nextMonth = () => { setDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1)); setSelectedDay(null) }
  const goToday = () => { setDate(new Date()); setSelectedDay(null) }

  const handleDeleteEvent = async (id) => {
    if (!confirm('Delete this event?')) return
    await fetch(`${API}/calendar/${id}`, { method: 'DELETE', credentials: 'include' })
    setEvents(ev => ev.filter(e => e.id !== id))
    setDetailEvent(null)
  }

  const selectedDayEvents = selectedDay ? getEventsForDay(selectedDay) : []

  return (
    <div>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <div className="page-header" style={{ marginBottom: 0 }}>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Calendar size={22} style={{ color: 'var(--plum)' }} />
            Center Calendar
          </h1>
          <p style={{ marginTop: '0.2rem' }}>Events, closures, and important dates for your team.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {/* View Toggle */}
          <div style={{ display: 'flex', background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '0.2rem', boxShadow: 'var(--shadow-sm)' }}>
            {[['month','Month'],['list','List']].map(([v, label]) => (
              <button key={v} onClick={() => setView(v)} className="btn btn-sm" style={{
                background: view === v ? 'var(--plum)' : 'transparent',
                color: view === v ? 'white' : 'var(--text-muted)',
                padding: '0.3rem 0.75rem', fontSize: '0.8125rem',
              }}>{label}</button>
            ))}
          </div>
          <button className="btn btn-secondary btn-sm" onClick={goToday}>Today</button>
          {user?.role === 'admin' && (
            <button className="btn btn-primary" onClick={() => { setEditEvent(null); setShowAdd(true) }}>
              <Plus size={16} /> Add Event
            </button>
          )}
        </div>
      </div>

      {/* Category Filter Legend */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginRight: '0.25rem' }}>Filter:</span>
        <button
          onClick={() => setCategoryFilter(null)}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.375rem',
            fontSize: '0.8125rem', padding: '0.3rem 0.75rem',
            borderRadius: 999, border: `1.5px solid ${categoryFilter === null ? 'var(--plum)' : 'var(--border)'}`,
            background: categoryFilter === null ? 'var(--plum-bg)' : 'var(--white)',
            color: categoryFilter === null ? 'var(--plum)' : 'var(--text-muted)',
            fontWeight: categoryFilter === null ? 700 : 400,
            cursor: 'pointer', transition: 'all 0.15s',
          }}
        >All Events</button>
        {Object.entries(CATEGORIES).map(([key, cat]) => (
          <button
            key={key}
            onClick={() => setCategoryFilter(prev => prev === key ? null : key)}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.375rem',
              fontSize: '0.8125rem', padding: '0.3rem 0.75rem',
              borderRadius: 999, border: `1.5px solid ${categoryFilter === key ? cat.dot : 'var(--border)'}`,
              background: categoryFilter === key ? cat.bg : 'var(--white)',
              color: categoryFilter === key ? cat.color : 'var(--text-muted)',
              fontWeight: categoryFilter === key ? 700 : 400,
              cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: cat.dot, display: 'inline-block' }} />
            {cat.label}
          </button>
        ))}
      </div>

      {/* Main Layout: Calendar + Side Panel */}
      <div style={{ display: 'grid', gridTemplateColumns: selectedDay ? '1fr 320px' : '1fr', gap: '1rem', alignItems: 'start' }}>
        {/* Calendar */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {/* Nav */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
            <button className="btn btn-ghost btn-sm" onClick={prevMonth}><ChevronLeft size={16} /></button>
            <h2 style={{ fontSize: '1.0625rem', fontWeight: 700, color: 'var(--text)' }}>{MONTHS[month]} {year}</h2>
            <button className="btn btn-ghost btn-sm" onClick={nextMonth}><ChevronRight size={16} /></button>
          </div>

          {view === 'month' ? (
            <>
              {/* Day headers */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
                {DAYS_SHORT.map(d => (
                  <div key={d} style={{ padding: '0.625rem 0.5rem', textAlign: 'center', fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{d}</div>
                ))}
              </div>

              {/* Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)' }}>
                {Array.from({ length: firstDay }).map((_, i) => (
                  <div key={`empty-${i}`} style={{ minHeight: 110, borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }} />
                ))}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1
                  const dayEvents = getEventsForDay(day)
                  const today = isToday(day)
                  const selected = selectedDay === day
                  return (
                    <div
                      key={day}
                      onClick={() => setSelectedDay(prev => prev === day ? null : day)}
                      style={{
                        minHeight: 110,
                        borderRight: '1px solid var(--border)',
                        borderBottom: '1px solid var(--border)',
                        padding: '0.375rem',
                        cursor: 'pointer',
                        background: selected ? 'var(--plum-bg)' : 'transparent',
                        transition: 'background 0.1s',
                        position: 'relative',
                      }}
                      onMouseEnter={e => { if (!selected) e.currentTarget.style.background = 'var(--surface)' }}
                      onMouseLeave={e => { if (!selected) e.currentTarget.style.background = 'transparent' }}
                    >
                      <div style={{
                        width: 30, height: 30, borderRadius: '50%',
                        background: today ? 'var(--plum)' : 'transparent',
                        color: today ? 'white' : selected ? 'var(--plum)' : 'var(--text)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.8125rem', fontWeight: today || selected ? 700 : 400,
                        marginBottom: '0.25rem',
                        border: selected && !today ? '2px solid var(--plum)' : 'none',
                      }}>
                        {day}
                      </div>
                      {dayEvents.slice(0, 3).map(ev => {
                        const cat = CATEGORIES[ev.category] || CATEGORIES.management
                        return (
                          <div
                            key={ev.id}
                            onClick={e => { e.stopPropagation(); setDetailEvent(ev) }}
                            style={{
                              background: cat.bg,
                              color: cat.color,
                              borderLeft: `3px solid ${cat.dot}`,
                              padding: '0.15rem 0.375rem',
                              borderRadius: '0 4px 4px 0',
                              fontSize: '0.6875rem',
                              fontWeight: 500,
                              marginBottom: '0.125rem',
                              cursor: 'pointer',
                              transition: 'filter 0.1s',
                            }}
                            onMouseEnter={e => e.currentTarget.style.filter = 'brightness(0.95)'}
                            onMouseLeave={e => e.currentTarget.style.filter = 'none'}
                            title={ev.title}
                          >
                            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.title}</div>
                            {ev.start_time && (
                              <div style={{ opacity: 0.8, fontSize: '0.625rem', fontWeight: 400 }}>{formatTime(ev.start_time)}</div>
                            )}
                          </div>
                        )
                      })}
                      {dayEvents.length > 3 && (
                        <div
                          onClick={e => { e.stopPropagation(); setSelectedDay(day) }}
                          style={{ fontSize: '0.6875rem', color: 'var(--plum)', fontWeight: 600, paddingLeft: '0.375rem', cursor: 'pointer' }}
                        >
                          +{dayEvents.length - 3} more
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          ) : (
            /* List View */
            <div>
              {upcomingEvents.length === 0 ? (
                <div className="empty-state" style={{ padding: '3rem' }}>
                  <Calendar size={36} />
                  <h3>No upcoming events</h3>
                  <p>Add events to keep your team informed.</p>
                </div>
              ) : (
                <div>
                  {upcomingEvents.map((ev, i) => {
                    const cat = CATEGORIES[ev.category] || CATEGORIES.management
                    const prevEv = upcomingEvents[i - 1]
                    const showDateHeader = !prevEv || prevEv.start_date !== ev.start_date
                    return (
                      <div key={ev.id}>
                        {showDateHeader && (
                          <div style={{ padding: '0.75rem 1.25rem 0.375rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
                            {formatDateLong(ev.start_date)}
                          </div>
                        )}
                        <div
                          onClick={() => setDetailEvent(ev)}
                          style={{
                            display: 'flex', alignItems: 'flex-start', gap: '0.875rem',
                            padding: '0.875rem 1.25rem',
                            borderBottom: '1px solid var(--border)',
                            cursor: 'pointer',
                            transition: 'background 0.1s',
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--surface)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <div style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, background: cat.dot, flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--text)', marginBottom: '0.25rem' }}>{ev.title}</div>
                            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                              {ev.start_time && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                                  <Clock size={13} /> {formatTime(ev.start_time)}{ev.end_time ? ` – ${formatTime(ev.end_time)}` : ''}
                                </span>
                              )}
                              {ev.location && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                                  <MapPin size={13} /> {ev.location}
                                </span>
                              )}
                            </div>
                            {ev.description && (
                              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.25rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 500 }}>{ev.description}</div>
                            )}
                          </div>
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, background: cat.bg, color: cat.color, padding: '0.2rem 0.6rem', borderRadius: 999, border: `1px solid ${cat.dot}`, whiteSpace: 'nowrap', flexShrink: 0 }}>
                            {cat.label}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Day Detail Side Panel */}
        {selectedDay && view === 'month' && (
          <div className="card" style={{ padding: 0, overflow: 'hidden', position: 'sticky', top: '1rem' }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text)' }}>
                  {DAYS_LONG[new Date(year, month, selectedDay).getDay()]}
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  {MONTHS[month]} {selectedDay}, {year}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center' }}>
                {user?.role === 'admin' && (
                  <button className="btn btn-primary btn-sm" onClick={() => {
                    setEditEvent(null)
                    setShowAdd(true)
                  }}>
                    <Plus size={13} /> Add
                  </button>
                )}
                <button className="btn btn-ghost btn-sm" onClick={() => setSelectedDay(null)}><X size={14} /></button>
              </div>
            </div>

            {selectedDayEvents.length === 0 ? (
              <div style={{ padding: '2rem 1.25rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Calendar size={28} style={{ marginBottom: '0.5rem', color: 'var(--text-light)' }} />
                <p style={{ fontSize: '0.875rem' }}>No events this day</p>
                {user?.role === 'admin' && (
                  <button className="btn btn-secondary btn-sm" style={{ marginTop: '0.75rem' }} onClick={() => setShowAdd(true)}>
                    <Plus size={13} /> Add Event
                  </button>
                )}
              </div>
            ) : (
              <div style={{ maxHeight: 480, overflowY: 'auto' }}>
                {selectedDayEvents.map(ev => {
                  const cat = CATEGORIES[ev.category] || CATEGORIES.management
                  return (
                    <div
                      key={ev.id}
                      onClick={() => setDetailEvent(ev)}
                      style={{
                        padding: '0.875rem 1.25rem',
                        borderBottom: '1px solid var(--border)',
                        cursor: 'pointer',
                        display: 'flex', gap: '0.75rem', alignItems: 'flex-start',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--surface)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ width: 3, alignSelf: 'stretch', borderRadius: 2, background: cat.dot, flexShrink: 0, marginTop: 2 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.25rem', color: 'var(--text)' }}>{ev.title}</div>
                        {ev.start_time && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            <Clock size={12} /> {formatTime(ev.start_time)}{ev.end_time ? ` – ${formatTime(ev.end_time)}` : ''}
                          </div>
                        )}
                        {ev.location && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>
                            <MapPin size={12} /> {ev.location}
                          </div>
                        )}
                        {ev.description && (
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem', lineHeight: 1.4 }}>{ev.description}</div>
                        )}
                      </div>
                      <span style={{ fontSize: '0.6875rem', background: cat.bg, color: cat.color, padding: '0.15rem 0.5rem', borderRadius: 999, fontWeight: 700, flexShrink: 0, border: `1px solid ${cat.dot}` }}>
                        {cat.label}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Upcoming Events (shown below calendar when no day selected) */}
      {!selectedDay && view === 'month' && upcomingEvents.length > 0 && (
        <div className="card" style={{ marginTop: '1rem', padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '0.875rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Clock size={15} style={{ color: 'var(--plum)' }} />
            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text)' }}>Upcoming Events</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.25rem' }}>— next 60 days</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
            {upcomingEvents.slice(0, 9).map(ev => {
              const cat = CATEGORIES[ev.category] || CATEGORIES.management
              return (
                <div
                  key={ev.id}
                  onClick={() => setDetailEvent(ev)}
                  style={{
                    padding: '0.875rem 1.125rem',
                    borderRight: '1px solid var(--border)',
                    borderBottom: '1px solid var(--border)',
                    cursor: 'pointer',
                    transition: 'background 0.1s',
                    display: 'flex', gap: '0.75rem', alignItems: 'flex-start',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  {/* Date block */}
                  <div style={{
                    width: 44, flexShrink: 0, textAlign: 'center',
                    background: 'var(--plum-bg)', borderRadius: 'var(--radius-sm)',
                    padding: '0.375rem 0.25rem',
                    border: '1px solid var(--border)',
                  }}>
                    <div style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--plum)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {MONTHS[parseInt(ev.start_date.split('-')[1]) - 1].slice(0, 3)}
                    </div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--plum-dark)', lineHeight: 1.1 }}>
                      {parseInt(ev.start_date.split('-')[2])}
                    </div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text)', marginBottom: '0.2rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.title}</div>
                    {ev.start_time && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        <Clock size={11} /> {formatTime(ev.start_time)}{ev.end_time ? ` – ${formatTime(ev.end_time)}` : ''}
                      </div>
                    )}
                    {ev.location && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                        <MapPin size={11} /> {ev.location}
                      </div>
                    )}
                    <span style={{ display: 'inline-flex', marginTop: '0.25rem', fontSize: '0.6875rem', fontWeight: 700, background: cat.bg, color: cat.color, padding: '0.1rem 0.5rem', borderRadius: 999, border: `1px solid ${cat.dot}` }}>
                      {cat.label}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Event Detail Modal */}
      {detailEvent && (
        <EventDetailModal
          event={detailEvent}
          user={user}
          API={API}
          onClose={() => setDetailEvent(null)}
          onEdit={ev => { setDetailEvent(null); setEditEvent(ev); setShowAdd(true) }}
          onDelete={handleDeleteEvent}
        />
      )}

      {/* Add / Edit Modal */}
      {showAdd && user?.role === 'admin' && (
        <EventFormModal
          event={editEvent}
          centerId={selectedCenter?.id}
          defaultDay={selectedDay ? dayStr(selectedDay) : ''}
          API={API}
          onClose={() => { setShowAdd(false); setEditEvent(null) }}
          onSaved={ev => {
            if (editEvent) {
              setEvents(prev => prev.map(e => e.id === ev.id ? ev : e))
            } else {
              setEvents(prev => [...prev, ev])
            }
            setShowAdd(false)
            setEditEvent(null)
          }}
        />
      )}
    </div>
  )
}

// ── Event Detail Modal ─────────────────────────────────────────────────────────

function EventDetailModal({ event: ev, user, API, onClose, onEdit, onDelete }) {
  const cat = CATEGORIES[ev.category] || CATEGORIES.management

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
        {/* Color header bar */}
        <div style={{ height: 6, background: cat.dot, borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0' }} />

        <div className="modal-header" style={{ paddingTop: '1.25rem' }}>
          <div style={{ flex: 1, minWidth: 0, paddingRight: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.375rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, background: cat.bg, color: cat.color, padding: '0.2rem 0.625rem', borderRadius: 999, border: `1px solid ${cat.dot}` }}>
                {cat.label}
              </span>
            </div>
            <h2 style={{ fontSize: '1.25rem', lineHeight: 1.3 }}>{ev.title}</h2>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="modal-body" style={{ paddingTop: '0.875rem' }}>
          {/* Date & Time */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.875rem' }}>
            <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', background: 'var(--plum-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Calendar size={15} style={{ color: 'var(--plum)' }} />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text)' }}>
                {formatDateLong(ev.start_date)}
                {ev.end_date && ev.end_date !== ev.start_date && ` – ${formatDateLong(ev.end_date)}`}
              </div>
              {ev.start_time && (
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.125rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <Clock size={12} />
                  {formatTime(ev.start_time)}{ev.end_time ? ` – ${formatTime(ev.end_time)}` : ''}
                </div>
              )}
              {!ev.start_time && <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>All day</div>}
            </div>
          </div>

          {/* Location */}
          {ev.location && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.875rem' }}>
              <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <MapPin size={15} style={{ color: '#10B981' }} />
              </div>
              <div style={{ paddingTop: '0.4rem', fontSize: '0.9rem', color: 'var(--text)' }}>{ev.location}</div>
            </div>
          )}

          {/* Description */}
          {ev.description && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.875rem' }}>
              <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <AlignLeft size={15} style={{ color: 'var(--text-muted)' }} />
              </div>
              <div style={{ paddingTop: '0.375rem', fontSize: '0.9rem', color: 'var(--text)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{ev.description}</div>
            </div>
          )}
        </div>

        {user?.role === 'admin' && (
          <div className="modal-footer">
            <button className="btn btn-danger btn-sm" onClick={() => onDelete(ev.id)}>
              <Trash2 size={14} /> Delete
            </button>
            <div style={{ flex: 1 }} />
            <button className="btn btn-secondary" onClick={onClose}>Close</button>
            <button className="btn btn-primary" onClick={() => onEdit(ev)}>
              <Edit2 size={14} /> Edit Event
            </button>
          </div>
        )}
        {user?.role !== 'admin' && (
          <div className="modal-footer">
            <button className="btn btn-primary" onClick={onClose}>Close</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Event Form Modal (Add / Edit) ─────────────────────────────────────────────

function EventFormModal({ event, centerId, defaultDay, API, onClose, onSaved }) {
  const isEdit = !!event
  const [form, setForm] = useState({
    title: event?.title || '',
    description: event?.description || '',
    location: event?.location || '',
    start_date: event?.start_date || defaultDay,
    end_date: event?.end_date || '',
    start_time: event?.start_time || '',
    end_time: event?.end_time || '',
    category: event?.category || 'management',
    all_day: event ? (event.all_day ? '1' : '0') : '1',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload = {
        ...form,
        all_day: form.start_time ? 0 : 1,
        end_date: form.end_date || null,
        start_time: form.start_time || null,
        end_time: form.end_time || null,
        location: form.location || null,
        description: form.description || null,
      }
      const url = isEdit ? `${API}/calendar/${event.id}` : `${API}/centers/${centerId}/calendar`
      const method = isEdit ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify(payload),
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
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <div className="modal-header">
          <h2>{isEdit ? 'Edit Event' : 'Add Calendar Event'}</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && (
              <div style={{ background: '#FFF1F2', borderLeft: '4px solid #F43F5E', color: '#BE123C', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', fontSize: '0.875rem' }}>
                {error}
              </div>
            )}

            <div className="field">
              <label>Event Title</label>
              <input value={form.title} onChange={set('title')} placeholder="e.g. Spring Picture Day" required autoFocus />
            </div>

            {/* Category */}
            <div className="field">
              <label>Category</label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {Object.entries(CATEGORIES).map(([key, cat]) => (
                  <label key={key} style={{
                    display: 'flex', alignItems: 'center', gap: '0.375rem',
                    padding: '0.375rem 0.875rem', borderRadius: 999, cursor: 'pointer',
                    border: `1.5px solid ${form.category === key ? cat.dot : 'var(--border)'}`,
                    background: form.category === key ? cat.bg : 'var(--white)',
                    color: form.category === key ? cat.color : 'var(--text-muted)',
                    fontSize: '0.8125rem', fontWeight: form.category === key ? 700 : 400,
                    transition: 'all 0.15s',
                  }}>
                    <input type="radio" name="category" value={key} checked={form.category === key} onChange={set('category')} style={{ display: 'none' }} />
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: cat.dot, display: 'inline-block' }} />
                    {cat.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Dates */}
            <div className="grid-2">
              <div className="field">
                <label>Start Date</label>
                <input type="date" value={form.start_date} onChange={set('start_date')} required />
              </div>
              <div className="field">
                <label>End Date <span style={{ fontWeight: 400, opacity: 0.6 }}>(optional)</span></label>
                <input type="date" value={form.end_date} onChange={set('end_date')} min={form.start_date} />
              </div>
              <div className="field">
                <label>Start Time <span style={{ fontWeight: 400, opacity: 0.6 }}>(optional)</span></label>
                <input type="time" value={form.start_time} onChange={set('start_time')} />
              </div>
              <div className="field">
                <label>End Time <span style={{ fontWeight: 400, opacity: 0.6 }}>(optional)</span></label>
                <input type="time" value={form.end_time} onChange={set('end_time')} />
              </div>
            </div>

            {/* Location */}
            <div className="field">
              <label>Location <span style={{ fontWeight: 400, opacity: 0.6 }}>(optional)</span></label>
              <input value={form.location} onChange={set('location')} placeholder="e.g. Main Conference Room, 123 Elm St" />
            </div>

            {/* Description */}
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Description <span style={{ fontWeight: 400, opacity: 0.6 }}>(optional)</span></label>
              <textarea value={form.description} onChange={set('description')} placeholder="Additional details, instructions, or notes…" rows={3} />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
