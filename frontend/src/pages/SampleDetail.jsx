import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import * as api from '../api'
import StatusBadge from '../components/StatusBadge'
import Thread from '../components/Thread'
import Loading from '../components/Loading'
import { Glyph } from '../components/Icon'

// Lab Analyst sample page: upload (with a quality check), run the analysis, check the draft, send it for review.
// Upload and analysis logic: Faiza Altaf. Quality check, draft check and discussion: analyst features.

function DraftCheck({ report, onSent }) {
  const nav = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const d = api.reportDetails(report)
  const ta = d.test_analysis || {}
  const found = (ta.results || []).filter((r) => r.found)
  const clear = found.filter((r) => r.status === 'ok' && r.value != null).length
  const lab = (d.compliance?.checks || []).filter((c) => c.source === 'lab report')
  const notRead = lab.filter((c) => c.result === 'NOT REPORTED').length
  const unclear = lab.filter((c) => c.result === 'CHECK MANUALLY').length
  const ia = d.image_analysis || {}
  const worry = ta.error || notRead > 3 || unclear > 3

  async function send() {
    setBusy(true); setError('')
    try { await api.submitReport(report.id); onSent() } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  return (
    <section className="card alert">
      <div className="card-head">
        <h2><Glyph name="scan" size={16} tone="check" />Check the draft before sending</h2>
        <div className="row"><StatusBadge value={report.decision} /><span className="note">v{report.version}, not sent yet</span></div>
      </div>
      <div className="tiles" style={{ marginBottom: 12 }}>
        <div><div className="tile-label">Lab report values read clearly</div><div className="tile-value small">{ta.error ? 'Could not read' : `${clear} of ${found.length}`}</div></div>
        <div><div className="tile-label">Unclear, a person must check</div><div className="tile-value small" style={{ color: unclear ? 'var(--check)' : undefined }}>{unclear}</div></div>
        <div><div className="tile-label">Not found on the report</div><div className="tile-value small" style={{ color: notRead ? 'var(--check)' : undefined }}>{notRead}</div></div>
        <div><div className="tile-label">Fabric photos checked</div><div className="tile-value small">{ia.skipped ? 'Model missing' : (ia.images || []).length}</div></div>
      </div>
      {worry
        ? <p style={{ color: 'var(--check)', marginTop: 0 }}>Many values could not be read. Look at the draft; if the scan is the problem, remove it, upload a clearer one and run the analysis again.</p>
        : <p className="muted" style={{ marginTop: 0 }}>The values look readable. Open the draft to compare them with the paper report, then send it.</p>}
      <div className="btn-row">
        <button className="ghost" onClick={() => nav(`/reports/${report.id}`)}>Open the draft</button>
        <button onClick={send} disabled={busy}>{busy ? 'Sending…' : 'Send to the Assistant Manager'}</button>
      </div>
      {error && <div className="error">{error}</div>}
    </section>
  )
}

export default function SampleDetail() {
  const { code } = useParams()
  const [sample, setSample] = useState(null)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState('')
  const [analysing, setAnalysing] = useState(false)

  const load = async () => {
    try { setSample(await api.getSample(code)); setError('') } catch (err) { setError(err.message) }
  }
  useEffect(() => { load() }, [code])

  async function handleUpload(event, kind) {
    const file = event.target.files?.[0]
    if (!file) return
    setError(''); setUploading(kind)
    try {
      if (kind === 'image') await api.uploadImage(code, file)
      else await api.uploadLabReport(code, file)
      await load()
    } catch (err) { setError(err.message) }
    finally { setUploading(''); event.target.value = '' }
  }

  async function handleAnalysis() {
    setError(''); setAnalysing(true)
    try { await api.analyzeSample(code); await load() } catch (err) { setError(err.message) } finally { setAnalysing(false) }
  }

  async function remove(f) {
    setError('')
    try { await api.deleteFile(f.id); await load() } catch (err) { setError(err.message) }
  }

  if (error && !sample) return <div className="error">{error}</div>
  if (!sample) return <Loading />
  const reports = [...sample.reports].sort((a, b) => b.version - a.version)
  const latest = reports[0]
  const st = latest?.status
  const locked = st === 'pending_am' || st === 'pending_dm' || st === 'approved'
  const lastReview = latest?.reviews?.[latest.reviews.length - 1]
  // Same rule as the backend: a file used by a report that was sent for review is kept as evidence
  const sentAt = reports.filter((r) => r.status !== 'draft').map((r) => new Date(r.created_at).getTime())
  const removable = (f) => !locked && !sentAt.some((t) => t >= new Date(f.uploaded_at).getTime())

  return (
    <>
      <div className="page-head"><div>
        <div className="eyebrow"><Link to="/samples">Samples</Link></div>
        <h1>Sample <span className="code">{sample.sample_code}</span></h1>
        <p className="muted">{sample.description ? `${sample.description}. ` : ''}Checked against specification {sample.specification}.</p>
      </div>{latest && <StatusBadge value={st} big />}</div>

      {error && <div className="error">{error}</div>}

      {st === 'returned_for_reanalysis' && (
        <section className="card" style={{ borderColor: 'rgba(236,106,94,.5)' }}>
          <div className="empty" style={{ border: 0, padding: 0 }}><Glyph name="undo" tone="fail" />
            <div><b>Sent back by the {lastReview?.role === 'dm' ? 'Deputy Manager' : 'Assistant Manager'}.</b>
              {lastReview?.comment && <div className="quote">“{lastReview.comment}”</div>}
              <div className="note" style={{ marginTop: 6 }}>Replace any bad file below, then run the analysis again. It becomes version {latest.version + 1}.</div></div>
          </div>
        </section>
      )}

      {st === 'draft' && !analysing && <DraftCheck report={latest} onSent={load} />}

      <div className="card">
        <div className="card-head"><h2><Glyph name="upload" size={16} tone="lit" />Files</h2><span className="note">Each file is checked for blur, light and size when it is uploaded</span></div>
        {!locked && (
          <div className="grid-2">
            <label className={`upload${uploading === 'image' ? ' busy' : ''}`}>
              <Glyph name="image" tone="lit" />
              <span><b>Add a fabric photo</b><span className="note">JPG or PNG, one or more photos of the sample</span></span>
              <input type="file" accept=".jpg,.jpeg,.png,image/jpeg,image/png" disabled={!!uploading} onChange={(e) => handleUpload(e, 'image')} />
            </label>
            <label className={`upload${uploading === 'lab-report' ? ' busy' : ''}`}>
              <Glyph name="file" tone="lit" />
              <span><b>Add the lab report scan</b><span className="note">JPG, PNG or PDF of the signed lab report</span></span>
              <input type="file" accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf" disabled={!!uploading} onChange={(e) => handleUpload(e, 'lab-report')} />
            </label>
          </div>
        )}
        {uploading && <div className="loading"><span className="spinner" />Uploading and checking the {uploading === 'image' ? 'fabric photo' : 'lab report'}…</div>}
        {sample.files.length > 0 && (
          <ul className="file-list">
            {sample.files.map((f) => {
              const q = f.quality
              return (
                <li key={f.id} style={{ alignItems: 'flex-start' }}>
                  <Glyph name={f.kind === 'image' ? 'image' : 'file'} size={14} tone={q ? (q.ok ? 'pass' : 'check') : ''} />
                  <div style={{ flex: 1 }}>
                    {f.kind === 'image' ? 'Fabric photo' : 'Lab report'}: <span className="code">{f.original_name}</span>
                    {q && (q.ok ? <span className="note"> · quality check passed</span>
                      : <ul className="warn-list">{q.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>)}
                  </div>
                  {removable(f) && <button className="ghost del" onClick={() => remove(f)} title="Remove this file">Remove</button>}
                </li>
              )
            })}
          </ul>
        )}
        {locked && <p className="note">Files are locked while the report is with the managers, so every report keeps its evidence.</p>}
      </div>

      <div className="card">
        <div className="card-head"><h2><Glyph name="scan" size={16} tone={analysing ? 'lit' : ''} />Analysis</h2>
          {!locked && (
            <button onClick={handleAnalysis} disabled={analysing || !!uploading || !sample.files.length}>
              {analysing ? 'Analysing…' : st === 'draft' ? 'Run analysis again' : 'Run analysis'}
            </button>
          )}</div>
        {analysing && <div className="loading"><span className="spinner" />Reading the lab report and checking the photos. This takes 10 to 30 seconds.</div>}
        <table>
          <thead><tr><th>Version</th><th>Decision</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {reports.map((r) => (
              <tr key={r.id}>
                <td>v{r.version}</td>
                <td><StatusBadge value={r.decision} /></td>
                <td><StatusBadge value={r.status} /></td>
                <td><Link to={`/reports/${r.id}`}>Open report</Link></td>
              </tr>
            ))}
            {!reports.length && <tr><td colSpan={4} className="muted">No reports yet. Upload the files, then run the analysis.</td></tr>}
          </tbody>
        </table>
      </div>

      <Thread code={sample.sample_code} />
    </>
  )
}
