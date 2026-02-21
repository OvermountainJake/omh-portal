import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { Plus, ChevronDown, ChevronUp, TrendingDown, UtensilsCrossed, DollarSign, X, Edit2 } from 'lucide-react'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
const MEALS = ['Breakfast', 'Lunch', 'Snack']

export default function FoodPricingApp() {
  const { user, API } = useAuth()
  const center = user?.centers?.[0]
  const [tab, setTab] = useState('menus') // menus | prices | compare
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

  return (
    <div>
      <div className="page-header">
        <h1>Food Pricing</h1>
        <p>Weekly menus, ingredient costs, and vendor comparisons.</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.5rem', background: 'var(--border)', borderRadius: 'var(--radius-sm)', padding: '0.25rem', width: 'fit-content' }}>
        {[
          { key: 'menus', label: '🍽️ Menus' },
          { key: 'prices', label: '💰 Ingredients & Prices' },
          { key: 'compare', label: '📊 Compare Vendors' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="btn"
            style={{
              background: tab === t.key ? 'var(--white)' : 'transparent',
              color: tab === t.key ? 'var(--plum)' : 'var(--text-muted)',
              boxShadow: tab === t.key ? 'var(--shadow-sm)' : 'none',
              fontSize: '0.875rem',
              padding: '0.5rem 1rem',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><div className="spinner" /></div>
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

// ── Menus Tab ──────────────────────────────────────────────────────────────────

function MenusTab({ menus, setMenus, center, API, user }) {
  const [expanded, setExpanded] = useState(menus[0]?.id || null)
  const [showAdd, setShowAdd] = useState(false)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{menus.length} menu{menus.length !== 1 ? 's' : ''} on file</p>
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
        <div key={menu.id} className="card" style={{ marginBottom: '0.75rem', padding: 0, overflow: 'hidden' }}>
          <button
            onClick={() => setExpanded(expanded === menu.id ? null : menu.id)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '1rem 1.25rem', background: 'none', border: 'none', cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{menu.week_label}</div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                {menu.week_start} – {menu.week_end}
              </div>
            </div>
            {expanded === menu.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>

          {expanded === menu.id && menu.items?.length > 0 && (
            <div style={{ overflowX: 'auto', borderTop: '1px solid var(--border)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
                <thead>
                  <tr style={{ background: 'var(--plum-bg)' }}>
                    <th style={{ padding: '0.625rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--plum)', textTransform: 'uppercase', letterSpacing: '0.04em', width: 100 }}>Meal</th>
                    {DAYS.map(d => (
                      <th key={d} style={{ padding: '0.625rem 0.75rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--plum)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{d}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {MEALS.map((meal, mi) => (
                    <tr key={meal} style={{ borderTop: '1px solid var(--border)', background: mi % 2 === 0 ? 'white' : 'var(--surface)' }}>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 600, fontSize: '0.8125rem', color: 'var(--text-muted)', verticalAlign: 'top' }}>{meal}</td>
                      {DAYS.map(day => {
                        const item = menu.items.find(i => i.day_of_week === day && i.meal_type === meal)
                        return (
                          <td key={day} style={{ padding: '0.75rem 0.75rem', fontSize: '0.8125rem', color: 'var(--text)', verticalAlign: 'top', lineHeight: 1.5 }}>
                            {item ? item.items.split(', ').map((food, i) => (
                              <div key={i}>{food}</div>
                            )) : '—'}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
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

  const filtered = ingredients.filter(i => i.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', alignItems: 'center' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search ingredients…"
          style={{ flex: 1, padding: '0.625rem 0.875rem', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '0.9375rem', outline: 'none' }}
          onFocus={e => e.target.style.borderColor = 'var(--plum)'}
          onBlur={e => e.target.style.borderColor = 'var(--border)'}
        />
        {user?.role === 'admin' && (
          <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>
            <Plus size={14} /> Add Ingredient
          </button>
        )}
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
              {['Ingredient', 'Category', 'Cheapest Vendor', 'Price', 'Vendors Tracked', ''].map(h => (
                <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((ing, i) => {
              const cheapest = ing.prices?.sort((a, b) => a.price - b.price)[0]
              return (
                <tr key={ing.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 500, fontSize: '0.9rem' }}>{ing.name}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <span className="badge" style={{ background: 'var(--sage-light)', color: '#3D6B40', fontSize: '0.7rem' }}>{ing.category}</span>
                  </td>
                  <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: cheapest ? 'var(--sage)' : 'var(--text-muted)' }}>
                    {cheapest ? cheapest.vendor_name : '—'}
                  </td>
                  <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', fontWeight: cheapest ? 600 : 400, color: cheapest ? 'var(--text)' : 'var(--text-muted)' }}>
                    {cheapest ? `$${cheapest.price.toFixed(2)} / ${cheapest.unit}` : '—'}
                  </td>
                  <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                    {ing.prices?.length || 0} vendor{ing.prices?.length !== 1 ? 's' : ''}
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    {user?.role === 'admin' && (
                      <button className="btn btn-ghost btn-sm" onClick={() => setEditing(ing)}><Edit2 size={14} /></button>
                    )}
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                {search ? 'No ingredients match your search.' : 'No ingredients yet. Add some to start tracking prices.'}
              </td></tr>
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

  if (withPrices.length === 0) {
    return (
      <div className="card empty-state">
        <DollarSign size={36} />
        <h3>No comparisons yet</h3>
        <p>Add ingredient prices from at least 2 vendors to see comparisons here.</p>
      </div>
    )
  }

  return (
    <div>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
        Showing {withPrices.length} ingredient{withPrices.length !== 1 ? 's' : ''} with prices from multiple vendors.
        <span style={{ color: 'var(--sage)', fontWeight: 600 }}> Green = best price.</span>
      </p>
      {withPrices.map(ing => {
        const sorted = [...ing.prices].sort((a, b) => a.price - b.price)
        const cheapest = sorted[0]
        const priciest = sorted[sorted.length - 1]
        const savings = priciest.price - cheapest.price

        return (
          <div key={ing.id} className="card" style={{ marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem' }}>
              <div>
                <span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{ing.name}</span>
                <span style={{ marginLeft: '0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>per {cheapest.unit}</span>
              </div>
              {savings > 0 && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--sage)' }}>
                  <TrendingDown size={14} />
                  Save ${savings.toFixed(2)} buying from {cheapest.vendor_name}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {sorted.map((p, i) => (
                <div key={p.vendor_name} style={{
                  flex: '1 1 140px',
                  padding: '0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  border: `1.5px solid ${i === 0 ? 'var(--sage)' : 'var(--border)'}`,
                  background: i === 0 ? 'var(--sage-light)' : 'var(--surface)',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>{p.vendor_name}</div>
                  <div style={{ fontSize: '1.125rem', fontWeight: 700, color: i === 0 ? '#3D6B40' : 'var(--text)' }}>
                    ${p.price.toFixed(2)}
                  </div>
                  {i === 0 && <div style={{ fontSize: '0.6875rem', color: '#3D6B40', fontWeight: 600, marginTop: '0.25rem' }}>✓ BEST PRICE</div>}
                </div>
              ))}
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
                  {['produce','dairy','protein','grain','canned','frozen','beverage','condiment','general'].map(c => <option key={c} value={c}>{c}</option>)}
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
                  style={{ padding: '0.5rem 0.5rem', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '0.8125rem', outline: 'none', background: 'white' }}
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
