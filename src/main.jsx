import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'

import './index.css'
import App from './App.jsx'
import { queryClient } from '@/lib/queryClient'
import { ThemeProvider } from '@/components/theme-provider'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { ConfirmProvider } from '@/components/ConfirmProvider'
import { Toaster } from '@/components/ui/sonner'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider defaultTheme="dark">
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <ConfirmProvider>
              <App />
            </ConfirmProvider>
            <Toaster position="top-center" richColors />
          </BrowserRouter>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
)
