import { useEffect, useRef, useState } from 'react'
import * as api from '../api'
import { ROLE_NAMES } from '../auth'
import { Glyph } from './Icon'

// Messages about one sample between the Lab Analyst, AM and DM. Checks for new messages every 8 seconds.
export default function Thread({ code, card = true, title = 'Discussion' }) {
  const [msgs, setMsgs] = useState(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [people, setPeople] = useState([])
  const [to, setTo] = useState('')             // '' = everyone on this sample, else one person's id
  const box = useRef(null)

  useEffect(() => { api.messagePeople().then(setPeople).catch(() => setPeople([])) }, [])

  useEffect(() => {
    let alive = true
    const load = () => api.getThread(code).then((m) => { if (!alive) return; setMsgs(m); window.dispatchEvent(new Event('st-messages-read')) })
      .catch((e) => alive && setError(e.message))
    setMsgs(null); load()
    const t = setInterval(load, 8000)
    return () => { alive = false; clearInterval(t) }
  }, [code])
  useEffect(() => { if (box.current) box.current.scrollTop = box.current.scrollHeight }, [msgs?.length])

  async function send(e) {
    e?.preventDefault()
    if (!text.trim()) return
    setBusy(true); setError('')
    try { const m = await api.sendMessage(code, text.trim(), to ? Number(to) : null); setMsgs((old) => [...(old || []), m]); setText('') }
    catch (err) { setError(err.message) }
    finally { setBusy(false) }
  }

  const body = (
    <>
      <div className="thread" ref={box}>
        {msgs === null && <div className="loading"><span className="spinner" />Loading messages…</div>}
        {msgs?.length === 0 && <p className="note" style={{ margin: 0 }}>No messages about {code} yet. Ask a question or leave a note for the team.</p>}
        {msgs?.map((m) => (
          <div key={m.id} className={`msg${m.mine ? ' mine' : ''}`}>
            <div className="msg-meta">
              <b>{m.mine ? 'You' : m.sender}</b> ({ROLE_NAMES[m.sender_role]})
              {m.recipient ? <> to <b>{m.mine ? m.recipient : 'you'}</b> <span className="private">private</span></> : ' to everyone'}
              {' · '}{new Date(m.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
            </div>
            <div className="msg-text">{m.text}</div>
          </div>
        ))}
      </div>
      <form className="composer" onSubmit={send}>
        <label className="to">To
          <select value={to} onChange={(e) => setTo(e.target.value)} aria-label="Send to">
            <option value="">Everyone on this sample</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.full_name} ({ROLE_NAMES[p.role]}) only</option>)}
          </select>
        </label>
        <textarea rows={2} value={text} maxLength={2000} placeholder={to ? 'Private message, only this person will see it' : `Message about ${code} to everyone`} aria-label="Message"
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) send(e) }} />
        <button disabled={busy || !text.trim()}>{busy ? 'Sending…' : 'Send'}</button>
      </form>
      {error && <div className="error">{error}</div>}
    </>
  )
  if (!card) return body
  return (
    <section className="card">
      <div className="card-head"><h2><Glyph name="chat" size={16} tone={msgs?.length ? 'lit' : ''} />{title}</h2><span className="note">To everyone on the sample, or privately to one person</span></div>
      {body}
    </section>
  )
}
