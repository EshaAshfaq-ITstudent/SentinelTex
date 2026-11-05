import { useState } from 'react'
import * as api from '../api'
import { Glyph } from './Icon'

// Explanation of the decision with the specification clauses it rests on.
// "template" = fixed sentences made without the LLM; "llm" = written by the local LLM, checked against the clauses.
export default function ExplanationPanel({ report, details, onUpdated }) {
  const [ex, setEx] = useState(details.llm_explanation || null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function run(refresh) {
    setBusy(true); setError('')
    try { const r = await api.explainReport(report.id, refresh); setEx(r); onUpdated?.() }
    catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }

  const g = ex?.grounding
  return (
    <section className="card">
      <div className="card-head"><h2><Glyph name="spark" tone={ex?.method === 'llm' ? 'lit' : ''} size={16} />Explanation</h2></div>
      {ex ? <p className="explain">{ex.text}</p> : <p className="muted">No explanation yet. The local LLM can write one from the specification clauses.</p>}
      {ex && (
        <p className="muted" style={{ fontSize: 13 }}>
          {ex.method === 'llm' ? `Written by the local LLM (${ex.model}).` : 'Made without the LLM from the checker results.'}
          {g && (g.grounded
            ? ' Every clause and number in it was found in the specification extract.'
            : <span style={{ color: 'var(--check)' }}> Check this text: {[
                g.unknown_clauses?.length ? `clauses not in the specification extract: ${g.unknown_clauses.join(', ')}` : '',
                g.unsupported_numbers?.length ? `numbers not in the results or clauses: ${g.unsupported_numbers.join(', ')}` : '',
              ].filter(Boolean).join('; ')}.</span>)}
          {ex.llm_error && ' The LLM was not reachable, so this is the version without it.'}
        </p>
      )}
      {ex?.sources?.length > 0 && (
        <details>
          <summary className="muted" style={{ cursor: 'pointer' }}>Specification clauses used ({ex.sources.length})</summary>
          <ul>{ex.sources.map((s, i) => <li key={i} className="muted" style={{ fontSize: 13 }}>{s.text} (page {s.page})</li>)}</ul>
        </details>
      )}
      <div className="row" style={{ marginTop: 10 }}>
        <button onClick={() => run(ex?.method === 'llm')} disabled={busy}>
          {busy ? 'The LLM is writing (up to a minute)…' : ex?.method === 'llm' ? 'Write again' : 'Explain with LLM'}
        </button>
      </div>
      {error && <div className="error">{error}</div>}
    </section>
  )
}
