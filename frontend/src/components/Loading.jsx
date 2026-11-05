export default function Loading({ text = 'Loading…' }) {
  return <div className="loading"><span className="spinner" />{text}</div>
}
