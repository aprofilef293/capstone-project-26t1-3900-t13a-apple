import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// for testing with cypress - to click on node in network graph page
type CypressWindow = Window & {
  Cypress?: unknown;
  __STORE__?: typeof import("./store/useStore").useStore;
};

const cypressWindow = window as CypressWindow;

if (cypressWindow.Cypress) {
  import("./store/useStore").then(({ useStore }) => {
    cypressWindow.__STORE__ = useStore;
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
