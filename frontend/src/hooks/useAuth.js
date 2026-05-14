import { useState, useCallback } from 'react'
import client from '../api/client'

export function useAuth() {
  const [user, setUser] = useState(() => {
    const role = localStorage.getItem('userRole')
    const username = localStorage.getItem('username')
    if (role) {
      return { role, username }
    }
    return null
  })

  const login = useCallback(async (username, password) => {
    try {
      const response = await client.post('/auth/login', {
        username,
        password,
      })

      const { access_token, role, username } = response.data

      localStorage.setItem('token', access_token)
      localStorage.setItem('userRole', role)
      localStorage.setItem('username', username || '')

      setUser({ role, username })

      return { success: true }
    } catch (error) {
      const message = error.response?.data?.detail || 'Login failed. Please try again.'
      return { success: false, error: message }
    }
  }, [])

  const logout = useCallback(() => {
    // Clear token and role from localStorage
    localStorage.removeItem('token')
    localStorage.removeItem('userRole')
    localStorage.removeItem('username')
    setUser(null)
  }, [])

  const isAuthenticated = !!user

  const isAdmin = user?.role === 'admin'

  return {
    user,
    isAuthenticated,
    isAdmin,
    login,
    logout,
  }
}