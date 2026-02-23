import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { FileText, Plus, X, ChevronDown, ChevronUp, Edit2 } from 'lucide-react'

const PERIODS = [
  'H1 2024', 'H2 2024', 'H1 2025', 'H2 2025', 'H1 2026', 'H2 2026',
]

export default function StaffReviewsApp() {
  const { user, API } = useAuth()
  const center = user?.centers?.[0]
  const [reviews, setReviews] = useState([])
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  const [filterStaff, setFilterStaff] = useState('')

  const load = () => {
    Promise.all([
      fetch(`${API}/reviews`, { credentials: 'include' }).then(r => r.json()),
      fetch(`${API}/staff`, { credentials: 'include' }).then(r => r.json()),
    ]).then(([r, s]) => {
      setReviews(Array.isArray(r) ? r : [])
      setStaff(Array.isArray(s) ? s.filter(x => x.status === 'active') : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const filteredReviews = filterStaff
    ? reviews.filter(r => r.staff_id === parseInt(filterStaff))
    : reviews

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><div className="spinner" /></div>

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1>Staff Reviews</h1>
          <p>Semi-annual performance reviews — archived and accessible to director and employee.</p>
        </div>
        {(user?.role === 'admin' || user?.role === 'director') && (
          <button className="btn btn-primary" onClick={() => { setEditing(null); setShowAdd(true) }}>
            <Plus size={16} /> Add Review
          </button>
        )}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <select
          value={filterStaff}
          onChange={e => setFilterStaff(e.target.value)}
          style={{ padding: '0.5rem 0.875rem', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem', color: 'var(--text)', background: 'white', minWidth: 200 }}
        >
          <option value="">All Staff Members</option>
          {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{filteredReviews.length} {filteredReviews.length === 1 ? 'review' : 'reviews'}</span>
      </div>

      {filteredReviews.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
          <div style={{ width: 72, height: 72, background: 'var(--plum-bg)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
            <FileText size={32} color="var(--plum)" />
          </div>
          <h3 style={{ fontWeight: 600, marginBottom: '0.5rem' }}>No reviews yet</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            Staff reviews are done twice a year. Start by adding the first review.
          </p>
          {(user?.role === 'admin' || user?.role === 'director') && (
            <button className="btn btn-primary" onClick={() => setShowAdd(true)}><Plus size={16} /> Add Review</button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {filteredReviews.map(review => {
            const isOpen = expandedId === review.id
            return (
              <div key={review.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <button
                  onClick={() => setExpandedId(isOpen ? null : review.id)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.25rem', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                >
                  <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'var(--plum-bg)', color: 'var(--plum)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.875rem', flexShrink: 0 }}>
                    {(review.staff_name || '?').split(' ').map(n => n[0]).join('').slice(0,2)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{review.staff_name}</div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{review.staff_title || 'Staff'}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexShrink: 0 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: '0.8125rem', fontWeight: 600, background: 'var(--plum-bg)', color: 'var(--plum)', padding: '0.25rem 0.75rem', borderRadius: 999 }}>
                      📅 {review.review_period}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {review.created_at?.split('T')[0] || review.created_at}
                    </span>
                    {(user?.role === 'admin' || user?.role === 'director') && (
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={e => { e.stopPropagation(); setEditing(review); setShowAdd(true) }}
                      >
                        <Edit2 size={14} />
                      </button>
                    )}
                    {isOpen ? <ChevronUp size={18} color="var(--text-muted)" /> : <ChevronDown size={18} color="var(--text-muted)" />}
                  </div>
                </button>

                {isOpen && (
                  <div style={{ borderTop: '1px solid var(--border)', padding: '1.25rem 1.5rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
                      {review.positives && (
                        <ReviewSection emoji="✅" title="Positives" content={review.positives} color="#ECFDF5" borderColor="#22C55E" textColor="#065F46" />
                      )}
                      {review.growth_areas && (
                        <ReviewSection emoji="📈" title="Areas for Growth" content={review.growth_areas} color="#EFF6FF" borderColor="#3B82F6" textColor="#1E40AF" />
                      )}
                      {review.focus_areas && (
                        <ReviewSection emoji="🎯" title="Focus Areas — Next Period" content={review.focus_areas} color="#FEF3C7" borderColor="#F59E0B" textColor="#92400E" />
                      )}
                      {review.notes && (
                        <ReviewSection emoji="📝" title="Additional Notes" content={review.notes} color="var(--surface)" borderColor="var(--border)" textColor="var(--text-muted)" />
                      )}
                    </div>
                    {review.reviewer_name && (
                      <div style={{ marginTop: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Reviewed by <strong>{review.reviewer_name}</strong> · {review.created_at?.split('T')[0]}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showAdd && (
        <ReviewModal
          review={editing}
          staff={staff}
          API={API}
          onSaved={() => { setShowAdd(false); setEditing(null); load() }}
          onClose={() => { setShowAdd(false); setEditing(null) }}
        />
      )}
    </div>
  )
}

function ReviewSection({ emoji, title, content, color, borderColor, textColor }) {
  return (
    <div style={{ background: color, border: `1px solid ${borderColor}`, borderRadius: 'var(--radius-sm)', padding: '0.875rem 1rem' }}>
      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: textColor, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>
        {emoji} {title}
      </div>
      <div style={{ fontSize: '0.875rem', color: 'var(--text)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{content}</div>
    </div>
  )
}

function ReviewModal({ review, staff, API, onSaved, onClose }) {
  const EMPTY = { staff_id: '', review_period: 'H1 2026', positives: '', growth_areas: '', focus_areas: '', notes: '' }
  const [form, setForm] = useState(review ? {
    staff_id: review.staff_id,
    review_period: review.review_period,
    positives: review.positives || '',
    growth_areas: review.growth_areas || '',
    focus_areas: review.focus_areas || '',
    notes: review.notes || '',
  } : EMPTY)
  const [saving, setSaving] = useState(false)
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.staff_id || !form.review_period) return
    setSaving(true)
    if (review) {
      await fetch(`${API}/reviews/${review.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(form) })
    } else {
      await fetch(`${API}/reviews`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(form) })
    }
    onSaved()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 620 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{review ? 'Edit Review' : 'Add Staff Review'}</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="grid-2">
              <div className="field">
                <label>Staff Member *</label>
                <select value={form.staff_id} onChange={set('staff_id')} required autoFocus disabled={!!review}>
                  <option value="">— Select staff —</option>
                  {staff.map(s => <option key={s.id} value={s.id}>{s.name} {s.title ? `(${s.title})` : ''}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Review Period *</label>
                <select value={form.review_period} onChange={set('review_period')} required>
                  {PERIODS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>

            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0.25rem 0 0.75rem' }}>Review Content</div>

            <div className="field">
              <label>✅ Positives</label>
              <textarea value={form.positives} onChange={set('positives')} rows={3} placeholder="What is this employee doing well? Areas of strength…" />
            </div>
            <div className="field">
              <label>📈 Areas for Growth / Weaknesses</label>
              <textarea value={form.growth_areas} onChange={set('growth_areas')} rows={3} placeholder="Areas that need development or improvement…" />
            </div>
            <div className="field">
              <label>🎯 Focus Areas for Next Period</label>
              <textarea value={form.focus_areas} onChange={set('focus_areas')} rows={3} placeholder="Specific goals or focuses for the next 6 months…" />
            </div>
            <div className="field">
              <label>📝 Additional Notes</label>
              <textarea value={form.notes} onChange={set('notes')} rows={2} placeholder="Any other context, context, or follow-up items…" />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : review ? 'Save Changes' : 'Submit Review'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
