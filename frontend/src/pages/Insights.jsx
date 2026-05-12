import { useState } from 'react'
import Layout from '../components/Layout'
import client from '../api/client'
import toast from 'react-hot-toast'
import { usePlatform } from '../context/PlatformContext'

function TrendCard({ rank, trend }) {
  const [expanded, setExpanded] = useState(false)
  const hasIds = trend.ticket_ids && trend.ticket_ids.length > 0

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5">
      <div className="flex items-start space-x-4">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-700 dark:text-blue-300 font-bold text-sm">
          {rank}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-base font-semibold text-gray-900 dark:text-white">{trend.title}</h4>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{trend.description}</p>
          {hasIds && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="mt-2 text-xs text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium flex items-center space-x-1"
            >
              <span>{expanded ? 'Hide' : 'Show'} ticket IDs</span>
              <svg
                className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          )}
        </div>
        <div className="flex-shrink-0 text-right">
          <span className="text-lg font-bold text-gray-800 dark:text-white">{trend.count}</span>
          <p className="text-xs text-gray-400">tickets</p>
        </div>
      </div>

      {hasIds && expanded && (
        <div className="mt-3 ml-12">
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">Referenced ticket IDs:</p>
          <div className="flex flex-wrap gap-1">
            {trend.ticket_ids.map((id) => (
              <span
                key={id}
                className="inline-block px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-mono"
              >
                #{id}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function Insights() {
  const { activePlatform } = usePlatform()
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  const runAnalysis = async () => {
    setLoading(true)
    try {
      const res = await client.post('/insights/trends', null, { params: { platform_id: activePlatform?.id } })
      setResult(res.data)
      toast.success('Analysis complete')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Analysis failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Insights</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Weekly trend analysis across all agent tickets
            </p>
          </div>
          <button
            onClick={runAnalysis}
            disabled={loading}
            className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Analyzing...</span>
              </>
            ) : (
              <span>Run Analysis</span>
            )}
          </button>
        </div>

        {result ? (
          <div className="space-y-4">
            {result.trends.length === 0 ? (
              <div className="text-center py-16 text-gray-400 dark:text-gray-500">
                <p>No trends found. Not enough ticket data yet.</p>
              </div>
            ) : (
              <>
                {result.trends.map((trend, i) => (
                  <TrendCard key={i} rank={i + 1} trend={trend} />
                ))}
                <div className="text-xs text-gray-400 dark:text-gray-500 text-right pt-2">
                  Based on {result.total_tickets_analyzed} tickets &middot;{' '}
                  {new Date(result.generated_at).toLocaleString()}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="text-center py-24 text-gray-400 dark:text-gray-500">
            <p className="text-sm">Click "Run Analysis" to identify trends in recent support tickets.</p>
          </div>
        )}
      </div>
    </Layout>
  )
}
