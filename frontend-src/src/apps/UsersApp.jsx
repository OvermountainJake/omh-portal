import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { Plus, Trash2, X, Edit2 } from 'lucide-react'

export default function UsersApp() {
  const { API } = useAuth()
  const [users, setUsers] = useState([])
  const [centers, setCenters] = useState([])
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState(null)

  useEffect(() => {
    fetch(`${API}/users`, { credentials: 'include' }).then(r => r.json()).then(setUsers).catch(() => {})
    fetch(`${API}/centers`, { credentials: 'include' }).then(r => r.json()).then(setCenters).catch(() => {})
  }, [API])

  const handleDelete = async (id, name) => {
    if (!confirm(`Remove ${name}? This cannot be undone.`)) return
    await fetch(`${API}/users/${id}`, { method: 'DELETE', credentials: 'include' })
    setUsers(u => u.filter(x => x.id !== id))
  }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1>User Management</h1>
          <p>Manage director accounts and center access.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
          <Plus size={16} /> Add User
        </button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Name', 'Email', 'Role', 'Centers', ''].map(h => (
                <th key={h} style={{ padding: '0.875rem 1.25rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u, i) => (
              <tr key={u.id} style={{ borderBottom: i < users.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <td style={{ padding: '0.875rem 1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                    <div style={{
                      width: 32, height: 32,
                      background: 'var(--plum-bg)',
                      borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.8125rem', fontWeight: 700, color: 'var(--plum)',
                      flexShrink: 0,
                    }}>
                      {u.name.charAt(0)}
                    </div>
                    <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>{u.name}</span>
                  </div>
                </td>
                <td style={{ padding: '0.875rem 1.25rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>{u.email}</td>
                <td style={{ padding: '0.875rem 1.25rem' }}>
                  <span className={`badge badge-${u.role}`}>{u.role}</span>
                </td>
                <td style={{ padding: '0.875rem 1.25rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  {u.role === 'admin' ? 'All centers' : (u.center_ids?.length ? `${u.center_ids.length} center${u.center_ids.length !== 1 ? 's' : ''}` : 'None assigned')}
                </td>
                <td style={{ padding: '0.875rem 1.25rem' }}>
                  <div style={{ display: 'flex', gap: '0.375rem', justifyContent: 'flex-end' }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditing(u)} title="Edit">
                      <Edit2 size={14} />
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(u.id, u.name)} title="Delete">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                  No users yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {(showAdd || editing) && (
        <UserModal
          user={editing}
          centers={centers}
          API={API}
          onClose={() => { setShowAdd(false); setEditing(null) }}
          onSaved={newUser => {
            if (editing) {
              setUsers(u => u.map(x => x.id === newUser.id ? { ...x, ...newUser } : x))
            } else {
              setUsers(u => [...u, newUser])
            }
            setShowAdd(false); setEditing(null)
          }}
        />
      )}
    </div>
  )
}

function UserModal({ user, centers, API, onClose, onSaved }) {
  const isEdit = !!user
  const [form, setForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    password: '',
    role: user?.role || 'director',
    center_ids: user?.center_ids || [],
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))
  const toggleCenter = id => setForm(f => ({
    ...f,
    center_ids: f.center_ids.includes(id) ? f.center_ids.filter(c => c !== id) : [...f.center_ids, id],
  }))

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const url = isEdit ? `${API}/users/${user.id}` : `${API}/users`
      const method = isEdit ? 'PUT' : 'POST'
      const body = { ...form }
      if (isEdit && !body.password) delete body.password
      const res = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onSaved(isEdit ? { ...user, ...form } : data)
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
          <h2>{isEdit ? 'Edit User' : 'Add User'}</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div style={{ color: '#B91C1C', marginBottom: '1rem', fontSize: '0.875rem' }}>{error}</div>}
            <div className="grid-2">
              <div className="field">
                <label>Full Name</label>
                <input value={form.name} onChange={set('name')} placeholder="Jane Smith" required />
              </div>
              <div className="field">
                <label>Role</label>
                <select value={form.role} onChange={set('role')}>
                  <option value="director">Director</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            <div className="field">
              <label>Email</label>
              <input type="email" value={form.email} onChange={set('email')} placeholder="jane@ycdcappleton.com" required={!isEdit} disabled={isEdit} />
            </div>
            <div className="field">
              <label>{isEdit ? 'New Password (leave blank to keep)' : 'Password'}</label>
              <input type="password" value={form.password} onChange={set('password')} placeholder="Min 8 characters" required={!isEdit} minLength={isEdit ? 0 : 8} />
            </div>
            {form.role === 'director' && centers.length > 0 && (
              <div className="field">
                <label>Center Access</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.25rem' }}>
                  {centers.map(c => (
                    <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', cursor: 'pointer', fontWeight: 400, fontSize: '0.9rem', color: 'var(--text)' }}>
                      <input
                        type="checkbox"
                        checked={form.center_ids.includes(c.id)}
                        onChange={() => toggleCenter(c.id)}
                        style={{ accentColor: 'var(--plum)', width: 16, height: 16 }}
                      />
                      {c.name}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add User'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
