import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { AuthProvider } from './auth'
import App from './App'
import Splash from './components/Splash'
// Fonts are bundled into the build, so they also work on the offline laptop
import '@fontsource/chakra-petch/latin-500.css'
import '@fontsource/chakra-petch/latin-600.css'
import '@fontsource/chakra-petch/latin-700.css'
import '@fontsource/ibm-plex-sans/latin-400.css'
import '@fontsource/ibm-plex-sans/latin-500.css'
import '@fontsource/ibm-plex-sans/latin-600.css'
import '@fontsource/ibm-plex-mono/latin-400.css'
import '@fontsource/ibm-plex-mono/latin-500.css'
import './theme.css'

function Root() {
  // The opening screen shows once per app start (not on every page reload).
  // The desktop app has its own splash while the backend starts (electron/splash.html), so it is skipped there.
  const inDesktop = navigator.userAgent.includes('Electron')
  const [splash, setSplash] = useState(() => { try { return !inDesktop && !sessionStorage.getItem('st_splash') } catch { return !inDesktop } })
  const done = () => { try { sessionStorage.setItem('st_splash', '1') } catch { /* ignore */ } setSplash(false) }
  return (
    <>
      <App />
      {splash && <Splash onDone={done} />}
    </>
  )
}

// HashRouter (#/page) also works inside Electron, where there is no web server
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HashRouter>
      <AuthProvider>
        <Root />
      </AuthProvider>
    </HashRouter>
  </StrictMode>
)
