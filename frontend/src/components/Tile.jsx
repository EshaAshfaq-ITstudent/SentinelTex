import { Glyph } from './Icon'

// A KPI plate: glowing icon, label, big value and a short note under it
export default function Tile({ icon, tone = '', label, value, sub, accent = false, small = false }) {
  return (
    <div className={`tile${accent ? ' accent' : ''}`}>
      {icon && <Glyph name={icon} tone={tone || 'lit'} />}
      <div style={{ minWidth: 0 }}>
        <div className="tile-label">{label}</div>
        <div className={`tile-value${small ? ' small' : ''}`}>{value}</div>
        {sub && <div className="tile-sub">{sub}</div>}
      </div>
    </div>
  )
}
