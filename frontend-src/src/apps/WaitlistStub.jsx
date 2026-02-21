export default function WaitlistStub() {
  return (
    <div>
      <div className="page-header">
        <h1>Waiting List</h1>
        <p>Manage enrollment requests for your center.</p>
      </div>
      <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
        <div style={{
          width: 64, height: 64,
          background: 'var(--plum-bg)',
          borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 1.25rem',
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--plum)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <polyline points="10 9 9 9 8 9"/>
          </svg>
        </div>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>Waiting List is being integrated</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', maxWidth: 360, margin: '0 auto 1.5rem' }}>
          Your existing waiting list app is being migrated into this portal. In the meantime, you can access it directly.
        </p>
        <a
          href="https://waitlist-production-fcf9.up.railway.app"
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-primary"
        >
          Open Waiting List App ↗
        </a>
      </div>
    </div>
  )
}
