import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { ShieldCheck, CheckCircle, AlertTriangle, XCircle, X, ChevronDown, ChevronUp, Plus, Building2 } from 'lucide-react'

const STATUS_CONFIG = {
  current:  { label: 'Current',  color: '#3D6B40', bg: 'var(--sage-light)', icon: CheckCircle },
  expired:  { label: 'Expired',  color: '#B91C1C', bg: '#FEF2F2', icon: XCircle },
  missing:  { label: 'Missing',  color: '#92400E', bg: '#FEF3C7', icon: AlertTriangle },
}

function daysUntilExpiry(dateStr) {
  if (!dateStr) return null
  const diff = (new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24)
  return Math.ceil(diff)
}

function centerComplianceStatus(item) {
  if (!item.due_date) return 'missing'
  const days = daysUntilExpiry(item.due_date)
  if (days !== null && days < 0) return 'expired'
  return 'current'
}

export default function ComplianceApp() {
  const [activeTab, setActiveTab] = useState('employee')
  return (
    <div>
      <div className="page-header">
        <h1>Compliance</h1>
        <p>Track employee certifications and center licensing requirements.</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '2px solid var(--border)', paddingBottom: '0' }}>
        {[
          { key: 'employee', label: 'Employee Compliance', emoji: '👩‍🏫' },
          { key: 'center', label: 'Center & Licensing Compliance', emoji: '🏛️' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '0.625rem 1.25rem',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab.key ? '2px solid var(--plum)' : '2px solid transparent',
              marginBottom: '-2px',
              fontSize: '0.9rem',
              fontWeight: activeTab === tab.key ? 700 : 500,
              color: activeTab === tab.key ? 'var(--plum)' : 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              transition: 'all 0.15s',
            }}
          >
            <span>{tab.emoji}</span> {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'employee' ? <EmployeeCompliance /> : <CenterCompliance />}
    </div>
  )
}

// ─── Employee Compliance (original, unchanged) ────────────────────────────────

function EmployeeCompliance() {
  const { user, API } = useAuth()
  const center = user?.centers?.[0]
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState({})
  const [editing, setEditing] = useState(null)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    if (!center) return
    fetch(`${API}/compliance/center/${center.id}`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [center, API])

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><div className="spinner" /></div>

  const { matrix = [], requirements = [] } = data || {}
  const allRecords = matrix.flatMap(m => m.compliance)
  const totalCurrent = allRecords.filter(r => r.status === 'current').length
  const totalExpired = allRecords.filter(r => r.status === 'expired').length
  const totalMissing = allRecords.filter(r => r.status === 'missing').length
  const filteredMatrix = filter === 'all' ? matrix : matrix.filter(m =>
    m.compliance.some(c => c.status === filter)
  )

  return (
    <div>
      <div className="grid-3" style={{ marginBottom: '1.5rem' }}>
        <div className="card" style={{ borderLeft: '4px solid var(--sage)', padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--sage)' }}>{totalCurrent}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>Requirements Current</div>
        </div>
        <div className="card" style={{ borderLeft: `4px solid ${totalExpired ? '#B91C1C' : 'var(--border)'}`, padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: totalExpired ? '#B91C1C' : 'var(--text-muted)' }}>{totalExpired}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>Expired</div>
        </div>
        <div className="card" style={{ borderLeft: `4px solid ${totalMissing ? '#D97706' : 'var(--border)'}`, padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: totalMissing ? '#D97706' : 'var(--text-muted)' }}>{totalMissing}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>Missing</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1rem', background: 'var(--border)', borderRadius: 'var(--radius-sm)', padding: '0.25rem', width: 'fit-content' }}>
        {[['all','All Staff'],['missing','Has Missing'],['expired','Has Expired']].map(([val, label]) => (
          <button key={val} onClick={() => setFilter(val)} className="btn"
            style={{ background: filter === val ? 'var(--white)' : 'transparent', color: filter === val ? 'var(--plum)' : 'var(--text-muted)', boxShadow: filter === val ? 'var(--shadow-sm)' : 'none', fontSize: '0.8125rem', padding: '0.375rem 0.875rem' }}>
            {label}
          </button>
        ))}
      </div>

      {matrix.length === 0 ? (
        <div className="card empty-state">
          <ShieldCheck size={40} />
          <h3>No staff added yet</h3>
          <p>Add staff members in the Employee Directory first, then track their compliance here.</p>
        </div>
      ) : (
        filteredMatrix.map(({ staff, compliance }) => {
          const missing = compliance.filter(c => c.status === 'missing').length
          const expired = compliance.filter(c => c.status === 'expired').length
          const isOpen = expanded[staff.id]
          return (
            <div key={staff.id} className="card" style={{ marginBottom: '0.75rem', padding: 0, overflow: 'hidden' }}>
              <button
                onClick={() => setExpanded(e => ({ ...e, [staff.id]: !e[staff.id] }))}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.25rem', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
              >
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--plum-bg)', color: 'var(--plum)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.875rem', flexShrink: 0 }}>
                  {staff.name.split(' ').map(n => n[0]).join('').slice(0,2)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{staff.name}</div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{staff.title || 'Staff'}</div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  {expired > 0 && <span className="badge" style={{ background: '#FEF2F2', color: '#B91C1C' }}>{expired} expired</span>}
                  {missing > 0 && <span className="badge" style={{ background: '#FEF3C7', color: '#92400E' }}>{missing} missing</span>}
                  {expired === 0 && missing === 0 && <span className="badge" style={{ background: 'var(--sage-light)', color: '#3D6B40' }}>✓ All current</span>}
                  {isOpen ? <ChevronUp size={18} color="var(--text-muted)" /> : <ChevronDown size={18} color="var(--text-muted)" />}
                </div>
              </button>
              {isOpen && (
                <div style={{ borderTop: '1px solid var(--border)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'var(--surface)' }}>
                        {['Requirement','Frequency','Status','Completed','Expires',''].map(h => (
                          <th key={h} style={{ padding: '0.625rem 1rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {compliance.map(({ requirement, record, status }) => {
                        const cfg = STATUS_CONFIG[status]
                        const StatusIcon = cfg.icon
                        const days = daysUntilExpiry(record?.expiry_date)
                        return (
                          <tr key={requirement.id} style={{ borderTop: '1px solid var(--border)' }}>
                            <td style={{ padding: '0.75rem 1rem', fontWeight: 500, fontSize: '0.875rem' }}>{requirement.name}</td>
                            <td style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{requirement.recurs === 'once' ? 'One-time' : requirement.recurs}</td>
                            <td style={{ padding: '0.75rem 1rem' }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', fontWeight: 600, background: cfg.bg, color: cfg.color, padding: '0.2rem 0.5rem', borderRadius: 999 }}>
                                <StatusIcon size={11} />{cfg.label}
                              </span>
                            </td>
                            <td style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{record?.completed_date || '—'}</td>
                            <td style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem' }}>
                              {record?.expiry_date ? (
                                <span style={{ color: days !== null && days < 30 ? '#B91C1C' : days !== null && days < 90 ? '#D97706' : 'var(--text-muted)' }}>
                                  {record.expiry_date}
                                  {days !== null && days >= 0 && days < 90 && ` (${days}d)`}
                                </span>
                              ) : '—'}
                            </td>
                            <td style={{ padding: '0.75rem 1rem' }}>
                              {user?.role === 'admin' && (
                                <button className="btn btn-ghost btn-sm" style={{ fontSize: '0.75rem' }}
                                  onClick={() => setEditing({ staff, requirement, record })}>
                                  {record ? 'Update' : 'Add'}
                                </button>
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
          )
        })
      )}

      {editing && (
        <ComplianceModal data={editing} API={API}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            fetch(`${API}/compliance/center/${center.id}`, { credentials: 'include' }).then(r => r.json()).then(setData)
          }}
        />
      )}
    </div>
  )
}

function ComplianceModal({ data: { staff, requirement, record }, API, onClose, onSaved }) {
  const [form, setForm] = useState({ completed_date: record?.completed_date || '', expiry_date: record?.expiry_date || '', notes: record?.notes || '' })
  const [saving, setSaving] = useState(false)
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))
  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true)
    await fetch(`${API}/compliance`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ staff_id: staff.id, requirement_id: requirement.id, ...form }) })
    onSaved()
  }
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div><h2>{requirement.name}</h2><p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{staff.name}</p></div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>{requirement.description}</p>
            <div className="field"><label>Completed Date</label><input type="date" value={form.completed_date} onChange={set('completed_date')} autoFocus /></div>
            <div className="field"><label>Expiry Date</label><input type="date" value={form.expiry_date} onChange={set('expiry_date')} /></div>
            <div className="field"><label>Notes</label><textarea value={form.notes} onChange={set('notes')} rows={2} /></div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Center & Licensing Compliance ────────────────────────────────────────────

function CenterCompliance() {
  const { user, API } = useAuth()
  const center = user?.centers?.[0]
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState(null)

  const load = () => {
    if (!center) return
    fetch(`${API}/centers/${center.id}/center-compliance`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => { setItems(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const handleDelete = async (id) => {
    if (!confirm('Remove this item?')) return
    await fetch(`${API}/center-compliance/${id}`, { method: 'DELETE', credentials: 'include' })
    setItems(i => i.filter(x => x.id !== id))
  }

  const overdue = items.filter(i => centerComplianceStatus(i) === 'expired').length
  const missing = items.filter(i => centerComplianceStatus(i) === 'missing').length
  const current = items.filter(i => centerComplianceStatus(i) === 'current').length

  return (
    <div>
      <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 'var(--radius-sm)', padding: '0.75rem 1rem', marginBottom: '1.25rem', fontSize: '0.8125rem', color: '#1E40AF' }}>
        <strong>🏛️ Center & Licensing Compliance</strong> — Track all licensing, building inspections, and non-employee regulatory requirements for this center. Requirements should be configured to match your state and license type.
      </div>

      <div className="grid-3" style={{ marginBottom: '1.25rem' }}>
        <div className="card" style={{ borderLeft: '4px solid var(--sage)', padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--sage)' }}>{current}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>Current / On Track</div>
        </div>
        <div className="card" style={{ borderLeft: `4px solid ${overdue ? '#B91C1C' : 'var(--border)'}`, padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: overdue ? '#B91C1C' : 'var(--text-muted)' }}>{overdue}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>Overdue</div>
        </div>
        <div className="card" style={{ borderLeft: `4px solid ${missing ? '#D97706' : 'var(--border)'}`, padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: missing ? '#D97706' : 'var(--text-muted)' }}>{missing}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>Missing / No Date Set</div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        {user?.role === 'admin' && (
          <button className="btn btn-primary" onClick={() => { setEditing(null); setShowAdd(true) }}>
            <Plus size={16} /> Add Requirement
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><div className="spinner" /></div>
      ) : items.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
          <Building2 size={40} color="var(--text-light)" style={{ margin: '0 auto 1rem', display: 'block' }} />
          <h3 style={{ fontWeight: 600, marginBottom: '0.5rem' }}>No center compliance items yet</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            Add licensing, inspection, and building compliance requirements specific to this center's state and license type.
          </p>
          {user?.role === 'admin' && (
            <button className="btn btn-primary" onClick={() => setShowAdd(true)}><Plus size={16} /> Add Requirement</button>
          )}
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
            <thead>
              <tr style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
                {['Requirement','Type','Frequency','Next Due','Last Completed','Status',''].map(h => (
                  <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => {
                const status = centerComplianceStatus(item)
                const cfg = STATUS_CONFIG[status]
                const StatusIcon = cfg.icon
                const days = daysUntilExpiry(item.due_date)
                return (
                  <tr key={item.id} style={{ borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 600, fontSize: '0.9rem' }}>
                      {item.name}
                      {item.description && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>{item.description}</div>}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{item.type || '—'}</td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{item.recurs || '—'}</td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem' }}>
                      {item.due_date ? (
                        <span style={{ color: days !== null && days < 0 ? '#B91C1C' : days !== null && days < 30 ? '#D97706' : 'var(--text)' }}>
                          {item.due_date}
                          {days !== null && days >= 0 && days < 60 && <span style={{ fontSize: '0.75rem', marginLeft: '0.25rem' }}>({days}d)</span>}
                        </span>
                      ) : <span style={{ color: 'var(--text-light)' }}>—</span>}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{item.completed_date || '—'}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', fontWeight: 600, background: cfg.bg, color: cfg.color, padding: '0.2rem 0.5rem', borderRadius: 999 }}>
                        <StatusIcon size={11} />{cfg.label}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      {user?.role === 'admin' && (
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => { setEditing(item); setShowAdd(true) }}>Edit</button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(item.id)}><X size={14} /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && (
        <CenterComplianceModal
          item={editing}
          centerId={center?.id}
          API={API}
          onSaved={() => { setShowAdd(false); setEditing(null); load() }}
          onClose={() => { setShowAdd(false); setEditing(null) }}
        />
      )}
    </div>
  )
}

function CenterComplianceModal({ item, centerId, API, onSaved, onClose }) {
  const EMPTY = { name: '', type: 'licensing', description: '', state: '', due_date: '', completed_date: '', recurs: 'annual', notes: '' }
  const [form, setForm] = useState(item ? { ...EMPTY, ...item } : EMPTY)
  const [saving, setSaving] = useState(false)
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    if (item) {
      await fetch(`${API}/center-compliance/${item.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(form) })
    } else {
      await fetch(`${API}/centers/${centerId}/center-compliance`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(form) })
    }
    onSaved()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 540 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{item ? 'Edit' : 'Add'} Compliance Requirement</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="grid-2">
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label>Requirement Name *</label>
                <input value={form.name} onChange={set('name')} placeholder="e.g. Annual Fire Inspection" required autoFocus />
              </div>
              <div className="field">
                <label>Type</label>
                <select value={form.type} onChange={set('type')}>
                  <option value="licensing">Licensing</option>
                  <option value="inspection">Inspection</option>
                  <option value="permit">Permit</option>
                  <option value="health">Health / Sanitation</option>
                  <option value="fire">Fire Safety</option>
                  <option value="building">Building</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="field">
                <label>Frequency</label>
                <select value={form.recurs} onChange={set('recurs')}>
                  <option value="once">One-time</option>
                  <option value="annual">Annual</option>
                  <option value="biennial">Every 2 Years</option>
                  <option value="every3years">Every 3 Years</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                </select>
              </div>
              <div className="field">
                <label>Next Due Date</label>
                <input type="date" value={form.due_date} onChange={set('due_date')} />
              </div>
              <div className="field">
                <label>Last Completed</label>
                <input type="date" value={form.completed_date} onChange={set('completed_date')} />
              </div>
            </div>
            <div className="field">
              <label>Description / Notes</label>
              <textarea value={form.description || form.notes} onChange={set('description')} rows={2} placeholder="Any details about this requirement…" />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : item ? 'Save Changes' : 'Add Requirement'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
