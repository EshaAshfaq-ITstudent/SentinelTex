import { useState } from 'react'
import { useAuth } from '../auth'

// DONE (example page): shows how a form calls the backend and handles errors.
export default function Login() {
  const { signIn } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setError('')
    try { await signIn(username, password) }      // App.jsx then sends the user to their dashboard
    catch (err) { setError(err.message) }
    finally { setBusy(false) }
  }

  return (
    <div className="login-wrap">
      <div className="card login">
        <div className="brand" style={{ padding: 0, marginBottom: 4 }}>SENTINEL<span>TEX</span></div>
        <p className="muted" style={{ marginTop: 0 }}>Military uniform fabric quality assurance</p>
        <form onSubmit={submit}>
          <input placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus required />
          <input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          {error && <div className="error">{error}</div>}
          <button disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>
      </div>
    </div>
  )
}
