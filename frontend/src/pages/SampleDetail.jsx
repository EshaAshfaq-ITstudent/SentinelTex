import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import * as api from '../api'
import StatusBadge from '../components/StatusBadge'

// FAIZA: Lab Analyst page for one sample. The data loading already works; add the TODO parts.
export default function SampleDetail() {
  const { code } = useParams()
  const [sample, setSample] = useState(null)
  const [error, setError] = useState('')

  const load = () => api.getSample(code).then(setSample).catch((e) => setError(e.message))
  useEffect(() => { load() }, [code])

  if (error) return <div className="error">{error}</div>
  if (!sample) return <p className="muted">Loading…</p>

  return (
    <>
      <h1>Sample {sample.sample_code}</h1>
      <p className="muted">{sample.description} · Specification {sample.specification}</p>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Files</h2>
        <ul>{sample.files.map((f) => <li key={f.id}>{f.kind === 'image' ? 'Fabric photo' : 'Lab report'}: {f.original_name}</li>)}</ul>
        {/* TODO 1: two file pickers, "Upload fabric photo" (.jpg .png) and "Upload lab report" (.jpg .png .pdf).
                    On change call api.uploadImage(code, file) or api.uploadLabReport(code, file), then load().
                    Show err.message in <div className="error"> if the upload fails. */}
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Analysis</h2>
        {/* TODO 2: "Run analysis" button. On click: const report = await api.analyzeSample(code), then load().
                    It takes 10 to 30 seconds (OCR + YOLO), so disable the button and show "Analysing…" meanwhile. */}
        <table>
          <thead><tr><th>Version</th><th>Decision</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {[...sample.reports].sort((a, b) => b.version - a.version).map((r) => (
              <tr key={r.id}>
                <td>v{r.version}</td><td><StatusBadge value={r.decision} /></td><td><StatusBadge value={r.status} /></td>
                <td><Link to={`/reports/${r.id}`}>Open report</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
