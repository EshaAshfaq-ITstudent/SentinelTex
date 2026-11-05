import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as api from '../api'
import { ROLE_NAMES, useAuth } from '../auth'
import Loading from '../components/Loading'
import StatusBadge from '../components/StatusBadge'
import Tile from '../components/Tile'
import { Glyph } from '../components/Icon'

// Lab Analyst overview: what needs doing (drafts to check, reports sent back with the reviewer's reason)
// and where every sample is in the process.
const STEPS = ['Fabric photo', 'Lab report', 'Analysed', 'Sent', 'AM', 'DM']

function progress(sample) {
  const latest = [...sample.reports].sort((a, b) => b.version - a.version)[0]
  const has = (k) => sample.files.some((f) => f.kind === k)
  const st = latest?.status
  const lastReview = latest?.reviews?.[latest.reviews.length - 1]
  const cls = [
    has('image') ? 'done' : '', has('lab_report') ? 'done' : '',
    latest ? 'done' : '',
    st && st !== 'draft' ? 'done' : st === 'draft' ? 'now' : '',
    st === 'pending_am' ? 'now' : ['pending_dm', 'approved'].includes(st) ? 'done' : st === 'returned_for_reanalysis' && lastReview?.role === 'am' ? 'bad' : '',
    st === 'pending_dm' ? 'now' : st === 'approved' ? 'done' : st === 'returned_for_reanalysis' && lastReview?.role === 'dm' ? 'bad' : '',
  ]
  return { latest, cls, lastReview }
}

export default function AnalystHome() {
  const { user } = useAuth()
  const nav = useNavigate()
  const [samples, setSamples] = useState(null)
  const [threads, setThreads] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    api.listSamples().then(setSamples).catch((e) => setError(e.message))
    api.listThreads().then(setThreads).catch(() => {})
  }, [])

  if (error) return <div className="error">{error}</div>
  if (!samples) return <Loading />
  const rows = samples.map((s) => ({ s, ...progress(s) }))
  const by = (st) => rows.filter((r) => r.latest?.status === st)
  const drafts = by('draft'), returned = by('returned_for_reanalysis')
  const waiting = rows.filter((r) => ['pending_am', 'pending_dm'].includes(r.latest?.status))
  const notRun = rows.filter((r) => !r.latest)
  const unread = threads.reduce((n, t) => n + t.unread, 0)
  const hour = new Date().getHours()

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">{new Date().toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}</div>
          <h1>Good {hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'}, {user.full_name.split(' ')[0]}</h1>
          <p className="muted">{drafts.length + returned.length ? `${drafts.length + returned.length} sample${drafts.length + returned.length > 1 ? 's need' : ' needs'} your action.` : 'Nothing needs your action right now.'}</p>
        </div>
        <button onClick={() => nav('/samples')}>Register a sample</button>
      </div>

      <div className="tiles">
        <Tile accent icon="file" label="Drafts to check and send" value={drafts.length} sub="analysed, not sent yet" />
        <Tile icon="undo" tone={returned.length ? 'fail' : ''} label="Sent back to you" value={returned.length} sub="re-analysis requested" />
        <Tile icon="clock" tone={waiting.length ? 'check' : ''} label="With the managers" value={waiting.length} sub="waiting for AM or DM" />
        <Tile icon="stamp" tone={by('approved').length ? 'pass' : ''} label="Approved" value={by('approved').length} sub="signed by AM and DM" />
      </div>

      <div className="grid-2">
        <section className="card">
          <div className="card-head"><h2><Glyph name="inbox" size={16} tone={drafts.length + returned.length ? 'lit' : ''} />Needs your action</h2></div>
          {returned.map(({ s, lastReview }) => (
            <div key={s.id} className="todo" onClick={() => nav(`/samples/${s.sample_code}`)}>
              <Glyph name="undo" tone="fail" size={16} />
              <div>
                <div className="todo-title"><span className="code">{s.sample_code}</span> was sent back by the {ROLE_NAMES[lastReview?.role] || 'reviewer'}</div>
                {lastReview?.comment && <div className="quote">“{lastReview.comment}”</div>}
                <div className="note">Fix the files if needed, then run the analysis again.</div>
              </div>
            </div>
          ))}
          {drafts.map(({ s, latest }) => (
            <div key={s.id} className="todo" onClick={() => nav(`/samples/${s.sample_code}`)}>
              <Glyph name="file" tone="check" size={16} />
              <div>
                <div className="todo-title"><span className="code">{s.sample_code}</span> v{latest.version}: check the draft and send it</div>
                <div className="note">System decision {latest.decision}. Check what was read before it goes to the Assistant Manager.</div>
              </div>
            </div>
          ))}
          {notRun.map(({ s }) => (
            <div key={s.id} className="todo" onClick={() => nav(`/samples/${s.sample_code}`)}>
              <Glyph name="upload" size={16} />
              <div><div className="todo-title"><span className="code">{s.sample_code}</span>: not analysed yet</div>
                <div className="note">{s.files.length ? 'Files uploaded. Run the analysis.' : 'Upload the fabric photo and the lab report.'}</div></div>
            </div>
          ))}
          {!returned.length && !drafts.length && !notRun.length && <div className="empty"><b>All clear.</b>Register a new sample to start.</div>}
        </section>

        <section className="card">
          <div className="card-head"><h2><Glyph name="chat" size={16} tone={unread ? 'lit' : ''} />Messages</h2>
            {unread > 0 && <span className="badge check">{unread} new</span>}</div>
          {threads.slice(0, 5).map((t) => (
            <div key={t.sample_code} className="todo" onClick={() => nav(`/messages?sample=${t.sample_code}`)}>
              <Glyph name="chat" tone={t.unread ? 'lit' : ''} size={16} />
              <div style={{ minWidth: 0 }}><div className="todo-title"><span className="code">{t.sample_code}</span>{t.unread > 0 && <span className="note"> · {t.unread} new</span>}</div>
                <div className="note" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.last_sender}: {t.last_text}</div></div>
            </div>
          ))}
          {!threads.length && <p className="note" style={{ margin: 0 }}>No messages yet. Each sample has a Discussion box for questions to the AM and DM.</p>}
        </section>
      </div>

      <section className="card">
        <div className="card-head"><h2><Glyph name="layers" size={16} />Where every sample is</h2><span className="note">{STEPS.join(', then ')}</span></div>
        <table>
          <thead><tr><th>Sample</th><th>Progress</th><th>Now</th><th>Decision</th></tr></thead>
          <tbody>
            {rows.map(({ s, latest, cls }) => (
              <tr key={s.id} className="click" onClick={() => nav(`/samples/${s.sample_code}`)}>
                <td><span className="code">{s.sample_code}</span> {latest && <span className="muted">v{latest.version}</span>}</td>
                <td><div className="steps" title={STEPS.map((n, i) => `${n}: ${cls[i] || 'not yet'}`).join('\n')}>{cls.map((c, i) => <i key={i} className={c} />)}</div></td>
                <td>{latest ? <StatusBadge value={latest.status} /> : <span className="muted">Not analysed</span>}</td>
                <td>{latest ? <StatusBadge value={latest.decision} /> : <span className="muted">none</span>}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={4}><div className="empty"><b>No samples yet.</b>Register the first one on the Samples page.</div></td></tr>}
          </tbody>
        </table>
      </section>
    </>
  )
}
