
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import * as api from '../api'
import StatusBadge from '../components/StatusBadge'

export default function SampleDetail() {
  const { code } = useParams()
  const [sample, setSample] = useState(null)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState('')
  const [analysing, setAnalysing] = useState(false)

  const load = async () => {
    try {
      const data = await api.getSample(code)
      setSample(data)
      setError('')
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    load()
  }, [code])

  async function handleUpload(event, kind) {
    const file = event.target.files?.[0]
    if (!file) return

    setError('')
    setUploading(kind)

    try {
      if (kind === 'image') {
        await api.uploadImage(code, file)
      } else {
        await api.uploadLabReport(code, file)
      }
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading('')
      event.target.value = ''
    }
  }

  async function handleAnalysis() {
    setError('')
    setAnalysing(true)

    try {
      await api.analyzeSample(code)
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setAnalysing(false)
    }
  }

  if (error && !sample) return <div className="error">{error}</div>
  if (!sample) return <p className="muted">Loading...</p>

  return (
    <>
      <h1>Sample {sample.sample_code}</h1>
      <p className="muted">
        {sample.description} · Specification {sample.specification}
      </p>

      {error && <div className="error">{error}</div>}

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Files</h2>

        <ul>
          {sample.files.map((f) => (
            <li key={f.id}>
              {f.kind === 'image' ? 'Fabric photo' : 'Lab report'}: {f.original_name}
            </li>
          ))}
        </ul>

        <div className="row">
          <label>
            <b>Upload fabric photo</b>
            <input
              type="file"
              accept=".jpg,.jpeg,.png,image/jpeg,image/png"
              disabled={!!uploading}
              onChange={(e) => handleUpload(e, 'image')}
            />
          </label>

          <label>
            <b>Upload lab report</b>
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
              disabled={!!uploading}
              onChange={(e) => handleUpload(e, 'lab-report')}
            />
          </label>
        </div>

        {uploading && (
          <p className="muted">
            Uploading {uploading === 'image' ? 'fabric photo' : 'lab report'}...
          </p>
        )}
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Analysis</h2>

        <button onClick={handleAnalysis} disabled={analysing || !!uploading}>
          {analysing ? 'Analysing...' : 'Run analysis'}
        </button>

        {analysing && (
          <p className="muted">
            Analysis is running. Please wait; this may take 10–30 seconds.
          </p>
        )}

        <table>
          <thead>
            <tr>
              <th>Version</th>
              <th>Decision</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {[...sample.reports]
              .sort((a, b) => b.version - a.version)
              .map((r) => (
                <tr key={r.id}>
                  <td>v{r.version}</td>
                  <td><StatusBadge value={r.decision} /></td>
                  <td><StatusBadge value={r.status} /></td>
                  <td><Link to={`/reports/${r.id}`}>Open report</Link></td>
                </tr>
              ))}

            {!sample.reports.length && (
              <tr>
                <td colSpan={4} className="muted">No reports yet</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
