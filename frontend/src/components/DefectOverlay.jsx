import { useEffect, useMemo, useState } from 'react'
import * as api from '../api'

// Fabric photo with the model's defect boxes drawn on top. Each defect type can be shown or hidden,
// and weak boxes can be hidden with the confidence slider.
const COLORS = { stain: '#e0a43a', spot: '#c8b88a', discoloration: '#9fb4ff', tear: '#d9534f', loose_thread: '#4caf7a', pattern_defect: '#e77fd0' }

export default function DefectOverlay({ fileId, boxes = [], threshold = 0.05 }) {
  const [src, setSrc] = useState(null)
  const [size, setSize] = useState(null)
  const [hidden, setHidden] = useState({})
  const [minConf, setMinConf] = useState(threshold)

  useEffect(() => {
    let url
    api.fileUrl(fileId).then((u) => { url = u; setSrc(u) }).catch(() => setSrc(''))
    return () => url && URL.revokeObjectURL(url)
  }, [fileId])

  const counts = useMemo(() => {
    const c = {}
    boxes.forEach((b) => { if (b.confidence >= minConf) c[b.defect] = (c[b.defect] || 0) + 1 })
    return c
  }, [boxes, minConf])
  const shown = boxes.filter((b) => !hidden[b.defect] && b.confidence >= minConf)
  const types = [...new Set(boxes.map((b) => b.defect))]

  if (src === '') return <p className="muted">Could not load the photo.</p>
  return (
    <div>
      <div className="overlay-wrap">
        {src && <img src={src} alt="Fabric photo" onLoad={(e) => setSize([e.target.naturalWidth, e.target.naturalHeight])} />}
        {size && (
          <svg viewBox={`0 0 ${size[0]} ${size[1]}`} preserveAspectRatio="none">
            {shown.map((b, i) => {
              const [x1, y1, x2, y2] = b.box
              return (
                <g key={i}>
                  <title>{`${b.defect} ${Math.round(b.confidence * 100)}%`}</title>
                  <rect x={x1} y={y1} width={x2 - x1} height={y2 - y1} fill="none" stroke={COLORS[b.defect] || '#fff'}
                        strokeWidth={Math.max(2, size[0] / 400)} />
                </g>
              )
            })}
          </svg>
        )}
      </div>
      {types.length > 0 && (
        <>
          <div className="chips">
            {types.map((t) => (
              <button key={t} className={`chip ${hidden[t] ? 'off' : ''}`} onClick={() => setHidden((h) => ({ ...h, [t]: !h[t] }))}>
                <span className="dot" style={{ background: COLORS[t] || '#fff' }} />{t.replace('_', ' ')} <b>{counts[t] || 0}</b>
              </button>
            ))}
          </div>
          <label className="muted" style={{ fontSize: 13, display: 'flex', gap: 10, alignItems: 'center' }}>
            Hide boxes below {Math.round(minConf * 100)}% confidence
            <input type="range" min={threshold} max="0.9" step="0.05" value={minConf} onChange={(e) => setMinConf(Number(e.target.value))} />
          </label>
        </>
      )}
    </div>
  )
}
