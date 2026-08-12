import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import { ZoomProvider } from './ui/Zoom'
import { applyStoredUiScale } from './ui/useUiScale'
import './index.css'

applyStoredUiScale()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ZoomProvider>
      <App />
    </ZoomProvider>
  </React.StrictMode>,
)
