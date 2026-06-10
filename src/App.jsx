import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'

import { ProtectedRoute } from '@/features/auth/ProtectedRoute'
import { RequireOnboarded } from '@/features/auth/RequireOnboarded'
import { FullScreenLoader } from '@/components/FullScreenLoader'

// Chargement à la demande (code-splitting) pour alléger le bundle initial.
const LandingPage = lazy(() => import('@/routes/LandingPage'))
const AuthPage = lazy(() => import('@/routes/auth/AuthPage'))
const OnboardingPage = lazy(() => import('@/routes/onboarding/OnboardingPage'))
const AppLayout = lazy(() => import('@/routes/app/AppLayout'))
const FeedPage = lazy(() => import('@/routes/app/FeedPage'))
const ExplorePage = lazy(() => import('@/routes/app/ExplorePage'))
const CollectionsPage = lazy(() => import('@/routes/app/CollectionsPage'))
const CollectionDetailPage = lazy(() =>
  import('@/routes/app/CollectionDetailPage'),
)
const ProfilePage = lazy(() => import('@/routes/app/ProfilePage'))

export default function App() {
  return (
    <Suspense fallback={<FullScreenLoader />}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/signup" element={<AuthPage mode="signup" />} />

        <Route
          path="/onboarding"
          element={
            <ProtectedRoute>
              <OnboardingPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <RequireOnboarded>
                <AppLayout />
              </RequireOnboarded>
            </ProtectedRoute>
          }
        >
          <Route index element={<FeedPage />} />
          <Route path="explore" element={<ExplorePage />} />
          <Route path="collections" element={<CollectionsPage />} />
          <Route path="collections/:id" element={<CollectionDetailPage />} />
          <Route path="me" element={<ProfilePage />} />
          <Route path="u/:username" element={<ProfilePage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
