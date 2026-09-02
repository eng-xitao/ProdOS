import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './theme.css'
import './standard-responsive-print.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
