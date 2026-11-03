
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as api from '../api'
import { useAuth } from '../auth'
import StatusBadge from '../components/StatusBadge'

export default function ReviewQueue() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const waitingFor = user?.role === 'am' ? 'pending_am' : 'pending_dm'

  const [reports, setReports] = useState([])
  const [approved, setApproved] = useState([])
  const [returned, setReturned] = useState([])
  const [history, setHistory] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    const loadDashboard = async () => {
      setLoading(true)
      setError('')

      try {
        const [waitingData, approvedData, returnedData, allData] =
          await Promise.all([
            api.listReports(waitingFor),
            api.listReports('approved'),
            api.listReports('returned_for_reanalysis'),
            api.listReports(),
          ])

        if (!active) return

        setReports(waitingData || [])
        setApproved(approvedData || [])
        setReturned(returnedData || [])
        setHistory(allData || [])
      } catch (e) {
        if (active) setError(e.message || 'Could not load review dashboard.')
      } finally {
        if (active) setLoading(false)
      }
    }

    loadDashboard()

    return () => {
      active = false
    }
  }, [waitingFor])

  const CountCard = ({ title, count }) => (
    <div className="card" style={{ flex: '1 1 180px', minWidth: 150 }}>
      <p className="muted" style={{ margin: 0 }}>{title}</p>
      <h2 style={{ marginBottom: 0 }}>{count}</h2>
    </div>
  )

  const ReportTable = ({ data, emptyMessage }) => (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th>Sample</th>
            <th>Version</th>
            <th>Decision</th>
            <th>Status</th>
            <th>Created</th>
          </tr>
        </thead>

        <tbody>
          {data.map((r) => (
            <tr
              key={r.id}
              className="click"
              onClick={() => navigate(`/reports/${r.id}`)}
              style={{ cursor: 'pointer' }}
            >
              <td><strong>{r.sample_code}</strong></td>
              <td>v{r.version}</td>
              <td><StatusBadge value={r.decision} /></td>
              <td><StatusBadge value={r.status} /></td>
              <td className="muted">
                {r.created_at
                  ? new Date(r.created_at).toLocaleString()
                  : '—'}
              </td>
            </tr>
          ))}

          {data.length === 0 && (
            <tr>
              <td colSpan={5} className="muted">
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )

  return (
    <>
      <h1>Report Review Dashboard</h1>

      <p className="muted">
        {user?.role === 'am'
          ? 'Assessment Manager — review reports waiting for AM approval.'
          : 'Deputy Manager — review reports waiting for DM approval.'}
      </p>

      {error && <div className="error">{error}</div>}

      {loading ? (
        <p className="muted">Loading review dashboard...</p>
      ) : (
        <>
          {/* TODO 1: Review count cards */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 12,
              marginBottom: 20,
            }}
          >
            <CountCard title="Waiting for Me" count={reports.length} />
            <CountCard title="Approved" count={approved.length} />
            <CountCard title="Returned" count={returned.length} />
          </div>

          <section className="card">
            <h2>Waiting for My Review</h2>
            <ReportTable
              data={reports}
              emptyMessage="Nothing waiting for your review."
            />
          </section>

          {/* TODO 2: Complete report history */}
          <section className="card">
            <h2>Report History</h2>

            <p className="muted">
              All reports are listed here. Select any report to view its
              assessment details and review history.
            </p>

            <ReportTable
              data={history}
              emptyMessage="No report history available."
            />
          </section>
        </>
      )}
    </>
  )
}
