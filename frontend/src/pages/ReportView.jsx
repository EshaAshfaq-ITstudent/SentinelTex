import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import * as api from '../api'
import { useAuth } from '../auth'
import StatusBadge from '../components/StatusBadge'
import ExplanationPanel from '../components/ExplanationPanel'
import DecisionTimeline from '../components/DecisionTimeline'
import EvidenceModal from '../components/EvidenceModal'
import DefectOverlay from '../components/DefectOverlay'
import Loading from '../components/Loading'

// Quality Assessment Report. Loading, review rules and approval logic: Faiza Altaf.
// Layout, decision timeline, evidence view and defect overlay: interface redesign.
export default function ReportView() {
  const { id } = useParams()
  const { user } = useAuth()

  const [report, setReport] = useState(null)
  const [sample, setSample] = useState(null)
  const [comment, setComment] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [reviewing, setReviewing] = useState(false)
  const [evidence, setEvidence] = useState(null)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const reportData = await api.getReport(id)
      setReport(reportData)
      try {
        setSample(await api.getSample(reportData.sample_code))
      } catch {
        setSample(null)
      }
    } catch (e) {
      setError(e.message || 'Could not load report.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  const handleReview = async (approve) => {
    if (!approve && !comment.trim()) {
      setError('A comment is required when rejecting a report.')
      return
    }
    setReviewing(true)
    setError('')
    try {
      await api.reviewReport(report.id, approve, comment.trim())
      setComment('')
      await load()
    } catch (e) {
      setError(e.message || 'Review action failed.')
    } finally {
      setReviewing(false)
    }
  }

  if (loading && !report) return <Loading text="Loading report…" />
  if (error && !report) return <div className="error">{error}</div>
  if (!report) return <p className="muted">Report not found.</p>

  const d = api.reportDetails(report)
  const checks = d.compliance?.checks || []
  const ta = d.test_analysis || {}
  const ia = d.image_analysis || {}
  const files = sample?.files || []
  const labFile = files.find((f) => f.kind === 'lab_report' && f.original_name === ta.file)
    || [...files].reverse().find((f) => f.kind === 'lab_report')
  const imageFile = (name) => files.find((f) => f.kind === 'image' && f.original_name === name)
  const boxFor = (clause) => (ta.results || []).find((r) => r.clause === clause)?.box
  const canReview = (user?.role === 'am' && report.status === 'pending_am') || (user?.role === 'dm' && report.status === 'pending_dm')
  const counts = checks.reduce((c, x) => ({ ...c, [x.result]: (c[x.result] || 0) + 1 }), {})

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Quality Assessment Report</div>
          <h1>{report.sample_code} <span className="muted" style={{ fontWeight: 400 }}>· version {report.version}</span></h1>
          <p className="muted">Specification {sample?.specification || 'STS/UC/01'} · analysed {new Date(report.created_at).toLocaleString()}</p>
        </div>
        <div className="row">
          <StatusBadge value={report.decision} big />
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      <section className="card">
        <h2>Approval</h2>
        <DecisionTimeline report={report} />
      </section>

      <div className="tiles">
        <div className="tile"><div className="tile-label">Clauses passed</div><div className="tile-value" style={{ color: 'var(--pass)' }}>{counts.PASS || 0}</div></div>
        <div className="tile"><div className="tile-label">Clauses failed</div><div className="tile-value" style={{ color: '#ee7a76' }}>{counts.FAIL || 0}</div><div className="tile-sub">{(d.compliance?.failed_clauses || []).join(', ') || 'none'}</div></div>
        <div className="tile"><div className="tile-label">Check manually / not reported</div><div className="tile-value" style={{ color: 'var(--check)' }}>{(counts['CHECK MANUALLY'] || 0) + (counts['NOT REPORTED'] || 0)}</div><div className="tile-sub">a person decides these</div></div>
      </div>

      <ExplanationPanel report={report} details={d} />

      <section className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0 }}>Compliance assessment</h2>
          {labFile && <span className="muted" style={{ fontSize: 13 }}>Click an underlined value to see where it was read on the scan</span>}
        </div>
        {ta.error && <p className="error">{ta.error}</p>}
        {checks.length === 0 ? <p className="muted">No compliance checks available.</p> : (
          <div style={{ overflowX: 'auto', marginTop: 8 }}>
            <table>
              <thead><tr><th>Clause</th><th>Property</th><th>Requirement</th><th>Value</th><th>Result</th><th>Source</th></tr></thead>
              <tbody>
                {checks.map((c, i) => {
                  const box = c.source === 'lab report' ? boxFor(c.clause) : null
                  const value = c.value ?? 'Not reported'
                  return (
                    <tr key={`${c.clause}-${i}`}>
                      <td><b>{c.clause}</b></td>
                      <td>{c.property}{c.direction && <div className="muted" style={{ fontSize: 13 }}>{c.direction}</div>}</td>
                      <td>{c.requirement}{c.unit && c.unit !== 'count' ? ` ${c.unit}` : ''}</td>
                      <td>
                        {box && labFile
                          ? <button className="value-link" onClick={() => setEvidence({ ...c, box })}>{value}{c.value != null && c.unit && c.unit !== 'count' ? ` ${c.unit}` : ''}</button>
                          : <>{value}{c.value != null && c.unit && c.unit !== 'count' ? ` ${c.unit}` : ''}</>}
                        {c.raw_line && !box && <div className="muted" style={{ fontSize: 12, maxWidth: 260 }}>OCR: {c.raw_line}</div>}
                      </td>
                      <td><StatusBadge value={c.result} /></td>
                      <td className="muted">{c.source}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <h2>Fabric photos and detected defects</h2>
        {ia.skipped ? <p className="muted">{ia.skipped}</p>
          : !(ia.images || []).length ? <p className="muted">No fabric photos were analysed for this report.</p>
          : <div className="grid-2">
              {ia.images.map((img, i) => {
                const f = imageFile(img.file)
                return (
                  <div key={i}>
                    <h3>{img.file} <span className="muted" style={{ fontWeight: 400 }}>· {img.defects_found ?? 0} boxes</span></h3>
                    {img.error ? <p className="error">{img.error}</p>
                      : f ? <DefectOverlay fileId={f.id} boxes={img.boxes} threshold={img.confidence_threshold ?? 0.05} />
                      : <p className="muted">Image file not found.</p>}
                  </div>
                )
              })}
            </div>}
        {(ia.images || []).length > 0 && <p className="muted" style={{ fontSize: 13 }}>Defects seen only by the model are marked CHECK MANUALLY above: a reviewer confirms them by looking at the photo.</p>}
      </section>

      {canReview && (
        <section className="card" style={{ borderColor: 'var(--check)' }}>
          <h2>Your review</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            {user.role === 'am' ? 'After your approval the report goes to the Deputy Manager.' : 'Your approval is the final sign off.'} Rejecting sends it back to the analyst for re-analysis.
          </p>
          <textarea id="review-comment" value={comment} onChange={(e) => setComment(e.target.value)}
                    placeholder="Comment (required when rejecting)" rows={3} style={{ width: '100%', marginBottom: 12 }} />
          <div className="row">
            <button type="button" className="ok" disabled={reviewing} onClick={() => handleReview(true)}>
              {reviewing ? 'Processing…' : 'Approve Report'}
            </button>
            <button type="button" className="danger" disabled={reviewing || !comment.trim()} onClick={() => handleReview(false)}>
              {reviewing ? 'Processing…' : 'Reject Report'}
            </button>
          </div>
        </section>
      )}

      {evidence && labFile && (
        <EvidenceModal fileId={labFile.id} check={evidence} pageSize={ta.page_size} onClose={() => setEvidence(null)} />
      )}
    </>
  )
}
