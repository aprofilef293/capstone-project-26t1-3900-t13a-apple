import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// for testing with cypress - to click on node in network graph page
if ((window as any).Cypress) {
  import('./store/useStore').then(({ useStore }) => {
    (window as any).__STORE__ = useStore
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
