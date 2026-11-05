import { useState } from 'react'
import { useAuth } from '../auth'
import { Emblem, Glyph } from '../components/Icon'

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
      <div className="login-art">
        <div>
          <Emblem size={64} />
          <h1>SENTINEL<b>TEX</b></h1>
          <p>Quality assurance and standards verification for military uniform fabric.</p>
        </div>
        <div className="login-facts">
          <div><Glyph name="image" tone="lit" />Fabric photos checked for defects</div>
          <div><Glyph name="file" tone="lit" />Lab report values read and matched to each clause</div>
          <div><Glyph name="database" tone="lit" />Answers grounded in specification STS/UC/01</div>
          <div><Glyph name="stamp" tone="lit" />Signed off by the Assistant Manager, then the Deputy Manager</div>
        </div>
      </div>
      <div className="login-side">
        <div className="login">
          <h2>Sign in</h2>
          <p className="muted" style={{ margin: '0 0 22px' }}>Use the account your lab administrator set up for you.</p>
          <form onSubmit={submit}>
            <label>Username
              <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus required placeholder="Username" autoComplete="username" />
            </label>
            <label>Password
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Password" autoComplete="current-password" />
            </label>
            {error && <div className="error">{error}</div>}
            <button disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
          </form>
          <div className="login-foot"><span className="status-dot" />Offline. Nothing leaves this laptop. Authorised staff only.</div>
        </div>
      </div>
    </div>
  )
}
