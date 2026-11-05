import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import * as api from '../api'
import AuthImage from '../components/AuthImage'
import StatusBadge from '../components/StatusBadge'

// Image Analysis (AM and DM dashboard): what the YOLO model found in the fabric photos of every analysed report.
// Pick a report to see each photo with its defect boxes and the list of detections.
// Detection layout and table: Maham Imran. A defect seen only by the model is CHECK MANUALLY for the reviewer.

function Tile({ label, value, sub }) {
  return (
    <div className="card" style={{ flex: '1 1 170px', margin: 0 }}>
      <p className="muted" style={{ marginTop: 0 }}>{label}</p>
      <h2 style={{ margin: 0 }}>{value}</h2>
      {sub && <p className="muted" style={{ fontSize: 12, marginBottom: 0 }}>{sub}</p>}
    </div>
  )
}

function Detections({ image }) {
  const boxes = image.boxes || []
  const classes = Object.entries(image.counts || {})
  if (!boxes.length) return <p className="muted">No defects were detected in this image.</p>
  return (
    <>
      <div style={{ overflowX: 'auto', maxHeight: 320 }}>
        <table>
          <thead><tr><th>Defect class</th><th>Confidence</th></tr></thead>
          <tbody>
            {[...boxes].sort((a, b) => b.confidence - a.confidence).map((d, i) => (
              <tr key={`${d.defect}-${i}`}><td>{d.defect}</td><td>{Math.round(d.confidence * 1000) / 10}%</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      {classes.length > 0 && <p className="muted">{classes.map(([n, c]) => `${n}: ${c}`).join(' · ')}</p>}
    </>
  )
}

function ReportImages({ row }) {
  const [files, setFiles] = useState(null)
  useEffect(() => {
    setFiles(null)
    api.getSample(row.report.sample_code).then((s) => setFiles(s.files)).catch(() => setFiles([]))
  }, [row.report.id])
  const ia = row.ia
  return (
    <section className="card">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>{row.report.sample_code} v{row.report.version}: fabric photos</h2>
        <Link to={`/reports/${row.report.id}`}>Open full report</Link>
      </div>
      {ia.skipped ? <p className="error">{ia.skipped}</p> : (ia.images || []).map((img, i) => {
        const file = files?.find((f) => f.kind === 'image' && f.original_name === img.file)
        return (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, marginTop: 16 }}>
            <div>
              <h3 style={{ marginTop: 0 }}>{img.file}</h3>
              {img.error ? <p className="error">{img.error}</p>
                : !files ? <p className="muted">Loading image…</p>
                : file ? <AuthImage fileId={file.id} annotated alt={`Defects found in ${img.file}`} />
                : <p className="muted">Image file not found.</p>}
            </div>
            <div>
              <h3 style={{ marginTop: 0 }}>Detected defects ({img.defects_found ?? 0})</h3>
              {!img.error && <Detections image={img} />}
            </div>
          </div>
        )
      })}
      {row.manual.length > 0 && (
        <p style={{ color: 'var(--check)' }}>
          Needs a person to confirm (found only by the model): clause {row.manual.join(', ')}.
        </p>
      )}
    </section>
  )
}

export default function ImageAnalysis() {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [picked, setPicked] = useState(null)

  useEffect(() => {
    api.listReports().then((d) => setReports(Array.isArray(d) ? d : [])).catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const rows = useMemo(() => reports.map((report) => {
    const d = api.reportDetails(report)
    const ia = d.image_analysis
    if (!ia) return null
    const images = ia.images || []
    const counts = {}
    images.forEach((im) => Object.entries(im.counts || {}).forEach(([k, v]) => { counts[k] = (counts[k] || 0) + v }))
    const manual = (d.compliance?.checks || []).filter((c) => c.source === 'image analysis' && c.result === 'CHECK MANUALLY').map((c) => c.clause)
    return { report, ia, images, counts, manual, threshold: images.find((im) => im.confidence_threshold != null)?.confidence_threshold }
  }).filter(Boolean), [reports])

  const stats = useMemo(() => {
    const photos = rows.reduce((n, r) => n + r.images.length, 0)
    const withDefects = rows.reduce((n, r) => n + r.images.filter((im) => (im.defects_found || 0) > 0).length, 0)
    const total = {}
    rows.forEach((r) => Object.entries(r.counts).forEach(([k, v]) => { total[k] = (total[k] || 0) + v }))
    const top = Object.entries(total).sort((a, b) => b[1] - a[1])[0]
    return { photos, withDefects, top, threshold: rows.find((r) => r.threshold != null)?.threshold }
  }, [rows])

  if (loading) return <p className="muted">Loading image analysis…</p>
  const pickedRow = rows.find((r) => r.report.id === picked)

  return (
    <>
      <h1>Image Analysis</h1>
      <p className="muted">Defects the YOLO model found in the fabric photos of each analysed sample. A defect seen only by the model is marked CHECK MANUALLY: a reviewer confirms it.</p>
      {error && <div className="error">{error}</div>}

      <div className="row" style={{ alignItems: 'stretch', marginBottom: 16 }}>
        <Tile label="Photos checked" value={stats.photos} />
        <Tile label="Photos with a defect found" value={stats.withDefects} sub={stats.photos ? `${Math.round(stats.withDefects / stats.photos * 100)}% of photos` : ''} />
        <Tile label="Most common defect" value={stats.top ? stats.top[0] : 'none'} sub={stats.top ? `${stats.top[1]} detections` : ''} />
        <Tile label="Model threshold" value={stats.threshold != null ? `${Math.round(stats.threshold * 100)}%` : 'n/a'} sub="minimum confidence for a box" />
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <table>
          <thead><tr><th>Sample</th><th>Version</th><th>Photos</th><th>Defects found</th><th>CHECK MANUALLY</th><th>Decision</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.report.id} className="click" onClick={() => setPicked(r.report.id)}
                  style={picked === r.report.id ? { background: 'var(--panel-2)' } : undefined}>
                <td><b>{r.report.sample_code}</b></td>
                <td>v{r.report.version}</td>
                <td>{r.ia.skipped ? <span className="muted">model not available</span> : r.images.length}</td>
                <td>{Object.entries(r.counts).map(([k, v]) => `${v} ${k}`).join(', ') || <span className="muted">none</span>}</td>
                <td>{r.manual.length ? <span className="badge check">{r.manual.join(', ')}</span> : <span className="muted">none</span>}</td>
                <td><StatusBadge value={r.report.decision} /></td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={6} className="muted">No fabric photos analysed yet. The analyst uploads photos on a sample and runs analysis.</td></tr>}
          </tbody>
        </table>
        {rows.length > 0 && !pickedRow && <p className="muted" style={{ fontSize: 13 }}>Click a row to see the photos with their defect boxes.</p>}
      </div>

      {pickedRow && <ReportImages row={pickedRow} />}
    </>
  )
}
