
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import * as api from '../api'
import { useAuth } from '../auth'
import StatusBadge from '../components/StatusBadge'
import AuthImage from '../components/AuthImage'

export default function ReportView() {
  const { id } = useParams()
  const { user } = useAuth()

  const [report, setReport] = useState(null)
  const [sample, setSample] = useState(null)
  const [comment, setComment] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [reviewing, setReviewing] = useState(false)

  const load = async () => {
    setLoading(true)
    setError('')

    try {
      const reportData = await api.getReport(id)
      setReport(reportData)

      try {
        const sampleData = await api.getSample(reportData.sample_code)
        setSample(sampleData)
      } catch (sampleError) {
        console.error('Could not load sample files:', sampleError)
        setSample(null)
      }
    } catch (e) {
      setError(e.message || 'Could not load report.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [id])

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

  if (loading) return <p className="muted">Loading report...</p>
  if (error && !report) return <div className="error">{error}</div>
  if (!report) return <p className="muted">Report not found.</p>

  const d = api.reportDetails(report)
  const checks = d.compliance?.checks || []
  const imageAnalysis = d.image_analysis || {}
  const analyzedImages = imageAnalysis.images || []
  const uploadedImages = (sample?.files || []).filter(
    (file) => file.kind === 'image'
  )

  const canReview =
    (user?.role === 'am' && report.status === 'pending_am') ||
    (user?.role === 'dm' && report.status === 'pending_dm')

  const findFile = (name) =>
    sample?.files?.find(
      (file) =>
        file.original_name === name ||
        file.original_name?.toLowerCase() === name?.toLowerCase()
    )

  return (
    <>
      <h1>
        Quality Assessment Report · {report.sample_code} v{report.version}
      </h1>

      {error && <div className="error">{error}</div>}

      <div className="card row">
        <StatusBadge value={report.decision} />
        <StatusBadge value={report.status} />
        <span className="muted">
          {new Date(report.created_at).toLocaleString()}
        </span>
      </div>

      <div className="card">
        <h3>Assessment Summary</h3>
        <p style={{ margin: 0 }}>{report.summary}</p>
      </div>

      {/* TODO 1: Compliance clause table */}
      <section className="card">
        <h2>Compliance Assessment</h2>

        <p className="muted">
          {checks.length} clauses evaluated against the selected specification.
        </p>

        {checks.length === 0 ? (
          <p className="muted">No compliance checks available.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th>Clause</th>
                  <th>Property</th>
                  <th>Requirement</th>
                  <th>Value</th>
                  <th>Result</th>
                  <th>Source</th>
                </tr>
              </thead>

              <tbody>
                {checks.map((c, index) => (
                  <tr key={`${c.clause}-${index}`}>
                    <td>{c.clause || '—'}</td>

                    <td>
                      <strong>{c.property || '—'}</strong>
                      {c.direction && (
                        <div className="muted">{c.direction}</div>
                      )}
                    </td>

                    <td>
                      {c.requirement || 'Not specified'}
                      {c.unit ? ` ${c.unit}` : ''}
                    </td>

                    <td>
                      {c.value ?? 'Not reported'}
                      {c.value !== null &&
                        c.value !== undefined &&
                        c.unit
                        ? ` ${c.unit}`
                        : ''}
                      {c.raw_line && (
                        <div
                          className="muted"
                          style={{
                            fontSize: 12,
                            marginTop: 4,
                            maxWidth: 260,
                            whiteSpace: 'normal',
                          }}
                        >
                          OCR: {c.raw_line}
                        </div>
                      )}
                    </td>

                    <td>
                      <StatusBadge value={c.result || 'UNKNOWN'} />
                    </td>

                    <td>{c.source || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Uploaded fabric photos */}
      <section className="card">
        <h2>Uploaded Fabric Images</h2>

        {uploadedImages.length === 0 ? (
          <p className="muted">No fabric images found.</p>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 16,
            }}
          >
            {uploadedImages.map((file) => (
              <div key={file.id}>
                <AuthImage
                  fileId={file.id}
                  alt={file.original_name}
                  style={{
                    width: '100%',
                    maxHeight: 260,
                    objectFit: 'contain',
                  }}
                />
                <p className="muted">{file.original_name}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* TODO 2: Image analysis */}
      <section className="card">
        <h2>Image Analysis & Defect Detection</h2>

        {imageAnalysis.skipped ? (
          <p className="muted">{imageAnalysis.skipped}</p>
        ) : analyzedImages.length > 0 ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 16,
            }}
          >
            {analyzedImages.map((item, index) => {
              const file = findFile(item.file)

              return (
                <div key={`${item.file}-${index}`}>
                  {file ? (
                    <AuthImage
                      fileId={file.id}
                      annotated
                      alt={`Defect analysis: ${item.file}`}
                    />
                  ) : (
                    <p className="muted">
                      Image file not found: {item.file}
                    </p>
                  )}

                  <strong>{item.file}</strong>

                  {item.counts && (
                    <pre style={{ whiteSpace: 'pre-wrap' }}>
                      {JSON.stringify(item.counts, null, 2)}
                    </pre>
                  )}

                  {item.boxes && (
                    <p className="muted">
                      Detected defect regions: {item.boxes.length}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <p className="muted">
            No image analysis results are available for this report.
          </p>
        )}
      </section>

      {/* TODO 3: Review history */}
      <section className="card">
        <h2>Review History</h2>

        {!report.reviews || report.reviews.length === 0 ? (
          <p className="muted">No reviews have been submitted yet.</p>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {report.reviews.map((review, index) => (
              <div
                key={review.id || index}
                style={{
                  borderLeft: '3px solid var(--border, #999)',
                  paddingLeft: 14,
                }}
              >
                <div className="row">
                  <strong>{String(review.role || 'Reviewer').toUpperCase()}</strong>

                  <StatusBadge
                    value={review.approved ? 'APPROVED' : 'REJECTED'}
                  />
                </div>

                <p>{review.comment || 'No comment provided.'}</p>

                <small className="muted">
                  {review.created_at
                    ? new Date(review.created_at).toLocaleString()
                    : ''}
                </small>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* TODO 4: AM / DM review controls */}
      {canReview && (
        <section className="card">
          <h2>Review Decision</h2>

          <p className="muted">
            This report is waiting for your review.
          </p>

          <label htmlFor="review-comment">Reviewer Comment</label>

          <textarea
            id="review-comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Enter your review comments..."
            rows={4}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              marginTop: 8,
              marginBottom: 14,
            }}
          />

          <div className="row" style={{ gap: 12 }}>
            <button
              type="button"
              disabled={reviewing}
              onClick={() => handleReview(true)}
            >
              {reviewing ? 'Processing...' : 'Approve Report'}
            </button>

            <button
              type="button"
              disabled={reviewing || !comment.trim()}
              onClick={() => handleReview(false)}
            >
              {reviewing ? 'Processing...' : 'Reject Report'}
            </button>
          </div>
        </section>
      )}
    </>
  )
}
