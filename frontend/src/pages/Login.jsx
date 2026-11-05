import { useState } from 'react'
import { useAuth } from '../auth'
import Icon from '../components/Icon'

// Login (the form logic is unchanged; only the look is new).
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
        <div className="brand"><span className="brand-mark"><Icon name="shield" size={17} /></span><span className="brand-text">SENTINEL<b>TEX</b></span></div>
        <p className="muted" style={{ margin: '0 0 18px' }}>Military uniform fabric quality assurance and standards verification</p>
        <form onSubmit={submit}>
          <label className="muted" style={{ fontSize: 13 }}>Username
            <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus required placeholder="Username"
                   style={{ width: '100%', marginTop: 4 }} autoComplete="username" />
          </label>
          <label className="muted" style={{ fontSize: 13 }}>Password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Password"
                   style={{ width: '100%', marginTop: 4 }} autoComplete="current-password" />
          </label>
          {error && <div className="error">{error}</div>}
          <button disabled={busy} style={{ marginTop: 6 }}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>
        <div className="login-foot"><span className="offline" style={{ padding: 0 }}>Offline · air gapped</span><span>Authorised staff only</span></div>
      </div>
    </div>
  )
}
