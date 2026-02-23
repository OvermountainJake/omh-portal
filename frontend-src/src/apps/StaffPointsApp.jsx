import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { Star, Plus, X, TrendingUp, TrendingDown, Minus, Info } from 'lucide-react'

const POINT_TYPES = [
  { value: 'call_out', label: 'Call Out', points: -2, direction: -1 },
  { value: 'late_arrival', label: 'Late Arrival', points: -1, direction: -1 },
  { value: 'early_departure', label: 'Early Departure', points: -1, direction: -1 },
  { value: 'policy_violation', label: 'Policy Violation', points: -3, direction: -1 },
  { value: 'bonus_achievement', label: 'Bonus Achievement', points: 2, direction: 1 },
  { value: 'positive_recognition', label: 'Positive Recognition', points: 1, direction: 1 },
  { value: 'perfect_attendance', label: 'Perfect Attendance (Month)', points: 3, direction: 1 },
  { value: 'other_deduction', label: 'Other (Deduction)', points: -1, direction: -1 },
  { value: 'other_addition', label: 'Other (Addition)', points: 1, direction: 1 },
]

function ScorePill({ total }) {
  const color = total >= 5 ? '#22C55E' : total >= 0 ? '#6366F1' : total >= -5 ? '#F59E0B' : '#EF4444'
  const bg = total >= 5 ? '#ECFDF5' : total >= 0 ? '#EEF2FF' : total >= -5 ? '#FFFBEB' : '#FEF2F2'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', fontWeight: 700, background: bg, color, padding: '0.25rem 0.625rem', borderRadius: 999 }}>
      <Star size={11} fill={color} />
      {total > 0 ? '+' : ''}{total} pts
    </span>
  )
}

export default function StaffPointsApp() {
  const { user, API } = useAuth()
  const center = user?.centers?.[0]
  const [staff, setStaff] = useState([])
  const [points, setPoints] = useState({}) // staff_id → { total, history }
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null) // selected staff member
  const [showAdd, setShowAdd] = useState(false)

  useEffect(() => {
    fetch(`${API}/staff`, { credentials: 'include' })
      .then(r => r.json())
      .then(async (list) => {
        const active = Array.isArray(list) ? list.filter(s => s.status === 'active') : []
        setStaff(active)
        // Load points for all staff
        const results = await Promise.all(active.map(s =>
          fetch(`${API}/staff/${s.id}/points`, { credentials: 'include' }).then(r => r.json()).catch(() => ({ total: 0, history: [] }))
        ))
        const map = {}
        active.forEach((s, i) => { map[s.id] = results[i] })
        setPoints(map)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [API])

  const refreshPoints = (staffId) => {
    fetch(`${API}/staff/${staffId}/points`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => setPoints(p => ({ ...p, [staffId]: d })))
  }

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><div className="spinner" /></div>

  const selectedData = selected ? points[selected.id] : null

  return (
    <div style={{ display: 'flex', gap: '1.5rem', minHeight: 600 }}>
      {/* Staff list */}
      <div style={{ flex: '0 0 340px' }}>
        <div className="page-header" style={{ marginBottom: '1rem' }}>
          <h1>Staff Points</h1>
          <p>Performance tracking for discretionary compensation.</p>
        </div>

        <div style={{ background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 'var(--radius-sm)', padding: '0.625rem 0.875rem', marginBottom: '1rem', fontSize: '0.8rem', color: '#92400E', display: 'flex', gap: '0.5rem' }}>
          <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          Point categories will be finalized once full rules are received. Current categories are placeholders.
        </div>

        {staff.length === 0 ? (
          <div className="card empty-state">
            <Star size={32} />
            <h3>No active staff</h3>
            <p>Add staff in Employee Directory first.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {staff.map(s => {
              const pd = points[s.id] || { total: 0, history: [] }
              const isSelected = selected?.id === s.id
              return (
                <button
                  key={s.id}
                  onClick={() => setSelected(s)}
                  className="card"
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.875rem',
                    padding: '0.875rem 1rem', border: isSelected ? '2px solid var(--plum)' : '1px solid var(--border)',
                    background: isSelected ? 'var(--plum-bg)' : 'white',
                    cursor: 'pointer', textAlign: 'left', width: '100%',
                  }}
                >
                  <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--plum-bg)', color: 'var(--plum)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.875rem', flexShrink: 0 }}>
                    {s.name.split(' ').map(n => n[0]).join('').slice(0,2)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text)' }}>{s.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{s.title || 'Staff'}</div>
                  </div>
                  <ScorePill total={pd.total} />
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Detail panel */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {!selected ? (
          <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 400, color: 'var(--text-muted)', flexDirection: 'column', gap: '1rem' }}>
            <Star size={40} strokeWidth={1.5} />
            <p style={{ fontSize: '0.9375rem' }}>Select a staff member to view their points</p>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.25rem' }}>{selected.name}</h2>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{selected.title || 'Staff'}</div>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Current Total</div>
                  <ScorePill total={selectedData?.total || 0} />
                </div>
                <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
                  <Plus size={16} /> Record Points
                </button>
              </div>
            </div>

            {/* Point history */}
            {!selectedData?.history?.length ? (
              <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                <Star size={32} strokeWidth={1.5} style={{ margin: '0 auto 0.75rem', display: 'block', opacity: 0.3 }} />
                <p>No point entries yet for {selected.name}.</p>
                <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => setShowAdd(true)}>
                  <Plus size={16} /> Record First Entry
                </button>
              </div>
            ) : (
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '0.875rem 1.25rem', borderBottom: '1px solid var(--border)', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  {selectedData.history.length} {selectedData.history.length === 1 ? 'entry' : 'entries'}
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
                      {['Date', 'Type', 'Points', 'Notes', 'Recorded By', ''].map(h => (
                        <th key={h} style={{ padding: '0.625rem 1rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {selectedData.history.map((entry, i) => {
                      const typeInfo = POINT_TYPES.find(t => t.value === entry.type)
                      return (
                        <tr key={entry.id} style={{ borderBottom: i < selectedData.history.length - 1 ? '1px solid var(--border)' : 'none' }}>
                          <td style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{entry.event_date || entry.created_at?.split('T')[0]}</td>
                          <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', fontWeight: 500 }}>{typeInfo?.label || entry.type}</td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.875rem', fontWeight: 700, color: entry.points > 0 ? '#22C55E' : '#EF4444' }}>
                              {entry.points > 0 ? <TrendingUp size={14} /> : entry.points < 0 ? <TrendingDown size={14} /> : <Minus size={14} />}
                              {entry.points > 0 ? '+' : ''}{entry.points}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{entry.notes || '—'}</td>
                          <td style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{entry.recorded_by_name || '—'}</td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            {user?.role === 'admin' && (
                              <DeletePointBtn id={entry.id} API={API} onDeleted={() => refreshPoints(selected.id)} />
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {showAdd && selected && (
        <AddPointsModal
          staff={selected}
          API={API}
          onSaved={() => { setShowAdd(false); refreshPoints(selected.id) }}
          onClose={() => setShowAdd(false)}
        />
      )}
    </div>
  )
}

function DeletePointBtn({ id, API, onDeleted }) {
  const [loading, setLoading] = useState(false)
  const handleDelete = async () => {
    if (!confirm('Remove this point entry?')) return
    setLoading(true)
    await fetch(`${API}/points/${id}`, { method: 'DELETE', credentials: 'include' })
    onDeleted()
  }
  return (
    <button className="btn btn-danger btn-sm" onClick={handleDelete} disabled={loading}>
      <X size={13} />
    </button>
  )
}

function AddPointsModal({ staff, API, onSaved, onClose }) {
  const defaultType = POINT_TYPES[0]
  const [form, setForm] = useState({
    type: defaultType.value,
    points: defaultType.points,
    notes: '',
    event_date: new Date().toISOString().split('T')[0],
  })
  const [saving, setSaving] = useState(false)
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleTypeChange = (e) => {
    const t = POINT_TYPES.find(x => x.value === e.target.value)
    setForm(f => ({ ...f, type: e.target.value, points: t ? t.points : f.points }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    await fetch(`${API}/staff/${staff.id}/points`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ ...form, points: parseInt(form.points) }),
    })
    onSaved()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>Record Points</h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{staff.name}</p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="field">
              <label>Type *</label>
              <select value={form.type} onChange={handleTypeChange} autoFocus>
                {POINT_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label} ({t.points > 0 ? '+' : ''}{t.points} pts)</option>
                ))}
              </select>
            </div>
            <div className="grid-2">
              <div className="field">
                <label>Points (+ or –) *</label>
                <input type="number" value={form.points} onChange={set('points')} required />
              </div>
              <div className="field">
                <label>Date</label>
                <input type="date" value={form.event_date} onChange={set('event_date')} />
              </div>
            </div>
            <div className="field">
              <label>Notes</label>
              <textarea value={form.notes} onChange={set('notes')} rows={2} placeholder="Optional context…" />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Record Entry'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
