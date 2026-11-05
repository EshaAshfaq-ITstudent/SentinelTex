import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import * as api from '../api'
import Loading from '../components/Loading'
import StatusBadge from '../components/StatusBadge'
import Tile from '../components/Tile'
import ExplanationPanel from '../components/ExplanationPanel'
import EvidenceModal from '../components/EvidenceModal'
import { Glyph } from '../components/Icon'

// Test Analysis (AM and DM dashboard): what the OCR read from each lab report and how every value compares
// with its clause. Pick a report to see its values, the scanned line behind each one, and the explanation.
// Summary figures and report table: Faiza Altaf. Detail panel with evidence and explanation: interface redesign.

function ReportDetail({ row }) {
  const [files, setFiles] = useState(null)
  const [evidence, setEvidence] = useState(null)
  useEffect(() => {
    setFiles(null)
    api.getSample(row.report.sample_code).then((s) => setFiles(s.files)).catch(() => setFiles([]))
  }, [row.report.id])

  const ta = row.analysis
  const labFile = (files || []).find((f) => f.kind === 'lab_report' && f.original_name === ta.file)
  const boxFor = (clause) => (ta.results || []).find((r) => r.clause === clause)?.box

  return (
    <>
      <section className="card">
        <div className="card-head">
          <h2><Glyph name="file" size={16} tone="lit" /><span className="code">{row.report.sample_code}</span> v{row.report.version}: lab report values</h2>
          <div className="row"><StatusBadge value={row.decision} /><Link to={`/reports/${row.report.id}`}>Open full report</Link></div>
        </div>
        {ta.error ? <p className="error">{ta.error}</p> : (
          <>
            <p className="note" style={{ marginTop: 0 }}>Read from <span className="code">{ta.file}</span>. Click an underlined value to see the line on the scan it came from.</p>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead><tr><th>Clause</th><th>Test</th><th>Requirement</th><th>Value read</th><th>Result</th></tr></thead>
                <tbody>
                  {row.labChecks.map((c, i) => {
                    const box = boxFor(c.clause)
                    const unit = c.unit && c.unit !== 'count' ? ` ${c.unit}` : ''
                    const value = c.value ?? 'Not reported'
                    return (
                      <tr key={`${c.clause}-${i}`}>
                        <td className="code">{c.clause}</td>
                        <td>{c.property}</td>
                        <td>{c.requirement}{unit}</td>
                        <td>{box && labFile
                          ? <button className="value-link" onClick={() => setEvidence({ ...c, box })}>{value}{c.value != null ? unit : ''}</button>
                          : <span className="num">{value}{c.value != null ? unit : ''}</span>}</td>
                        <td><StatusBadge value={c.result} /></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
      <ExplanationPanel key={row.report.id} report={row.report} details={row.details} />
      {evidence && labFile && <EvidenceModal fileId={labFile.id} check={evidence} pageSize={ta.page_size} onClose={() => setEvidence(null)} />}
    </>
  )
}

export default function TestAnalysis() {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [picked, setPicked] = useState(null)

  useEffect(() => {
    api.listReports().then((d) => setReports(Array.isArray(d) ? d : []))
      .catch((e) => setError(e.message || 'Could not load test analysis reports.'))
      .finally(() => setLoading(false))
  }, [])

  // Only reports that have a lab report result belong here
  const rows = useMemo(() => reports.map((report) => {
    const details = api.reportDetails(report)
    const analysis = details.test_analysis
    if (!analysis) return null
    const checks = details.compliance?.checks || []
    const labChecks = checks.filter((c) => c.source === 'lab report')
    const ocrResults = (analysis.results || []).filter((r) => r.found)
    const valuesRead = ocrResults.filter((r) => r.status === 'ok' && r.value !== null && r.value !== undefined).length
    return {
      report, details, analysis, labChecks, ocrResults, valuesRead,
      manualCount: labChecks.filter((c) => c.result === 'CHECK MANUALLY').length,
      failCount: labChecks.filter((c) => c.result === 'FAIL').length,
      decision: details.compliance?.decision || report.decision,
    }
  }).filter(Boolean), [reports])

  const stats = useMemo(() => {
    const totalValues = rows.reduce((n, r) => n + r.ocrResults.length, 0)
    const readValues = rows.reduce((n, r) => n + r.valuesRead, 0)
    const failed = {}
    rows.forEach((row) => row.labChecks.filter((c) => c.result === 'FAIL').forEach((c) => { failed[c.clause] = (failed[c.clause] || 0) + 1 }))
    const top = Object.entries(failed).sort((a, b) => b[1] - a[1])[0]
    return {
      reports: rows.length,
      percentage: totalValues ? Math.round(readValues / totalValues * 100) : 0,
      manual: rows.reduce((n, r) => n + r.manualCount, 0),
      top,
    }
  }, [rows])

  if (loading) return <Loading text="Loading test analysis…" />
  const pickedRow = rows.find((r) => r.report.id === picked)

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Test Analysis</h1>
          <p className="muted">Values read from each lab report scan and how they compare with specification STS/UC/01. Unclear values are flagged for a person to check, never guessed.</p>
        </div>
      </div>
      {error && <p className="error">{error}</p>}

      <div className="tiles">
        <Tile icon="file" label="Lab reports read" value={stats.reports} />
        <Tile accent icon="scan" label="Values read clearly" value={`${stats.percentage}%`} sub="not flagged for checking" />
        <Tile icon="user" tone={stats.manual ? 'check' : ''} label="Values to check by hand" value={stats.manual} sub="across all reports" />
        <Tile icon="alert" tone={stats.top ? 'fail' : ''} small label="Most failed clause" value={stats.top ? stats.top[0] : 'None'} sub={stats.top ? `${stats.top[1]} ${stats.top[1] === 1 ? 'failure' : 'failures'}` : 'no failures so far'} />
      </div>

      <section className="card">
        <div className="card-head"><h2><Glyph name="layers" size={16} />Laboratory reports</h2><span className="note">Pick a report to see its values and explanation</span></div>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead><tr><th>Sample</th><th>Lab report file</th><th>Values read</th><th>Check by hand</th><th>Failed</th><th>Decision</th></tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.report.id} className={`click${picked === row.report.id ? ' picked' : ''}`} onClick={() => setPicked(row.report.id)}>
                  <td><span className="code">{row.report.sample_code}</span> <span className="muted">v{row.report.version}</span></td>
                  <td>{row.analysis.error ? <span className="error">Could not be read</span> : <span className="muted">{row.analysis.file}</span>}</td>
                  <td className="num">{row.valuesRead} / {row.ocrResults.length}</td>
                  <td>{row.manualCount ? <span className="badge check">{row.manualCount}</span> : <span className="muted">0</span>}</td>
                  <td>{row.failCount ? <span className="badge fail">{row.failCount}</span> : <span className="muted">0</span>}</td>
                  <td><StatusBadge value={row.decision} /></td>
                </tr>
              ))}
              {!rows.length && (
                <tr><td colSpan="6"><div className="empty"><b>No lab reports analysed yet.</b>The Lab Analyst uploads a lab report scan on a sample and runs analysis.</div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {pickedRow && <ReportDetail row={pickedRow} />}
    </>
  )
}
