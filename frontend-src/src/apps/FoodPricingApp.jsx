import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  Plus, ChevronDown, ChevronUp, TrendingDown, UtensilsCrossed,
  DollarSign, X, Edit2, Upload, Search, BarChart3, Package,
  ShoppingCart, Leaf, AlertCircle, CheckCircle2, FileText
} from 'lucide-react'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
const MEALS = ['Breakfast', 'Lunch', 'Snack']

const CATEGORY_COLORS = {
  produce:   { bg: '#ECFDF5', color: '#065F46', border: '#6EE7B7', emoji: '🥬' },
  dairy:     { bg: '#EFF6FF', color: '#1D4ED8', border: '#93C5FD', emoji: '🥛' },
  protein:   { bg: '#FFF1F2', color: '#BE123C', border: '#FDA4AF', emoji: '🥩' },
  grain:     { bg: '#FFFBEB', color: '#92400E', border: '#FCD34D', emoji: '🌾' },
  canned:    { bg: '#F0FDF4', color: '#166534', border: '#86EFAC', emoji: '🥫' },
  frozen:    { bg: '#F0F9FF', color: '#0369A1', border: '#7DD3FC', emoji: '❄️' },
  beverage:  { bg: '#FDF4FF', color: '#7E22CE', border: '#D8B4FE', emoji: '🧃' },
  condiment: { bg: '#FFF7ED', color: '#C2410C', border: '#FDBA74', emoji: '🍯' },
  general:   { bg: '#F9FAFB', color: '#374151', border: '#D1D5DB', emoji: '📦' },
}

const MEAL_COLORS = {
  Breakfast: { bg: '#FFFBEB', color: '#92400E', border: '#FCD34D', label: '☀️ Breakfast' },
  Lunch:     { bg: '#ECFDF5', color: '#065F46', border: '#6EE7B7', label: '🌿 Lunch' },
  Snack:     { bg: '#F5F0F8', color: '#6B3F7C', border: '#C4B5FD', label: '🍎 Snack' },
}

export default function FoodPricingApp() {
  const { user, API } = useAuth()
  const center = user?.centers?.[0]
  const [tab, setTab] = useState('upload')
  const [menus, setMenus] = useState([])
  const [ingredients, setIngredients] = useState([])
  const [vendors, setVendors] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!center) return
    Promise.all([
      fetch(`${API}/centers/${center.id}/menus`, { credentials: 'include' }).then(r => r.json()),
      fetch(`${API}/ingredients`, { credentials: 'include' }).then(r => r.json()),
      fetch(`${API}/vendors`, { credentials: 'include' }).then(r => r.json()),
    ]).then(([m, i, v]) => {
      setMenus(Array.isArray(m) ? m : [])
      setIngredients(Array.isArray(i) ? i : [])
      setVendors(Array.isArray(v) ? v : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [center, API])

  // Computed stats
  const stats = useMemo(() => {
    const totalIngredients = ingredients.length
    const totalVendors = vendors.length
    let monthlyMin = 0, monthlyMax = 0, hasAnyPrice = false

    ingredients.forEach(ing => {
      if (!ing.prices?.length) return
      const sorted = [...ing.prices].sort((a, b) => a.price - b.price)
      monthlyMin += sorted[0].price * 20
      monthlyMax += sorted[sorted.length - 1].price * 20
      hasAnyPrice = true
    })

    const savings = monthlyMax - monthlyMin

    return {
      totalIngredients,
      totalVendors,
      monthlyCost: hasAnyPrice ? monthlyMin : null,
      savings: hasAnyPrice && savings > 0 ? savings : null,
    }
  }, [ingredients, vendors])

  const compareCount = ingredients.filter(i => i.prices?.length > 1).length

  const tabs = [
    { key: 'upload',  label: 'Upload List',      icon: Upload,         count: null },
    { key: 'menus',   label: 'Menus',             icon: UtensilsCrossed,count: menus.length },
    { key: 'prices',  label: 'Ingredients',       icon: Package,        count: ingredients.length },
    { key: 'compare', label: 'Compare Vendors',   icon: BarChart3,      count: compareCount },
  ]

  return (
    <div>
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <UtensilsCrossed size={22} style={{ color: 'var(--plum)' }} />
              Food Pricing
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.2rem' }}>
              Upload your ingredient list — find the cheapest vendors automatically.
              <span style={{ color: 'var(--text-light)', marginLeft: '0.75rem', fontSize: '0.8125rem' }}>
                Updated {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      {!loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.875rem', marginBottom: '1.5rem' }}>
          <StatCard
            icon={<Package size={18} />}
            iconBg="var(--plum)"
            label="Ingredients Tracked"
            value={stats.totalIngredients}
            suffix=""
            empty="0"
          />
          <StatCard
            icon={<ShoppingCart size={18} />}
            iconBg="var(--sage)"
            label="Vendors on File"
            value={stats.totalVendors}
            suffix=""
            empty="0"
          />
          <StatCard
            icon={<DollarSign size={18} />}
            iconBg="#C9A84C"
            label="Est. Monthly Cost"
            value={stats.monthlyCost !== null ? `$${stats.monthlyCost.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : null}
            suffix="/mo"
            empty="Add prices to estimate"
          />
          <StatCard
            icon={<TrendingDown size={18} />}
            iconBg="#3D6B40"
            label="Potential Savings"
            value={stats.savings !== null ? `$${stats.savings.toFixed(0)}` : null}
            suffix="/mo"
            empty="Add multiple vendors"
            valueColor="#3D6B40"
          />
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.375rem', marginBottom: '1.5rem', background: 'var(--white)', borderRadius: 'var(--radius-sm)', padding: '0.3rem', width: 'fit-content', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
        {tabs.map(t => {
          const Icon = t.icon
          const active = tab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="btn"
              style={{
                background: active ? 'var(--plum)' : 'transparent',
                color: active ? 'white' : 'var(--text-muted)',
                boxShadow: active ? 'var(--shadow-sm)' : 'none',
                fontSize: '0.8125rem',
                padding: '0.5rem 1rem',
                gap: '0.375rem',
                transition: 'all 0.15s',
              }}
            >
              <Icon size={14} />
              {t.label}
              {t.count !== null && t.count > 0 && (
                <span style={{
                  background: active ? 'rgba(255,255,255,0.25)' : 'var(--border)',
                  color: active ? 'white' : 'var(--text-muted)',
                  borderRadius: 999,
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  padding: '0.1rem 0.425rem',
                  minWidth: 18,
                  textAlign: 'center',
                }}>
                  {t.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
          <div className="spinner" />
        </div>
      ) : tab === 'upload' ? (
        <UploadTab vendors={vendors} setIngredients={setIngredients} setTab={setTab} API={API} user={user} />
      ) : tab === 'menus' ? (
        <MenusTab menus={menus} setMenus={setMenus} center={center} API={API} user={user} />
      ) : tab === 'prices' ? (
        <PricesTab ingredients={ingredients} setIngredients={setIngredients} vendors={vendors} API={API} user={user} />
      ) : (
        <CompareTab ingredients={ingredients} vendors={vendors} API={API} />
      )}
    </div>
  )
}

// ── Stat Card ──────────────────────────────────────────────────────────────────

function StatCard({ icon, iconBg, label, value, suffix, empty, valueColor }) {
  return (
    <div style={{
      background: 'var(--white)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      padding: '1rem 1.25rem',
      display: 'flex',
      alignItems: 'center',
      gap: '0.875rem',
      boxShadow: 'var(--shadow-sm)',
    }}>
      <div style={{
        width: 38, height: 38,
        background: iconBg,
        borderRadius: '10px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'white',
        flexShrink: 0,
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>
          {label}
        </div>
        {value !== null && value !== undefined ? (
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: valueColor || 'var(--text)', lineHeight: 1.2 }}>
            {value}<span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)', marginLeft: '0.2rem' }}>{suffix}</span>
          </div>
        ) : (
          <div style={{ fontSize: '0.78rem', color: 'var(--text-light)', fontStyle: 'italic' }}>{empty}</div>
        )}
      </div>
    </div>
  )
}

// ── Upload Tab ─────────────────────────────────────────────────────────────────

function UploadTab({ vendors, setIngredients, setTab, API, user }) {
  const [text, setText] = useState('')
  const [parsed, setParsed] = useState(null)
  const [lookupResults, setLookupResults] = useState({})
  const [looking, setLooking] = useState(false)
  const [krogerAvailable, setKrogerAvailable] = useState(null)
  const [parsing, setParsing] = useState(false)

  const step = !parsed ? 1 : Object.keys(lookupResults).length === 0 ? 2 : 3

  const handleParse = async () => {
    if (!text.trim()) return
    setParsing(true)
    const res = await fetch(`${API}/ingredients/parse-list`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ text }),
    })
    const data = await res.json()
    setParsed(data.items || [])
    setParsing(false)
  }

  const handleLookupAll = async () => {
    if (!parsed?.length) return
    setLooking(true)
    const results = {}
    for (const item of parsed) {
      const res = await fetch(`${API}/ingredients/lookup`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ query: item.name }),
      })
      const data = await res.json()
      results[item.name] = data
      if (data.source === 'unavailable') { setKrogerAvailable(false); break; }
      setKrogerAvailable(true)
    }
    setLookupResults(results)
    setLooking(false)
    const ingRes = await fetch(`${API}/ingredients`, { credentials: 'include' })
    const ingData = await ingRes.json()
    if (Array.isArray(ingData)) setIngredients(ingData)
  }

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setText(ev.target?.result || '')
    reader.readAsText(file)
  }

  return (
    <div>
      {/* Step Indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0', marginBottom: '1.5rem' }}>
        {[
          { n: 1, label: 'Paste or Upload' },
          { n: 2, label: 'Parse Ingredients' },
          { n: 3, label: 'Find Best Prices' },
        ].map((s, i) => (
          <div key={s.n} style={{ display: 'flex', alignItems: 'center', flex: i < 2 ? 1 : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{
                width: 28, height: 28,
                borderRadius: '50%',
                background: step >= s.n ? 'var(--plum)' : 'var(--border)',
                color: step >= s.n ? 'white' : 'var(--text-muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.75rem', fontWeight: 700,
                flexShrink: 0,
                transition: 'all 0.2s',
              }}>
                {step > s.n ? <CheckCircle2 size={14} /> : s.n}
              </div>
              <span style={{
                fontSize: '0.8125rem',
                fontWeight: step === s.n ? 600 : 400,
                color: step >= s.n ? 'var(--text)' : 'var(--text-muted)',
                whiteSpace: 'nowrap',
              }}>
                {s.label}
              </span>
            </div>
            {i < 2 && (
              <div style={{
                flex: 1, height: 2,
                background: step > s.n ? 'var(--plum)' : 'var(--border)',
                margin: '0 0.75rem',
                borderRadius: 1,
                transition: 'background 0.2s',
              }} />
            )}
          </div>
        ))}
      </div>

      {/* Status Banners */}
      {krogerAvailable === false && (
        <div style={{
          background: '#FEF3C7',
          borderLeft: '4px solid #F59E0B',
          borderRadius: 'var(--radius-sm)',
          padding: '0.875rem 1.125rem',
          marginBottom: '1rem',
          fontSize: '0.875rem',
          color: '#92400E',
          display: 'flex', alignItems: 'flex-start', gap: '0.625rem',
        }}>
          <AlertCircle size={16} style={{ marginTop: 1, flexShrink: 0, color: '#F59E0B' }} />
          <div>
            <strong>Kroger API not connected.</strong> Register free at developer.kroger.com and share your credentials to enable live pricing. Manual prices can still be entered in the Ingredients tab.
          </div>
        </div>
      )}
      {krogerAvailable === true && (
        <div style={{
          background: 'var(--sage-light)',
          borderLeft: '4px solid var(--sage)',
          borderRadius: 'var(--radius-sm)',
          padding: '0.875rem 1.125rem',
          marginBottom: '1rem',
          fontSize: '0.875rem',
          color: '#3D6B40',
          display: 'flex', alignItems: 'center', gap: '0.625rem',
        }}>
          <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
          <div><strong>Live Kroger pricing active.</strong> Prices are current as of today.</div>
        </div>
      )}

      {/* Upload Card */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.5rem' }}>
          <FileText size={16} style={{ color: 'var(--plum)' }} />
          <span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>Paste or Upload Your Ingredient List</span>
        </div>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
          Paste your ingredient list below (one item per line), or upload a .txt or .csv file.
          Format can be <em>"2 lbs chicken breast"</em> or just <em>"whole milk"</em> — we'll parse it automatically.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem', alignItems: 'center' }}>
          <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
            <Upload size={13} /> Upload File
            <input type="file" accept=".txt,.csv" onChange={handleFileUpload} style={{ display: 'none' }} />
          </label>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>or paste below:</span>
        </div>
        <textarea
          value={text}
          onChange={e => { setText(e.target.value); setParsed(null); setLookupResults({}) }}
          placeholder={'Example:\n2 gallons whole milk\n5 lbs chicken breast\n1 case canned corn (24 ct)\napple juice\nwhole wheat bread\n...'}
          style={{
            width: '100%', minHeight: 180, padding: '0.875rem',
            border: '1.5px solid var(--border)', borderRadius: 'var(--radius-sm)',
            fontSize: '0.9rem', fontFamily: 'monospace', resize: 'vertical', outline: 'none',
            background: 'var(--surface)', lineHeight: 1.6,
          }}
          onFocus={e => e.target.style.borderColor = 'var(--plum)'}
          onBlur={e => e.target.style.borderColor = 'var(--border)'}
        />
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.875rem' }}>
          <button className="btn btn-secondary" onClick={handleParse} disabled={!text.trim() || parsing}>
            <Search size={14} />
            {parsing ? 'Parsing…' : 'Parse List'}
          </button>
          {parsed && (
            <button className="btn btn-primary" onClick={handleLookupAll} disabled={looking}>
              <ShoppingCart size={14} />
              {looking ? 'Checking prices…' : 'Find Cheapest Prices'}
            </button>
          )}
        </div>
      </div>

      {/* Parsed Results */}
      {parsed && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{
            padding: '0.875rem 1.25rem',
            borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>
              {parsed.length} ingredient{parsed.length !== 1 ? 's' : ''} parsed
              {Object.keys(lookupResults).length > 0 && (
                <span style={{ color: 'var(--sage)', marginLeft: '0.5rem', fontSize: '0.8125rem', fontWeight: 500 }}>
                  · prices checked ✓
                </span>
              )}
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Step 2 of 3 complete</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface)' }}>
                {['Ingredient', 'Qty / Unit', 'Best Price', 'Source', ''].map(h => (
                  <th key={h} style={{ padding: '0.625rem 1rem', textAlign: 'left', fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {parsed.map((item, i) => {
                const result = lookupResults[item.name]
                const bestProduct = result?.products?.[0]
                return (
                  <tr key={i} style={{ borderTop: '1px solid var(--border)', transition: 'background 0.1s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--surface)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 500, fontSize: '0.875rem' }}>{item.name}</td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                      {item.qty ? `${item.qty} ${item.unit}` : '—'}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>
                      {result ? (
                        bestProduct ? (
                          <div>
                            <div style={{ fontWeight: 700, color: '#3D6B40', fontSize: '0.9375rem' }}>
                              ${bestProduct.price?.toFixed(2) || '?'}
                              {bestProduct.size && <span style={{ fontWeight: 400, fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.25rem' }}>/ {bestProduct.size}</span>}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>{bestProduct.name}</div>
                          </div>
                        ) : <span style={{ color: 'var(--text-light)', fontSize: '0.8125rem' }}>Not found</span>
                      ) : (
                        looking
                          ? <span style={{ color: 'var(--plum)', fontSize: '0.8125rem', fontStyle: 'italic' }}>Checking…</span>
                          : <span style={{ color: 'var(--text-light)', fontSize: '0.8125rem' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      {result?.source === 'kroger' && (
                        <span style={{ fontSize: '0.75rem', background: '#EFF6FF', color: '#1D4ED8', padding: '0.2rem 0.5rem', borderRadius: 999, fontWeight: 600 }}>🛒 Kroger</span>
                      )}
                      {result?.source === 'unavailable' && (
                        <span style={{ fontSize: '0.75rem', background: '#FFF1F2', color: '#BE123C', padding: '0.2rem 0.5rem', borderRadius: 999, fontWeight: 600 }}>⚠️ API needed</span>
                      )}
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      {bestProduct?.price && (
                        <button className="btn btn-ghost btn-sm" style={{ fontSize: '0.75rem' }}
                          onClick={async () => {
                            const ingRes = await fetch(`${API}/ingredients`, { credentials: 'include' })
                            const ings = await ingRes.json()
                            const ing = ings.find(x => x.name.toLowerCase() === item.name.toLowerCase())
                            if (ing) alert(`Price saved to ${ing.name}`)
                          }}>
                          Save Price
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Menus Tab ──────────────────────────────────────────────────────────────────

function MenusTab({ menus, setMenus, center, API, user }) {
  const [expanded, setExpanded] = useState(menus[0]?.id || null)
  const [showAdd, setShowAdd] = useState(false)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          {menus.length} menu week{menus.length !== 1 ? 's' : ''} on file
        </p>
        {user?.role === 'admin' && (
          <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>
            <Plus size={14} /> Add Menu Week
          </button>
        )}
      </div>

      {menus.length === 0 && (
        <div className="card empty-state">
          <UtensilsCrossed size={36} />
          <h3>No menus yet</h3>
          <p>Upload a weekly menu to get started with ingredient tracking.</p>
        </div>
      )}

      {menus.map(menu => (
        <div key={menu.id} style={{
          background: 'var(--white)',
          border: '1px solid var(--border)',
          borderLeft: '4px solid var(--plum)',
          borderRadius: 'var(--radius)',
          marginBottom: '0.75rem',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-sm)',
        }}>
          <button
            onClick={() => setExpanded(expanded === menu.id ? null : menu.id)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '1rem 1.25rem', background: 'none', border: 'none', cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--text)' }}>{menu.week_label}</div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>
                📅 {menu.week_start} – {menu.week_end}
              </div>
            </div>
            <div style={{ color: 'var(--plum)' }}>
              {expanded === menu.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </div>
          </button>

          {expanded === menu.id && menu.items?.length > 0 && (
            <div style={{ overflowX: 'auto', borderTop: '1px solid var(--border)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
                <thead>
                  <tr style={{ background: 'var(--plum-bg)' }}>
                    <th style={{ padding: '0.625rem 1rem', textAlign: 'left', fontSize: '0.6875rem', fontWeight: 700, color: 'var(--plum)', textTransform: 'uppercase', letterSpacing: '0.05em', width: 110 }}>Meal</th>
                    {DAYS.map(d => (
                      <th key={d} style={{ padding: '0.625rem 0.75rem', textAlign: 'left', fontSize: '0.6875rem', fontWeight: 700, color: 'var(--plum)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{d}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {MEALS.map((meal) => {
                    const mc = MEAL_COLORS[meal]
                    return (
                      <tr key={meal} style={{ borderTop: '1px solid var(--border)' }}>
                        <td style={{ padding: '0.75rem 1rem', verticalAlign: 'top' }}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                            fontSize: '0.75rem', fontWeight: 700,
                            background: mc.bg, color: mc.color,
                            border: `1px solid ${mc.border}`,
                            padding: '0.25rem 0.625rem', borderRadius: 999,
                          }}>
                            {mc.label}
                          </span>
                        </td>
                        {DAYS.map(day => {
                          const item = menu.items.find(i => i.day_of_week === day && i.meal_type === meal)
                          return (
                            <td key={day} style={{ padding: '0.75rem 0.75rem', fontSize: '0.8125rem', color: 'var(--text)', verticalAlign: 'top', lineHeight: 1.6 }}>
                              {item ? item.items.split(', ').map((food, i) => (
                                <div key={i} style={{ marginBottom: '0.1rem' }}>{food}</div>
                              )) : <span style={{ color: 'var(--text-light)' }}>—</span>}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}

      {showAdd && <AddMenuModal center={center} API={API} onClose={() => setShowAdd(false)} onSaved={m => { setMenus(prev => [m, ...prev]); setShowAdd(false) }} />}
    </div>
  )
}

// ── Prices Tab ─────────────────────────────────────────────────────────────────

function PricesTab({ ingredients, setIngredients, vendors, API, user }) {
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState(null)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')

  const categories = useMemo(() => {
    const cats = new Set(ingredients.map(i => i.category).filter(Boolean))
    return ['all', ...Array.from(cats).sort()]
  }, [ingredients])

  const filtered = ingredients.filter(i => {
    const matchSearch = i.name.toLowerCase().includes(search.toLowerCase())
    const matchCat = categoryFilter === 'all' || i.category === categoryFilter
    return matchSearch && matchCat
  })

  return (
    <div>
      {/* Filters Row */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 180 }}>
          <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search ingredients…"
            style={{ width: '100%', paddingLeft: '2.25rem', padding: '0.625rem 0.875rem 0.625rem 2.25rem', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '0.9rem', outline: 'none' }}
            onFocus={e => e.target.style.borderColor = 'var(--plum)'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'}
          />
        </div>
        {user?.role === 'admin' && (
          <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>
            <Plus size={14} /> Add Ingredient
          </button>
        )}
      </div>

      {/* Category Filter Pills */}
      <div style={{ display: 'flex', gap: '0.375rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {categories.map(cat => {
          const isAll = cat === 'all'
          const cc = CATEGORY_COLORS[cat]
          const active = categoryFilter === cat
          return (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              style={{
                padding: '0.3rem 0.75rem',
                borderRadius: 999,
                border: `1.5px solid ${active ? (isAll ? 'var(--plum)' : cc?.border || 'var(--border)') : 'var(--border)'}`,
                background: active ? (isAll ? 'var(--plum-bg)' : cc?.bg || 'var(--surface)') : 'var(--white)',
                color: active ? (isAll ? 'var(--plum)' : cc?.color || 'var(--text)') : 'var(--text-muted)',
                fontSize: '0.78rem',
                fontWeight: active ? 700 : 400,
                cursor: 'pointer',
                transition: 'all 0.15s',
                display: 'flex', alignItems: 'center', gap: '0.3rem',
              }}
            >
              {!isAll && cc?.emoji && cc.emoji}
              {isAll ? 'All Categories' : cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          )
        })}
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)', background: 'var(--surface)' }}>
              {['Ingredient', 'Category', 'Cheapest Vendor', 'Best Price', 'Vendors', ''].map(h => (
                <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.6875rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((ing, i) => {
              const cheapest = ing.prices?.sort((a, b) => a.price - b.price)[0]
              const cc = CATEGORY_COLORS[ing.category] || CATEGORY_COLORS.general
              return (
                <tr
                  key={ing.id}
                  style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none', transition: 'background 0.1s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '0.875rem 1rem', fontWeight: 600, fontSize: '0.9rem' }}>{ing.name}</td>
                  <td style={{ padding: '0.875rem 1rem' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                      background: cc.bg, color: cc.color,
                      border: `1px solid ${cc.border}`,
                      padding: '0.2rem 0.6rem', borderRadius: 999,
                      fontSize: '0.72rem', fontWeight: 700,
                    }}>
                      {cc.emoji} {ing.category}
                    </span>
                  </td>
                  <td style={{ padding: '0.875rem 1rem', fontSize: '0.875rem', color: cheapest ? '#3D6B40' : 'var(--text-muted)', fontWeight: cheapest ? 600 : 400 }}>
                    {cheapest ? cheapest.vendor_name : '—'}
                  </td>
                  <td style={{ padding: '0.875rem 1rem' }}>
                    {cheapest ? (
                      <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text)' }}>
                        ${cheapest.price.toFixed(2)}
                        <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-muted)', marginLeft: '0.2rem' }}>/ {cheapest.unit}</span>
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-light)', fontSize: '0.8125rem' }}>No prices yet</span>
                    )}
                  </td>
                  <td style={{ padding: '0.875rem 1rem' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: 28, height: 28,
                      background: ing.prices?.length ? 'var(--plum-bg)' : 'var(--surface)',
                      color: ing.prices?.length ? 'var(--plum)' : 'var(--text-muted)',
                      borderRadius: '50%', fontSize: '0.75rem', fontWeight: 700,
                    }}>
                      {ing.prices?.length || 0}
                    </span>
                  </td>
                  <td style={{ padding: '0.875rem 1rem' }}>
                    {user?.role === 'admin' && (
                      <button className="btn btn-ghost btn-sm" onClick={() => setEditing(ing)}>
                        <Edit2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                  {search || categoryFilter !== 'all'
                    ? 'No ingredients match your filters.'
                    : 'No ingredients yet. Add some to start tracking prices.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <AddIngredientModal vendors={vendors} API={API}
          onClose={() => setShowAdd(false)}
          onSaved={ing => { setIngredients(prev => [...prev, { ...ing, prices: [] }]); setShowAdd(false) }}
        />
      )}
      {editing && (
        <EditPricesModal ingredient={editing} vendors={vendors} API={API}
          onClose={() => setEditing(null)}
          onSaved={updated => {
            setIngredients(prev => prev.map(i => i.id === updated.id ? updated : i))
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}

// ── Compare Tab ────────────────────────────────────────────────────────────────

function CompareTab({ ingredients, vendors }) {
  const withPrices = ingredients.filter(i => i.prices?.length > 1)

  const totalSavings = useMemo(() => {
    return withPrices.reduce((sum, ing) => {
      const sorted = [...ing.prices].sort((a, b) => a.price - b.price)
      return sum + (sorted[sorted.length - 1].price - sorted[0].price)
    }, 0)
  }, [withPrices])

  if (withPrices.length === 0) {
    return (
      <div className="card empty-state">
        <BarChart3 size={36} />
        <h3>No comparisons yet</h3>
        <p>Add ingredient prices from at least 2 vendors to see comparisons here.</p>
      </div>
    )
  }

  return (
    <div>
      {/* Summary Banner */}
      <div style={{
        background: 'var(--sage-light)',
        border: '1px solid #C6DBC8',
        borderLeft: '4px solid var(--sage)',
        borderRadius: 'var(--radius)',
        padding: '1rem 1.25rem',
        marginBottom: '1.25rem',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <TrendingDown size={20} style={{ color: 'var(--sage)' }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#3D6B40' }}>
              Total Potential Savings: ${totalSavings.toFixed(2)}/order
            </div>
            <div style={{ fontSize: '0.8125rem', color: '#5A8A5E' }}>
              Across {withPrices.length} ingredient{withPrices.length !== 1 ? 's' : ''} with multiple vendor prices.
              <span style={{ color: '#3D6B40', fontWeight: 600 }}> Green bars = best price.</span>
            </div>
          </div>
        </div>
      </div>

      {withPrices.map(ing => {
        const sorted = [...ing.prices].sort((a, b) => a.price - b.price)
        const cheapest = sorted[0]
        const priciest = sorted[sorted.length - 1]
        const savings = priciest.price - cheapest.price
        const maxPrice = priciest.price

        return (
          <div key={ing.id} className="card" style={{ marginBottom: '0.875rem' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text)' }}>{ing.name}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'var(--surface)', padding: '0.2rem 0.5rem', borderRadius: 999, border: '1px solid var(--border)' }}>
                  per {cheapest.unit}
                </span>
              </div>
              {savings > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem', fontWeight: 700, color: '#3D6B40', background: 'var(--sage-light)', padding: '0.3rem 0.75rem', borderRadius: 999 }}>
                  <TrendingDown size={13} />
                  Save ${savings.toFixed(2)} with {cheapest.vendor_name}
                </div>
              )}
            </div>

            {/* Bar Chart */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {sorted.map((p, i) => {
                const barPct = maxPrice > 0 ? (p.price / maxPrice) * 100 : 0
                const isBest = i === 0
                return (
                  <div key={p.vendor_name} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: 120, fontSize: '0.8125rem', fontWeight: isBest ? 700 : 400, color: isBest ? '#3D6B40' : 'var(--text-muted)', flexShrink: 0, textAlign: 'right' }}>
                      {p.vendor_name}
                    </div>
                    <div style={{ flex: 1, height: 28, background: 'var(--surface)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: `1px solid ${isBest ? '#C6DBC8' : 'var(--border)'}` }}>
                      <div style={{
                        width: `${barPct}%`,
                        height: '100%',
                        background: isBest ? 'var(--sage)' : 'var(--plum-bg)',
                        borderRadius: 'var(--radius-sm)',
                        display: 'flex', alignItems: 'center', paddingLeft: '0.625rem',
                        transition: 'width 0.4s ease',
                        minWidth: 60,
                      }}>
                        <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: isBest ? 'white' : 'var(--plum)', whiteSpace: 'nowrap' }}>
                          ${p.price.toFixed(2)}
                        </span>
                      </div>
                    </div>
                    {isBest && (
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#3D6B40', background: 'var(--sage-light)', border: '1px solid #C6DBC8', padding: '0.2rem 0.5rem', borderRadius: 999, whiteSpace: 'nowrap', flexShrink: 0 }}>
                        ✓ BEST
                      </span>
                    )}
                    {!isBest && savings > 0 && (
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0, width: 60 }}>
                        +${(p.price - cheapest.price).toFixed(2)}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Modals ─────────────────────────────────────────────────────────────────────

function AddIngredientModal({ vendors, API, onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', category: 'produce', unit: 'lb' })
  const [saving, setSaving] = useState(false)
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault(); setSaving(true)
    const res = await fetch(`${API}/ingredients`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(form) })
    const data = await res.json()
    if (res.ok) onSaved(data); else alert(data.error)
    setSaving(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header"><h2>Add Ingredient</h2><button className="btn btn-ghost btn-sm" onClick={onClose}><X size={16} /></button></div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="field"><label>Ingredient Name</label><input value={form.name} onChange={set('name')} placeholder="e.g. Whole Milk" required autoFocus /></div>
            <div className="grid-2">
              <div className="field"><label>Category</label>
                <select value={form.category} onChange={set('category')}>
                  {Object.keys(CATEGORY_COLORS).map(c => (
                    <option key={c} value={c}>{CATEGORY_COLORS[c].emoji} {c.charAt(0).toUpperCase() + c.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div className="field"><label>Unit</label>
                <select value={form.unit} onChange={set('unit')}>
                  {['lb','oz','gallon','quart','pint','each','case','bag','box','can','jar','dozen'].map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Add Ingredient'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function EditPricesModal({ ingredient, vendors, API, onClose, onSaved }) {
  const [prices, setPrices] = useState(
    vendors.map(v => {
      const existing = ingredient.prices?.find(p => p.vendor_name === v.name)
      return { vendor_id: v.id, vendor_name: v.name, price: existing?.price?.toFixed(2) || '', unit: existing?.unit || ingredient.unit || 'each' }
    })
  )
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    const toSave = prices.filter(p => p.price !== '' && !isNaN(parseFloat(p.price)))
    await fetch(`${API}/ingredients/${ingredient.id}/prices`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ prices: toSave.map(p => ({ ...p, price: parseFloat(p.price) })) }),
    })
    onSaved({ ...ingredient, prices: toSave.map(p => ({ ...p, price: parseFloat(p.price) })) })
    setSaving(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <div>
            <h2>Vendor Prices</h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>{ingredient.name}</p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>Leave blank for vendors you don't track.</p>
          {prices.map((p, i) => (
            <div key={p.vendor_id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div style={{ width: 130, fontSize: '0.875rem', fontWeight: 500 }}>{p.vendor_name}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flex: 1 }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>$</span>
                <input
                  type="number" min="0" step="0.01"
                  value={p.price}
                  onChange={e => setPrices(prev => prev.map((x, j) => j === i ? { ...x, price: e.target.value } : x))}
                  placeholder="—"
                  style={{ width: 90, padding: '0.5rem 0.625rem', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '0.9rem', outline: 'none' }}
                  onFocus={e => e.target.style.borderColor = 'var(--plum)'}
                  onBlur={e => e.target.style.borderColor = 'var(--border)'}
                />
                <select
                  value={p.unit}
                  onChange={e => setPrices(prev => prev.map((x, j) => j === i ? { ...x, unit: e.target.value } : x))}
                  style={{ padding: '0.5rem', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '0.8125rem', outline: 'none', background: 'white' }}
                >
                  {['lb','oz','gallon','quart','pint','each','case','bag','box','can','jar','dozen'].map(u => <option key={u}>{u}</option>)}
                </select>
              </div>
            </div>
          ))}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save Prices'}</button>
        </div>
      </div>
    </div>
  )
}

function AddMenuModal({ center, API, onClose, onSaved }) {
  const [form, setForm] = useState({ week_label: '', week_start: '', week_end: '' })
  const [saving, setSaving] = useState(false)
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault(); setSaving(true)
    const res = await fetch(`${API}/centers/${center.id}/menus`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(form) })
    const data = await res.json()
    if (res.ok) onSaved({ ...data, items: [] }); else alert(data.error)
    setSaving(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header"><h2>Add Menu Week</h2><button className="btn btn-ghost btn-sm" onClick={onClose}><X size={16} /></button></div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="field"><label>Week Label</label><input value={form.week_label} onChange={set('week_label')} placeholder="e.g. Week 1 — Jan 6–10, 2025" /></div>
            <div className="grid-2">
              <div className="field"><label>Week Start</label><input type="date" value={form.week_start} onChange={set('week_start')} required /></div>
              <div className="field"><label>Week End</label><input type="date" value={form.week_end} onChange={set('week_end')} required /></div>
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Menu items can be added after creation. Contact Jake to bulk-upload from a document.</p>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Create Menu'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
