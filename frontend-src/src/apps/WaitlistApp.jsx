import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { Plus, Search, Edit2, Trash2, X, AlertCircle, Mail, Baby } from 'lucide-react'

const HEARD_ABOUT_OPTIONS = [
  'Word of mouth', 'Google search', 'Social media',
  'Drive-by / signage', 'Referral from current family', 'Other',
]

const ENROLLMENT_OPTIONS = [
  'Full-time', 'Part-time', 'M/W/F mornings', 'M/W/F afternoons',
  'T/Th mornings', 'T/Th afternoons', 'Flexible', 'ASAP', 'Fall 2026',
]

function calcAge(dob) {
  if (!dob) return null
  const birth = new Date(dob + 'T00:00:00')
  const now = new Date()
  const months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth())
  if (months < 1) return '<1mo'
  if (months < 24) return `${months}mo`
  return `${Math.floor(months / 12)}y ${months % 12}mo`
}

function calcAgeMonths(dob) {
  if (!dob) return null
  const birth = new Date(dob + 'T00:00:00')
  const now = new Date()
  return (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth())
}

function getAgeGroup(entry) {
  if (entry.is_expected) return 'expected'
  if (!entry.date_of_birth) return 'expected'
  const months = calcAgeMonths(entry.date_of_birth)
  if (months === null) return 'expected'
  if (months < 24) return 'infants'
  if (months < 36) return 'toddlers'
  if (months < 48) return 'age3'
  if (months < 60) return 'age4'
  return 'older'
}

const AGE_GROUPS = [
  { key: 'expected', label: 'Expected', emoji: '🤰', color: '#7C3AED', bg: '#F5F3FF' },
  { key: 'infants',  label: 'Infants',  emoji: '👶', color: '#DB2777', bg: '#FDF2F8', sub: '0–24 mo' },
  { key: 'toddlers', label: 'Toddlers', emoji: '🧒', color: '#D97706', bg: '#FFFBEB', sub: '24–36 mo' },
  { key: 'age3',     label: '3 Years',  emoji: '🎒', color: '#059669', bg: '#ECFDF5', sub: '3 yrs' },
  { key: 'age4',     label: '4 Years',  emoji: '🎨', color: '#2563EB', bg: '#EFF6FF', sub: '4 yrs' },
  { key: 'older',    label: 'Older',    emoji: '📚', color: '#64748B', bg: '#F8FAFC', sub: '5+ yrs' },
]

export default function WaitlistApp() {
  const { user, API } = useAuth()
  const center = user?.centers?.[0]
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState('signed_up_at')
  const [sortDir, setSortDir] = useState('desc')
  const [editEntry, setEditEntry] = useState(null)
  const [showAdd, setShowAdd] = useState(false)

  const load = useCallback(() => {
    if (!center) return
    setLoading(true)
    fetch(`${API}/centers/${center.id}/waitlist`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => { setEntries(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [center, API])

  useEffect(() => { load() }, [load])

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const handleSave = async (data) => {
    const isEdit = !!editEntry
    const url = isEdit
      ? `${API}/centers/${center.id}/waitlist/${editEntry.id}`
      : `${API}/centers/${center.id}/waitlist`
    const res = await fetch(url, {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    })
    if (res.ok) { load(); setShowAdd(false); setEditEntry(null) }
    else { const d = await res.json(); alert(d.error || 'Error saving') }
  }

  const handleDelete = async (id, name) => {
    if (!confirm(`Remove ${name} from the waiting list?`)) return
    await fetch(`${API}/centers/${center.id}/waitlist/${id}`, { method: 'DELETE', credentials: 'include' })
    setEntries(e => e.filter(x => x.id !== id))
  }

  const q = search.toLowerCase()
  const filtered = entries.filter(e =>
    !q || [e.child_name, e.parent_name, e.email, e.phone].some(f => (f || '').toLowerCase().includes(q))
  )
  const sorted = [...filtered].sort((a, b) => {
    const av = a[sortKey] || '', bv = b[sortKey] || ''
    return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
  })

  const now = new Date()
  const thisMonthEntries = entries.filter(e => {
    const d = new Date(e.signed_up_at); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  })
  const needsFollowUp = entries.filter(e => !e.last_contact).length

  // Age group counts
  const groupCounts = {}
  const groupAddedThisMonth = {}
  AGE_GROUPS.forEach(g => { groupCounts[g.key] = 0; groupAddedThisMonth[g.key] = 0 })
  entries.forEach(e => {
    const g = getAgeGroup(e)
    groupCounts[g] = (groupCounts[g] || 0) + 1
  })
  thisMonthEntries.forEach(e => {
    const g = getAgeGroup(e)
    groupAddedThisMonth[g] = (groupAddedThisMonth[g] || 0) + 1
  })

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1>Waiting List</h1>
          <p>{center?.name || 'Your center'} — enrollment queue</p>
        </div>
        {user?.role === 'admin' && (
          <button className="btn btn-primary" onClick={() => { setEditEntry(null); setShowAdd(true) }}>
            <Plus size={16} /> Add Child
          </button>
        )}
      </div>

      {/* Age Group Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.625rem', marginBottom: '1.5rem' }}>
        {AGE_GROUPS.map(g => (
          <div key={g.key} className="card" style={{ padding: '0.875rem 0.75rem', borderLeft: `3px solid ${g.color}`, background: g.bg }}>
            <div style={{ fontSize: '0.8rem', marginBottom: '0.25rem' }}>{g.emoji} <strong style={{ color: g.color }}>{g.label}</strong></div>
            {g.sub && <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '0.375rem' }}>{g.sub}</div>}
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: g.color, lineHeight: 1 }}>{groupCounts[g.key]}</div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>+{groupAddedThisMonth[g.key]} this mo.</div>
          </div>
        ))}
        <div className="card" style={{ padding: '0.875rem 0.75rem', borderLeft: '3px solid var(--plum)', background: 'var(--plum-bg)' }}>
          <div style={{ fontSize: '0.8rem', marginBottom: '0.25rem' }}>📋 <strong style={{ color: 'var(--plum)' }}>Total</strong></div>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '0.375rem' }}>all groups</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--plum)', lineHeight: 1 }}>{entries.length}</div>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>+{thisMonthEntries.length} this mo.</div>
        </div>
      </div>

      {/* Search */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', alignItems: 'center' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, parent, phone, or email…"
            style={{ width: '100%', padding: '0.625rem 0.875rem 0.625rem 2.25rem', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '0.9375rem', outline: 'none' }}
            onFocus={e => e.target.style.borderColor = 'var(--plum)'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'}
          />
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><div className="spinner" /></div>
        ) : sorted.length === 0 ? (
          <div className="empty-state">
            <span style={{ fontSize: '2.5rem' }}>📋</span>
            <h3>{search ? 'No results' : 'No children on the waiting list yet'}</h3>
            <p>{search ? 'Try a different search term.' : 'Click "Add Child" to add the first entry.'}</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
                  {[
                    { key: 'child_name', label: 'Child' },
                    { key: 'date_of_birth', label: 'Age / DOB' },
                    { key: 'desired_enrollment_time', label: 'Enrollment' },
                    { key: 'parent_name', label: 'Parent' },
                    { key: 'phone', label: 'Phone' },
                    { key: 'email', label: 'Email' },
                    { key: 'signed_up_at', label: 'Signed Up' },
                    { key: 'last_contact', label: 'Last Contact' },
                    { key: 'notes', label: 'Notes' },
                  ].map(col => (
                    <th
                      key={col.key}
                      onClick={() => handleSort(col.key)}
                      style={{
                        padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem',
                        fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase',
                        letterSpacing: '0.04em', cursor: 'pointer', whiteSpace: 'nowrap',
                        userSelect: 'none',
                      }}
                    >
                      {col.label} {sortKey === col.key ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                    </th>
                  ))}
                  <th style={{ padding: '0.75rem 1rem' }} />
                </tr>
              </thead>
              <tbody>
                {sorted.map((entry, i) => (
                  <tr
                    key={entry.id}
                    style={{ borderBottom: i < sorted.length - 1 ? '1px solid var(--border)' : 'none' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--plum-bg)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'white'}
                  >
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 600, fontSize: '0.9rem', whiteSpace: 'nowrap' }}>{entry.child_name}</td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
                      {entry.is_expected ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', fontWeight: 600, background: '#F5F3FF', color: '#7C3AED', padding: '0.125rem 0.5rem', borderRadius: 999 }}>
                          🤰 Expected
                        </span>
                      ) : entry.date_of_birth ? (
                        <div>
                          <div style={{ color: 'var(--text)' }}>{entry.date_of_birth}</div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{calcAge(entry.date_of_birth)}</div>
                        </div>
                      ) : <span style={{ color: 'var(--text-light)' }}>—</span>}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{entry.desired_enrollment_time || <span style={{ color: 'var(--text-light)' }}>—</span>}</td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>{entry.parent_name || <span style={{ color: 'var(--text-light)' }}>—</span>}</td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
                      {entry.phone ? <a href={`tel:${entry.phone}`} style={{ color: 'var(--plum)' }}>{entry.phone}</a> : <span style={{ color: 'var(--text-light)' }}>—</span>}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem' }}>
                      {entry.email ? <a href={`mailto:${entry.email}`} style={{ color: 'var(--plum)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Mail size={12} />{entry.email}</a> : <span style={{ color: 'var(--text-light)' }}>—</span>}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{entry.signed_up_at?.split('T')[0] || entry.signed_up_at || '—'}</td>
                    <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap' }}>
                      {entry.last_contact
                        ? <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{entry.last_contact}</span>
                        : <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', fontWeight: 600, background: '#FEF3C7', color: '#92400E', padding: '0.125rem 0.5rem', borderRadius: 999 }}>
                            <AlertCircle size={11} /> Needs follow-up
                          </span>}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem', color: 'var(--text-muted)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={entry.notes}>
                      {entry.notes || <span style={{ color: 'var(--text-light)' }}>—</span>}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap' }}>
                      {user?.role === 'admin' && (
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => { setEditEntry(entry); setShowAdd(true) }}><Edit2 size={14} /></button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(entry.id, entry.child_name)}><Trash2 size={14} /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid var(--border)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {entries.length} {entries.length === 1 ? 'child' : 'children'} on the waiting list
            </div>
          </div>
        )}
      </div>

      {showAdd && (
        <EntryModal
          entry={editEntry}
          onSave={handleSave}
          onClose={() => { setShowAdd(false); setEditEntry(null) }}
        />
      )}
    </div>
  )
}

function StatCard({ label, value, color, alert }) {
  return (
    <div className="card" style={{ borderLeft: `4px solid ${color}`, padding: '1rem 1.25rem' }}>
      <div style={{ fontSize: '1.75rem', fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', fontWeight: 500 }}>{label}</div>
    </div>
  )
}

const EMPTY_FORM = {
  child_name: '', date_of_birth: '', desired_enrollment_time: '',
  parent_name: '', phone: '', email: '', notes: '',
  last_contact: '', signed_up_at: new Date().toISOString().split('T')[0],
  heard_about_us: '', is_expected: false,
}

function EntryModal({ entry, onSave, onClose }) {
  const [form, setForm] = useState(entry ? {
    child_name: entry.child_name || '',
    date_of_birth: entry.date_of_birth || '',
    desired_enrollment_time: entry.desired_enrollment_time || '',
    parent_name: entry.parent_name || '',
    phone: entry.phone || '',
    email: entry.email || '',
    notes: entry.notes || '',
    last_contact: entry.last_contact || '',
    signed_up_at: entry.signed_up_at?.split('T')[0] || new Date().toISOString().split('T')[0],
    heard_about_us: entry.heard_about_us || '',
    is_expected: !!entry.is_expected,
  } : { ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))
  const setCheck = k => e => setForm(f => ({ ...f, [k]: e.target.checked }))

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.child_name.trim()) { setError('Child name is required'); return }
    setSaving(true)
    await onSave(form)
    setSaving(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{entry ? 'Edit Entry' : 'Add Child to Waiting List'}</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div style={{ color: '#B91C1C', marginBottom: '1rem', fontSize: '0.875rem' }}>{error}</div>}

            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem' }}>Child Information</div>
            <div className="grid-2">
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label>Child's Full Name *</label>
                <input value={form.child_name} onChange={set('child_name')} placeholder="First and last name" required autoFocus />
              </div>
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.is_expected} onChange={setCheck('is_expected')} style={{ width: 16, height: 16 }} />
                  <span>🤰 Mother is still pregnant — child not yet born</span>
                </label>
              </div>
              {!form.is_expected && (
                <div className="field">
                  <label>Date of Birth</label>
                  <input type="date" value={form.date_of_birth} onChange={set('date_of_birth')} />
                </div>
              )}
              <div className="field">
                <label>Desired Enrollment</label>
                <input list="enrollment-opts" value={form.desired_enrollment_time} onChange={set('desired_enrollment_time')} placeholder="e.g. Full-time, Fall 2026" />
                <datalist id="enrollment-opts">{ENROLLMENT_OPTIONS.map(o => <option key={o} value={o} />)}</datalist>
              </div>
            </div>

            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0.5rem 0 0.75rem' }}>Parent / Guardian</div>
            <div className="grid-2">
              <div className="field">
                <label>Parent / Guardian Name</label>
                <input value={form.parent_name} onChange={set('parent_name')} placeholder="Full name" />
              </div>
              <div className="field">
                <label>Phone</label>
                <input type="tel" value={form.phone} onChange={set('phone')} placeholder="(555) 000-0000" />
              </div>
              <div className="field" style={{ gridColumn: '1 / -1' }}>
                <label>Email</label>
                <input type="email" value={form.email} onChange={set('email')} placeholder="parent@email.com" />
              </div>
            </div>

            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0.5rem 0 0.75rem' }}>List Details</div>
            <div className="grid-2">
              <div className="field">
                <label>How Did They Hear About Us?</label>
                <select value={form.heard_about_us} onChange={set('heard_about_us')}>
                  <option value="">— Select —</option>
                  {HEARD_ABOUT_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Signed Up Date</label>
                <input type="date" value={form.signed_up_at} onChange={set('signed_up_at')} />
              </div>
              <div className="field">
                <label>Last Contact Date</label>
                <input type="date" value={form.last_contact} onChange={set('last_contact')} />
              </div>
            </div>

            <div className="field">
              <label>Notes</label>
              <textarea value={form.notes} onChange={set('notes')} rows={3} placeholder="Any additional notes…" />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : entry ? 'Save Changes' : 'Add to Waiting List'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
