import { useState, useCallback } from 'react'
import client from '../api/client'

export function useAuth() {
  const [user, setUser] = useState(() => {
    // Initialize from localStorage if available
    const role = localStorage.getItem('userRole')
    if (role) {
      return { role }
    }
    return null
  })

  const login = useCallback(async (username, password) => {
    try {
      const response = await client.post('/auth/login', {
        username,
        password,
      })

      const { access_token, role } = response.data

      // Store token and role in localStorage
      localStorage.setItem('token', access_token)
      localStorage.setItem('userRole', role)

      setUser({ role })

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