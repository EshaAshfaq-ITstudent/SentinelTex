import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import * as api from '../api'
import { useAuth } from '../auth'
import StatusBadge from '../components/StatusBadge'

// FAIZA: the Quality Assessment Report page. This is the most important screen in the demo.
export default function ReportView() {
  const { id } = useParams()
  const { user } = useAuth()
  const [report, setReport] = useState(null)
  const [error, setError] = useState('')

  const load = () => api.getReport(id).then(setReport).catch((e) => setError(e.message))
  useEffect(() => { load() }, [id])

  if (error) return <div className="error">{error}</div>
  if (!report) return <p className="muted">Loading…</p>
  const d = api.reportDetails(report)   // { compliance, test_analysis, image_analysis, images, lab_reports }
  const canReview = (user.role === 'am' && report.status === 'pending_am') || (user.role === 'dm' && report.status === 'pending_dm')

  return (
    <>
      <h1>Quality Assessment Report · {report.sample_code} v{report.version}</h1>
      <div className="card row">
        <StatusBadge value={report.decision} /> <StatusBadge value={report.status} />
        <span className="muted">{new Date(report.created_at).toLocaleString()}</span>
      </div>
      <div className="card"><p style={{ margin: 0 }}>{report.summary}</p></div>

      {/* TODO 1: clause table from d.compliance.checks. Columns: Clause, Property, Requirement, Value (+ unit),
                  Result (<StatusBadge value={c.result} />), Source. Show c.raw_line in small muted text under the
                  value, so the reviewer can see exactly what OCR read. */}

      {/* TODO 2: Image Analysis section. d.image_analysis.images is a list of { file, counts, boxes }.
                  If d.image_analysis.skipped exists, show that message instead.
                  Show each photo with boxes using <AuthImage fileId={...} annotated />
                  (find the file id by matching the name in report files: load api.getSample(report.sample_code)). */}

      {/* TODO 3: Review history from report.reviews (role, approved, comment, created_at) as approval "stamps". */}

      {/* TODO 4: if canReview, a comment box and two buttons:
                  Approve  -> await api.reviewReport(report.id, true, comment)
                  Reject   -> await api.reviewReport(report.id, false, comment)  (comment is required to reject)
                  then load(). */}
      {canReview && <p className="muted">This report is waiting for your review.</p>}
    </>
  )
}
