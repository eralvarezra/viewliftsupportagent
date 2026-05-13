import { useState, useCallback, useRef, useEffect } from 'react'
import Layout from '../components/Layout'
import client from '../api/client'
import toast from 'react-hot-toast'

const STEPS = [
  { n: 1, text: 'In Freshdesk, apply the filter: B2C → New tickets created today' },
  { n: 2, text: 'Click the "Export" button' },
  {
    n: 3,
    text: 'Select the following fields:',
    fields: {
      'Ticket fields': 'Ticket ID, Subject, Description, Status, Type, Created time, Tags, Survey results, Product, Summary, Client Name, Platform',
      'Contact fields': 'Full name, Email, Contact ID',
    },
  },
  { n: 4, text: 'Click "Export" to download the CSV file' },
  { n: 5, text: 'Upload the downloaded CSV in the area below' },
]

const TREND_CONFIG = {
  high:   { label: 'High',   cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
  medium: { label: 'Medium', cls: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300' },
  low:    { label: 'Low',    cls: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' },
}

const CLIENT_PALETTES = [
  { card: 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-700',   badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',   header: 'text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-700' },
  { card: 'bg-purple-50 border-purple-200 dark:bg-purple-900/20 dark:border-purple-700', badge: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300', header: 'text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-700' },
  { card: 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-700',  badge: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',   header: 'text-green-700 dark:text-green-400 border-green-200 dark:border-green-700' },
  { card: 'bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-700', badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300', header: 'text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-700' },
  { card: 'bg-pink-50 border-pink-200 dark:bg-pink-900/20 dark:border-pink-700',    badge: 'bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300',     header: 'text-pink-700 dark:text-pink-400 border-pink-200 dark:border-pink-700' },
  { card: 'bg-teal-50 border-teal-200 dark:bg-teal-900/20 dark:border-teal-700',   badge: 'bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300',    header: 'text-teal-700 dark:text-teal-400 border-teal-200 dark:border-teal-700' },
  { card: 'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-700', badge: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300', header: 'text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-700' },
  { card: 'bg-rose-50 border-rose-200 dark:bg-rose-900/20 dark:border-rose-700',   badge: 'bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300',    header: 'text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-700' },
]

const clientColorCache = {}
let clientColorCounter = 0
const getClientPalette = (clientName) => {
  if (!clientColorCache[clientName]) {
    clientColorCache[clientName] = CLIENT_PALETTES[clientColorCounter % CLIENT_PALETTES.length]
    clientColorCounter++
  }
  return clientColorCache[clientName]
}

function TrackerGroupCard({ tg, trackerDetails }) {
  const [open, setOpen] = useState(true)
  const details = trackerDetails?.[tg.tracker_id] || {}

  return (
    <div className="rounded-lg border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:opacity-90 transition-opacity"
      >
        <span className="flex-shrink-0 px-2 py-0.5 rounded text-xs font-bold bg-red-200 text-red-800 dark:bg-red-800 dark:text-red-200">
          TRACKER
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
            #{tg.tracker_id} — {tg.subject}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Status: {tg.status} · {tg.ticket_ids.length} ticket{tg.ticket_ids.length !== 1 ? 's' : ''} from today linked to this tracker
          </p>
        </div>
        <a
          href={tg.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className="flex-shrink-0 text-xs text-blue-600 dark:text-blue-400 hover:underline mr-2"
        >
          Open ↗
        </a>
        <svg className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="px-5 pb-4 pt-1 border-t border-red-200 dark:border-red-700 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Tickets from today's CSV</p>
              <div className="flex flex-wrap gap-1">
                {tg.ticket_ids.map(id => (
                  <a
                    key={id}
                    href={`https://viewlift.freshdesk.com/a/tickets/${id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block px-2 py-0.5 rounded bg-white dark:bg-gray-800 border border-red-200 dark:border-red-600 text-xs font-mono text-red-700 dark:text-red-300 hover:underline"
                  >
                    #{id}
                  </a>
                ))}
              </div>
            </div>
            {tg.tags?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Tracker Tags</p>
                <div className="flex flex-wrap gap-1">
                  {tg.tags.map(tag => (
                    <span key={tag} className="inline-block px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/40 text-xs text-red-700 dark:text-red-300">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function GroupCard({ group, index, trackerDetails, palette = CLIENT_PALETTES[0] }) {
  const [open, setOpen] = useState(true)
  const trend = TREND_CONFIG[group.trend] || TREND_CONFIG.low
  const hasTrackers = group.tracker_ids?.length > 0

  return (
    <div className={`rounded-lg border ${palette.card} overflow-hidden`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:opacity-90 transition-opacity"
      >
        <span className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${palette.badge}`}>
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{group.title}</h3>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${trend.cls}`}>{trend.label}</span>
            {hasTrackers && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                🔗 Tracker
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{group.description}</p>
        </div>
        <div className="flex-shrink-0 flex items-center gap-2 mr-2">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
            {group.ticket_ids?.length || 0} ticket{(group.ticket_ids?.length || 0) !== 1 ? 's' : ''}
          </span>

        </div>
        <svg className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="px-5 pb-5 pt-1 space-y-4 border-t border-inherit">
          <p className="text-sm text-gray-700 dark:text-gray-300">{group.description}</p>

          {/* Linked trackers */}
          {hasTrackers && (
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Linked Trackers</p>
              <div className="flex flex-col gap-1">
                {group.tracker_ids.map(trId => {
                  const tr = trackerDetails?.[trId]
                  return (
                    <a
                      key={trId}
                      href={`https://viewlift.freshdesk.com/a/tickets/${trId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-xs hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
                    >
                      <span className="font-mono text-red-700 dark:text-red-300">#{trId}</span>
                      <span className="text-gray-700 dark:text-gray-300">{tr?.subject || 'Tracker'}</span>
                      <span className="ml-auto text-gray-400">{tr?.status}</span>
                    </a>
                  )
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {group.ticket_ids?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Tickets</p>
                <div className="flex flex-wrap gap-1">
                  {group.ticket_ids.map(id => (
                    <span key={id} className="inline-block px-2 py-0.5 rounded text-xs font-mono border bg-white border-gray-200 text-gray-700 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300">#{id}</span>
                  ))}
                </div>
              </div>
            )}

            {group.devices?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Devices</p>
                <div className="flex flex-wrap gap-1">
                  {group.devices.map(d => (
                    <span key={d} className="inline-block px-2 py-0.5 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-xs text-gray-600 dark:text-gray-300">{d}</span>
                  ))}
                </div>
              </div>
            )}

            {group.tags?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Tags</p>
                <div className="flex flex-wrap gap-1">
                  {group.tags.map(tag => (
                    <span key={tag} className="inline-block px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-xs text-gray-600 dark:text-gray-300">{tag}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function DailyUpdate() {
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [fileName, setFileName] = useState(null)
  const inputRef = useRef(null)
  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [activeReportId, setActiveReportId] = useState(null)
  const [filterTrend, setFilterTrend] = useState(null) // null | 'high' | 'medium' | 'low'
  const [filterTracker, setFilterTracker] = useState(false)
  const [slackCopied, setSlackCopied] = useState(false)

  useEffect(() => {
    client.get('/daily-update/history')
      .then(r => setHistory(r.data))
      .catch(() => {})
      .finally(() => setHistoryLoading(false))
  }, [])

  const loadReport = async (id) => {
    try {
      const r = await client.get(`/daily-update/history/${id}`)
      setResult(r.data)
      setFileName(r.data.filename || 'saved report')
      setActiveReportId(id)
      setFilterTrend(null)
      setFilterTracker(false)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      toast.error('Failed to load report')
    }
  }

  const deleteReport = async (id, e) => {
    e.stopPropagation()
    try {
      await client.delete(`/daily-update/history/${id}`)
      setHistory(prev => prev.filter(r => r.id !== id))
      if (activeReportId === id) { setResult(null); setFileName(null); setActiveReportId(null) }
      toast.success('Report deleted')
    } catch {
      toast.error('Failed to delete report')
    }
  }

  const processFile = useCallback(async (file) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast.error('File must be a CSV')
      return
    }
    setFileName(file.name)
    setLoading(true)
    setResult(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await client.post('/daily-update/analyze', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 180000,
      })
      setResult(res.data)
      setActiveReportId(null)
      setFilterTrend(null)
      setFilterTracker(false)
      toast.success('Analysis complete')
      client.get('/daily-update/history').then(r => setHistory(r.data)).catch(() => {})
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to analyze CSV')
    } finally {
      setLoading(false)
    }
  }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, [processFile])

  const copyForSlack = () => {
    const date = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    const highGroups = (result.groups || []).filter(g => g.trend === 'high')
    const trackerGroups = (result.groups || []).filter(g => g.tracker_ids && g.tracker_ids.length > 0)

    // helper: group an array of groups by client
    const byClient = (groups) => {
      const map = {}
      groups.forEach(g => {
        const clients = (g.clients || []).filter(cl => cl && cl !== 'None' && cl.trim() !== '')
        const effectiveClients = clients.length ? clients : ['Other']
        effectiveClients.forEach(cl => {
          if (!map[cl]) map[cl] = []
          map[cl].push(g)
        })
      })
      return map
    }

    let msg = '*Daily Update — ' + date + '*\n'
    msg += result.total_tickets + ' tickets analyzed • ' + (result.groups?.length || 0) + ' groups found\n'
    msg += '\n'

    msg += '*🔴 High Trend Issues*\n'
    if (highGroups.length === 0) {
      msg += '_No high trend groups_\n'
    } else {
      const grouped = byClient(highGroups)
      Object.entries(grouped).forEach(([platform, groups]) => {
        msg += '\n*' + platform + '*\n'
        groups.forEach(g => {
          msg += '  • *' + g.title + '* — ' + (g.ticket_ids?.length || 0) + ' tickets'
          if (g.devices?.length) msg += ' | ' + g.devices.join(', ')
          msg += '\n'
        })
      })
    }

    msg += '\n*🔗 Tracker-Linked Groups*\n'
    if (trackerGroups.length === 0) {
      msg += '_No trackers_\n'
    } else {
      const grouped = byClient(trackerGroups)
      Object.entries(grouped).forEach(([platform, groups]) => {
        msg += '\n*' + platform + '*\n'
        groups.forEach(g => {
          const trackerInfo = g.tracker_ids.map(tid => {
            const td = result.tracker_details?.[tid]
            return td ? 'Tracker #' + tid + ': ' + td.subject + ' (' + td.status + ')' : 'Tracker #' + tid
          }).join(', ')
          msg += '  • *' + g.title + '* — ' + (g.ticket_ids?.length || 0) + ' tickets → ' + trackerInfo + '\n'
          if (g.devices?.length) msg += '    Devices: ' + g.devices.join(', ') + '\n'
        })
      })
    }

    if (navigator.clipboard) {
      navigator.clipboard.writeText(msg).then(() => {
        setSlackCopied(true)
        setTimeout(() => setSlackCopied(false), 2000)
      }).catch(() => toast.error('Could not copy'))
    } else {
      const el = document.createElement('textarea')
      el.value = msg
      el.style.position = 'fixed'
      el.style.opacity = '0'
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setSlackCopied(true)
      setTimeout(() => setSlackCopied(false), 2000)
    }
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Daily Update</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Grouped trend analysis of today's Freshdesk tickets, including active trackers
          </p>
        </div>

        {/* Instructions */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5 mb-6">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-4">How to generate the report</h3>
          <ol className="space-y-3">
            {STEPS.map(step => (
              <li key={step.n} className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs font-bold flex items-center justify-center mt-0.5">
                  {step.n}
                </span>
                <div>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{step.text}</p>
                  {step.fields && (
                    <div className="mt-2 space-y-1">
                      {Object.entries(step.fields).map(([section, fields]) => (
                        <div key={section} className="text-xs">
                          <span className="font-medium text-gray-600 dark:text-gray-400">{section}: </span>
                          <span className="text-gray-500 font-mono">{fields}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* History */}
        {(history.length > 0 || historyLoading) && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3">Past Reports</h3>
            {historyLoading ? (
              <div className="h-8 w-48 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
            ) : (
              <div className="space-y-1 max-h-52 overflow-y-auto">
                {history.map(r => (
                  <button
                    key={r.id}
                    onClick={() => loadReport(r.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors group ${
                      activeReportId === r.id
                        ? 'bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{r.filename}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        {new Date(r.created_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <div className="flex-shrink-0 text-right mr-2">
                      <p className="text-xs font-medium text-gray-600 dark:text-gray-400">{r.total_tickets} tickets</p>
                      <p className="text-xs text-gray-400">{r.group_count} groups</p>
                    </div>
                    <button
                      onClick={(e) => deleteReport(r.id, e)}
                      className="opacity-0 group-hover:opacity-100 flex-shrink-0 p-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-all rounded"
                      title="Delete report"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                    {activeReportId === r.id && (
                      <span className="flex-shrink-0 w-2 h-2 rounded-full bg-blue-500" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Upload */}
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => inputRef.current?.click()}
          className={`flex flex-col items-center justify-center border-2 border-dashed rounded-lg py-10 cursor-pointer transition-colors mb-6 ${
            dragOver ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-gray-800'
          }`}
        >
          <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={(e) => e.target.files[0] && processFile(e.target.files[0])} />
          {loading ? (
            <>
              <svg className="animate-spin h-8 w-8 text-blue-600 mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <p className="text-sm text-blue-600 font-medium">Analyzing {fileName}...</p>
              <p className="text-xs text-gray-400 mt-1">Fetching tracker info from Freshdesk. This may take up to 60 seconds.</p>
            </>
          ) : (
            <>
              <svg className="w-10 h-10 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                {fileName ? `${fileName} — click or drag to replace` : 'Drag the CSV here or click to select'}
              </p>
              <p className="text-xs text-gray-400 mt-1">Only .csv files exported from Freshdesk</p>
            </>
          )}
        </div>

        {/* Results */}
        {result && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-semibold text-gray-800 dark:text-white">
                  {result.groups?.length || 0} issue group{(result.groups?.length || 0) !== 1 ? 's' : ''} found
                  <span className="text-sm font-normal text-gray-400 ml-2">({result.total_tickets} tickets analyzed)</span>
                </h3>
                <div className="flex gap-3 mt-1">
                  {result.total_with_freshdesk_tracker > 0 && (
                    <p className="text-xs text-red-600 dark:text-red-400">
                      🔗 {result.total_with_freshdesk_tracker} ticket{result.total_with_freshdesk_tracker !== 1 ? 's' : ''} linked to a Freshdesk tracker
                    </p>
                  )}

                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={copyForSlack}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-white text-xs font-medium transition-all ${slackCopied ? 'bg-green-600' : 'bg-[#4A154B] hover:bg-[#611f69]'}`}
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zm10.122 2.521a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.268 0a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zm-2.523 10.122a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zm0-1.268a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
                  </svg>
                  {slackCopied ? '✓ Message copied!' : 'Copy for Slack'}
                </button>
                <button onClick={() => { setResult(null); setFileName(null) }} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                  Clear
                </button>
              </div>
            </div>

            {/* Active Trackers section */}
            {result.tracker_groups?.length > 0 && (
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-red-700 dark:text-red-400 uppercase tracking-wide mb-3">
                  🔗 Active Trackers ({result.tracker_groups.length})
                </h4>
                <div className="space-y-3">
                  {result.tracker_groups.map(tg => (
                    <TrackerGroupCard key={tg.tracker_id} tg={tg} trackerDetails={result.tracker_details} />
                  ))}
                </div>
              </div>
            )}

            {/* Issue groups */}
            <div className="mb-3 flex items-center justify-between flex-wrap gap-3">
              <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                Issue Groups
              </h4>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setFilterTracker(!filterTracker)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
                    filterTracker
                      ? 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/40 dark:text-red-300 dark:border-red-700'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600'
                  }`}
                >
                  🔗 Has Tracker
                </button>
                {filterTracker && (
                  <button
                    onClick={() => setFilterTracker(false)}
                    className="px-2 py-1 rounded-full text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 border border-gray-200 dark:border-gray-600 transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 mb-4 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-200 inline-block" /> High (3+ tickets)</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-yellow-200 inline-block" /> Medium (2 tickets)</span>
              <span className="flex items-center gap-1"><span className="text-red-500">🔗</span> Has Freshdesk tracker</span>
            </div>

            {(() => {
              const filtered = (result.groups || []).filter(g => {
                if (filterTracker && (!g.tracker_ids || g.tracker_ids.length === 0)) return false
                return true
              })
              if (filtered.length === 0) return (
                <div className="text-center py-8 text-gray-400 dark:text-gray-500 text-sm">No groups match the selected filters.</div>
              )
              // Group by client
              const clientMap = {}
              filtered.forEach(g => {
                const clients = (g.clients || []).filter(cl => cl && cl !== 'None' && cl.trim() !== '')
                const effectiveClients = clients.length ? clients : ['Other']
                effectiveClients.forEach(cl => {
                  if (!clientMap[cl]) clientMap[cl] = []
                  clientMap[cl].push(g)
                })
              })
              return (
                <div className="space-y-6">
                  {Object.entries(clientMap).sort(([a], [b]) => a === 'Other' ? 1 : b === 'Other' ? -1 : a.localeCompare(b)).map(([client, groups]) => {
                    const pal = getClientPalette(client)
                    return (
                      <div key={client}>
                        <h5 className={`text-xs font-bold uppercase tracking-widest mb-2 pb-1 border-b ${pal.header}`}>{client}</h5>
                        <div className="space-y-3">
                          {groups.map((group, i) => (
                            <GroupCard key={i} group={group} index={i} trackerDetails={result.tracker_details} palette={pal} />
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })()}
            <p className="text-xs text-gray-400 dark:text-gray-500 text-right mt-4">Source: {result.filename}</p>
          </div>
        )}
      </div>
    </Layout>
  )
}
