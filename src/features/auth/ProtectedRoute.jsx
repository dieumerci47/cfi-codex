import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthProvider'
import { FullScreenLoader } from '@/components/FullScreenLoader'

/** Bloque l'accès aux routes privées si pas de session. */
export function ProtectedRoute({ children }) {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) return <FullScreenLoader label="Vérification de la session…" />

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return children
}
