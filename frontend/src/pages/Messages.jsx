import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import * as api from '../api'
import Loading from '../components/Loading'
import Thread from '../components/Thread'
import { Glyph } from '../components/Icon'
import { useAuth } from '../auth'

// Messages: every sample conversation in one place, newest first. A new conversation starts from a sample or report page.
export default function Messages() {
  const { user } = useAuth()
  const [threads, setThreads] = useState(null)
  const [params, setParams] = useSearchParams()
  const picked = params.get('sample')
  const [error, setError] = useState('')

  useEffect(() => {
    const load = () => api.listThreads().then(setThreads).catch((e) => setError(e.message))
    load()
    const t = setInterval(load, 10000)
    window.addEventListener('st-messages-read', load)
    return () => { clearInterval(t); window.removeEventListener('st-messages-read', load) }
  }, [])

  if (!threads && !error) return <Loading text="Loading messages…" />
  const pick = (code) => setParams({ sample: code })

  return (
    <>
      <div className="page-head"><div>
        <h1>Messages</h1>
        <p className="muted">Conversations between the Lab Analyst, Assistant Manager and Deputy Manager, one per sample. Everything stays on this laptop.</p>
      </div></div>
      {error && <div className="error">{error}</div>}
      {threads && !threads.length && !picked ? (
        <section className="card"><div className="empty"><Glyph name="chat" tone="lit" />
          <div><b>No conversations yet.</b>
            {user.role === 'lab_analyst' ? 'Open a sample and write in its Discussion box.' : 'Open a report and write in its Discussion box.'}</div></div></section>
      ) : (
        <div className="inbox">
          <section className="card" style={{ padding: 0 }}>
            {(threads || []).map((t) => (
              <div key={t.sample_code} className={`thread-item${picked === t.sample_code ? ' picked' : ''}`} onClick={() => pick(t.sample_code)}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="code">{t.sample_code}</span>
                  {t.unread > 0 ? <span className="badge check">{t.unread} new</span>
                    : <span className="note">{new Date(t.last_at).toLocaleDateString()}</span>}
                </div>
                <div className="last">{t.last_sender}: {t.last_text}</div>
              </div>
            ))}
          </section>
          {picked ? <Thread code={picked} title={`Sample ${picked}`} />
            : <section className="card"><p className="muted" style={{ margin: 0 }}>Pick a conversation.</p></section>}
        </div>
      )}
    </>
  )
}
