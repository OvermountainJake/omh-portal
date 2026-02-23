import { useState, useEffect } from 'react'
import { TrendingUp, Search, MapPin, Star, DollarSign, Plus, X, RefreshCw, AlertCircle, CheckCircle, Navigation } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const AGE_GROUPS = ['Infant (0–1)', 'Toddler (1–2)', 'Young Toddler (2–3)', 'Preschool (3–4)', 'Pre-K (4–5)', 'School Age']

export default function CompetitiveApp() {
  const { user, API } = useAuth()
  const center = user?.centers?.[0]
  const [competitors, setCompetitors] = useState([])
  const [showAdd, setShowAdd] = useState(false)
  const [loading, setLoading] = useState(true)
  const [discovering, setDiscovering] = useState(false)
  const [discoveryResults, setDiscoveryResults] = useState(null)
  const [editingRates, setEditingRates] = useState(null)

  const load = () => {
    fetch(`${API}/competitors?center_id=${center?.id || ''}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then(d => { setCompetitors(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [center, API])

  const handleDiscover = async () => {
    setDiscovering(true)
    try {
      const res = await fetch(`${API}/centers/${center.id}/discover-competitors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ radius_miles: 30 }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || 'Discovery failed')
      } else {
        setDiscoveryResults(data)
      }
    } catch (e) {
      alert('Discovery failed: ' + e.message)
    }
    setDiscovering(false)
  }

  const handleAddDiscovered = async (place) => {
    const res = await fetch(`${API}/competitors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        center_id: center.id,
        name: place.name,
        city: place.city,
        state: place.state,
        zip: place.zip,
        is_ours: false,
        rates: {},
        rates_published: 0,
        notes: place.rates_published ? '' : '⚠️ Rates not published — update manually',
      }),
    })
    if (res.ok) {
      const newComp = await res.json()
      setCompetitors(prev => [...prev, { ...newComp, rates_published: 0 }])
      // Mark as already tracked in results
      setDiscoveryResults(d => ({ ...d, results: d.results.map(r => r.place_id === place.place_id ? { ...r, already_tracked: true } : r) }))
    }
  }

  const handleToggleRatesPublished = async (comp) => {
    await fetch(`${API}/competitors/${comp.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ rates_published: !comp.rates_published }),
    })
    setCompetitors(prev => prev.map(c => c.id === comp.id ? { ...c, rates_published: !c.rates_published } : c))
  }

  const ours = competitors.find(c => c.is_ours)
  const others = competitors.filter(c => !c.is_ours)
  const unpublishedCount = others.filter(c => !c.rates_published).length

  const avgByAge = {}
  AGE_GROUPS.forEach(age => {
    const vals = competitors.filter(c => c.rates_published !== false).map(c => c.rates?.[age]).filter(v => v > 0)
    if (vals.length) avgByAge[age] = (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(0)
  })

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1>Competitive Analysis</h1>
          <p>Compare your rates to local daycares within a 30-mile radius.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.625rem' }}>
          {user?.role === 'admin' && (
            <>
              <button
                className="btn btn-secondary"
                onClick={handleDiscover}
                disabled={discovering}
              >
                {discovering ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Searching…</> : <><Navigation size={15} /> Discover Nearby</>}
              </button>
              <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
                <Plus size={16} /> Add Manually
              </button>
            </>
          )}
        </div>
      </div>

      {/* Unpublished rates alert */}
      {unpublishedCount > 0 && (
        <div style={{ background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 'var(--radius-sm)', padding: '0.75rem 1.125rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
          <AlertCircle size={16} style={{ color: '#D97706', flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: '0.8125rem' }}>
            <strong style={{ color: '#92400E' }}>{unpublishedCount} competitor{unpublishedCount > 1 ? 's' : ''} with unpublished rates</strong>
            <span style={{ color: '#92400E' }}> — highlighted below. Directors can update rates manually by clicking the center's name.</span>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><div className="spinner" /></div>
      ) : competitors.length === 0 ? (
        <EmptyState onAdd={() => setShowAdd(true)} onDiscover={handleDiscover} discovering={discovering} isAdmin={user?.role === 'admin'} />
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid-3" style={{ marginBottom: '1.5rem' }}>
            <StatCard icon={<TrendingUp size={20} />} label="Competitors Tracked" value={others.length} color="var(--plum)" />
            <StatCard
              icon={<DollarSign size={20} />}
              label="Your Avg vs Market"
              value={ours && computeAvgRate(ours) > 0 ? `$${computeAvgRate(ours).toFixed(0)}/wk` : '—'}
              sub={Object.keys(avgByAge).length > 0 ? `Market avg: $${(Object.values(avgByAge).reduce((a,b)=>a+parseFloat(b),0)/Object.values(avgByAge).length).toFixed(0)}/wk` : null}
              color="var(--sage)"
            />
            <StatCard icon={<Star size={20} />} label="Your YoungStar Rating" value={ours?.youngstar_rating ? `${ours.youngstar_rating} ★` : '—'} color="#C9A84C" />
          </div>

          {/* Rate comparison table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: '1.5rem' }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <TrendingUp size={18} color="var(--plum)" />
                <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>Weekly Rate Comparison</h2>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Last updated: {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
                    <th style={thStyle}>Center</th>
                    <th style={thStyle}>Location</th>
                    {center?.state === 'WI' && <th style={thStyle}>YoungStar</th>}
                    {AGE_GROUPS.map(a => <th key={a} style={thStyle}>{a}</th>)}
                    {user?.role === 'admin' && <th style={thStyle} />}
                  </tr>
                </thead>
                <tbody>
                  {competitors.sort((a, b) => (b.is_ours ? 1 : 0) - (a.is_ours ? 1 : 0)).map((comp, i) => {
                    const ratesUnpublished = !comp.is_ours && !comp.rates_published
                    return (
                      <tr key={comp.id} style={{
                        borderBottom: i < competitors.length - 1 ? '1px solid var(--border)' : 'none',
                        background: comp.is_ours ? 'var(--plum-bg)' : ratesUnpublished ? '#FFFBEB' : 'white',
                      }}>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: comp.is_ours ? 700 : 500, fontSize: '0.875rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {comp.name}
                            {comp.is_ours && <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--plum)', background: 'white', padding: '0.1rem 0.35rem', borderRadius: 999 }}>US</span>}
                            {ratesUnpublished && (
                              <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#92400E', background: '#FEF3C7', padding: '0.1rem 0.35rem', borderRadius: 999, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                <AlertCircle size={9} /> Rates not published
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{comp.city}, {comp.state}</td>
                        {center?.state === 'WI' && (
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'center', fontSize: '0.875rem' }}>
                            {comp.youngstar_rating ? `${'★'.repeat(comp.youngstar_rating)}${'☆'.repeat(5 - comp.youngstar_rating)}` : '—'}
                          </td>
                        )}
                        {AGE_GROUPS.map(age => {
                          const rate = comp.rates?.[age]
                          const avg = avgByAge[age]
                          const isLow = rate && avg && rate < parseFloat(avg)
                          const isHigh = rate && avg && rate > parseFloat(avg)
                          return (
                            <td key={age} style={{ padding: '0.75rem 1rem', textAlign: 'center', fontSize: '0.875rem', fontWeight: rate ? 500 : 400, color: ratesUnpublished ? 'var(--text-light)' : rate ? (isLow ? '#B45309' : isHigh ? '#3D6B40' : 'var(--text)') : 'var(--text-light)' }}>
                              {ratesUnpublished ? <span style={{ fontSize: '0.75rem', fontStyle: 'italic', color: '#D97706' }}>not published</span> : rate ? `$${rate}` : '—'}
                            </td>
                          )
                        })}
                        {user?.role === 'admin' && (
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end' }}>
                              <button className="btn btn-ghost btn-sm" style={{ fontSize: '0.75rem' }} onClick={() => setEditingRates(comp)}>Edit Rates</button>
                              {!comp.is_ours && (
                                <button
                                  className="btn btn-ghost btn-sm"
                                  style={{ fontSize: '0.75rem', color: ratesUnpublished ? '#D97706' : 'var(--text-muted)' }}
                                  onClick={() => handleToggleRatesPublished(comp)}
                                  title={ratesUnpublished ? 'Mark rates as published' : 'Mark rates as not published'}
                                >
                                  {ratesUnpublished ? '⚠️' : '✓'}
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                  {/* Market average row */}
                  <tr style={{ background: 'var(--surface)', borderTop: '2px solid var(--border)' }}>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-muted)' }} colSpan={center?.state === 'WI' ? 3 : 2}>Market Average</td>
                    {AGE_GROUPS.map(age => (
                      <td key={age} style={{ padding: '0.75rem 1rem', textAlign: 'center', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                        {avgByAge[age] ? `$${avgByAge[age]}` : '—'}
                      </td>
                    ))}
                    {user?.role === 'admin' && <td />}
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

      {editingRates && (
        <EditRatesModal competitor={editingRates} API={API}
          onClose={() => setEditingRates(null)}
          onSaved={() => { setEditingRates(null); load() }}
        />
      )}

      {discoveryResults && (
        <DiscoveryModal
          results={discoveryResults}
          onAdd={handleAddDiscovered}
          onClose={() => setDiscoveryResults(null)}
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
        <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-sm)', background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0 }}>{icon}</div>
        <div>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.25rem' }}>{label}</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>{value}</div>
          {sub && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{sub}</div>}
        </div>
      </div>
    </div>
  )
}

function EmptyState({ onAdd, onDiscover, discovering, isAdmin }) {
  return (
    <div className="card empty-state">
      <TrendingUp size={40} style={{ color: 'var(--plum-light)', opacity: 0.5 }} />
      <h3>No competitors tracked yet</h3>
      <p>Use auto-discovery to find nearby daycares, or add competitors manually.</p>
      {isAdmin && (
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', justifyContent: 'center' }}>
          <button className="btn btn-primary" onClick={onDiscover} disabled={discovering}>
            {discovering ? 'Searching…' : <><Navigation size={15} /> Discover Nearby</>}
          </button>
          <button className="btn btn-secondary" onClick={onAdd}><Plus size={16} /> Add Manually</button>
        </div>
      )}
    </div>
  )
}

// ─── Discovery Results Modal ──────────────────────────────────────────────────

function DiscoveryModal({ results, onAdd, onClose }) {
  const [adding, setAdding] = useState({})

  const handleAdd = async (place) => {
    setAdding(a => ({ ...a, [place.place_id]: true }))
    await onAdd(place)
    setAdding(a => ({ ...a, [place.place_id]: false }))
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 680 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>Discovered Nearby — {results.center_name}</h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Found {results.found} daycares within {results.radius_miles} miles</p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          {results.results.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>No results found. Try expanding the search radius.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              {results.results.map(place => (
                <div key={place.place_id} style={{
                  display: 'flex', alignItems: 'flex-start', gap: '1rem', padding: '0.875rem 1rem',
                  border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                  background: place.already_tracked ? 'var(--surface)' : 'white',
                  opacity: place.already_tracked ? 0.6 : 1,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.2rem' }}>{place.name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                      <MapPin size={11} style={{ display: 'inline', marginRight: 3 }} />{place.address}
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      <span>📍 {place.distance_miles} mi away</span>
                      {place.rating && <span>⭐ {place.rating}</span>}
                      <span style={{ color: '#D97706', fontWeight: 500 }}>⚠️ Rates not published — update manually</span>
                    </div>
                  </div>
                  {place.already_tracked ? (
                    <span style={{ fontSize: '0.8rem', color: 'var(--sage)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
                      <CheckCircle size={14} /> Added
                    </span>
                  ) : (
                    <button
                      className="btn btn-primary btn-sm"
                      style={{ flexShrink: 0 }}
                      onClick={() => handleAdd(place)}
                      disabled={adding[place.place_id]}
                    >
                      {adding[place.place_id] ? 'Adding…' : <><Plus size={13} /> Add</>}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  )
}

// ─── Edit Rates Modal ─────────────────────────────────────────────────────────

function EditRatesModal({ competitor, API, onSaved, onClose }) {
  const [rates, setRates] = useState({ ...competitor.rates })
  const [ratesPublished, setRatesPublished] = useState(!!competitor.rates_published)
  const [saving, setSaving] = useState(false)
  const setRate = age => e => setRates(r => ({ ...r, [age]: e.target.value ? parseFloat(e.target.value) : undefined }))

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true)
    await fetch(`${API}/competitors/${competitor.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ ...competitor, rates, rates_published: ratesPublished }),
    })
    onSaved()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 540 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>Edit Rates — {competitor.name}</h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{competitor.city}, {competitor.state}</p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="field" style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 400 }}>
                <input type="checkbox" checked={ratesPublished} onChange={e => setRatesPublished(e.target.checked)} style={{ width: 16, height: 16 }} />
                Rates are publicly published (on their website)
              </label>
            </div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.75rem' }}>Weekly Rates by Age Group</div>
            <div className="grid-2">
              {AGE_GROUPS.map(age => (
                <div key={age} className="field">
                  <label>{age}</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>$</span>
                    <input type="number" min="0" step="1" value={rates[age] || ''} onChange={setRate(age)} placeholder="—" />
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>/wk</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save Rates'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Add Competitor Modal ─────────────────────────────────────────────────────

function AddCompetitorModal({ center, API, onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', city: center?.city || '', state: center?.state || 'WI', is_ours: false, youngstar_rating: '', rates: {}, rates_published: true })
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
            <div className="field"><label>Center Name *</label><input value={form.name} onChange={set('name')} placeholder="e.g. Sunshine Academy" required autoFocus /></div>
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
              <div className="field" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', justifyContent: 'flex-end', paddingBottom: '1.25rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 400, cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.is_ours} onChange={set('is_ours')} style={{ width: 16, height: 16 }} />
                  This is our center
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 400, cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.rates_published} onChange={set('rates_published')} style={{ width: 16, height: 16 }} />
                  Rates publicly published
                </label>
              </div>
            </div>

            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.75rem' }}>Weekly Rates by Age Group</div>
            <div className="grid-2">
              {AGE_GROUPS.map(age => (
                <div key={age} className="field">
                  <label>{age}</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>$</span>
                    <input type="number" min="0" step="1" value={form.rates[age] || ''} onChange={setRate(age)} placeholder="—" />
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>/wk</span>
                  </div>
                </div>
              ))}
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
