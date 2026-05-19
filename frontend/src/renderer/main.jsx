/**
 * main.jsx — точка входа React-приложения.
 * Берёт компонент App и монтирует его в <div id="root"> из index.html.
 */

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
