import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { DollarSign, TrendingDown, TrendingUp, AlertCircle, CheckCircle, Info } from 'lucide-react'

function fmt(n) {
  return Number(n || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function pct(actual, budget) {
  if (!budget) return null
  return ((actual / budget) * 100).toFixed(1)
}

function variance(actual, budget) {
  return budget - actual
}

function StatusPill({ actual, budget }) {
  if (!budget) return null
  const v = variance(actual, budget)
  const p = Math.abs(v / budget) * 100
  if (v >= 0 && p > 10) return <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.7rem', fontWeight: 700, background: '#ECFDF5', color: '#065F46', padding: '0.2rem 0.5rem', borderRadius: 999 }}><CheckCircle size={10} /> Under Budget</span>
  if (v < 0) return <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.7rem', fontWeight: 700, background: '#FEF2F2', color: '#B91C1C', padding: '0.2rem 0.5rem', borderRadius: 999 }}><TrendingUp size={10} /> Over Budget</span>
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.7rem', fontWeight: 700, background: '#FEF3C7', color: '#92400E', padding: '0.2rem 0.5rem', borderRadius: 999 }}><AlertCircle size={10} /> Near Limit</span>
}

function BudgetBar({ actual, budget }) {
  if (!budget) return null
  const pctUsed = Math.min((actual / budget) * 100, 100)
  const color = actual > budget ? '#EF4444' : actual / budget > 0.9 ? '#F59E0B' : '#22C55E'
  return (
    <div style={{ height: 6, background: '#E5E7EB', borderRadius: 3, overflow: 'hidden', width: 80 }}>
      <div style={{ height: '100%', width: `${pctUsed}%`, background: color, borderRadius: 3, transition: 'width 0.4s ease' }} />
    </div>
  )
}

// ─── Dummy Data ───────────────────────────────────────────────────────────────

const LINE_ITEMS = [
  { account: 'Food & Kitchen Supplies',        monthly: { budget: 4800, actual: 4320 }, ytd: { budget: 14400, actual: 13200 }, remaining: { budget: 43200, actual: 13200 } },
  { account: 'Classroom Supplies & Toys',      monthly: { budget: 1200, actual: 1380 }, ytd: { budget: 3600,  actual: 3820  }, remaining: { budget: 10800, actual: 3820  } },
  { account: 'Office Supplies',                monthly: { budget: 350,  actual: 280  }, ytd: { budget: 1050,  actual: 790   }, remaining: { budget: 3150,  actual: 790   } },
  { account: 'Teacher Appreciation',           monthly: { budget: 500,  actual: 500  }, ytd: { budget: 1500,  actual: 1500  }, remaining: { budget: 6000,  actual: 1500  } },
  { account: 'Cleaning & Maintenance',         monthly: { budget: 800,  actual: 920  }, ytd: { budget: 2400,  actual: 2750  }, remaining: { budget: 7200,  actual: 2750  } },
  { account: 'Staff Development & Training',   monthly: { budget: 400,  actual: 150  }, ytd: { budget: 1200,  actual: 450   }, remaining: { budget: 4800,  actual: 450   } },
  { account: 'Marketing & Community',          monthly: { budget: 600,  actual: 540  }, ytd: { budget: 1800,  actual: 1620  }, remaining: { budget: 7200,  actual: 1620  } },
  { account: 'Miscellaneous',                  monthly: { budget: 300,  actual: 410  }, ytd: { budget: 900,   actual: 995   }, remaining: { budget: 3600,  actual: 995   } },
]

const VIEW_LABELS = {
  monthly: { label: 'Monthly', desc: 'Current month budget vs. actual spend' },
  ytd: { label: 'Year-to-Date', desc: 'Jan – present cumulative totals' },
  remaining: { label: 'Remaining Budget', desc: 'What\'s left for the rest of the year' },
}

export default function FinancialsApp() {
  const { user } = useAuth()
  const center = user?.centers?.[0]
  const [view, setView] = useState('monthly')

  const d = VIEW_LABELS[view]
  const totalBudget = LINE_ITEMS.reduce((s, l) => s + l[view].budget, 0)
  const totalActual = LINE_ITEMS.reduce((s, l) => s + l[view].actual, 0)
  const totalVariance = variance(totalActual, totalBudget)
  const overCount = LINE_ITEMS.filter(l => l[view].actual > l[view].budget).length

  const today = new Date()
  const monthName = today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  return (
    <div>
      <div className="page-header">
        <h1>Financial Performance</h1>
        <p>{center?.name || 'Your center'} — Cost vs. Budget</p>
      </div>

      {/* IES notice */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 'var(--radius-sm)', padding: '0.75rem 1rem', marginBottom: '1.25rem', fontSize: '0.8125rem', color: '#1E40AF' }}>
        <Info size={15} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>Data will sync automatically from <strong>IES (Intuit Enterprise Suite)</strong> once integration is complete. Numbers shown below are sample data.</span>
      </div>

      {/* View toggle */}
      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.5rem', background: 'var(--border)', borderRadius: 'var(--radius-sm)', padding: '0.25rem', width: 'fit-content' }}>
        {Object.entries(VIEW_LABELS).map(([key, { label }]) => (
          <button key={key} onClick={() => setView(key)} className="btn"
            style={{ background: view === key ? 'var(--white)' : 'transparent', color: view === key ? 'var(--plum)' : 'var(--text-muted)', boxShadow: view === key ? 'var(--shadow-sm)' : 'none', fontSize: '0.8125rem', padding: '0.375rem 1rem', fontWeight: view === key ? 600 : 400 }}>
            {label}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <div className="grid-3" style={{ marginBottom: '1.5rem', gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="card" style={{ borderLeft: '4px solid var(--plum)', padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500, marginBottom: '0.375rem' }}>{d.label} Budget</div>
          <div style={{ fontSize: '1.625rem', fontWeight: 700, color: 'var(--plum)' }}>{fmt(totalBudget)}</div>
        </div>
        <div className="card" style={{ borderLeft: '4px solid #6366F1', padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500, marginBottom: '0.375rem' }}>Actual Spend</div>
          <div style={{ fontSize: '1.625rem', fontWeight: 700, color: '#6366F1' }}>{fmt(totalActual)}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{pct(totalActual, totalBudget)}% of budget used</div>
        </div>
        <div className="card" style={{ borderLeft: `4px solid ${totalVariance >= 0 ? '#22C55E' : '#EF4444'}`, padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500, marginBottom: '0.375rem' }}>
            {totalVariance >= 0 ? '✅ Under Budget by' : '⚠️ Over Budget by'}
          </div>
          <div style={{ fontSize: '1.625rem', fontWeight: 700, color: totalVariance >= 0 ? '#22C55E' : '#EF4444' }}>
            {fmt(Math.abs(totalVariance))}
          </div>
        </div>
        <div className="card" style={{ borderLeft: `4px solid ${overCount > 0 ? '#F59E0B' : 'var(--sage)'}`, padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500, marginBottom: '0.375rem' }}>Lines Over Budget</div>
          <div style={{ fontSize: '1.625rem', fontWeight: 700, color: overCount > 0 ? '#F59E0B' : 'var(--sage)' }}>{overCount}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>of {LINE_ITEMS.length} categories</div>
        </div>
      </div>

      {/* Line item table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>Controllable Cost Lines</div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{d.desc}</div>
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{monthName}</div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
            <thead>
              <tr style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
                {['Account', 'Budget', 'Actual', 'Variance', '% Used', '', 'Status'].map(h => (
                  <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {LINE_ITEMS.map((item, i) => {
                const { budget, actual } = item[view]
                const v = variance(actual, budget)
                const p = pct(actual, budget)
                return (
                  <tr key={item.account} style={{ borderBottom: i < LINE_ITEMS.length - 1 ? '1px solid var(--border)' : 'none' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--plum-bg)'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}
                  >
                    <td style={{ padding: '0.875rem 1rem', fontWeight: 500, fontSize: '0.9rem' }}>{item.account}</td>
                    <td style={{ padding: '0.875rem 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>{fmt(budget)}</td>
                    <td style={{ padding: '0.875rem 1rem', fontSize: '0.875rem', fontWeight: 600 }}>{fmt(actual)}</td>
                    <td style={{ padding: '0.875rem 1rem', fontSize: '0.875rem', fontWeight: 600, color: v >= 0 ? '#22C55E' : '#EF4444' }}>
                      {v >= 0 ? '+' : ''}{fmt(v)}
                    </td>
                    <td style={{ padding: '0.875rem 1rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{p}%</td>
                    <td style={{ padding: '0.875rem 1rem' }}><BudgetBar actual={actual} budget={budget} /></td>
                    <td style={{ padding: '0.875rem 1rem' }}><StatusPill actual={actual} budget={budget} /></td>
                  </tr>
                )
              })}
              {/* Totals row */}
              <tr style={{ background: 'var(--surface)', borderTop: '2px solid var(--border)' }}>
                <td style={{ padding: '0.875rem 1rem', fontWeight: 700, fontSize: '0.9rem' }}>Total</td>
                <td style={{ padding: '0.875rem 1rem', fontWeight: 700, fontSize: '0.875rem' }}>{fmt(totalBudget)}</td>
                <td style={{ padding: '0.875rem 1rem', fontWeight: 700, fontSize: '0.875rem' }}>{fmt(totalActual)}</td>
                <td style={{ padding: '0.875rem 1rem', fontWeight: 700, fontSize: '0.875rem', color: totalVariance >= 0 ? '#22C55E' : '#EF4444' }}>
                  {totalVariance >= 0 ? '+' : ''}{fmt(totalVariance)}
                </td>
                <td style={{ padding: '0.875rem 1rem', fontWeight: 700, fontSize: '0.8125rem' }}>{pct(totalActual, totalBudget)}%</td>
                <td /><td />
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '1.5rem', marginTop: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}><div style={{ width: 10, height: 10, background: '#22C55E', borderRadius: 2 }} /> Under budget (&gt;10% remaining)</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}><div style={{ width: 10, height: 10, background: '#F59E0B', borderRadius: 2 }} /> Within 10% of budget</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}><div style={{ width: 10, height: 10, background: '#EF4444', borderRadius: 2 }} /> Over budget</div>
      </div>
    </div>
  )
}
