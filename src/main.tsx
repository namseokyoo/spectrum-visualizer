import "./sentry";
import * as Sentry from "@sentry/react";
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ThemeProvider } from './contexts/ThemeContext'

const ErrorFallback = () => (
  <div className="min-h-screen w-full bg-gray-900 text-gray-100 flex items-center justify-center p-4">
    <div className="text-center max-w-md">
      <div className="text-6xl mb-4">⚠️</div>
      <h1 className="text-2xl font-bold mb-2 text-red-400">Something went wrong</h1>
      <p className="text-gray-400 mb-6">
        Please reload the page to try again.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors font-medium"
      >
        Reload Page
      </button>
    </div>
  </div>
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<ErrorFallback />}>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </Sentry.ErrorBoundary>
  </StrictMode>,
)
