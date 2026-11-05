import { NavLink, Outlet } from 'react-router-dom'
import { ROLE_NAMES, useAuth } from '../auth'
import Icon from './Icon'

// Menus follow the proposal: AM and DM dashboards have Image Analysis, Test Analysis,
// Trend Analysis, Lab Chatbot, Report Review and Sign Out.
const MENUS = {
  lab_analyst: [['/samples', 'Samples', 'samples']],
  am: [['/home', 'Overview', 'home'], ['/review', 'Report Review', 'review'], ['/image-analysis', 'Image Analysis', 'image'],
       ['/test-analysis', 'Test Analysis', 'test'], ['/trends', 'Trend Analysis', 'trend'], ['/chatbot', 'Lab Chatbot', 'chat']],
}
MENUS.dm = MENUS.am

const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?'

export default function Layout() {
  const { user, signOut } = useAuth()
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark"><Icon name="shield" size={17} /></span><span className="brand-text">SENTINEL<b>TEX</b></span></div>
        <div className="who">
          <div className="avatar">{initials(user.full_name)}</div>
          <div><div className="who-name">{user.full_name}</div><div className="who-role">{ROLE_NAMES[user.role]}</div></div>
        </div>
        <div className="nav-label">Dashboard</div>
        {MENUS[user.role].map(([to, label, icon]) => (
          <NavLink key={to} to={to} className={({ isActive }) => 'nav' + (isActive ? ' active' : '')}>
            <Icon name={icon} />{label}
          </NavLink>
        ))}
        <div className="spacer" />
        <div className="offline">Offline · air gapped</div>
        <button className="ghost" onClick={signOut} style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="logout" size={16} />Sign Out
        </button>
      </aside>
      <main className="content"><Outlet /></main>
    </div>
  )
}
