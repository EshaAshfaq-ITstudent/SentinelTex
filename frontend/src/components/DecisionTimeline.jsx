import { ROLE_NAMES } from '../auth'

// Analyst → Assistant Manager → Deputy Manager, with a rubber stamp for each review.
function Stamp({ review }) {
  const ok = review.approved
  return (
    <div className={`stamp ${ok ? 'ok' : 'no'}`} title={review.comment || ''}>
      <div className="stamp-word">{ok ? 'Approved' : 'Rejected'}</div>
      <div className="stamp-meta">{ROLE_NAMES[review.role] || review.role}</div>
      <div className="stamp-meta">{new Date(review.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</div>
    </div>
  )
}

export default function DecisionTimeline({ report }) {
  const reviews = report.reviews || []
  const am = [...reviews].reverse().find((r) => r.role === 'am')
  const dm = [...reviews].reverse().find((r) => r.role === 'dm')
  const steps = [
    { label: report.status === 'draft' ? 'Analysed (draft)' : 'Analysed and sent', sub: new Date(report.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }),
      state: report.status === 'draft' ? 'current' : 'done' },
    { label: 'Assistant Manager', review: am,
      state: am ? (am.approved ? 'done' : 'rejected') : report.status === 'pending_am' ? 'current' : 'waiting' },
    { label: 'Deputy Manager', review: dm,
      state: dm ? (dm.approved ? 'done' : 'rejected') : report.status === 'pending_dm' ? 'current' : 'waiting' },
  ]
  return (
    <div className="timeline">
      {steps.map((s, i) => (
        <div key={s.label} className={`tl-step ${s.state}`}>
          <div className="tl-dot">{i + 1}</div>
          <div className="tl-body">
            <div className="tl-label">{s.label}</div>
            {s.review ? <><Stamp review={s.review} />{s.review.comment && <div className="stamp-note">“{s.review.comment}”</div>}</>
              : <div className="muted tl-sub">{s.sub || (s.state === 'current' ? 'Waiting for review' : s.state === 'waiting' ? 'Not yet' : '')}</div>}
          </div>
        </div>
      ))}
    </div>
  )
}
