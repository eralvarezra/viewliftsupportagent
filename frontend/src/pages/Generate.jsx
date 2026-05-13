import { useState, useCallback, useEffect } from 'react'
import Layout from '../components/Layout'
import client from '../api/client'
import toast from 'react-hot-toast'
import { usePlatform } from '../context/PlatformContext'

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function Generate() {
  const [customerMessage, setCustomerMessage] = useState('')
  const [screenshots, setScreenshots] = useState([]) // [{ base64, mediaType, previewUrl }]
  const [parsedInfo, setParsedInfo] = useState(null)
  const [generatedResponse, setGeneratedResponse] = useState('')
  const [nextSteps, setNextSteps] = useState(null)
  const [botNotes, setBotNotes] = useState(null)
  const [agentNotes, setAgentNotes] = useState("")
  const [needsVerification, setNeedsVerification] = useState(false)
  const [faqSources, setFaqSources] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const { activePlatform } = usePlatform()

  const [trackerLogs, setTrackerLogs] = useState([])
  const [trackerStats, setTrackerStats] = useState({ today_count: 0, daily_goal: 35 })
  const [trackerPage, setTrackerPage] = useState(1)
  const TRACKER_PAGE_SIZE = 10

  useEffect(() => {
    async function loadTracker() {
      try {
        const [logsRes, statsRes] = await Promise.all([
          client.get('/ticket-tracker/'),
          client.get('/ticket-tracker/stats'),
        ])
        setTrackerLogs(logsRes.data)
        setTrackerStats(statsRes.data)
      } catch { /* silently ignore */ }
    }
    loadTracker()
  }, [])

  const getTodayLogs = (logs) => {
    const today = new Date().toDateString()
    return logs.filter(l => new Date(l.worked_at + 'Z').toDateString() === today)
  }
  const formatTrackerTime = (worked_at) =>
    new Date(worked_at + 'Z').toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  const getTicketId = (url) =>
    '#' + url.replace('https://viewlift.freshdesk.com/a/tickets/', '')

  useEffect(() => {
    setCustomerMessage('')
    setScreenshots([])
    setParsedInfo(null)
    setGeneratedResponse('')
    setNextSteps(null)
    setBotNotes(null)
    setNeedsVerification(false)
    setFaqSources([])
    setScreenshots([])
  }, [activePlatform?.id])

  const processImageFile = useCallback(async (file) => {
    if (!file.type.startsWith('image/')) { toast.error('Only image files are supported'); return }
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5MB'); return }
    const base64 = await fileToBase64(file)
    setScreenshots(prev => [...prev, { base64, mediaType: file.type, previewUrl: URL.createObjectURL(file) }])
  }, [])

  const handlePaste = useCallback((e) => {
    const item = Array.from(e.clipboardData.items).find(i => i.type.startsWith('image/'))
    if (item) { e.preventDefault(); processImageFile(item.getAsFile()) }
  }, [processImageFile])

  const handleDrop = useCallback((e) => {
    e.preventDefault(); setDragOver(false)
    Array.from(e.dataTransfer.files).forEach(file => processImageFile(file))
  }, [processImageFile])

  const handleAnalyzeAndGenerate = async () => {
    if (!customerMessage.trim()) {
      toast.error('Please enter the message content')
      return
    }

    setIsLoading(true)
    setParsedInfo(null)
    setGeneratedResponse('')
    setNextSteps(null)
    setBotNotes(null)
    setNeedsVerification(false)
    setFaqSources([])
    setScreenshots([])

    try {
      const response = await client.post('/generate', {
        message: customerMessage,
        platform_id: activePlatform.id,
        images: screenshots.length > 0 ? screenshots.map(s => ({ base64: s.base64, media_type: s.mediaType })) : null,
        agent_notes: agentNotes.trim() || null,
      })

      setParsedInfo(response.data.parsed)
      setGeneratedResponse(response.data.response || '')
      setNextSteps(response.data.next_steps || null)
      setBotNotes(response.data.bot_notes || null)
      setNeedsVerification(response.data.needs_verification || false)
      setFaqSources(response.data.faq_sources || [])

      if (response.data.needs_verification) {
        toast('CMS verification required — attach a screenshot to continue', { icon: '⚠️' })
      } else {
        toast.success('Response generated successfully')
      }
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to generate response. Please try again.'
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleRegenerate = async () => {
    if (!customerMessage.trim()) {
      toast.error('No message to regenerate from')
      return
    }

    setIsRegenerating(true)

    try {
      const response = await client.post('/generate', {
        message: customerMessage,
        platform_id: activePlatform.id,
        images: screenshots.length > 0 ? screenshots.map(s => ({ base64: s.base64, media_type: s.mediaType })) : null,
        agent_notes: agentNotes.trim() || null,
      })

      setParsedInfo(response.data.parsed)
      setGeneratedResponse(response.data.response || '')
      setNextSteps(response.data.next_steps || null)
      setBotNotes(response.data.bot_notes || null)
      setNeedsVerification(response.data.needs_verification || false)
      setFaqSources(response.data.faq_sources || [])

      if (response.data.needs_verification) {
        toast('CMS verification required — attach a screenshot to continue', { icon: '⚠️' })
      } else {
        toast.success('Response regenerated successfully')
      }
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to regenerate response. Please try again.'
      toast.error(message)
    } finally {
      setIsRegenerating(false)
    }
  }

  const handleCopy = () => {
    if (!generatedResponse) {
      toast.error('No response to copy')
      return
    }

    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = generatedResponse
    const plainText = tempDiv.innerText || tempDiv.textContent || generatedResponse

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(plainText)
        .then(() => toast.success('Response copied to clipboard'))
        .catch(() => fallbackCopy(plainText))
    } else {
      fallbackCopy(plainText)
    }
  }

  const fallbackCopy = (text) => {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.cssText = 'position:fixed;top:0;left:0;width:2px;height:2px;opacity:0;border:0;padding:0'
    document.body.appendChild(textarea)
    textarea.focus()
    textarea.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(textarea)
    if (ok) {
      toast.success('Response copied to clipboard')
    } else {
      toast.error('Failed to copy to clipboard')
    }
  }

  const handleClear = () => {
    setAgentNotes("")
    setCustomerMessage('')
    setScreenshots([])
    setParsedInfo(null)
    setGeneratedResponse('')
    setNextSteps(null)
    setBotNotes(null)
    setNeedsVerification(false)
    setFaqSources([])
    setScreenshots([])
    toast.success('Cleared successfully')
  }

  return (
    <Layout>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Generate Response</h2>
        <p className="text-gray-600 mt-1">
          Paste the full content including customer message, email thread, and account notes
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Input */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-800">Full Message Content</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Include: latest message, email thread, account notes - AI will parse everything
                </p>
              </div>
              <button
                onClick={handleClear}
                className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                Clear
              </button>
            </div>

            <textarea
              value={customerMessage}
              onChange={(e) => setCustomerMessage(e.target.value)}
              onPaste={handlePaste}
              placeholder={`Paste everything here, for example:

[Latest customer message]
I can't access my account, it says my subscription expired.

[Email thread - if any]
From: customer@email.com
Subject: Can't login
...previous messages...

[Account notes - if available]
CMS account found for customer@email.com
status: active
subscription: COMPLETED
end_of_access: 2026-05-18`}
              disabled={isLoading}
              rows={16}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 dark:placeholder-gray-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 dark:disabled:bg-gray-600 disabled:cursor-not-allowed resize-none font-mono text-sm"
            />

            {/* Agent Notes */}
            <div className="mt-3">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Agent Notes <span className="text-gray-400 font-normal">(optional — instructions for the bot)</span>
              </label>
              <textarea
                value={agentNotes}
                onChange={(e) => setAgentNotes(e.target.value)}
                placeholder="e.g. Customer already tried reinstalling. Offer refund only if subscription is expired."
                disabled={isLoading}
                rows={3}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 dark:placeholder-gray-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 dark:disabled:bg-gray-600 disabled:cursor-not-allowed resize-none text-sm"
              />
            </div>

            {/* Screenshot area */}
            <div className="mt-4 space-y-2">
              {/* Thumbnails grid */}
              {screenshots.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {screenshots.map((s, i) => (
                    <div key={i} className="relative group w-20 h-20 rounded-lg overflow-hidden border border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 flex-shrink-0">
                      <img src={s.previewUrl} alt={`Screenshot ${i + 1}`} className="w-full h-full object-cover" />
                      <button
                        onClick={() => setScreenshots(prev => prev.filter((_, idx) => idx !== i))}
                        className="absolute top-0.5 right-0.5 w-5 h-5 flex items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 text-xs transition-colors opacity-0 group-hover:opacity-100"
                        title="Remove"
                      >✕</button>
                    </div>
                  ))}
                </div>
              )}
              {/* Drop zone */}
              <div
                onDrop={handleDrop}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                className={`flex items-center justify-center border-2 border-dashed rounded-lg py-3 cursor-pointer transition-colors ${
                  needsVerification && screenshots.length === 0
                    ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20 hover:border-amber-500'
                    : dragOver
                      ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                }`}
                onClick={() => document.getElementById('screenshot-input').click()}
              >
                <input
                  id="screenshot-input"
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => Array.from(e.target.files).forEach(f => processImageFile(f))}
                />
                <p className={`text-xs select-none ${needsVerification && screenshots.length === 0 ? 'text-amber-600 dark:text-amber-400 font-medium' : 'text-gray-400 dark:text-gray-500'}`}>
                  {needsVerification && screenshots.length === 0
                    ? '📎 Upload CMS screenshot here to proceed'
                    : screenshots.length > 0
                      ? <span>📷 Add more — paste, drag & drop, or <span className="text-blue-500">click</span></span>
                      : <span>📷 Attach screenshots — paste, drag & drop, or <span className="text-blue-500">click</span> (optional)</span>
                  }
                </p>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={handleAnalyzeAndGenerate}
                disabled={isLoading || !customerMessage.trim() || !activePlatform || (needsVerification && screenshots.length === 0)}
                className="px-6 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Analyzing...
                  </span>
                ) : needsVerification ? (
                  'Generate Final Response'
                ) : (
                  'Analyze and Generate'
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right Panel - Output */}
        <div className="space-y-6">
          {/* Parsed Information */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Parsed Information</h3>

            {parsedInfo ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Customer Name</label>
                    <p className="mt-1 text-gray-900 dark:text-gray-100">{parsedInfo.customer_name || 'Not detected'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Email</label>
                    <p className="mt-1 text-gray-900 dark:text-gray-100">{parsedInfo.customer_email || 'Not detected'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Device</label>
                    <p className="mt-1 text-gray-900 dark:text-gray-100">{parsedInfo.device || 'Not detected'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Account Number</label>
                    <p className="mt-1 text-gray-900 dark:text-gray-100">{parsedInfo.account_number || 'Not detected'}</p>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Problem Summary</label>
                  <p className="mt-1 text-gray-900 dark:text-gray-100">{parsedInfo.problem_summary || 'Not detected'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Context</label>
                  <p className="mt-1 text-gray-900 text-sm">{parsedInfo.context || 'Not detected'}</p>
                </div>
              </div>
            ) : (
              <div className="text-gray-400 text-center py-8">
                <p>Parsed information will appear here</p>
              </div>
            )}
          </div>

          {/* CMS Verification Banner */}
          {needsVerification && screenshots.length === 0 && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-600 rounded-lg p-5">
              <div className="flex items-start gap-3 mb-3">
                <span className="text-2xl">⚠️</span>
                <div>
                  <h4 className="font-semibold text-amber-800 dark:text-amber-300 text-base">CMS Verification Required</h4>
                  <p className="text-amber-700 dark:text-amber-400 text-sm mt-0.5">
                    Please upload a screenshot of the customer's account in CMS before proceeding.
                  </p>
                </div>
              </div>
              {nextSteps && (
                <div className="bg-amber-100 dark:bg-amber-900/40 rounded-md p-3 mb-3">
                  <pre className="text-xs text-amber-900 dark:text-amber-200 whitespace-pre-wrap font-sans">{nextSteps}</pre>
                </div>
              )}
              <button
                onClick={() => document.getElementById('screenshot-input').click()}
                className="w-full py-2 px-4 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-md transition-colors text-sm"
              >
                📎 Upload CMS Screenshot
              </button>
            </div>
          )}

          {/* Generated Response */}
          {(!needsVerification || screenshots.length > 0) && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-800">
                  {nextSteps && generatedResponse ? '✉️ Customer Response' : 'Generated Response'}
                </h3>
                <div className="flex space-x-2">
                  <button
                    onClick={handleCopy}
                    disabled={!generatedResponse}
                    className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Copy
                  </button>
                  <button
                    onClick={handleRegenerate}
                    disabled={isRegenerating || !parsedInfo}
                    className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isRegenerating ? (
                      <span className="flex items-center">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Regenerating...
                      </span>
                    ) : (
                      'Regenerate'
                    )}
                  </button>
                </div>
              </div>

              {generatedResponse ? (
                <div className="bg-gray-50 dark:bg-gray-700 rounded-md p-4 max-h-64 overflow-y-auto">
                  <div className="text-gray-800 dark:text-gray-100 whitespace-pre-wrap prose prose-sm dark:prose-invert" dangerouslySetInnerHTML={{ __html: generatedResponse }} />
                </div>
              ) : (
                <div className="text-gray-400 text-center py-8">
                  <p>Generated response will appear here</p>
                </div>
              )}
            </div>
          )}


          {/* Next Steps Panel (internal only — shown after full billing response) */}
          {nextSteps && !needsVerification && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-600 rounded-lg p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">📋</span>
                <h4 className="font-semibold text-amber-800 dark:text-amber-300">Next Steps</h4>
                <span className="ml-auto text-xs text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 rounded-full font-medium">
                  Internal only
                </span>
              </div>
              <pre className="text-sm text-amber-900 dark:text-amber-200 whitespace-pre-wrap font-sans leading-relaxed">{nextSteps}</pre>
            </div>
          )}

          {/* Bot Notes Panel (internal) */}
          {botNotes && (
            <div className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">🤖</span>
                <h4 className="font-semibold text-gray-700 dark:text-gray-300">Bot Notes</h4>
                <span className="ml-auto text-xs text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-600 px-2 py-0.5 rounded-full font-medium">
                  Internal only
                </span>
              </div>
              <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-sans leading-relaxed">{botNotes}</pre>
            </div>
          )}

          {/* FAQ Sources Used */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">FAQ Sources Used</h3>
            {faqSources.length > 0 ? (
              <div className="space-y-3">
                {faqSources.map((source, index) => (
                  <div key={index} className="bg-blue-50 rounded-md p-3">
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-xs font-medium text-blue-600">Chunk #{source.chunk_id}</span>
                      <span className="text-xs text-gray-500">Relevance: {(source.similarity * 100).toFixed(1)}%</span>
                    </div>
                    <p className="text-sm text-gray-700">{source.content_preview}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-gray-400 text-center py-4">
                <p>No FAQ sources used for this response</p>
              </div>
            )}
          </div>
        </div>

        {/* Tracker Today - Column 3 */}
        <div>
          {(() => {
            const todayLogs = getTodayLogs(trackerLogs)
            const totalPages = Math.max(1, Math.ceil(todayLogs.length / TRACKER_PAGE_SIZE))
            const currentPage = Math.min(trackerPage, totalPages)
            const pageLogs = todayLogs.slice((currentPage - 1) * TRACKER_PAGE_SIZE, currentPage * TRACKER_PAGE_SIZE)
            return (
              <div className="sticky top-4 bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden flex flex-col" style={{ maxHeight: 'calc(100vh - 6rem)' }}>
                <div className="px-3 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                  <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">Tracker Today</h3>
                  <div className="flex items-baseline gap-2 mt-1">
                    <p className="text-xl font-bold text-blue-600 dark:text-blue-400 leading-none">
                      {todayLogs.length}<span className="text-xs font-normal text-gray-400 ml-1">tickets</span>
                    </p>
                    <span className="text-xs text-gray-400">/ {trackerStats.daily_goal} goal</span>
                  </div>
                </div>
                <div className="overflow-y-auto flex-1 divide-y divide-gray-100 dark:divide-gray-700">
                  {todayLogs.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-6 px-3">No tickets today</p>
                  ) : pageLogs.map(log => (
                    <div key={log.id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors group">
                      <span className="text-xs text-gray-400 font-mono flex-shrink-0 w-11">{formatTrackerTime(log.worked_at)}</span>
                      <a href={log.ticket_url} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline truncate flex-1">
                        {getTicketId(log.ticket_url)}
                      </a>
                      <button
                        onClick={() => client.delete(`/ticket-tracker/${log.id}`).then(() => setTrackerLogs(prev => prev.filter(l => l.id !== log.id))).catch(() => {})}
                        className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-all flex-shrink-0"
                        title="Delete"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-3 py-2 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
                    <button onClick={() => setTrackerPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed px-1">‹ Prev</button>
                    <span className="text-xs text-gray-400">{currentPage} / {totalPages}</span>
                    <button onClick={() => setTrackerPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed px-1">Next ›</button>
                  </div>
                )}
              </div>
            )
          })()}
        </div>
      </div>
    </Layout>
  )
}
