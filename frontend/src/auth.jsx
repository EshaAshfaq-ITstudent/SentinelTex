import { createContext, useContext, useEffect, useState } from 'react'
import * as api from './api'

const AuthContext = createContext(null)

export const ROLE_NAMES = { lab_analyst: 'Lab Analyst', am: 'Assistant Manager', dm: 'Deputy Manager' }

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)        // { username, full_name, role }
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    if (!api.getToken()) { setChecking(false); return }
    api.me().then(setUser).catch(() => api.setToken(null)).finally(() => setChecking(false))
  }, [])

  async function signIn(username, password) {
    await api.login(username, password)
    setUser(await api.me())
  }
  function signOut() {
    api.setToken(null)
    setUser(null)
  }
  return <AuthContext.Provider value={{ user, checking, signIn, signOut }}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
