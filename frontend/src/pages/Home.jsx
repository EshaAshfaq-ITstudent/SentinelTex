import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import * as api from '../api'
import { useAuth } from '../auth'
import Loading from '../components/Loading'
import StatusBadge from '../components/StatusBadge'

// Overview for the Assistant Manager and Deputy Manager: what is waiting, recent decisions, system health.
export default function Home() {
  const { user } = useAuth()
  const nav = useNavigate()
  const waitingFor = user.role === 'am' ? 'pending_am' : 'pending_dm'
  const [data, setData] = useState(null)
  const [sys, setSys] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.listReports().then((all) => setData(all)).catch((e) => setError(e.message))
    Promise.all([api.health().catch(() => null), api.knowledgeStatus().catch(() => null)]).then(([h, k]) => setSys({ h, k }))
  }, [])

  if (error) return <div className="error">{error}</div>
  if (!data) return <Loading />
  const mine = data.filter((r) => r.status === waitingFor)
  const decided = data.filter((r) => r.status === 'approved' || r.status === 'returned_for_reanalysis')
  const count = (s) => data.filter((r) => r.status === s).length
  const accept = data.filter((r) => r.decision === 'ACCEPT').length
  const hour = new Date().getHours()

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">{new Date().toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}</div>
          <h1>Good {hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'}, {user.full_name.split(' ')[0]}</h1>
          <p className="muted">{mine.length ? `${mine.length} report${mine.length > 1 ? 's are' : ' is'} waiting for your review.` : 'Nothing is waiting for your review.'}</p>
        </div>
        {mine.length > 0 && <button onClick={() => nav(`/reports/${mine[0].id}`)}>Review the oldest report</button>}
      </div>

      <div className="tiles">
        <div className="tile accent"><div className="tile-label">Waiting for you</div><div className="tile-value">{mine.length}</div><div className="tile-sub">{user.role === 'am' ? 'Assistant Manager' : 'Deputy Manager'} review</div></div>
        <div className="tile"><div className="tile-label">Fully approved</div><div className="tile-value">{count('approved')}</div><div className="tile-sub">AM and DM signed</div></div>
        <div className="tile"><div className="tile-label">Returned for re-analysis</div><div className="tile-value">{count('returned_for_reanalysis')}</div><div className="tile-sub">rejected by a reviewer</div></div>
        <div className="tile"><div className="tile-label">System decision ACCEPT</div><div className="tile-value">{data.length ? Math.round(accept / data.length * 100) : 0}%</div><div className="tile-sub">of {data.length} analysed reports</div></div>
      </div>

      <div className="grid-2">
        <section className="card">
          <h2>Waiting for your review</h2>
          <table><tbody>
            {mine.slice(0, 6).map((r) => (
              <tr key={r.id} className="click" onClick={() => nav(`/reports/${r.id}`)}>
                <td><b>{r.sample_code}</b> <span className="muted">v{r.version}</span></td>
                <td><StatusBadge value={r.decision} /></td>
                <td className="muted">{new Date(r.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
            {!mine.length && <tr><td className="muted">All clear.</td></tr>}
          </tbody></table>
          {mine.length > 6 && <Link to="/review">See all {mine.length}</Link>}
        </section>
        <section className="card">
          <h2>Recent decisions</h2>
          <table><tbody>
            {decided.slice(0, 6).map((r) => (
              <tr key={r.id} className="click" onClick={() => nav(`/reports/${r.id}`)}>
                <td><b>{r.sample_code}</b> <span className="muted">v{r.version}</span></td>
                <td><StatusBadge value={r.status} /></td>
                <td><StatusBadge value={r.decision} /></td>
              </tr>
            ))}
            {!decided.length && <tr><td className="muted">No reviewed reports yet.</td></tr>}
          </tbody></table>
        </section>
      </div>

      <section className="card">
        <h2>System status</h2>
        <div className="tiles" style={{ marginBottom: 0 }}>
          <div><div className="tile-label">Image model</div><StatusBadge value={sys?.h?.image_model?.available ? 'PASS' : 'CHECK MANUALLY'} /> <span className="muted">{sys?.h?.image_model?.available ? 'loaded' : 'not available'}</span></div>
          <div><div className="tile-label">Specification knowledge base</div><StatusBadge value={sys?.k?.chunks ? 'PASS' : 'CHECK MANUALLY'} /> <span className="muted">{sys?.k ? `${sys.k.chunks} clauses, ${sys.k.embedding} search` : '…'}</span></div>
          <div><div className="tile-label">Local LLM</div><StatusBadge value={sys?.k?.llm?.available ? 'PASS' : 'CHECK MANUALLY'} /> <span className="muted">{sys?.k ? (sys.k.llm.available ? sys.k.llm.model : 'Ollama not running') : '…'}</span></div>
        </div>
      </section>
    </>
  )
}
