import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { Plus, DollarSign, TrendingUp, TrendingDown, X, Edit2, Trash2 } from 'lucide-react'

function fmt(n) { return Number(n || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }) }
function pct(a, b) { if (!b) return '—'; return `${((a / b) * 100).toFixed(1)}%` }

export default function FinancialsApp() {
  const { user, API } = useAuth()
  const center = user?.centers?.[0]
  const [snapshots, setSnapshots] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState(null)

  useEffect(() => {
    if (!center) return
    fetch(`${API}/centers/${center.id}/financials`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => { setSnapshots(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [center, API])

  const handleDelete = async (id) => {
    if (!confirm('Delete this financial snapshot?')) return
    await fetch(`${API}/financials/${id}`, { method: 'DELETE', credentials: 'include' })
    setSnapshots(s => s.filter(x => x.id !== id))
  }

  // Summary of most recent period
  const latest = snapshots[0]
  const netIncome = latest ? (latest.revenue - latest.expenses) : 0

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1>Financial Performance</h1>
          <p>Revenue, expenses, and profitability — manual entry now, Intuit Enterprise Suite sync coming.</p>
        </div>
        {user?.role === 'admin' && (
          <button className="btn btn-primary" onClick={() => { setEditing(null); setShowAdd(true) }}>
            <Plus size={16} /> Add Period
          </button>
        )}
      </div>

      {/* IES notice */}
      <div style={{ background: 'var(--plum-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '0.875rem 1.125rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
        <DollarSign size={18} style={{ color: 'var(--plum)', flexShrink: 0, marginTop: '0.125rem' }} />
        <div>
          <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--plum-dark)', marginBottom: '0.25rem' }}>Intuit Enterprise Suite Integration Coming Soon</div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Financial data will sync automatically once IES API credentials are configured. Add periods manually in the meantime.</div>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><div className="spinner" /></div>
      ) : snapshots.length === 0 ? (
        <div className="card empty-state">
          <DollarSign size={36} />
          <h3>No financial data yet</h3>
          <p>Add your first period to start tracking revenue and expenses.</p>
          {user?.role === 'admin' && <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => setShowAdd(true)}><Plus size={16} /> Add Period</button>}
        </div>
      ) : (
        <>
          {/* Summary cards — most recent period */}
          {latest && (
            <div className="grid-3" style={{ marginBottom: '1.5rem' }}>
              <SummaryCard label="Revenue" value={fmt(latest.revenue)} icon={<TrendingUp size={20} />} color="var(--sage)" sub={latest.period_label} />
              <SummaryCard label="Expenses" value={fmt(latest.expenses)} icon={<TrendingDown size={20} />} color="#EF4444" sub={`Payroll: ${fmt(latest.payroll)}`} />
              <SummaryCard
                label="Net Income" value={fmt(netIncome)} icon={<DollarSign size={20} />}
                color={netIncome >= 0 ? 'var(--sage)' : '#EF4444'}
                sub={`Margin: ${pct(netIncome, latest.revenue)}`}
              />
            </div>
          )}

          {/* Periods table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
                  {['Period','Revenue','Payroll','Food','Supplies','Util.','Other Exp.','Total Exp.','Net',''].map(h => (
                    <th key={h} style={{ padding: '0.75rem 0.875rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {snapshots.map((snap, i) => {
                  const net = snap.revenue - snap.expenses
                  return (
                    <tr key={snap.id} style={{ borderBottom: i < snapshots.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <td style={{ padding: '0.75rem 0.875rem', fontWeight: 500, fontSize: '0.875rem', whiteSpace: 'nowrap' }}>
                        <div>{snap.period_label}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{snap.period_start} – {snap.period_end}</div>
                      </td>
                      <td style={{ padding: '0.75rem 0.875rem', fontSize: '0.875rem', fontWeight: 600, color: 'var(--sage)' }}>{fmt(snap.revenue)}</td>
                      <td style={{ padding: '0.75rem 0.875rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{fmt(snap.payroll)}</td>
                      <td style={{ padding: '0.75rem 0.875rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{fmt(snap.food_costs)}</td>
                      <td style={{ padding: '0.75rem 0.875rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{fmt(snap.supplies)}</td>
                      <td style={{ padding: '0.75rem 0.875rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{fmt(snap.utilities)}</td>
                      <td style={{ padding: '0.75rem 0.875rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{fmt(snap.other_exp)}</td>
                      <td style={{ padding: '0.75rem 0.875rem', fontSize: '0.8125rem', fontWeight: 500 }}>{fmt(snap.expenses)}</td>
                      <td style={{ padding: '0.75rem 0.875rem', fontSize: '0.875rem', fontWeight: 700, color: net >= 0 ? 'var(--sage)' : '#B91C1C' }}>{fmt(net)}</td>
                      <td style={{ padding: '0.75rem 0.875rem' }}>
                        {user?.role === 'admin' && (
                          <div style={{ display: 'flex', gap: '0.25rem' }}>
                            <button className="btn btn-ghost btn-sm" onClick={() => { setEditing(snap); setShowAdd(true) }}><Edit2 size={13} /></button>
                            <button className="btn btn-danger btn-sm" onClick={() => handleDelete(snap.id)}><Trash2 size={13} /></button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {showAdd && (
        <FinancialModal snap={editing} center={center} API={API}
          onClose={() => { setShowAdd(false); setEditing(null) }}
          onSaved={snap => {
            if (editing) setSnapshots(s => s.map(x => x.id === snap.id ? snap : x))
            else setSnapshots(s => [snap, ...s])
            setShowAdd(false); setEditing(null)
          }}
        />
      )}
    </div>
  )
}

function SummaryCard({ label, value, icon, color, sub }) {
  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem' }}>
        <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-sm)', background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0 }}>{icon}</div>
        <div>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.25rem' }}>{label}</div>
          <div style={{ fontSize: '1.375rem', fontWeight: 700, color: 'var(--text)' }}>{value}</div>
          {sub && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>{sub}</div>}
        </div>
      </div>
    </div>
  )
}

function FinancialModal({ snap, center, API, onClose, onSaved }) {
  const isEdit = !!snap
  const [form, setForm] = useState({
    period_label: snap?.period_label || '', period_start: snap?.period_start || '', period_end: snap?.period_end || '',
    revenue: snap?.revenue || '', payroll: snap?.payroll || '', food_costs: snap?.food_costs || '',
    supplies: snap?.supplies || '', utilities: snap?.utilities || '', other_exp: snap?.other_exp || '',
    expenses: snap?.expenses || '', notes: snap?.notes || '',
  })
  const [saving, setSaving] = useState(false)
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  // Auto-compute total expenses
  const totalExp = ['payroll','food_costs','supplies','utilities','other_exp'].reduce((sum, k) => sum + (parseFloat(form[k])||0), 0)

  async function handleSubmit(e) {
    e.preventDefault(); setSaving(true)
    const payload = { ...form, expenses: totalExp }
    const url = isEdit ? `${API}/financials/${snap.id}` : `${API}/centers/${center.id}/financials`
    const res = await fetch(url, { method: isEdit ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(payload) })
    const data = await res.json()
    if (res.ok) onSaved(isEdit ? { ...snap, ...payload } : data); else { alert(data.error); setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header"><h2>{isEdit ? 'Edit Financial Period' : 'Add Financial Period'}</h2><button className="btn btn-ghost btn-sm" onClick={onClose}><X size={16} /></button></div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="field"><label>Period Label</label><input value={form.period_label} onChange={set('period_label')} placeholder="e.g. January 2026" required autoFocus /></div>
            <div className="grid-2">
              <div className="field"><label>Period Start</label><input type="date" value={form.period_start} onChange={set('period_start')} required /></div>
              <div className="field"><label>Period End</label><input type="date" value={form.period_end} onChange={set('period_end')} /></div>
            </div>

            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0.5rem 0 0.75rem' }}>Revenue</div>
            <div className="field"><label>Total Revenue ($)</label><input type="number" step="0.01" min="0" value={form.revenue} onChange={set('revenue')} placeholder="0.00" /></div>

            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0.5rem 0 0.75rem' }}>Expenses</div>
            <div className="grid-2">
              {[['payroll','Payroll'],['food_costs','Food Costs'],['supplies','Supplies'],['utilities','Utilities'],['other_exp','Other Expenses']].map(([k, label]) => (
                <div key={k} className="field">
                  <label>{label} ($)</label>
                  <input type="number" step="0.01" min="0" value={form[k]} onChange={set(k)} placeholder="0.00" />
                </div>
              ))}
            </div>
            <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-sm)', padding: '0.75rem 1rem', fontSize: '0.875rem', fontWeight: 600 }}>
              Total Expenses: {fmt(totalExp)} &nbsp;|&nbsp; Net Income: <span style={{ color: (parseFloat(form.revenue)||0) - totalExp >= 0 ? 'var(--sage)' : '#B91C1C' }}>{fmt((parseFloat(form.revenue)||0) - totalExp)}</span>
            </div>

            <div className="field" style={{ marginTop: '1rem' }}><label>Notes</label><textarea value={form.notes} onChange={set('notes')} rows={2} /></div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Period'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
