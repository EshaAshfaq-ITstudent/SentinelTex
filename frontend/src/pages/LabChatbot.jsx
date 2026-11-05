import { useEffect, useRef, useState } from 'react'
import * as api from '../api'
import { Glyph } from '../components/Icon'

// Lab Chatbot: answers only from the specification in the knowledge base, with clause references.
const EXAMPLES = ['What is the tear force requirement in the weft direction?', 'Which test method is used for colour fastness to rubbing?',
  'How many loose threads are allowed?', 'What happens if one of the tests was not done?']

export default function LabChatbot() {
  const [status, setStatus] = useState(null)
  const [question, setQuestion] = useState('')
  const [messages, setMessages] = useState([])
  const [busy, setBusy] = useState(false)
  const end = useRef(null)

  useEffect(() => { api.knowledgeStatus().then(setStatus).catch(() => setStatus(null)) }, [])
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function ask(q) {
    const text = (q ?? question).trim()
    if (!text || busy) return
    setQuestion(''); setBusy(true)
    setMessages((m) => [...m, { role: 'user', text }])
    try {
      const r = await api.askChatbot(text)
      setMessages((m) => [...m, { role: 'bot', ...r }])
    } catch (e) {
      setMessages((m) => [...m, { role: 'bot', answer: e.message, method: 'error', sources: [] }])
    } finally { setBusy(false) }
  }

  return (
    <>
      <div className="page-head"><div>
        <h1>Lab Chatbot</h1>
        <p className="muted">Answers come only from specification STS/UC/01 and name the clause. If the specification does not cover a question, it says so.</p>
      </div>
      {status && <div className="row note"><span className={`status-dot${status.llm.available ? '' : ' warn'}`} />{status.chunks} clauses indexed, LLM {status.llm.available ? 'ready' : 'not running'}</div>}
      </div>

      <div className="card" style={{ minHeight: 280 }}>
        {!messages.length && (<>
          <div className="empty" style={{ border: 0, padding: '4px 0 16px' }}><Glyph name="chat" tone="lit" /><div><b>Ask about the specification.</b>Try one of these:</div></div>
          <div className="row">{EXAMPLES.map((e) => <button key={e} className="chip" onClick={() => ask(e)}>{e}</button>)}</div></>
        )}
        {messages.map((m, i) => m.role === 'user'
          ? <div key={i} className="bubble me" style={{ margin: '12px 0 12px auto', width: 'fit-content' }}>{m.text}</div>
          : (
            <div key={i} className="bubble" style={{ margin: '12px 0', borderLeft: '3px solid var(--brass)' }}>
              <p style={{ whiteSpace: 'pre-wrap', margin: '0 0 6px' }}>{m.answer}</p>
              {m.grounding && !m.grounding.grounded && (
                <p style={{ color: 'var(--check)', fontSize: 13 }}>
                  Check this answer: it mentions {[...(m.grounding.unknown_clauses || []), ...(m.grounding.unsupported_numbers || [])].join(', ')}, which is not in the clauses found.
                </p>
              )}
              {m.sources?.length > 0 && (
                <details>
                  <summary className="muted" style={{ cursor: 'pointer', fontSize: 13 }}>
                    Sources: {m.sources.map((s) => `clause ${s.clause}`).join(', ')}
                  </summary>
                  <ul>{m.sources.map((s, j) => <li key={j} className="muted" style={{ fontSize: 13 }}>{s.text} (page {s.page})</li>)}</ul>
                </details>
              )}
            </div>
          ))}
        {busy && <div className="loading"><span className="spinner" />Searching the specification and writing the answer. The local LLM can take up to a minute.</div>}
        <div ref={end} />
      </div>

      <form className="row" onSubmit={(e) => { e.preventDefault(); ask() }}>
        <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ask about the specification"
               style={{ flex: 1, minWidth: 240 }} maxLength={500} />
        <button disabled={busy || !question.trim()}>Ask</button>
      </form>
    </>
  )
}
