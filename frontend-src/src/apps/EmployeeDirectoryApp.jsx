import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { Plus, Edit2, Trash2, X, User, Phone, Mail, Calendar } from 'lucide-react'

const TITLES = ['Lead Teacher','Assistant Teacher','Director','Assistant Director','Cook','Aide','Floater','Admin','Other']

export default function EmployeeDirectoryApp() {
  const { user, API } = useAuth()
  const center = user?.centers?.[0]
  const [staff, setStaff] = useState([])
  const [centers, setCenters] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCenter, setFilterCenter] = useState(center?.id || '')
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState(null)
  const [filterStatus, setFilterStatus] = useState('active')

  useEffect(() => {
    Promise.all([
      fetch(`${API}/staff${filterCenter ? `?center_id=${filterCenter}` : ''}`, { credentials: 'include' }).then(r => r.json()),
      fetch(`${API}/centers`, { credentials: 'include' }).then(r => r.json()),
    ]).then(([s, c]) => {
      setStaff(Array.isArray(s) ? s : [])
      setCenters(Array.isArray(c) ? c : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [API, filterCenter])

  const handleDelete = async (id, name) => {
    if (!confirm(`Remove ${name} from the directory?`)) return
    await fetch(`${API}/staff/${id}`, { method: 'DELETE', credentials: 'include' })
    setStaff(s => s.filter(x => x.id !== id))
  }

  const q = search.toLowerCase()
  const filtered = staff
    .filter(s => filterStatus === 'all' || s.status === filterStatus)
    .filter(s => !q || [s.name, s.title, s.email, s.phone].some(f => (f||'').toLowerCase().includes(q)))

  const byCenter = {}
  filtered.forEach(s => {
    const key = s.center_name || s.center_id || 'Unassigned'
    if (!byCenter[key]) byCenter[key] = []
    byCenter[key].push(s)
  })

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1>Employee Directory</h1>
          <p>All staff across your centers.</p>
        </div>
        {user?.role === 'admin' && (
          <button className="btn btn-primary" onClick={() => { setEditing(null); setShowAdd(true) }}>
            <Plus size={16} /> Add Staff Member
          </button>
        )}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search name, title, email…"
          style={{ flex: 1, minWidth: 200, padding: '0.625rem 0.875rem', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '0.9375rem', outline: 'none' }}
          onFocus={e => e.target.style.borderColor = 'var(--plum)'}
          onBlur={e => e.target.style.borderColor = 'var(--border)'}
        />
        {user?.role === 'admin' && centers.length > 1 && (
          <select value={filterCenter} onChange={e => setFilterCenter(e.target.value)}
            style={{ padding: '0.625rem 0.875rem', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem', background: 'white', outline: 'none' }}>
            <option value="">All Centers</option>
            {centers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          style={{ padding: '0.625rem 0.875rem', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem', background: 'white', outline: 'none' }}>
          <option value="active">Active Staff</option>
          <option value="inactive">Inactive</option>
          <option value="all">All</option>
        </select>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><div className="spinner" /></div>
      ) : filtered.length === 0 ? (
        <div className="card empty-state">
          <User size={36} />
          <h3>No staff found</h3>
          <p>{search ? 'Try a different search.' : 'Add your first staff member to get started.'}</p>
          {!search && user?.role === 'admin' && <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => setShowAdd(true)}><Plus size={16} /> Add Staff Member</button>}
        </div>
      ) : (
        Object.entries(byCenter).map(([centerName, members]) => (
          <div key={centerName} style={{ marginBottom: '1.5rem' }}>
            {Object.keys(byCenter).length > 1 && (
              <h2 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem' }}>{centerName}</h2>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem' }}>
              {members.map(member => (
                <StaffCard key={member.id} member={member} isAdmin={user?.role === 'admin'}
                  onEdit={() => { setEditing(member); setShowAdd(true) }}
                  onDelete={() => handleDelete(member.id, member.name)}
                />
              ))}
            </div>
          </div>
        ))
      )}

      {showAdd && (
        <StaffModal
          staff={editing}
          centers={centers}
          defaultCenter={center}
          API={API}
          onClose={() => { setShowAdd(false); setEditing(null) }}
          onSaved={s => {
            if (editing) setStaff(prev => prev.map(x => x.id === s.id ? s : x))
            else setStaff(prev => [...prev, s])
            setShowAdd(false); setEditing(null)
          }}
        />
      )}
    </div>
  )
}

function StaffCard({ member, isAdmin, onEdit, onDelete }) {
  const initials = member.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
  const colors = ['#6B3F7C', '#7A9E7E', '#C9A84C', '#6366F1', '#EC4899']
  const color = colors[member.id % colors.length]

  return (
    <div className="card" style={{ padding: '1.25rem', position: 'relative' }}>
      {member.status === 'inactive' && (
        <div style={{ position: 'absolute', top: '0.75rem', right: '0.75rem', fontSize: '0.6875rem', background: '#FEE2E2', color: '#B91C1C', padding: '0.125rem 0.5rem', borderRadius: 999, fontWeight: 600 }}>
          Inactive
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem', marginBottom: '1rem' }}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          background: `${color}22`, color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1rem', fontWeight: 700, flexShrink: 0,
        }}>
          {initials}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: '0.9375rem', marginBottom: '0.125rem' }}>{member.name}</div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{member.title || 'Staff'}</div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
        {member.phone && (
          <a href={`tel:${member.phone}`} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', color: 'var(--text-muted)', textDecoration: 'none' }}>
            <Phone size={13} style={{ flexShrink: 0, color: 'var(--plum)' }} />{member.phone}
          </a>
        )}
        {member.email && (
          <a href={`mailto:${member.email}`} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', color: 'var(--text-muted)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <Mail size={13} style={{ flexShrink: 0, color: 'var(--plum)' }} />{member.email}
          </a>
        )}
        {member.hire_date && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            <Calendar size={13} style={{ flexShrink: 0, color: 'var(--plum)' }} />Hired {member.hire_date}
          </div>
        )}
      </div>
      {isAdmin && (
        <div style={{ display: 'flex', gap: '0.375rem', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
          <button className="btn btn-ghost btn-sm" onClick={onEdit} style={{ flex: 1, justifyContent: 'center' }}><Edit2 size={14} /> Edit</button>
          <button className="btn btn-danger btn-sm" onClick={onDelete}><Trash2 size={14} /></button>
        </div>
      )}
    </div>
  )
}

function StaffModal({ staff, centers, defaultCenter, API, onClose, onSaved }) {
  const isEdit = !!staff
  const [form, setForm] = useState({
    name: staff?.name || '', title: staff?.title || '', email: staff?.email || '',
    phone: staff?.phone || '', hire_date: staff?.hire_date || '',
    center_id: staff?.center_id || defaultCenter?.id || '',
    status: staff?.status || 'active',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Name required'); return }
    setSaving(true)
    const url = isEdit ? `${API}/staff/${staff.id}` : `${API}/staff`
    const res = await fetch(url, { method: isEdit ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(form) })
    const data = await res.json()
    if (res.ok) onSaved(isEdit ? { ...staff, ...form } : data)
    else { setError(data.error || 'Error saving'); setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEdit ? 'Edit Staff Member' : 'Add Staff Member'}</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div style={{ color: '#B91C1C', marginBottom: '1rem', fontSize: '0.875rem' }}>{error}</div>}
            <div className="grid-2">
              <div className="field" style={{ gridColumn: '1/-1' }}><label>Full Name *</label><input value={form.name} onChange={set('name')} required autoFocus /></div>
              <div className="field"><label>Title / Role</label>
                <input list="title-opts" value={form.title} onChange={set('title')} placeholder="e.g. Lead Teacher" />
                <datalist id="title-opts">{TITLES.map(t => <option key={t} value={t} />)}</datalist>
              </div>
              <div className="field"><label>Status</label>
                <select value={form.status} onChange={set('status')}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div className="field"><label>Email</label><input type="email" value={form.email} onChange={set('email')} /></div>
              <div className="field"><label>Phone</label><input type="tel" value={form.phone} onChange={set('phone')} /></div>
              <div className="field"><label>Hire Date</label><input type="date" value={form.hire_date} onChange={set('hire_date')} /></div>
              <div className="field"><label>Center</label>
                <select value={form.center_id} onChange={set('center_id')}>
                  <option value="">— Select —</option>
                  {centers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Staff Member'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
