import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import * as api from '../api'
import { useAuth } from '../auth'
import Loading from '../components/Loading'
import StatusBadge from '../components/StatusBadge'
import Tile from '../components/Tile'
import { Glyph } from '../components/Icon'

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
        <Tile accent icon="inbox" label="Waiting for you" value={mine.length} sub={`${user.role === 'am' ? 'Assistant Manager' : 'Deputy Manager'} review`} />
        <Tile icon="stamp" tone={count('approved') ? 'pass' : ''} label="Fully approved" value={count('approved')} sub="signed by AM and DM" />
        <Tile icon="undo" tone={count('returned_for_reanalysis') ? 'fail' : ''} label="Returned for re-analysis" value={count('returned_for_reanalysis')} sub="rejected by a reviewer" />
        <Tile icon="gauge" label="System decision ACCEPT" value={`${data.length ? Math.round(accept / data.length * 100) : 0}%`} sub={`of ${data.length} analysed reports`} />
      </div>

      <div className="grid-2">
        <section className="card">
          <div className="card-head"><h2><Glyph name="inbox" size={16} tone={mine.length ? 'lit' : ''} />Waiting for your review</h2></div>
          <table><tbody>
            {mine.slice(0, 6).map((r) => (
              <tr key={r.id} className="click" onClick={() => nav(`/reports/${r.id}`)}>
                <td><span className="code">{r.sample_code}</span> <span className="muted">v{r.version}</span></td>
                <td><StatusBadge value={r.decision} /></td>
                <td className="muted">{new Date(r.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
            {!mine.length && <tr><td className="muted">All clear.</td></tr>}
          </tbody></table>
          {mine.length > 6 && <Link to="/review">See all {mine.length}</Link>}
        </section>
        <section className="card">
          <div className="card-head"><h2><Glyph name="clock" size={16} />Recent decisions</h2></div>
          <table><tbody>
            {decided.slice(0, 6).map((r) => (
              <tr key={r.id} className="click" onClick={() => nav(`/reports/${r.id}`)}>
                <td><span className="code">{r.sample_code}</span> <span className="muted">v{r.version}</span></td>
                <td><StatusBadge value={r.status} /></td>
                <td><StatusBadge value={r.decision} /></td>
              </tr>
            ))}
            {!decided.length && <tr><td className="muted">No reviewed reports yet.</td></tr>}
          </tbody></table>
        </section>
      </div>

      <section className="card">
        <div className="card-head"><h2><Glyph name="cpu" size={16} />System status</h2><span className="note">Everything runs on this laptop</span></div>
        <div className="tiles" style={{ marginBottom: 0 }}>
          <Tile icon="image" tone={sys ? (sys.h?.image_model?.available ? 'pass' : 'check') : ''} small label="Image model"
                value={!sys ? '…' : sys.h?.image_model?.available ? 'Loaded' : 'Not available'} sub="YOLOv8, fabric defects" />
          <Tile icon="database" tone={sys ? (sys.k?.chunks ? 'pass' : 'check') : ''} small label="Specification knowledge base"
                value={!sys ? '…' : sys.k?.chunks ? `${sys.k.chunks} clauses` : 'Empty'} sub={sys?.k ? `${sys.k.embedding} search in ChromaDB` : ''} />
          <Tile icon="spark" tone={sys ? (sys.k?.llm?.available ? 'pass' : 'check') : ''} small label="Local LLM"
                value={!sys ? '…' : sys.k?.llm?.available ? 'Ready' : 'Not running'} sub={sys?.k?.llm?.available ? sys.k.llm.model : 'start Ollama to use explanations'} />
        </div>
      </section>
    </>
  )
}
