import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import client from '../api/client'
import toast from 'react-hot-toast'

export default function Profile() {
  const [fdKey, setFdKey] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [profile, setProfile] = useState(null)

  const [newUsername, setNewUsername] = useState('')
  const [savingUsername, setSavingUsername] = useState(false)

  useEffect(() => {
    client.get('/users/me')
      .then(r => {
        setProfile(r.data)
        setFdKey(r.data.freshdesk_api_key || '')
        setNewUsername(r.data.username || '')
      })
      .catch(() => toast.error('Failed to load profile'))
      .finally(() => setLoading(false))
  }, [])

  const saveFd = async () => {
    setSaving(true)
    try {
      await client.put('/users/me/freshdesk-key', { freshdesk_api_key: fdKey })
      toast.success('Settings saved')
    } catch {
      toast.error('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const saveUsername = async () => {
    if (newUsername.trim() === profile?.username) return
    setSavingUsername(true)
    try {
      const r = await client.put('/users/me/username', { username: newUsername.trim() })
      setProfile(prev => ({ ...prev, username: r.data.username }))
      localStorage.setItem('username', r.data.username)
      toast.success('Username updated')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update username')
    } finally {
      setSavingUsername(false)
    }
  }

  if (loading) return <Layout><div className="p-8 text-gray-400">Loading...</div></Layout>

  return (
    <Layout>
      <div className="max-w-xl mx-auto py-10 px-4 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Settings</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your account preferences</p>
        </div>

        {/* Profile info */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Account</h2>

          {/* Username */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Username</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newUsername}
                onChange={e => setNewUsername(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveUsername()}
                className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={saveUsername}
                disabled={savingUsername || newUsername.trim() === profile?.username || !newUsername.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {savingUsername ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-sm text-gray-700 dark:text-gray-300"><span className="font-medium">Email:</span> {profile?.email}</p>
            <p className="text-sm text-gray-700 dark:text-gray-300"><span className="font-medium">Role:</span> {profile?.role}</p>
          </div>
        </div>

        {/* Freshdesk API Key */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-1">Freshdesk API Key</h2>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Your personal Freshdesk API key. Used for loading tickets and the Daily Update tracker detection.
              Find it in Freshdesk → Profile Settings → API Key.
            </p>
          </div>
          <div className="flex gap-2">
            <input
              type="password"
              value={fdKey}
              onChange={e => setFdKey(e.target.value)}
              placeholder="Enter your Freshdesk API key"
              className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={saveFd}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
          {fdKey ? (
            <p className="text-xs text-green-600 dark:text-green-400">✓ API key configured</p>
          ) : (
            <p className="text-xs text-yellow-600 dark:text-yellow-400">⚠ No personal key set — using shared key (shared quota with all agents)</p>
          )}
        </div>
      </div>
    </Layout>
  )
}
