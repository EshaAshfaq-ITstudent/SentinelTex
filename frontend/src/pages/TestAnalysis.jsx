import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as api from '../api'

export default function TestAnalysis() {
  const navigate = useNavigate()
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    async function loadReports() {
      try {
        setLoading(true)
        setError('')
        const data = await api.listReports()

        if (active) {
          setReports(Array.isArray(data) ? data : [])
        }
      } catch (err) {
        if (active) {
          setError(err.message || 'Could not load test analysis reports.')
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    loadReports()
    return () => { active = false }
  }, [])

  const rows = useMemo(() => reports.map((report) => {
    const details = api.reportDetails(report)
    const analysis = details.test_analysis || {}
    const checks = details.compliance?.checks || []
    const results = analysis.results || []

    // Only the lab report's own values belong here (image analysis findings are on the Image Analysis page)
    const labChecks = checks.filter((c) => c.source === 'lab report')
    // Values the OCR found on the page, and how many of them it read clearly (not flagged CHECK MANUALLY)
    const ocrResults = results.filter((r) => r.found)
    const valuesRead = ocrResults.filter(
      (r) => r.status === 'ok' && r.value !== null && r.value !== undefined
    ).length

    return {
      report,
      analysis,
      checks,
      ocrResults,
      valuesRead,
      manualCount: labChecks.filter((c) => c.result === 'CHECK MANUALLY').length,
      failCount: labChecks.filter((c) => c.result === 'FAIL').length,
      decision: details.compliance?.decision || report.decision || 'Pending',
    }
  }), [reports])

  const stats = useMemo(() => {
    const totalLabReports = rows.filter(
      (r) => r.analysis.file || r.analysis.results || r.analysis.error
    ).length

    const totalValues = rows.reduce((n, r) => n + r.ocrResults.length, 0)
    const readValues = rows.reduce((n, r) => n + r.valuesRead, 0)

    const failedClauses = {}
    rows.forEach((row) => {
      row.checks.filter((c) => c.result === 'FAIL' && c.source === 'lab report').forEach((c) => {
        failedClauses[c.clause] = (failedClauses[c.clause] || 0) + 1
      })
    })

    const mostFailed = Object.entries(failedClauses)
      .sort((a, b) => b[1] - a[1])[0]

    return {
      totalLabReports,
      percentage: totalValues ? Math.round(readValues / totalValues * 100) : 0,
      mostFailed: mostFailed
        ? `${mostFailed[0]} (${mostFailed[1]} ${mostFailed[1] === 1 ? 'failure' : 'failures'})`
        : 'No failed clauses',
    }
  }, [rows])

  function decisionClass(decision) {
    const value = String(decision).toUpperCase()
    if (value === 'ACCEPT') return 'pass'
    if (value === 'REJECT') return 'fail'
    if (value === 'NOT VERIFIABLE') return 'check'
    return 'neutral'
  }

  if (loading) return <div className="pad muted">Loading test analysis...</div>

  return (
    <>
      <h1>Test Analysis</h1>
      <p className="muted">
        Laboratory report OCR results and compliance verification overview.
      </p>

      {error && <p className="error">{error}</p>}

      <div className="row" style={{ alignItems: 'stretch', marginTop: 20 }}>
        <div className="card" style={{ flex: 1, minWidth: 180 }}>
          <p className="muted">Total Lab Reports</p>
          <h2>{stats.totalLabReports}</h2>
        </div>

        <div className="card" style={{ flex: 1, minWidth: 180 }}>
          <p className="muted">OCR values read clearly</p>
          <h2>{stats.percentage}%</h2>
          <p className="muted" style={{ fontSize: 12, margin: 0 }}>not flagged CHECK MANUALLY (accuracy against the answer keys is in the results document)</p>
        </div>

        <div className="card" style={{ flex: 1, minWidth: 180 }}>
          <p className="muted">Most Failed Clause</p>
          <h2 style={{ fontSize: 16 }}>{stats.mostFailed}</h2>
        </div>
      </div>

      <h2>Laboratory Reports</h2>

      <div className="card" style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Sample</th>
              <th>Lab Report File</th>
              <th>Values Read</th>
              <th>CHECK MANUALLY</th>
              <th>FAIL</th>
              <th>Decision</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.report.id}
                className="click"
                onClick={() => navigate(`/reports/${row.report.id}`)}
              >
                <td>{row.report.sample_code || '—'}</td>
                <td>
                  {row.analysis.error
                    ? <span className="error">{row.analysis.error}</span>
                    : row.analysis.file || 'Not available'}
                </td>
                <td>{row.valuesRead}</td>
                <td><span className="badge check">{row.manualCount}</span></td>
                <td><span className="badge fail">{row.failCount}</span></td>
                <td>
                  <span className={`badge ${decisionClass(row.decision)}`}>
                    {row.decision}
                  </span>
                </td>
              </tr>
            ))}

            {rows.length === 0 && (
              <tr>
                <td colSpan="6" className="muted">
                  No laboratory reports available yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}