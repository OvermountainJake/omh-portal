import { useState, useEffect } from 'react'
import { TrendingUp, Search, MapPin, Star, DollarSign, Plus, X, RefreshCw } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const AGE_GROUPS = ['Infant (0–1)', 'Toddler (1–2)', 'Young Toddler (2–3)', 'Preschool (3–4)', 'Pre-K (4–5)', 'School Age']
const WI_YOUNGSTAR_RATINGS = [1, 2, 3, 4, 5]

export default function CompetitiveApp() {
  const { user, API } = useAuth()
  const center = user?.centers?.[0]
  const [competitors, setCompetitors] = useState([])
  const [showAdd, setShowAdd] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API}/competitors?center_id=${center?.id || ''}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then(d => { setCompetitors(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [center, API])

  const ours = competitors.find(c => c.is_ours)
  const others = competitors.filter(c => !c.is_ours)

  // Compute averages per age group
  const avgByAge = {}
  AGE_GROUPS.forEach(age => {
    const vals = competitors.map(c => c.rates?.[age]).filter(v => v > 0)
    if (vals.length) avgByAge[age] = (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(0)
  })

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1>Competitive Analysis</h1>
          <p>Compare your rates to local daycares within a 30-mile radius.</p>
        </div>
        {user?.role === 'admin' && (
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
            <Plus size={16} /> Add Competitor
          </button>
        )}
      </div>

      {/* Auto-discover notice */}
      <div style={{ background: 'var(--plum-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '0.875rem 1.125rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
        <MapPin size={18} style={{ color: 'var(--plum)', flexShrink: 0, marginTop: '0.125rem' }} />
        <div>
          <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--plum-dark)', marginBottom: '0.25rem' }}>
            Auto-discovery requires a Google Maps API key
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            6 Appleton-area competitors are pre-loaded. Once you send Jake a Google Maps API key (free from console.cloud.google.com), this will automatically find all daycares within any radius and keep the list current.
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><div className="spinner" /></div>
      ) : competitors.length === 0 ? (
        <EmptyState onAdd={() => setShowAdd(true)} isAdmin={user?.role === 'admin'} />
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid-3" style={{ marginBottom: '1.5rem' }}>
            <StatCard icon={<TrendingUp size={20} />} label="Competitors Tracked" value={others.length} color="var(--plum)" />
            <StatCard
              icon={<DollarSign size={20} />}
              label="Your Avg vs Market Avg"
              value={ours ? computeAvgRate(ours) > 0 ? `$${computeAvgRate(ours).toFixed(0)}/wk` : '—' : '—'}
              sub={Object.keys(avgByAge).length > 0 ? `Market avg: $${(Object.values(avgByAge).reduce((a,b)=>a+parseFloat(b),0)/Object.values(avgByAge).length).toFixed(0)}/wk` : null}
              color="var(--sage)"
            />
            <StatCard icon={<Star size={20} />} label="Your YoungStar Rating" value={ours?.youngstar_rating ? `${ours.youngstar_rating} ★` : '—'} color="var(--gold)" />
          </div>

          {/* Rate comparison table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: '1.5rem' }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <TrendingUp size={18} color="var(--plum)" />
              <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>Weekly Rate Comparison</h2>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
                    <th style={thStyle}>Center</th>
                    <th style={thStyle}>Location</th>
                    {center?.state === 'WI' && <th style={thStyle}>YoungStar</th>}
                    {AGE_GROUPS.map(a => <th key={a} style={thStyle}>{a}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {competitors.sort((a, b) => (b.is_ours ? 1 : 0) - (a.is_ours ? 1 : 0)).map((comp, i) => (
                    <tr key={comp.id} style={{
                      borderBottom: i < competitors.length - 1 ? '1px solid var(--border)' : 'none',
                      background: comp.is_ours ? 'var(--plum-bg)' : 'white',
                    }}>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: comp.is_ours ? 700 : 500, fontSize: '0.875rem' }}>
                        {comp.name}
                        {comp.is_ours && <span style={{ marginLeft: '0.5rem', fontSize: '0.6875rem', fontWeight: 700, color: 'var(--plum)', background: 'white', padding: '0.125rem 0.375rem', borderRadius: 999 }}>US</span>}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{comp.city}, {comp.state}</td>
                      {center?.state === 'WI' && (
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                          {comp.youngstar_rating ? `${'★'.repeat(comp.youngstar_rating)}${'☆'.repeat(5 - comp.youngstar_rating)}` : '—'}
                        </td>
                      )}
                      {AGE_GROUPS.map(age => {
                        const rate = comp.rates?.[age]
                        const avg = avgByAge[age]
                        const isLow = rate && avg && rate < parseFloat(avg)
                        const isHigh = rate && avg && rate > parseFloat(avg)
                        return (
                          <td key={age} style={{ padding: '0.75rem 1rem', textAlign: 'center', fontSize: '0.875rem', fontWeight: rate ? 500 : 400, color: rate ? (isLow ? '#B45309' : isHigh ? '#3D6B40' : 'var(--text)') : 'var(--text-light)' }}>
                            {rate ? `$${rate}` : '—'}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                  {/* Market average row */}
                  <tr style={{ background: 'var(--surface)', borderTop: '2px solid var(--border)' }}>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-muted)' }} colSpan={center?.state === 'WI' ? 3 : 2}>Market Average</td>
                    {AGE_GROUPS.map(age => (
                      <td key={age} style={{ padding: '0.75rem 1rem', textAlign: 'center', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                        {avgByAge[age] ? `$${avgByAge[age]}` : '—'}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {showAdd && (
        <AddCompetitorModal center={center} API={API}
          onClose={() => setShowAdd(false)}
          onSaved={c => { setCompetitors(prev => [...prev, c]); setShowAdd(false) }}
        />
      )}
    </div>
  )
}

const thStyle = { padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }

function computeAvgRate(comp) {
  const vals = AGE_GROUPS.map(a => comp.rates?.[a]).filter(v => v > 0)
  if (!vals.length) return 0
  return vals.reduce((a, b) => a + b, 0) / vals.length
}

function StatCard({ icon, label, value, sub, color }) {
  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem' }}>
        <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-sm)', background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0 }}>
          {icon}
        </div>
        <div>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.25rem' }}>{label}</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>{value}</div>
          {sub && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{sub}</div>}
        </div>
      </div>
    </div>
  )
}

function EmptyState({ onAdd, isAdmin }) {
  return (
    <div className="card empty-state">
      <TrendingUp size={40} style={{ color: 'var(--plum-light)', opacity: 0.5 }} />
      <h3>No competitors tracked yet</h3>
      <p>Add your center and nearby competitors to start comparing rates and YoungStar ratings.</p>
      {isAdmin && <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={onAdd}><Plus size={16} /> Add First Center</button>}
    </div>
  )
}

function AddCompetitorModal({ center, API, onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', city: center?.city || '', state: center?.state || 'WI', is_ours: false, youngstar_rating: '', rates: {} })
  const [saving, setSaving] = useState(false)
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))
  const setRate = age => e => setForm(f => ({ ...f, rates: { ...f.rates, [age]: e.target.value ? parseFloat(e.target.value) : undefined } }))

  async function handleSubmit(e) {
    e.preventDefault(); setSaving(true)
    const res = await fetch(`${API}/competitors`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ ...form, center_id: center?.id }),
    })
    const data = await res.json()
    if (res.ok) onSaved(data); else alert(data.error || 'Error saving')
    setSaving(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header"><h2>Add Center / Competitor</h2><button className="btn btn-ghost btn-sm" onClick={onClose}><X size={16} /></button></div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="field"><label>Center Name</label><input value={form.name} onChange={set('name')} placeholder="e.g. Sunshine Academy" required autoFocus /></div>
            <div className="grid-2">
              <div className="field"><label>City</label><input value={form.city} onChange={set('city')} placeholder="Appleton" /></div>
              <div className="field"><label>State</label>
                <select value={form.state} onChange={set('state')}>
                  {['WI','IL','MN','IA','IN','MO','MI','OH'].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="grid-2">
              <div className="field">
                <label>YoungStar Rating (WI only)</label>
                <select value={form.youngstar_rating} onChange={set('youngstar_rating')}>
                  <option value="">Not rated / N/A</option>
                  {[1,2,3,4,5].map(r => <option key={r} value={r}>{r} ★</option>)}
                </select>
              </div>
              <div className="field" style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '1.25rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 400, fontSize: '0.9rem', color: 'var(--text)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.is_ours} onChange={set('is_ours')} style={{ accentColor: 'var(--plum)', width: 16, height: 16 }} />
                  This is our center
                </label>
              </div>
            </div>

            <div style={{ marginTop: '0.5rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.75rem' }}>Weekly Rates by Age Group</div>
              <div className="grid-2">
                {AGE_GROUPS.map(age => (
                  <div key={age} className="field" style={{ marginBottom: '0.875rem' }}>
                    <label>{age}</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>$</span>
                      <input type="number" min="0" step="1" value={form.rates[age] || ''} onChange={setRate(age)} placeholder="—" />
                      <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>/week</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Add Center'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
