export default function ComingSoon({ title, desc, icon }) {
  return (
    <div>
      <div className="page-header">
        <h1>{title}</h1>
        <p>{desc}</p>
      </div>
      <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
        <div style={{
          width: 72, height: 72,
          background: 'var(--plum-bg)',
          borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 1.5rem',
        }}>
          <span style={{ fontSize: '2rem' }}>🚧</span>
        </div>
        <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem' }}>{title} — Coming Soon</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9375rem', maxWidth: 400, margin: '0 auto' }}>
          {desc} This app is currently being built and will be available soon.
        </p>
      </div>
    </div>
  )
}
