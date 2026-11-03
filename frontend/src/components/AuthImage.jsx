import { useEffect, useState } from 'react'
import { fileUrl } from '../api'

// Shows an uploaded photo. annotated = the copy with YOLO defect boxes (if the model ran).
export default function AuthImage({ fileId, annotated = false, alt = '', style }) {
  const [src, setSrc] = useState(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let url
    fileUrl(fileId, annotated).then((u) => { url = u; setSrc(u) }).catch(() => setFailed(true))
    return () => url && URL.revokeObjectURL(url)
  }, [fileId, annotated])
  if (failed) return <p className="muted">Could not load image</p>
  if (!src) return <p className="muted">Loading image…</p>
  return <img src={src} alt={alt} style={{ maxWidth: '100%', borderRadius: 8, ...style }} />
}
