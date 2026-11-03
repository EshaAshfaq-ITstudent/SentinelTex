import { useEffect, useMemo, useState } from 'react'
import * as api from '../api'

// Trend Analysis: decisions per month, which clauses fail most, supplier comparison,
// and one clause's results over time against its limit.
// Colour is never the only signal: failing points are crosses, bars have a legend and tooltips.

const C = { accept: 'var(--pass)', reject: 'var(--fail)', nv: 'var(--check)', bar: 'var(--khaki)', line: 'var(--khaki)',
  grid: 'var(--line)', ink: 'var(--muted)' }
const pct = (x) => (x == null ? 'n/a' : `${Math.round(x * 100)}%`)
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const monthName = (ym) => `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(2, 4)}`

function Tile({ label, value, sub }) {
  return (
    <div className="card" style={{ flex: '1 1 170px', marginBottom: 0 }}>
      <div className="muted" style={{ fontSize: 13 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, margin: '4px 0' }}>{value}</div>
      {sub && <div className="muted" style={{ fontSize: 12 }}>{sub}</div>}
    </div>
  )
}

function Legend({ items }) {
  return (
    <div className="row" style={{ gap: 16, fontSize: 13, margin: '0 0 8px' }}>
      {items.map(([label, color]) => (
        <span key={label} className="muted"><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3,
          background: color, marginRight: 6 }} />{label}</span>
      ))}
    </div>
  )
}

// Stacked bars: decisions per month (same segment order every month)
function MonthlyChart({ data }) {
  const W = 720, H = 220, P = { l: 34, r: 8, t: 10, b: 28 }
  const max = Math.max(1, ...data.map((d) => d.total))
  const bw = (W - P.l - P.r) / Math.max(1, data.length)
  const y = (v) => P.t + (H - P.t - P.b) * (1 - v / max)
  const ticks = [0, Math.ceil(max / 2), max]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }} role="img" aria-label="Decisions per month">
      {ticks.map((t) => (
        <g key={t}><line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} stroke={C.grid} strokeWidth="1" />
          <text x={P.l - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill={C.ink}>{t}</text></g>
      ))}
      {data.map((d, i) => {
        const x = P.l + i * bw + bw * 0.2, w = bw * 0.6
        let base = 0
        const segs = [['Accept', d.accept, C.accept], ['Reject', d.reject, C.reject], ['Not verifiable', d.not_verifiable, C.nv]]
        return (
          <g key={d.month}>
            <title>{`${d.month}: ${d.total} reports, ${d.accept} accept, ${d.reject} reject, ${d.not_verifiable} not verifiable`}</title>
            <rect x={x - 4} y={P.t} width={w + 8} height={H - P.t - P.b} fill="transparent" />
            {segs.map(([label, v, color]) => {
              if (!v) return null
              const top = y(base + v), h = y(base) - top
              base += v
              return <rect key={label} x={x} y={top + 1} width={w} height={Math.max(0, h - 2)} rx="3" fill={color} />
            })}
            <text x={x + w / 2} y={H - 10} textAnchor="middle" fontSize="11" fill={C.ink}>{monthName(d.month)}</text>
          </g>
        )
      })}
    </svg>
  )
}

// Horizontal bars: failure rate per clause (one hue = magnitude)
function ClauseBars({ data, onPick, picked }) {
  const rows = data.filter((d) => d.failed > 0).slice(0, 10)
  if (!rows.length) return <p className="muted">No failures in this selection.</p>
  const max = Math.max(...rows.map((r) => r.rate))
  return (
    <div>
      {rows.map((r) => (
        <div key={r.clause} onClick={() => r.clause.startsWith('3') && onPick(r.clause)} title={`${r.failed} of ${r.tested} reports failed this clause`}
             style={{ display: 'grid', gridTemplateColumns: '200px 1fr 70px', gap: 10, alignItems: 'center', padding: '4px 0',
                      cursor: r.clause.startsWith('3') ? 'pointer' : 'default', opacity: picked && picked !== r.clause ? 0.7 : 1 }}>
          <span style={{ fontSize: 13 }}><b>{r.clause}</b> {r.property}</span>
          <span style={{ background: 'var(--panel-2)', borderRadius: 4, height: 12 }}>
            <span style={{ display: 'block', width: `${(r.rate / max) * 100}%`, height: '100%', borderRadius: 4,
                           background: picked === r.clause ? 'var(--olive)' : C.bar }} />
          </span>
          <span className="muted" style={{ fontSize: 13, textAlign: 'right' }}>{r.failed} ({pct(r.rate)})</span>
        </div>
      ))}
      <p className="muted" style={{ fontSize: 12 }}>Number of reports that failed each clause. Click a Section 3 clause to see its measured values over time.</p>
    </div>
  )
}

// One clause over time: dots (pass), crosses (fail), dashed limit line(s)
function ClauseLine({ t }) {
  const W = 720, H = 240, P = { l: 44, r: 12, t: 12, b: 28 }
  const pts = t.points
  const lims = t.kind === 'range' ? t.limit : t.kind === 'abs_max' ? [-t.limit, t.limit] : [t.limit]
  const vals = pts.map((p) => p.value).concat(lims)
  let lo = Math.min(...vals), hi = Math.max(...vals)
  const pad = (hi - lo || 1) * 0.12; lo -= pad; hi += pad
  const x = (i) => P.l + (W - P.l - P.r) * (pts.length > 1 ? i / (pts.length - 1) : 0.5)
  const y = (v) => P.t + (H - P.t - P.b) * (1 - (v - lo) / (hi - lo))
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.value)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }} role="img"
         aria-label={`Clause ${t.clause} results over time`}>
      {[lo + pad, (lo + hi) / 2, hi - pad].map((v) => (
        <g key={v}><line x1={P.l} x2={W - P.r} y1={y(v)} y2={y(v)} stroke={C.grid} />
          <text x={P.l - 6} y={y(v) + 4} textAnchor="end" fontSize="11" fill={C.ink}>{Math.round(v * 10) / 10}</text></g>
      ))}
      {lims.map((l) => (
        <g key={l}><line x1={P.l} x2={W - P.r} y1={y(l)} y2={y(l)} stroke="var(--fail)" strokeDasharray="6 4" strokeWidth="1.5" />
          <text x={W - P.r} y={y(l) - 5} textAnchor="end" fontSize="11" fill="var(--text)">limit {l}</text></g>
      ))}
      <path d={path} fill="none" stroke={C.line} strokeWidth="2" opacity="0.6" />
      {pts.map((p, i) => (
        <g key={i}>
          <title>{`${p.date} · ${p.report_no} · ${p.supplier}\n${p.value} ${t.unit}: ${p.compliant ? (p.near_limit ? 'pass, close to limit' : 'pass') : 'FAIL'}\n${p.source}`}</title>
          <circle cx={x(i)} cy={y(p.value)} r="9" fill="transparent" />
          {p.compliant
            ? <circle cx={x(i)} cy={y(p.value)} r="4" fill={p.near_limit ? 'var(--check)' : C.line} stroke="var(--panel)" strokeWidth="2" />
            : <path d={`M${x(i) - 5},${y(p.value) - 5}L${x(i) + 5},${y(p.value) + 5}M${x(i) + 5},${y(p.value) - 5}L${x(i) - 5},${y(p.value) + 5}`}
                    stroke="var(--fail)" strokeWidth="2.5" />}
        </g>
      ))}
      {pts.length > 0 && <>
        <text x={P.l} y={H - 8} fontSize="11" fill={C.ink}>{pts[0].date}</text>
        <text x={W - P.r} y={H - 8} textAnchor="end" fontSize="11" fill={C.ink}>{pts[pts.length - 1].date}</text>
      </>}
    </svg>
  )
}

export default function TrendAnalysis() {
  const [filters, setFilters] = useState({ source: 'all', supplier: '', date_from: '', date_to: '' })
  const [suppliers, setSuppliers] = useState([])
  const [data, setData] = useState(null)
  const [clause, setClause] = useState('')
  const [trend, setTrend] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => { api.trendSuppliers().then(setSuppliers).catch(() => {}) }, [])
  useEffect(() => {
    setError('')
    api.trendOverview(filters).then((d) => {
      setData(d)
      setClause((c) => c || d.clause_failures.find((x) => x.clause.startsWith('3'))?.clause || '3.1')
    }).catch((e) => setError(e.message))
  }, [filters])
  useEffect(() => {
    if (!clause) { setTrend(null); return }
    api.clauseTrend(clause, filters).then(setTrend).catch((e) => setError(e.message))
  }, [clause, filters])

  const set = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }))
  const topClause = useMemo(() => data?.clause_failures.find((c) => c.failed > 0), [data])

  return (
    <>
      <h1>Trend Analysis</h1>
      {data?.note && <div className="card" style={{ borderColor: 'var(--check)' }}>⚠ {data.note}</div>}

      <div className="row" style={{ marginBottom: 16 }}>
        <select value={filters.source} onChange={set('source')}>
          <option value="all">All records</option><option value="history">Imported history only</option>
          <option value="system">Reports analysed in SentinelTex</option>
        </select>
        <select value={filters.supplier} onChange={set('supplier')}>
          <option value="">All suppliers</option>{suppliers.map((s) => <option key={s}>{s}</option>)}
        </select>
        <label className="muted">From <input type="date" value={filters.date_from} onChange={set('date_from')} /></label>
        <label className="muted">To <input type="date" value={filters.date_to} onChange={set('date_to')} /></label>
      </div>
      {error && <div className="error">{error}</div>}
      {!data ? <p className="muted">Loading…</p> : data.total_reports === 0 ? (
        <div className="card muted">No records for this selection. To load past records run <code>python tools\import_history.py</code> in the backend folder.</div>
      ) : (
        <>
          <div className="row" style={{ marginBottom: 16 }}>
            <Tile label="Reports" value={data.total_reports}
                  sub={Object.entries(data.by_source).map(([k, v]) => `${v} ${k}`).join(' · ')} />
            <Tile label="Accepted" value={pct(data.accept_rate)} sub={`${data.decisions.ACCEPT || 0} lots`} />
            <Tile label="Rejected" value={data.decisions.REJECT || 0} sub={`${data.decisions['NOT VERIFIABLE'] || 0} not verifiable`} />
            <Tile label="Most failed clause" value={topClause ? topClause.clause : 'none'}
                  sub={topClause ? `${topClause.property}, ${topClause.failed} reports` : ''} />
          </div>

          <div className="card">
            <h2 style={{ marginTop: 0 }}>Decisions per month</h2>
            <Legend items={[['Accept', C.accept], ['Reject', C.reject], ['Not verifiable', C.nv]]} />
            <MonthlyChart data={data.monthly} />
          </div>

          <div className="card">
            <h2 style={{ marginTop: 0 }}>Clauses that fail most often</h2>
            <ClauseBars data={data.clause_failures} onPick={setClause} picked={clause} />
          </div>

          {trend && (
            <div className="card">
              <h2 style={{ marginTop: 0 }}>Clause {trend.clause}: {trend.property}{trend.direction ? ` (${trend.direction})` : ''}</h2>
              <p className="muted" style={{ marginTop: 0 }}>
                Requirement: {trend.requirement} {trend.unit} · {trend.stats.n} results · mean {trend.stats.mean} ·
                {' '}{trend.stats.out_of_limit} out of limit · {trend.stats.near_limit} passing but within 5% of the limit
              </p>
              <Legend items={[['Pass', C.line], ['Pass, close to limit', 'var(--check)'], ['Fail (✕)', 'var(--fail)']]} />
              {trend.points.length ? <ClauseLine t={trend} /> : <p className="muted">No results for this clause.</p>}
            </div>
          )}

          <div className="card">
            <h2 style={{ marginTop: 0 }}>Suppliers</h2>
            <table>
              <thead><tr><th>Supplier</th><th>Reports</th><th>Accepted</th><th>Rejected</th><th>Not verifiable</th><th>Reject rate</th></tr></thead>
              <tbody>
                {data.suppliers.map((s) => (
                  <tr key={s.supplier}><td>{s.supplier}</td><td>{s.reports}</td><td>{s.accept}</td><td>{s.reject}</td>
                    <td>{s.not_verifiable}</td><td><b>{pct(s.reject_rate)}</b></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  )
}
