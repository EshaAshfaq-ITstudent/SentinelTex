import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as api from '../api'
import StatusBadge from '../components/StatusBadge'

// DONE (example page): loads a list from the backend, shows it in a table, and creates a new item.
// Use this as the pattern for the other pages: useEffect to load, useState to keep data, try/catch for errors.
export default function Samples() {
  const [samples, setSamples] = useState([])
  const [code, setCode] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const load = () => api.listSamples().then(setSamples).catch((e) => setError(e.message))
  useEffect(() => { load() }, [])

  async function create(e) {
    e.preventDefault(); setError('')
    try {
      await api.createSample(code.trim().toUpperCase(), description)
      navigate(`/samples/${code.trim().toUpperCase()}`)
    } catch (err) { setError(err.message) }
  }

  return (
    <>
      <h1>Samples</h1>
      <div className="card">
        <form className="row" onSubmit={create}>
          <input placeholder="Sample code, e.g. ST-0080" value={code} onChange={(e) => setCode(e.target.value)}
                 pattern="ST-\d{4}" title="ST- followed by 4 digits" required />
          <input placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)}
                 style={{ flex: 1, minWidth: 200 }} />
          <button>New sample</button>
        </form>
        {error && <div className="error">{error}</div>}
      </div>
      <div className="card">
        <table>
          <thead><tr><th>Sample</th><th>Specification</th><th>Files</th><th>Latest report</th><th>Created</th></tr></thead>
          <tbody>
            {samples.map((s) => {
              const latest = [...s.reports].sort((a, b) => b.version - a.version)[0]
              return (
                <tr key={s.id} className="click" onClick={() => navigate(`/samples/${s.sample_code}`)}>
                  <td><b>{s.sample_code}</b><div className="muted">{s.description}</div></td>
                  <td>{s.specification}</td>
                  <td>{s.files.length}</td>
                  <td>{latest ? <><StatusBadge value={latest.decision} /> <StatusBadge value={latest.status} /></> : <span className="muted">Not analysed</span>}</td>
                  <td className="muted">{new Date(s.created_at).toLocaleDateString()}</td>
                </tr>
              )
            })}
            {!samples.length && <tr><td colSpan={5} className="muted">No samples yet</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  )
}
