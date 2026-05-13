import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import Login from './pages/Login'
import Register from './pages/Register'
import Generate from './pages/Generate'
import FAQs from './pages/FAQs'
import History from './pages/History'
import Users from './pages/Users'
import Insights from './pages/Insights'
import Tracker from './pages/Tracker'
import Profile from './pages/Profile'
import ProtectedRoute from './components/ProtectedRoute'
import { PlatformProvider } from './context/PlatformContext'

function App() {
  useEffect(() => {
    const saved = localStorage.getItem('darkMode')
    if (saved && JSON.parse(saved)) {
      document.documentElement.classList.add('dark')
    }
  }, [])

  return (
    <PlatformProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/generate"
          element={
            <ProtectedRoute>
              <Generate />
            </ProtectedRoute>
          }
        />
        <Route
          path="/faqs"
          element={
            <ProtectedRoute>
              <FAQs />
            </ProtectedRoute>
          }
        />
        <Route
          path="/history"
          element={
            <ProtectedRoute>
              <History />
            </ProtectedRoute>
          }
        />
        <Route
          path="/users"
          element={
            <ProtectedRoute>
              <Users />
            </ProtectedRoute>
          }
        />
        <Route
          path="/insights"
          element={
            <ProtectedRoute>
              <Insights />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tracker"
          element={
            <ProtectedRoute>
              <Tracker />
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </PlatformProvider>
  )
}

export default App
