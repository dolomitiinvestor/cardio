import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// iOS Safari suspends the service worker's own update checks while the tab
// is backgrounded, so a new deploy can sit undetected indefinitely. Force a
// check whenever the app is foregrounded again.
if ('serviceWorker' in navigator) {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      navigator.serviceWorker.getRegistration().then((reg) => reg?.update())
    }
  })
}
