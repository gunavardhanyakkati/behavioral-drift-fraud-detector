import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource-variable/inter'
import '@fontsource-variable/jetbrains-mono'
import './index.css'
import App from './App.jsx'
import { PipelineProvider } from './lib/pipeline.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <PipelineProvider>
      <App />
    </PipelineProvider>
  </React.StrictMode>,
)
