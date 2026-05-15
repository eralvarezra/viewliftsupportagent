import { useState, useCallback } from 'react'
import client from '../api/client'

function getUserFromStorage() {
  const role = localStorage.getItem('userRole')
  if (!role) return null

  // Primary: localStorage (set at login)
  let username = localStorage.getItem('username') || ''

  // Fallback: decode JWT sub claim — always has the username
  if (!username) {
    try {
      const token = localStorage.getItem('token') || ''
      const payload = JSON.parse(atob(token.split('.')[1]))
      username = payload.sub || ''
      if (username) localStorage.setItem('username', username)
    } catch {}
  }

  return { role, username }
}

export function useAuth() {
  const [user, setUser] = useState(getUserFromStorage)

  const login = useCallback(async (username, password) => {
    try {
      const response = await client.post('/auth/login', { username, password })
      const { access_token, role, username: returnedUsername } = response.data
      const resolvedUsername = returnedUsername || username

      localStorage.setItem('token', access_token)
      localStorage.setItem('userRole', role)
      localStorage.setItem('username', resolvedUsername)

      setUser({ role, username: resolvedUsername })
      return { success: true }
    } catch (error) {
      const message = error.response?.data?.detail || 'Login failed. Please try again.'
      return { success: false, error: message }
    }
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    localStorage.removeItem('userRole')
    localStorage.removeItem('username')
    setUser(null)
  }, [])

  return {
    user,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
    login,
    logout,
  }
}
