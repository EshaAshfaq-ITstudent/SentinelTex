import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as api from '../api'
import { useAuth } from '../auth'
import StatusBadge from '../components/StatusBadge'

// FAIZA: Report Review dashboard for the AM and DM.
// The AM sees reports waiting for the AM, the DM sees reports waiting for the DM (already wired below).
export default function ReviewQueue() {
  const { user } = useAuth()
  const waitingFor = user.role === 'am' ? 'pending_am' : 'pending_dm'
  const [reports, setReports] = useState([])
  const [error, setError] = useState('')
  const navigate = useNavigate()

  useEffect(() => { api.listReports(waitingFor).then(setReports).catch((e) => setError(e.message)) }, [waitingFor])

  return (
    <>
      <h1>Report Review</h1>
      {error && <div className="error">{error}</div>}
      {/* TODO 1: three small count cards at the top: Waiting for me, Approved, Returned.
                  Use api.listReports('approved') and api.listReports('returned_for_reanalysis') for the counts. */}
      <div className="card">
        <table>
          <thead><tr><th>Sample</th><th>Version</th><th>Decision</th><th>Status</th><th>Created</th></tr></thead>
          <tbody>
            {reports.map((r) => (
              <tr key={r.id} className="click" onClick={() => navigate(`/reports/${r.id}`)}>
                <td><b>{r.sample_code}</b></td><td>v{r.version}</td>
                <td><StatusBadge value={r.decision} /></td><td><StatusBadge value={r.status} /></td>
                <td className="muted">{new Date(r.created_at).toLocaleString()}</td>
              </tr>
            ))}
            {!reports.length && <tr><td colSpan={5} className="muted">Nothing waiting for you</td></tr>}
          </tbody>
        </table>
        {/* TODO 2: a second table "History" with all reports (api.listReports()) so managers can open old ones. */}
      </div>
    </>
  )
}
