import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { ChevronLeft, ChevronRight, Plus, X, Trash2, Users } from 'lucide-react'

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday']
const HOURS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2,'0')}:00`)
const COLOR_POOL = ['#6B3F7C','#7A9E7E','#C9A84C','#6366F1','#EC4899','#0EA5E9','#F97316','#14B8A6']

function getWeekStart(date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Monday
  d.setDate(diff)
  return d.toISOString().slice(0, 10)
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

function formatDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function StaffingApp() {
  const { user, API } = useAuth()
  const center = user?.centers?.[0]
  const [weekStart, setWeekStart] = useState(getWeekStart(new Date()))
  const [shifts, setShifts] = useState([])
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [defaultDay, setDefaultDay] = useState(null)

  useEffect(() => {
    if (!center) return
    setLoading(true)
    Promise.all([
      fetch(`${API}/centers/${center.id}/schedule?week_start=${weekStart}`, { credentials: 'include' }).then(r => r.json()),
      fetch(`${API}/staff?center_id=${center.id}`, { credentials: 'include' }).then(r => r.json()),
    ]).then(([s, st]) => {
      setShifts(Array.isArray(s) ? s : [])
      setStaff((Array.isArray(st) ? st : []).filter(x => x.status === 'active'))
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [center, API, weekStart])

  const staffColors = {}
  staff.forEach((s, i) => { staffColors[s.id] = COLOR_POOL[i % COLOR_POOL.length] })

  const prevWeek = () => setWeekStart(addDays(weekStart, -7))
  const nextWeek = () => setWeekStart(addDays(weekStart, 7))
  const thisWeek = () => setWeekStart(getWeekStart(new Date()))

  const handleDelete = async (id) => {
    await fetch(`${API}/schedule/${id}`, { method: 'DELETE', credentials: 'include' })
    setShifts(s => s.filter(x => x.id !== id))
  }

  const getShiftsForDay = (dayIdx) => {
    const date = addDays(weekStart, dayIdx)
    return shifts.filter(s => s.shift_date === date).sort((a, b) => a.start_time.localeCompare(b.start_time))
  }

  // Coverage summary per day
  const getDayCoverage = (dayIdx) => {
    const dayShifts = getShiftsForDay(dayIdx)
    return { count: dayShifts.length, staff: [...new Set(dayShifts.map(s => s.staff_id))].length }
  }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1>Staffing Schedule</h1>
          <p>Weekly shift schedule for {center?.name || 'your center'}.</p>
        </div>
        {user?.role === 'admin' && (
          <button className="btn btn-primary" onClick={() => { setDefaultDay(null); setShowAdd(true) }}>
            <Plus size={16} /> Add Shift
          </button>
        )}
      </div>

      {/* Week nav */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <button className="btn btn-secondary btn-sm" onClick={prevWeek}><ChevronLeft size={16} /></button>
        <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>
          Week of {formatDate(weekStart)} – {formatDate(addDays(weekStart, 4))}
        </div>
        <button className="btn btn-secondary btn-sm" onClick={nextWeek}><ChevronRight size={16} /></button>
        <button className="btn btn-ghost btn-sm" onClick={thisWeek} style={{ marginLeft: '0.25rem' }}>Today</button>
      </div>

      {/* Staff legend */}
      {staff.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.25rem' }}>
          {staff.map(s => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: staffColors[s.id], display: 'inline-block', flexShrink: 0 }} />
              {s.name}
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><div className="spinner" /></div>
      ) : staff.length === 0 ? (
        <div className="card empty-state">
          <Users size={36} />
          <h3>No staff added yet</h3>
          <p>Add staff members in the Employee Directory first.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {/* Day headers */}
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${DAYS.length}, 1fr)`, borderBottom: '1px solid var(--border)' }}>
            {DAYS.map((day, i) => {
              const date = addDays(weekStart, i)
              const isToday = date === new Date().toISOString().slice(0,10)
              const cov = getDayCoverage(i)
              return (
                <div
                  key={day}
                  onClick={() => user?.role === 'admin' && (setDefaultDay(date), setShowAdd(true))}
                  style={{
                    padding: '0.875rem 0.75rem',
                    textAlign: 'center',
                    borderRight: i < DAYS.length - 1 ? '1px solid var(--border)' : 'none',
                    background: isToday ? 'var(--plum-bg)' : 'white',
                    cursor: user?.role === 'admin' ? 'pointer' : 'default',
                  }}
                >
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: isToday ? 'var(--plum)' : 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{day.slice(0,3)}</div>
                  <div style={{ fontSize: '1.125rem', fontWeight: 700, color: isToday ? 'var(--plum)' : 'var(--text)', marginTop: '0.125rem' }}>{formatDate(date).split(' ')[1]}</div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--text-light)', marginTop: '0.25rem' }}>{cov.staff} staff</div>
                </div>
              )
            })}
          </div>

          {/* Shifts grid */}
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${DAYS.length}, 1fr)`, minHeight: 300 }}>
            {DAYS.map((day, i) => {
              const dayShifts = getShiftsForDay(i)
              return (
                <div key={day} style={{ borderRight: i < DAYS.length - 1 ? '1px solid var(--border)' : 'none', padding: '0.625rem', minHeight: 120 }}>
                  {dayShifts.length === 0 ? (
                    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {user?.role === 'admin' && (
                        <button className="btn btn-ghost btn-sm" style={{ opacity: 0.4, fontSize: '0.75rem' }}
                          onClick={() => { setDefaultDay(addDays(weekStart, i)); setShowAdd(true) }}>
                          <Plus size={12} /> Add
                        </button>
                      )}
                    </div>
                  ) : (
                    dayShifts.map(shift => (
                      <div key={shift.id} style={{
                        background: `${staffColors[shift.staff_id]}18`,
                        borderLeft: `3px solid ${staffColors[shift.staff_id]}`,
                        borderRadius: 4,
                        padding: '0.375rem 0.5rem',
                        marginBottom: '0.375rem',
                        fontSize: '0.75rem',
                      }}>
                        <div style={{ fontWeight: 600, color: staffColors[shift.staff_id], marginBottom: '0.125rem' }}>{shift.staff_name}</div>
                        <div style={{ color: 'var(--text-muted)' }}>{shift.start_time}–{shift.end_time}</div>
                        {shift.role && <div style={{ color: 'var(--text-muted)', fontSize: '0.6875rem' }}>{shift.role}</div>}
                        {user?.role === 'admin' && (
                          <button onClick={() => handleDelete(shift.id)} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-light)', padding: 0, marginTop: '-1.25rem' }}>
                            <X size={11} />
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {showAdd && (
        <AddShiftModal staff={staff} center={center} defaultDay={defaultDay} API={API}
          onClose={() => { setShowAdd(false); setDefaultDay(null) }}
          onSaved={shift => { setShifts(s => [...s, shift]); setShowAdd(false); setDefaultDay(null) }}
        />
      )}
    </div>
  )
}

function AddShiftModal({ staff, center, defaultDay, API, onClose, onSaved }) {
  const [form, setForm] = useState({ staff_id: '', shift_date: defaultDay || '', start_time: '07:00', end_time: '15:00', role: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault(); setSaving(true)
    const res = await fetch(`${API}/centers/${center.id}/schedule`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(form) })
    const data = await res.json()
    if (res.ok) onSaved(data); else { alert(data.error); setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header"><h2>Add Shift</h2><button className="btn btn-ghost btn-sm" onClick={onClose}><X size={16} /></button></div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="field"><label>Staff Member *</label>
              <select value={form.staff_id} onChange={set('staff_id')} required>
                <option value="">— Select —</option>
                {staff.map(s => <option key={s.id} value={s.id}>{s.name} {s.title ? `(${s.title})` : ''}</option>)}
              </select>
            </div>
            <div className="field"><label>Date *</label><input type="date" value={form.shift_date} onChange={set('shift_date')} required /></div>
            <div className="grid-2">
              <div className="field"><label>Start Time *</label><input type="time" value={form.start_time} onChange={set('start_time')} required /></div>
              <div className="field"><label>End Time *</label><input type="time" value={form.end_time} onChange={set('end_time')} required /></div>
            </div>
            <div className="field"><label>Role (optional)</label><input value={form.role} onChange={set('role')} placeholder="e.g. Infant Room Lead" /></div>
            <div className="field"><label>Notes</label><input value={form.notes} onChange={set('notes')} placeholder="Any notes…" /></div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Add Shift'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
