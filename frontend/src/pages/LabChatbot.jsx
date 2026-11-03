import { useEffect, useRef, useState } from 'react'
import * as api from '../api'

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
      <h1>Lab Chatbot</h1>
      <p className="muted">
        Answers come only from specification STS/UC/01 and name the clause. If the specification does not cover a question, it says so.
        {status && <> · {status.chunks} clauses indexed · search: {status.embedding} · LLM {status.llm.available ? 'ready' : 'not running'}</>}
      </p>

      <div className="card" style={{ minHeight: 280 }}>
        {!messages.length && (
          <div className="row">{EXAMPLES.map((e) => <button key={e} className="ghost" onClick={() => ask(e)}>{e}</button>)}</div>
        )}
        {messages.map((m, i) => m.role === 'user'
          ? <p key={i} style={{ textAlign: 'right' }}><span className="badge neutral" style={{ fontSize: 14, whiteSpace: 'normal' }}>{m.text}</span></p>
          : (
            <div key={i} style={{ borderLeft: '3px solid var(--olive)', paddingLeft: 12, margin: '12px 0' }}>
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
        {busy && <p className="muted">Thinking… (the local LLM can take up to a minute)</p>}
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
