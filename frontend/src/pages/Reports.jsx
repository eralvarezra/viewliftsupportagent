import { useState, useEffect, useRef, useCallback } from 'react'
import Layout from '../components/Layout'
import client from '../api/client'
import toast from 'react-hot-toast'

// ── Usage Reports ────────────────────────────────────────────────────────────

const PERIODS = ['today', 'week', 'month', 'total']
const PERIOD_LABELS = { today: 'Today', week: 'This Week', month: 'This Month', total: 'All Time' }
const POLL_INTERVAL = 30_000
const fmt$ = (n) => n == null ? '—' : '$' + (n || 0).toFixed(4)
const totalCost = (data, period) => data.reduce((s, u) => s + (u.cost?.[period] || 0), 0)

function UsageReports() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('week')
  const [lastUpdated, setLastUpdated] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const intervalRef = useRef(null)

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true)
    try {
      const r = await client.get('/reports/usage')
      setData(r.data)
      setLastUpdated(new Date())
    } catch {
      if (!silent) toast.error('Failed to load report')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchData(false)
    intervalRef.current = setInterval(() => fetchData(true), POLL_INTERVAL)
    return () => clearInterval(intervalRef.current)
  }, [fetchData])

  const total = (key) => data.reduce((s, u) => s + (u[key]?.[period] || 0), 0)

  const timeAgo = () => {
    if (!lastUpdated) return ''
    const secs = Math.floor((Date.now() - lastUpdated) / 1000)
    if (secs < 5) return 'just now'
    if (secs < 60) return `${secs}s ago`
    return `${Math.floor(secs / 60)}m ago`
  }

  const costNote = (u) => {
    const periodCost = u.cost?.[period] || 0
    if (!periodCost) return null
    if (period === 'month') return `${fmt$(u.cost?.responses_month)} resp + ${fmt$(u.cost?.daily_updates_month)} DU`
    if (period === 'total') return `${fmt$(u.cost?.responses_month)} resp (month) + ${fmt$(u.cost?.daily_updates_month)} DU (month)`
    return 'Daily Updates only'
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-2 mt-1">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Live · updates every 30s
            {lastUpdated && <span className="ml-1 text-gray-400 dark:text-gray-500">· {timeAgo()}</span>}
          </p>
          <button
            onClick={() => fetchData(false)}
            disabled={refreshing}
            className="ml-1 text-xs text-blue-500 hover:text-blue-700 disabled:opacity-40 transition-colors"
          >
            {refreshing ? 'Refreshing…' : '↻ Refresh'}
          </button>
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
            <p className={`text-3xl font-bold text-${color}-600 dark:text-${color}-400 transition-all`}>{loading ? '—' : total(key)}</p>
            <p className="text-xs text-gray-400 mt-1">{PERIOD_LABELS[period]}</p>
          </div>
        ))}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-amber-200 dark:border-amber-800 p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Total Cost · {PERIOD_LABELS[period]}</p>
          <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">{loading ? '—' : '$' + totalCost(data, period).toFixed(4)}</p>
          <p className="text-xs text-gray-400 mt-1">{period === 'today' || period === 'week' ? 'Daily Updates only' : 'Responses + Daily Updates'}</p>
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
                <th className="text-center px-4 py-3 text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide">Cost · {PERIOD_LABELS[period]}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {loading ? (
                [...Array(4)].map((_, i) => (
                  <tr key={i}>{[...Array(6)].map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" /></td>
                  ))}</tr>
                ))
              ) : data.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No data available</td></tr>
              ) : (
                [...data]
                  .sort((a, b) => (b.responses?.[period] || 0) - (a.responses?.[period] || 0))
                  .map(u => {
                    const periodCost = u.cost?.[period] || 0
                    const note = costNote(u)
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
                          <span className="font-semibold text-amber-600 dark:text-amber-400">{fmt$(periodCost)}</span>
                          {note && <p className="text-xs text-gray-400 mt-0.5">{note}</p>}
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
                  <td className="px-4 py-3 text-center text-amber-600 dark:text-amber-400">${totalCost(data, period).toFixed(4)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </>
  )
}

// ── Get Paid ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color = 'text-gray-800 dark:text-white' }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{sub}</p>}
    </div>
  )
}

function SetupCard({ onSaved }) {
  const [token, setToken] = useState('')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!token.trim()) return
    setSaving(true)
    try {
      await client.put('/harvest/config', { harvest_token: token.trim() })
      toast.success('Harvest token saved')
      onSaved()
    } catch {
      toast.error('Failed to save token')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto mt-10 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center space-y-4">
      <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center mx-auto">
        <svg className="w-6 h-6 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <div>
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white">Connect Harvest</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Enter your Harvest Personal Access Token to see your pay report.
          Find it at <span className="font-medium">harvestapp.com → Developers → Personal Access Tokens</span>.
        </p>
      </div>
      <div className="flex gap-2">
        <input
          type="password"
          value={token}
          onChange={e => setToken(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && save()}
          placeholder="Harvest Personal Access Token"
          className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
        <button
          onClick={save}
          disabled={saving || !token.trim()}
          className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {saving ? 'Saving…' : 'Connect'}
        </button>
      </div>
    </div>
  )
}

function GetPaid() {
  const [configured, setConfigured] = useState(null)
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(false)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [customRange, setCustomRange] = useState(false)

  const checkConfig = async () => {
    try {
      const r = await client.get('/harvest/config')
      setConfigured(r.data.configured)
      if (r.data.configured) loadReport()
    } catch {
      setConfigured(false)
    }
  }

  const loadReport = async (fd, td) => {
    setLoading(true)
    try {
      const params = {}
      if (fd && td) { params.from_date = fd; params.to_date = td }
      const r = await client.get('/harvest/report', { params })
      setReport(r.data)
      if (!fd) { setFromDate(r.data.from_date); setToDate(r.data.to_date) }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to load report')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { checkConfig() }, [])

  if (configured === null) return <div className="p-8 text-gray-400 text-sm">Loading…</div>
  if (!configured) return <SetupCard onSaved={() => { setConfigured(true); loadReport() }} />

  const applyRange = () => { if (fromDate && toDate) loadReport(fromDate, toDate) }
  const approvalPct = report ? Math.round((report.approved_hours / (report.billable_hours || 1)) * 100) : 0

  return (
    <div className="space-y-6">
      {/* Sub-header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {report ? `${report.name} — ${report.month}` : 'Loading your pay report…'}
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          {customRange ? (
            <>
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500" />
              <span className="text-gray-400 text-sm">→</span>
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500" />
              <button onClick={applyRange} disabled={loading}
                className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors">
                Apply
              </button>
              <button onClick={() => { setCustomRange(false); loadReport() }}
                className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                Current month
              </button>
            </>
          ) : (
            <button onClick={() => setCustomRange(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Custom range
            </button>
          )}
          <button onClick={() => loadReport(customRange ? fromDate : undefined, customRange ? toDate : undefined)} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors">
            <svg className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>

      {loading && !report && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-24 rounded-xl bg-gray-100 dark:bg-gray-700 animate-pulse" />)}
        </div>
      )}

      {report && (
        <>
          <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl p-6 text-white shadow-lg">
            <p className="text-sm font-medium opacity-80 mb-1">Total Payment — {report.month}</p>
            <p className="text-4xl font-bold">${report.total_payment.toFixed(2)}</p>
            <div className="flex gap-4 mt-3 text-sm opacity-90 flex-wrap">
              <span>Base: ${report.earned.toFixed(2)}</span>
              {report.weekend_bonus > 0 && <span>+ Weekend bonus: ${report.weekend_bonus.toFixed(2)} ({report.weekend_days} day{report.weekend_days !== 1 ? 's' : ''})</span>}
              <span>Rate: ${report.hourly_rate.toFixed(4)}/hr</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="Total Hours" value={`${report.total_hours}h`} sub={`of ${report.capacity_hours}h capacity`} />
            <StatCard label="Billable Hours" value={`${report.billable_hours}h`} sub={report.time_off_hours > 0 ? `${report.time_off_hours}h time off` : 'No time off'} color="text-blue-600 dark:text-blue-400" />
            <StatCard label="Approved" value={`${report.approved_hours}h`} sub={`${approvalPct}% of billable`} color="text-green-600 dark:text-green-400" />
            <StatCard label="Pending" value={`${report.pending_hours}h`} sub="awaiting approval" color={report.pending_hours > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-800 dark:text-white'} />
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Hours Approval Progress</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{report.approved_hours}h / {report.billable_hours}h</p>
            </div>
            <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${Math.min(approvalPct, 100)}%` }} />
            </div>
            {report.pending_billable > 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1.5">{report.pending_billable}h pending approval — payment may increase once approved</p>
            )}
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
              <h3 className="font-semibold text-gray-800 dark:text-white text-sm">Projects Breakdown</h3>
            </div>
            <div className="divide-y divide-gray-50 dark:divide-gray-700">
              {report.projects.map(p => (
                <div key={p.name} className={`flex items-center justify-between px-4 py-3 ${p.is_time_off ? 'opacity-60' : ''}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{p.name}</p>
                      {p.is_time_off && <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">Time Off</span>}
                    </div>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{p.task}</p>
                  </div>
                  <div className="flex items-center gap-4 text-right flex-shrink-0">
                    {!p.is_time_off && (
                      <div className="hidden sm:flex gap-3 text-xs">
                        {p.approved > 0 && <span className="text-green-600 dark:text-green-400">{p.approved}h approved</span>}
                        {p.pending > 0 && <span className="text-amber-600 dark:text-amber-400">{p.pending}h pending</span>}
                      </div>
                    )}
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 w-14 text-right">{p.hours}h</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-2">
            <h3 className="font-semibold text-gray-800 dark:text-white text-sm mb-3">Payment Calculation</h3>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-gray-600 dark:text-gray-400"><span>Monthly salary</span><span>$900.00</span></div>
              <div className="flex justify-between text-gray-600 dark:text-gray-400"><span>Working hours in month</span><span>{report.monthly_hours}h</span></div>
              <div className="flex justify-between text-gray-600 dark:text-gray-400"><span>Hourly rate</span><span>${report.hourly_rate.toFixed(4)}</span></div>
              <div className="flex justify-between text-gray-600 dark:text-gray-400"><span>Effective billable hours</span><span>{report.effective_hours}h (of {report.capacity_hours}h capacity)</span></div>
              <div className="border-t border-gray-100 dark:border-gray-700 pt-1.5 flex justify-between font-medium text-gray-700 dark:text-gray-200"><span>Base earned</span><span>${report.earned.toFixed(2)}</span></div>
              {report.weekend_bonus > 0 && (
                <div className="flex justify-between font-medium text-gray-700 dark:text-gray-200">
                  <span>Weekend bonus ({report.weekend_days} day{report.weekend_days !== 1 ? 's' : ''} × $20)</span>
                  <span>+${report.weekend_bonus.toFixed(2)}</span>
                </div>
              )}
              <div className="border-t border-gray-200 dark:border-gray-600 pt-2 flex justify-between text-base font-bold text-orange-600 dark:text-orange-400">
                <span>Total</span><span>${report.total_payment.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── Main Reports page ─────────────────────────────────────────────────────────

const TABS = [
  { id: 'usage', label: 'Usage Reports' },
  { id: 'getpaid', label: 'Get Paid' },
]

export default function Reports() {
  const [tab, setTab] = useState('usage')

  return (
    <Layout>
      <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Reports</h2>
        </div>
        <div className="flex rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden text-sm font-medium">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 transition-colors ${tab === t.id ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-400'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'usage' ? <UsageReports /> : <GetPaid />}
    </Layout>
  )
}
