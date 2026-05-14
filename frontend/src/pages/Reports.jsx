import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import client from '../api/client'
import toast from 'react-hot-toast'

const PERIODS = ['today', 'week', 'month', 'total']
const PERIOD_LABELS = { today: 'Today', week: 'This Week', month: 'This Month', total: 'All Time' }

const fmt$ = (n) => n == null ? '—' : '$' + (n || 0).toFixed(4)
const totalCost = (data) => data.reduce((s, u) => s + (u.cost?.responses_month || 0) + (u.cost?.daily_updates_month || 0), 0)

export default function Reports() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('week')

  useEffect(() => {
    client.get('/reports/usage')
      .then(r => setData(r.data))
      .catch(() => toast.error('Failed to load report'))
      .finally(() => setLoading(false))
  }, [])

  const total = (key) => data.reduce((s, u) => s + (u[key]?.[period] || 0), 0)

  return (
    <Layout>
      <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Usage Reports</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Agent activity breakdown</p>
        </div>
        <div className="flex rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden text-xs font-medium">
          {PERIODS.map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-2 transition-colors ${period === p ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-400'}`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Responses Generated', key: 'responses', color: 'blue' },
          { label: 'Daily Updates Run', key: 'daily_updates', color: 'purple' },
          { label: 'Tickets Tracked', key: 'ticket_logs', color: 'green' },
        ].map(({ label, key, color }) => (
          <div key={key} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">{label}</p>
            <p className={`text-3xl font-bold text-${color}-600 dark:text-${color}-400`}>{loading ? '—' : total(key)}</p>
            <p className="text-xs text-gray-400 mt-1">{PERIOD_LABELS[period]}</p>
          </div>
        ))}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-amber-200 dark:border-amber-800 p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Total Cost (This Month)</p>
          <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">{loading ? '—' : '$' + totalCost(data).toFixed(4)}</p>
          <p className="text-xs text-gray-400 mt-1">Responses + Daily Updates</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-600">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">Agent</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">Role</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">Responses</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wide">Daily Updates</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-green-600 dark:text-green-400 uppercase tracking-wide">Tickets Tracked</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide">Cost (Month)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {loading ? (
                [...Array(4)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(6)].map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : data.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No data available</td></tr>
              ) : (
                [...data]
                  .sort((a, b) => (b.responses?.[period] || 0) - (a.responses?.[period] || 0))
                  .map(u => {
                    const costMonth = (u.cost?.responses_month || 0) + (u.cost?.daily_updates_month || 0)
                    return (
                      <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-800 dark:text-white">{u.username}</p>
                          <p className="text-xs text-gray-400">{u.email}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${u.role === 'admin' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center font-semibold text-blue-600 dark:text-blue-400">{u.responses?.[period] || 0}</td>
                        <td className="px-4 py-3 text-center font-semibold text-purple-600 dark:text-purple-400">{u.daily_updates?.[period] || 0}</td>
                        <td className="px-4 py-3 text-center font-semibold text-green-600 dark:text-green-400">{u.ticket_logs?.[period] || 0}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="font-semibold text-amber-600 dark:text-amber-400">{fmt$(costMonth)}</span>
                          {costMonth > 0 && (
                            <p className="text-xs text-gray-400 mt-0.5">{fmt$(u.cost?.responses_month)} resp + {fmt$(u.cost?.daily_updates_month)} DU</p>
                          )}
                        </td>
                      </tr>
                    )
                  })
              )}
            </tbody>
            {!loading && data.length > 0 && (
              <tfoot>
                <tr className="bg-gray-50 dark:bg-gray-700/50 border-t-2 border-gray-200 dark:border-gray-600 font-semibold">
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300" colSpan={2}>Total</td>
                  <td className="px-4 py-3 text-center text-blue-600 dark:text-blue-400">{total('responses')}</td>
                  <td className="px-4 py-3 text-center text-purple-600 dark:text-purple-400">{total('daily_updates')}</td>
                  <td className="px-4 py-3 text-center text-green-600 dark:text-green-400">{total('ticket_logs')}</td>
                  <td className="px-4 py-3 text-center text-amber-600 dark:text-amber-400">${totalCost(data).toFixed(4)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </Layout>
  )
}
