import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { BookOpen, Upload, FileText, Trash2, Plus, X } from 'lucide-react'

const TABS = [
  { key: 'director', label: "Director's Handbook", emoji: '📋', desc: 'Policies, procedures, and guidelines for center directors.' },
  { key: 'staff', label: 'Staff Handbook', emoji: '👩‍🏫', desc: 'Expectations, benefits, and procedures for all staff members.' },
  { key: 'parent', label: "Parent's Handbook", emoji: '👨‍👩‍👧', desc: 'Information and policies shared with enrolled families.' },
]

export default function HandbookApp() {
  const { user, API } = useAuth()
  const [activeTab, setActiveTab] = useState('director')
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)

  const load = () => {
    fetch(`${API}/handbooks`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => { setDocs(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const handleDelete = async (id) => {
    if (!confirm('Remove this document?')) return
    await fetch(`${API}/handbooks/${id}`, { method: 'DELETE', credentials: 'include' })
    setDocs(d => d.filter(x => x.id !== id))
  }

  const tabDocs = docs.filter(d => d.type === activeTab)
  const currentTab = TABS.find(t => t.key === activeTab)

  return (
    <div>
      <div className="page-header">
        <h1>Handbooks</h1>
        <p>Director, staff, and parent handbooks — all in one place.</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '2px solid var(--border)', paddingBottom: '0' }}>
        {TABS.map(tab => (
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
            <span>{tab.emoji}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{currentTab?.desc}</p>
        {user?.role === 'admin' && (
          <button className="btn btn-primary" onClick={() => setShowAdd(true)} style={{ flexShrink: 0 }}>
            <Plus size={16} /> Add Document
          </button>
        )}
      </div>

      {/* Documents */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><div className="spinner" /></div>
      ) : tabDocs.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
          <div style={{
            width: 72, height: 72, background: 'var(--plum-bg)', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem',
          }}>
            <BookOpen size={32} color="var(--plum)" />
          </div>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem' }}>No {currentTab?.label} uploaded yet</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            Upload a PDF or link to a document to make it available here.
          </p>
          {user?.role === 'admin' && (
            <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
              <Upload size={16} /> Upload Document
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {tabDocs.map(doc => (
            <div key={doc.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.25rem' }}>
              <div style={{
                width: 44, height: 44, background: 'var(--plum-bg)', borderRadius: 'var(--radius-sm)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <FileText size={22} color="var(--plum)" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{doc.title}</div>
                {doc.notes && <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>{doc.notes}</div>}
                <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginTop: '0.25rem' }}>
                  Updated {doc.updated_at?.split('T')[0] || doc.updated_at || '—'}
                </div>
              </div>
              {doc.file_url && (
                <a
                  href={doc.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary btn-sm"
                  style={{ flexShrink: 0 }}
                >
                  View
                </a>
              )}
              {user?.role === 'admin' && (
                <button className="btn btn-danger btn-sm" onClick={() => handleDelete(doc.id)} style={{ flexShrink: 0 }}>
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <AddDocModal
          type={activeTab}
          API={API}
          onSaved={() => { setShowAdd(false); load() }}
          onClose={() => setShowAdd(false)}
        />
      )}
    </div>
  )
}

function AddDocModal({ type, API, onSaved, onClose }) {
  const tabLabel = TABS.find(t => t.key === type)?.label || 'Document'
  const [form, setForm] = useState({ type, title: '', file_url: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.title.trim()) return
    setSaving(true)
    await fetch(`${API}/handbooks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(form),
    })
    onSaved()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add to {tabLabel}</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="field">
              <label>Document Title *</label>
              <input value={form.title} onChange={set('title')} placeholder="e.g. Director's Handbook 2026" required autoFocus />
            </div>
            <div className="field">
              <label>Link / URL <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional — Google Drive, Dropbox, etc.)</span></label>
              <input type="url" value={form.file_url} onChange={set('file_url')} placeholder="https://docs.google.com/…" />
            </div>
            <div className="field">
              <label>Notes</label>
              <textarea value={form.notes} onChange={set('notes')} rows={2} placeholder="Version, effective date, etc." />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Add Document'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
