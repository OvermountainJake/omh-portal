import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { Plus, Clock, CheckCircle, X, Trash2 } from 'lucide-react'

const TYPE_COLORS = { vacation: '#6366F1', sick: '#EF4444', personal: '#F59E0B', bereavement: '#6B7280', other: '#8B5A9E' }
const TYPE_LABELS = { vacation: 'Vacation', sick: 'Sick', personal: 'Personal', bereavement: 'Bereavement', other: 'Other' }

export default function TimeOffApp() {
  const { user, API } = useAuth()
  const center = user?.centers?.[0]
  const [staff, setStaff] = useState([])
  const [requests, setRequests] = useState([])
  const [balances, setBalances] = useState({})
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editBalance, setEditBalance] = useState(null)
  const [filterType, setFilterType] = useState('all')
  const [viewMode, setViewMode] = useState('requests') // requests | balances

  useEffect(() => {
    if (!center) return
    Promise.all([
      fetch(`${API}/staff?center_id=${center.id}`, { credentials: 'include' }).then(r => r.json()),
      fetch(`${API}/timeoff?center_id=${center.id}`, { credentials: 'include' }).then(r => r.json()),
    ]).then(([s, r]) => {
      const staffList = Array.isArray(s) ? s : []
      setStaff(staffList)
      setRequests(Array.isArray(r) ? r : [])
      // Load PTO balances for all staff
      Promise.all(staffList.filter(m => m.status === 'active').map(m =>
        fetch(`${API}/staff/${m.id}/pto`, { credentials: 'include' }).then(r => r.json())
      )).then(bals => {
        const map = {}
        bals.forEach(b => { if (b.staff_id) map[b.staff_id] = b })
        setBalances(map)
      })
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [center, API])

  const handleDelete = async (id) => {
    if (!confirm('Remove this time off record?')) return
    await fetch(`${API}/timeoff/${id}`, { method: 'DELETE', credentials: 'include' })
    setRequests(r => r.filter(x => x.id !== id))
  }

  const filtered = requests.filter(r => filterType === 'all' || r.type === filterType)
  const activeStaff = staff.filter(s => s.status === 'active')

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1>Time Off Tracker</h1>
          <p>Vacation, sick, and personal hours — powered by iSolved when connected.</p>
        </div>
        {user?.role === 'admin' && (
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}><Plus size={16} /> Log Time Off</button>
        )}
      </div>

      {/* iSolved notice */}
      <div style={{ background: 'var(--plum-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '0.875rem 1.125rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
        <Clock size={18} style={{ color: 'var(--plum)', flexShrink: 0, marginTop: '0.125rem' }} />
        <div>
          <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--plum-dark)', marginBottom: '0.25rem' }}>iSolved Integration Coming Soon</div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Time off data will sync automatically once iSolved API credentials are configured. In the meantime, log manually below.</div>
        </div>
      </div>

      {/* View toggle */}
      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.25rem', background: 'var(--border)', borderRadius: 'var(--radius-sm)', padding: '0.25rem', width: 'fit-content' }}>
        {[['requests','Time Off Log'],['balances','PTO Balances']].map(([val, label]) => (
          <button key={val} onClick={() => setViewMode(val)} className="btn"
            style={{ background: viewMode === val ? 'white' : 'transparent', color: viewMode === val ? 'var(--plum)' : 'var(--text-muted)', boxShadow: viewMode === val ? 'var(--shadow-sm)' : 'none', fontSize: '0.875rem', padding: '0.5rem 1rem' }}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><div className="spinner" /></div>
      ) : viewMode === 'requests' ? (
        <RequestsView requests={filtered} filterType={filterType} setFilterType={setFilterType} onDelete={user?.role === 'admin' ? handleDelete : null} />
      ) : (
        <BalancesView staff={activeStaff} balances={balances} isAdmin={user?.role === 'admin'} onEdit={setEditBalance} />
      )}

      {showAdd && (
        <AddTimeOffModal staff={activeStaff} center={center} API={API}
          onClose={() => setShowAdd(false)}
          onSaved={req => { setRequests(r => [req, ...r]); setShowAdd(false) }}
        />
      )}
      {editBalance && (
        <EditBalanceModal staff={editBalance} balance={balances[editBalance.id]} API={API}
          onClose={() => setEditBalance(null)}
          onSaved={bal => { setBalances(b => ({ ...b, [editBalance.id]: bal })); setEditBalance(null) }}
        />
      )}
    </div>
  )
}

function RequestsView({ requests, filterType, setFilterType, onDelete }) {
  return (
    <>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        {['all','vacation','sick','personal','bereavement','other'].map(t => (
          <button key={t} onClick={() => setFilterType(t)} className="btn btn-sm"
            style={{ background: filterType === t ? (t === 'all' ? 'var(--plum)' : TYPE_COLORS[t]) : 'var(--border)', color: filterType === t ? 'white' : 'var(--text-muted)', textTransform: 'capitalize', fontWeight: 500 }}>
            {t === 'all' ? 'All Types' : TYPE_LABELS[t]}
          </button>
        ))}
      </div>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {requests.length === 0 ? (
          <div className="empty-state" style={{ padding: '3rem' }}>
            <Clock size={36} style={{ opacity: 0.3 }} />
            <h3>No time off records yet</h3>
            <p>Log time off manually or connect iSolved to sync automatically.</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
                {['Staff Member','Type','Start','End','Hours','Notes',''].map(h => (
                  <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {requests.map((req, i) => (
                <tr key={req.id} style={{ borderBottom: i < requests.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 500, fontSize: '0.9rem' }}>
                    <div>{req.staff_name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{req.staff_title}</div>
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', fontWeight: 600, background: `${TYPE_COLORS[req.type]}22`, color: TYPE_COLORS[req.type], padding: '0.2rem 0.625rem', borderRadius: 999 }}>
                      {TYPE_LABELS[req.type]}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>{req.start_date}</td>
                  <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>{req.end_date}</td>
                  <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>{req.hours ? `${req.hours}h` : '—'}</td>
                  <td style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem', color: 'var(--text-muted)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{req.notes || '—'}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    {onDelete && <button className="btn btn-danger btn-sm" onClick={() => onDelete(req.id)}><Trash2 size={14} /></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}

function BalancesView({ staff, balances, isAdmin, onEdit }) {
  if (staff.length === 0) return (
    <div className="card empty-state"><Clock size={36} style={{ opacity: 0.3 }} /><h3>No active staff</h3><p>Add staff in the Employee Directory first.</p></div>
  )
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
            {['Staff Member','Vacation Hrs','Sick Hrs','Personal Hrs','As Of',''].map(h => (
              <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {staff.map((s, i) => {
            const bal = balances[s.id] || { vacation_hrs: 0, sick_hrs: 0, personal_hrs: 0 }
            return (
              <tr key={s.id} style={{ borderBottom: i < staff.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <td style={{ padding: '0.75rem 1rem', fontWeight: 500, fontSize: '0.9rem' }}>
                  <div>{s.name}</div><div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{s.title}</div>
                </td>
                <PtoCell val={bal.vacation_hrs} color="#6366F1" />
                <PtoCell val={bal.sick_hrs} color="#EF4444" />
                <PtoCell val={bal.personal_hrs} color="#F59E0B" />
                <td style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{bal.as_of_date || '—'}</td>
                <td style={{ padding: '0.75rem 1rem' }}>
                  {isAdmin && <button className="btn btn-ghost btn-sm" onClick={() => onEdit(s)}>Update</button>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function PtoCell({ val, color }) {
  return (
    <td style={{ padding: '0.75rem 1rem' }}>
      <span style={{ fontWeight: 600, color: val > 0 ? color : 'var(--text-muted)', fontSize: '0.9rem' }}>{val}h</span>
    </td>
  )
}

function AddTimeOffModal({ staff, center, API, onClose, onSaved }) {
  const [form, setForm] = useState({ staff_id: '', type: 'vacation', start_date: '', end_date: '', hours: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault(); setSaving(true)
    const res = await fetch(`${API}/timeoff`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ ...form, center_id: center?.id }) })
    const data = await res.json()
    if (res.ok) onSaved(data); else { alert(data.error); setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header"><h2>Log Time Off</h2><button className="btn btn-ghost btn-sm" onClick={onClose}><X size={16} /></button></div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="field"><label>Staff Member *</label>
              <select value={form.staff_id} onChange={set('staff_id')} required>
                <option value="">— Select —</option>
                {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="grid-2">
              <div className="field"><label>Type</label>
                <select value={form.type} onChange={set('type')}>
                  {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="field"><label>Hours (optional)</label><input type="number" step="0.5" min="0" value={form.hours} onChange={set('hours')} placeholder="e.g. 8" /></div>
              <div className="field"><label>Start Date *</label><input type="date" value={form.start_date} onChange={set('start_date')} required /></div>
              <div className="field"><label>End Date *</label><input type="date" value={form.end_date} onChange={set('end_date')} required /></div>
            </div>
            <div className="field"><label>Notes</label><textarea value={form.notes} onChange={set('notes')} rows={2} /></div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Log Time Off'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function EditBalanceModal({ staff, balance, API, onClose, onSaved }) {
  const [form, setForm] = useState({ vacation_hrs: balance?.vacation_hrs || 0, sick_hrs: balance?.sick_hrs || 0, personal_hrs: balance?.personal_hrs || 0, as_of_date: balance?.as_of_date || new Date().toISOString().slice(0,10) })
  const [saving, setSaving] = useState(false)
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  async function handleSave() {
    setSaving(true)
    await fetch(`${API}/staff/${staff.id}/pto`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(form) })
    onSaved({ ...form, staff_id: staff.id })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header"><div><h2>PTO Balances</h2><p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{staff.name}</p></div><button className="btn btn-ghost btn-sm" onClick={onClose}><X size={16} /></button></div>
        <div className="modal-body">
          <div className="field"><label>Vacation Hours</label><input type="number" step="0.5" value={form.vacation_hrs} onChange={set('vacation_hrs')} /></div>
          <div className="field"><label>Sick Hours</label><input type="number" step="0.5" value={form.sick_hrs} onChange={set('sick_hrs')} /></div>
          <div className="field"><label>Personal Hours</label><input type="number" step="0.5" value={form.personal_hrs} onChange={set('personal_hrs')} /></div>
          <div className="field"><label>As Of Date</label><input type="date" value={form.as_of_date} onChange={set('as_of_date')} /></div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save Balances'}</button>
        </div>
      </div>
    </div>
  )
}
