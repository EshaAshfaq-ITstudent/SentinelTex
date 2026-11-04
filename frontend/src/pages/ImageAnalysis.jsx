import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import * as api from '../api'

export default function ImageAnalysis() {
  const [samples, setSamples] = useState([])
  const [selectedSample, setSelectedSample] = useState('')
  const [file, setFile] = useState(null)
  const [uploadedImage, setUploadedImage] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [annotatedUrl, setAnnotatedUrl] = useState('')
  const [result, setResult] = useState(null)
  const [loadingSamples, setLoadingSamples] = useState(true)
  const [analysing, setAnalysing] = useState(false)
  const [error, setError] = useState('')
  const [annotationError, setAnnotationError] = useState('')

  useEffect(() => {
    let active = true

    async function loadSamples() {
      try {
        const data = await api.listSamples()
        if (active) {
          const availableSamples = Array.isArray(data) ? data : []
          setSamples(availableSamples)
          setSelectedSample((current) => current || availableSamples[0]?.sample_code || '')
        }
      } catch (err) {
        if (active) setError(err.message || 'Could not load samples.')
      } finally {
        if (active) setLoadingSamples(false)
      }
    }

    loadSamples()
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!file) {
      setPreviewUrl('')
      return
    }

    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  useEffect(() => () => {
    if (annotatedUrl) URL.revokeObjectURL(annotatedUrl)
  }, [annotatedUrl])

  function handleFileChange(event) {
    const selectedFile = event.target.files?.[0]
    if (!selectedFile) return

    if (!/\.(jpe?g|png)$/i.test(selectedFile.name)) {
      setError('Choose a JPG or PNG fabric image.')
      setFile(null)
      setUploadedImage(null)
      setResult(null)
      setAnnotatedUrl('')
      setAnnotationError('')
      event.target.value = ''
      return
    }

    setError('')
    setFile(selectedFile)
    setUploadedImage(null)
    setResult(null)
    setAnnotatedUrl('')
    setAnnotationError('')
  }

  async function handleAnalysis() {
    if (!selectedSample) {
      setError('Select a sample before analyzing an image.')
      return
    }
    if (!file) {
      setError('Select a fabric image before starting the analysis.')
      return
    }

    setError('')
    setAnnotationError('')
    setResult(null)
    setAnalysing(true)

    try {
      const image = uploadedImage || await api.uploadImage(selectedSample, file)
      setUploadedImage(image)

      const report = await api.analyzeSample(selectedSample)
      const details = api.reportDetails(report)
      const imageAnalysis = details.image_analysis || {}
      const matchingResults = (imageAnalysis.images || []).filter(
        (item) => item.file === image.original_name
      )
      const imageResult = matchingResults[matchingResults.length - 1] || null

      setResult({ imageAnalysis, imageResult, report })

      if (imageResult && !imageResult.error && !imageAnalysis.skipped) {
        try {
          setAnnotatedUrl(await api.fileUrl(image.id, true))
        } catch (err) {
          setAnnotationError(err.message || 'Could not load the annotated result image.')
        }
      }
    } catch (err) {
      setError(err.message || 'Image analysis failed.')
    } finally {
      setAnalysing(false)
    }
  }

  const detections = result?.imageResult?.boxes || []
  const defectCount = result?.imageResult?.defects_found ?? detections.length
  const defectClasses = Object.entries(result?.imageResult?.counts || {})

  return (
    <>
      <h1>Image Analysis</h1>
      <p className="muted">
        Upload a fabric photo for YOLO defect detection. The analysis is attached to the selected sample.
      </p>

      {error && <div className="error">{error}</div>}

      <section className="card">
        <h2 style={{ marginTop: 0 }}>Analyze a Fabric Image</h2>
        {loadingSamples ? (
          <p className="muted">Loading samples...</p>
        ) : samples.length === 0 ? (
          <p className="muted">
            Create a sample before uploading a fabric image. <Link to="/samples">Go to Samples</Link>
          </p>
        ) : (
          <>
            <label style={{ display: 'block', marginBottom: 16 }}>
              <b style={{ display: 'block', marginBottom: 8 }}>Sample</b>
              <select
                value={selectedSample}
                onChange={(event) => {
                  setSelectedSample(event.target.value)
                  setUploadedImage(null)
                  setResult(null)
                  setAnnotatedUrl('')
                  setError('')
                }}
                disabled={analysing}
                style={{ minWidth: 240 }}
              >
                {samples.map((sample) => (
                  <option key={sample.sample_code} value={sample.sample_code}>
                    {sample.sample_code} · {sample.specification}
                  </option>
                ))}
              </select>
            </label>

            <div className="row" style={{ alignItems: 'stretch' }}>
              <div style={{ flex: '1 1 300px', minWidth: 0 }}>
                <label style={{ display: 'block' }}>
                  <b style={{ display: 'block', marginBottom: 8 }}>Fabric image</b>
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                    onChange={handleFileChange}
                    disabled={analysing}
                  />
                </label>
                <p className="muted" style={{ fontSize: 13 }}>
                  Supported formats: JPG and PNG.
                </p>

                <button
                  type="button"
                  onClick={handleAnalysis}
                  disabled={analysing || !file}
                >
                  {analysing ? 'Analyzing...' : 'Analyze Image'}
                </button>
                {analysing && (
                  <p className="muted" role="status">
                    Uploading the image and running defect detection. Please wait...
                  </p>
                )}
              </div>

              <div style={{ flex: '1 1 300px', minWidth: 0 }}>
                <h3 style={{ marginTop: 0 }}>Image Preview</h3>
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Selected fabric preview"
                    style={{
                      display: 'block',
                      width: '100%',
                      maxHeight: 320,
                      objectFit: 'contain',
                      borderRadius: 8,
                      background: 'var(--bg)',
                    }}
                  />
                ) : (
                  <div
                    className="muted"
                    style={{
                      minHeight: 180,
                      display: 'grid',
                      placeItems: 'center',
                      border: '1px dashed var(--line)',
                      borderRadius: 8,
                      padding: 20,
                      textAlign: 'center',
                    }}
                  >
                    No image selected. Choose a JPG or PNG to see its preview.
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </section>

      {result && (
        <section className="card">
          <h2 style={{ marginTop: 0 }}>Detection Results</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Sample {selectedSample} · Report v{result.report.version}
          </p>

          {result.imageAnalysis.skipped ? (
            <p className="error">{result.imageAnalysis.skipped}</p>
          ) : result.imageResult?.error ? (
            <p className="error">{result.imageResult.error}</p>
          ) : result.imageResult ? (
            <>
              <div className="row" style={{ alignItems: 'stretch', marginBottom: 20 }}>
                <div className="card" style={{ flex: '1 1 160px', margin: 0 }}>
                  <p className="muted" style={{ marginTop: 0 }}>Detected defects</p>
                  <h2 style={{ margin: 0 }}>{defectCount}</h2>
                </div>
                <div className="card" style={{ flex: '1 1 160px', margin: 0 }}>
                  <p className="muted" style={{ marginTop: 0 }}>Defect classes</p>
                  <h2 style={{ margin: 0 }}>{defectClasses.length}</h2>
                </div>
                {result.imageResult.confidence_threshold != null && (
                  <div className="card" style={{ flex: '1 1 160px', margin: 0 }}>
                    <p className="muted" style={{ marginTop: 0 }}>Model threshold</p>
                    <h2 style={{ margin: 0 }}>
                      {Math.round(result.imageResult.confidence_threshold * 100)}%
                    </h2>
                  </div>
                )}
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                  gap: 20,
                }}
              >
                <div>
                  <h3 style={{ marginTop: 0 }}>Annotated Image</h3>
                  {annotatedUrl ? (
                    <img
                      src={annotatedUrl}
                      alt="Fabric image with detected defects annotated"
                      style={{ maxWidth: '100%', borderRadius: 8 }}
                    />
                  ) : annotationError ? (
                    <p className="error">{annotationError}</p>
                  ) : (
                    <p className="muted">Loading annotated image...</p>
                  )}
                </div>

                <div>
                  <h3 style={{ marginTop: 0 }}>Detected Defects</h3>
                  {detections.length > 0 ? (
                    <div style={{ overflowX: 'auto' }}>
                      <table>
                        <thead>
                          <tr>
                            <th>Defect class</th>
                            <th>Confidence</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detections.map((detection, index) => (
                            <tr key={`${detection.defect}-${index}`}>
                              <td>{detection.defect}</td>
                              <td>{Math.round(detection.confidence * 1000) / 10}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="muted">No defects were detected in this image.</p>
                  )}
                  {defectClasses.length > 0 && (
                    <p className="muted">
                      {defectClasses.map(([name, count]) => `${name}: ${count}`).join(' · ')}
                    </p>
                  )}
                </div>
              </div>
            </>
          ) : (
            <p className="muted">No image detection result was returned for this sample.</p>
          )}
        </section>
      )}
    </>
  )
}
