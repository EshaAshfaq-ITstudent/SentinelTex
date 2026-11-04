import { NavLink, Outlet } from 'react-router-dom'
import { ROLE_NAMES, useAuth } from '../auth'

// Navigation follows the role permissions of the sample and report APIs.
const MENUS = {
  lab_analyst: [['/samples', 'Samples'], ['/image-analysis', 'Image Analysis']],
  am: [['/review', 'Report Review'], ['/test-analysis', 'Test Analysis'],
       ['/trends', 'Trend Analysis'], ['/chatbot', 'Lab Chatbot']],
}
MENUS.dm = MENUS.am

export default function Layout() {
  const { user, signOut } = useAuth()
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">SENTINEL<span>TEX</span></div>
        <div className="who">{user.full_name}<br />{ROLE_NAMES[user.role]}</div>
        {MENUS[user.role].map(([to, label]) => (
          <NavLink key={to} to={to} className={({ isActive }) => 'nav' + (isActive ? ' active' : '')}>{label}</NavLink>
        ))}
        <div className="spacer" />
        <div className="offline">● Offline system</div>
        <button className="ghost" onClick={signOut}>Sign Out</button>
      </aside>
      <main className="content"><Outlet /></main>
    </div>
  )
}
