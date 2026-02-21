import { BookOpen } from 'lucide-react'

export default function HandbookApp() {
  return (
    <div>
      <div className="page-header">
        <h1>Director's Handbook</h1>
        <p>Policies, procedures, and guidelines for center directors.</p>
      </div>
      <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
        <div style={{
          width: 72, height: 72,
          background: 'var(--plum-bg)',
          borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 1.5rem',
        }}>
          <BookOpen size={32} color="var(--plum)" />
        </div>
        <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem' }}>Handbook Coming Soon</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9375rem', maxWidth: 420, margin: '0 auto' }}>
          The Directors Handbook will be uploaded as a PDF and made available here. Directors will be able to browse sections and search for policies.
        </p>
      </div>
    </div>
  )
}
