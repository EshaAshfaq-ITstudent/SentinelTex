import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import * as api from '../api'
import { ROLE_NAMES, useAuth } from '../auth'
import Icon, { Emblem, Glyph } from './Icon'

// Menus follow the proposal: AM and DM dashboards have Image Analysis, Test Analysis,
// Trend Analysis, Lab Chatbot, Report Review and Sign Out.
const MENUS = {
  lab_analyst: [['/overview', 'Overview', 'home'], ['/samples', 'Samples', 'samples'], ['/messages', 'Messages', 'chat']],
  am: [['/home', 'Overview', 'home'], ['/review', 'Report Review', 'review'], ['/image-analysis', 'Image Analysis', 'image'],
       ['/test-analysis', 'Test Analysis', 'test'], ['/trends', 'Trend Analysis', 'trend'], ['/chatbot', 'Lab Chatbot', 'spark'],
       ['/messages', 'Messages', 'chat']],
}
MENUS.dm = MENUS.am

const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?'

export default function Layout() {
  const { user, signOut } = useAuth()
  const [llm, setLlm] = useState(null)
  const [unread, setUnread] = useState(0)
  useEffect(() => { api.knowledgeStatus().then((k) => setLlm(!!k?.llm?.available)).catch(() => setLlm(false)) }, [])
  useEffect(() => {      // unread message count next to Messages, checked every 15 seconds
    const load = () => api.listThreads().then((t) => setUnread(t.reduce((n, x) => n + x.unread, 0))).catch(() => {})
    load()
    const t = setInterval(load, 15000)
    window.addEventListener('st-messages-read', load)      // a thread was opened: update the count now
    return () => { clearInterval(t); window.removeEventListener('st-messages-read', load) }
  }, [])

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <Emblem size={36} />
          <div><div className="brand-text">SENTINEL<b>TEX</b></div><div className="brand-sub">Fabric QA and standards</div></div>
        </div>
        <div className="who">
          <div className="avatar">{initials(user.full_name)}</div>
          <div><div className="who-name">{user.full_name}</div><div className="who-role">{ROLE_NAMES[user.role]}</div></div>
        </div>
        <div className="nav-label">{user.role === 'lab_analyst' ? 'Lab work' : 'Dashboard'}</div>
        {MENUS[user.role].map(([to, label, icon]) => (
          <NavLink key={to} to={to} className={({ isActive }) => 'nav' + (isActive ? ' active' : '')}>
            <Glyph name={icon} size={16} />{label}
            {to === '/messages' && unread > 0 && <span className="count" aria-label={`${unread} unread`}>{unread}</span>}
          </NavLink>
        ))}
        <div className="spacer" />
        <div className="sidebar-foot">
        <div className="offline"><span className="status-dot" />Offline, nothing leaves this laptop</div>
        {llm !== null && (
          <div className="offline" style={{ paddingTop: 0 }}>
            <span className={`status-dot${llm ? '' : ' warn'}`} />{llm ? 'Local LLM ready' : 'Local LLM not running'}
          </div>
        )}
        <button className="ghost" onClick={signOut} style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', marginTop: 6 }}>
          <Icon name="logout" size={16} />Sign Out
        </button>
        </div>
      </aside>
      <main className="content"><Outlet /></main>
    </div>
  )
}
