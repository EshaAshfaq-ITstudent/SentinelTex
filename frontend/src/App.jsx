import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth'
import Layout from './components/Layout'
import Login from './pages/Login'
import Samples from './pages/Samples'
import SampleDetail from './pages/SampleDetail'
import ReviewQueue from './pages/ReviewQueue'
import ReportView from './pages/ReportView'
import ComingSoon from './pages/ComingSoon'

function home(role) {
  return role === 'lab_analyst' ? '/samples' : '/review'
}

// Only lets the listed roles open a page
function Guard({ roles, children }) {
  const { user, checking } = useAuth()
  if (checking) return <p className="muted pad">Loading…</p>
  if (!user) return <Navigate to="/login" replace />
  if (roles && !roles.includes(user.role)) return <Navigate to={home(user.role)} replace />
  return children
}

export default function App() {
  const { user } = useAuth()
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={home(user.role)} replace /> : <Login />} />
      <Route element={<Guard><Layout /></Guard>}>
        {/* Lab Analyst */}
        <Route path="/samples" element={<Guard roles={['lab_analyst']}><Samples /></Guard>} />
        <Route path="/samples/:code" element={<Guard roles={['lab_analyst']}><SampleDetail /></Guard>} />
        {/* Assistant Manager and Deputy Manager dashboards */}
        <Route path="/review" element={<Guard roles={['am', 'dm']}><ReviewQueue /></Guard>} />
        <Route path="/image-analysis" element={<Guard roles={['am', 'dm']}><ComingSoon title="Image Analysis" owner="Faiza" /></Guard>} />
        <Route path="/test-analysis" element={<Guard roles={['am', 'dm']}><ComingSoon title="Test Analysis" owner="Faiza" /></Guard>} />
        <Route path="/trends" element={<Guard roles={['am', 'dm']}><ComingSoon title="Trend Analysis" owner="Maham" /></Guard>} />
        <Route path="/chatbot" element={<Guard roles={['am', 'dm']}><ComingSoon title="Lab Chatbot" owner="Esha" /></Guard>} />
        {/* Everyone */}
        <Route path="/reports/:id" element={<ReportView />} />
      </Route>
      <Route path="*" element={<Navigate to={user ? home(user.role) : '/login'} replace />} />
    </Routes>
  )
}
