import { useEffect, useRef, useState } from 'react'
import * as api from '../api'
import Icon from './Icon'

// Evidence view: shows exactly where on the scanned lab report the OCR read a value.
export default function EvidenceModal({ fileId, check, pageSize, onClose }) {
  const [src, setSrc] = useState(null)
  const [error, setError] = useState('')
  const canvas = useRef(null)

  useEffect(() => {
    let url
    api.fileUrl(fileId, false, true).then((u) => { url = u; setSrc(u) }).catch((e) => setError(e.message))
    const esc = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', esc)
    return () => { url && URL.revokeObjectURL(url); window.removeEventListener('keydown', esc) }
  }, [fileId])

  useEffect(() => {
    if (!src || !canvas.current) return
    const img = new Image()
    img.onload = () => {
      const [x, y, w, h] = check.box
      const padY = Math.max(40, h * 1.5)
      const top = Math.max(0, y - padY), bottom = Math.min(img.height, y + h + padY)
      const c = canvas.current
      c.width = img.width; c.height = bottom - top
      const ctx = c.getContext('2d')
      ctx.drawImage(img, 0, top, img.width, bottom - top, 0, 0, img.width, bottom - top)
      ctx.strokeStyle = '#d9534f'; ctx.lineWidth = 4
      ctx.strokeRect(x - 8, y - top - 6, w + 16, h + 12)
    }
    img.src = src
  }, [src, check])

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Where this value was read">
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
          <h2 style={{ margin: 0 }}>Clause {check.clause}: where the value was read</h2>
          <button className="ghost icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
        </div>
        <p className="muted" style={{ marginTop: 0 }}>
          {check.property}{check.direction ? ` (${check.direction})` : ''} · read as <b style={{ color: 'var(--text)' }}>{check.value} {check.unit}</b> · requirement {check.requirement}
        </p>
        {error ? <p className="error">{error}</p> : !src ? <p className="muted">Loading the scanned page…</p> :
          <div className="evidence"><canvas ref={canvas} style={{ width: '100%', height: 'auto' }} /></div>}
        <p className="muted" style={{ fontSize: 13 }}>OCR text of this line: <code>{check.raw_line}</code></p>
        {pageSize && <p className="muted" style={{ fontSize: 12 }}>Cleaned page {pageSize[0]} × {pageSize[1]} px, after page finding and straightening.</p>}
      </div>
    </div>
  )
}
