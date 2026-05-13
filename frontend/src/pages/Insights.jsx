import { useState, useCallback, useRef } from 'react'
import Layout from '../components/Layout'
import client from '../api/client'
import toast from 'react-hot-toast'

const STEPS = [
  { n: 1, text: 'En Freshdesk, aplica el filtro: B2C → New tickets created today' },
  { n: 2, text: 'Haz click en el botón "Export"' },
  {
    n: 3,
    text: 'Selecciona los siguientes campos:',
    fields: {
      'Ticket fields': 'Ticket ID, Subject, Description, Status, Type, Created time, Tags, Survey results, Product, Summary, Client Name, Platform',
      'Contact fields': 'Full name, Email, Contact ID',
    },
  },
  { n: 4, text: 'Haz click en "Export" para descargar el CSV' },
  { n: 5, text: 'Sube el CSV descargado en el área de abajo' },
]

function GroupCard({ group, index }) {
  const [open, setOpen] = useState(true)

  const colors = [
    'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-700',
    'bg-purple-50 border-purple-200 dark:bg-purple-900/20 dark:border-purple-700',
    'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-700',
    'bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-700',
    'bg-pink-50 border-pink-200 dark:bg-pink-900/20 dark:border-pink-700',
    'bg-teal-50 border-teal-200 dark:bg-teal-900/20 dark:border-teal-700',
  ]
  const numColors = [
    'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
    'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
    'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
    'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
    'bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300',
    'bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300',
  ]
  const c = index % colors.length

  return (
    <div className={`rounded-lg border ${colors[c]} overflow-hidden`}>
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:opacity-90 transition-opacity"
      >
        <span className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${numColors[c]}`}>
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{group.title}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{group.description}</p>
        </div>
        <span className="flex-shrink-0 text-xs font-medium text-gray-500 dark:text-gray-400 mr-2">
          {group.ticket_ids?.length || 0} ticket{(group.ticket_ids?.length || 0) !== 1 ? 's' : ''}
        </span>
        <svg className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="px-5 pb-5 pt-1 space-y-4 border-t border-inherit">
          {/* Description */}
          <p className="text-sm text-gray-700 dark:text-gray-300">{group.description}</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Ticket IDs */}
            {group.ticket_ids?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Tickets</p>
                <div className="flex flex-wrap gap-1">
                  {group.ticket_ids.map(id => (
                    <span key={id} className="inline-block px-2 py-0.5 rounded bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-xs font-mono text-gray-700 dark:text-gray-300">
                      #{id}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Devices */}
            {group.devices?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Dispositivos</p>
                <div className="flex flex-wrap gap-1">
                  {group.devices.map(d => (
                    <span key={d} className="inline-block px-2 py-0.5 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-xs text-gray-600 dark:text-gray-300">
                      {d}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Clients */}
            {group.clients?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Clientes</p>
                <div className="flex flex-wrap gap-1">
                  {group.clients.map(cl => (
                    <span key={cl} className="inline-block px-2 py-0.5 rounded bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-xs text-gray-600 dark:text-gray-300">
                      {cl}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Tags */}
            {group.tags?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Tags</p>
                <div className="flex flex-wrap gap-1">
                  {group.tags.map(tag => (
                    <span key={tag} className="inline-block px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-xs text-gray-600 dark:text-gray-300">
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

export default function DailyUpdate() {
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [fileName, setFileName] = useState(null)
  const inputRef = useRef(null)

  const processFile = useCallback(async (file) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast.error('El archivo debe ser un CSV')
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
        timeout: 120000,
      })
      setResult(res.data)
      toast.success('Análisis completado')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al analizar el CSV')
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

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Daily Update</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Análisis agrupado de tickets del día desde Freshdesk
          </p>
        </div>

        {/* Instructions */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5 mb-6">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-4">
            Cómo generar el reporte
          </h3>
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
                          <span className="text-gray-500 dark:text-gray-500 font-mono">{fields}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* Upload area */}
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => inputRef.current?.click()}
          className={`flex flex-col items-center justify-center border-2 border-dashed rounded-lg py-10 cursor-pointer transition-colors mb-6 ${
            dragOver
              ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20'
              : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-gray-800'
          }`}
        >
          <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={(e) => e.target.files[0] && processFile(e.target.files[0])} />
          {loading ? (
            <>
              <svg className="animate-spin h-8 w-8 text-blue-600 mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <p className="text-sm text-blue-600 font-medium">Analizando {fileName}...</p>
              <p className="text-xs text-gray-400 mt-1">Esto puede tomar hasta 30 segundos</p>
            </>
          ) : (
            <>
              <svg className="w-10 h-10 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                {fileName ? `${fileName} — click o arrastra para cambiar` : 'Arrastra el CSV aquí o haz click para seleccionar'}
              </p>
              <p className="text-xs text-gray-400 mt-1">Solo archivos .csv exportados de Freshdesk</p>
            </>
          )}
        </div>

        {/* Results */}
        {result && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-800 dark:text-white">
                {result.groups?.length || 0} grupos encontrados
                <span className="text-sm font-normal text-gray-400 ml-2">({result.total_tickets} tickets analizados)</span>
              </h3>
              <button
                onClick={() => { setResult(null); setFileName(null) }}
                className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              >
                Limpiar
              </button>
            </div>
            <div className="space-y-3">
              {result.groups?.map((group, i) => (
                <GroupCard key={i} group={group} index={i} />
              ))}
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 text-right mt-4">
              Basado en: {result.filename}
            </p>
          </div>
        )}
      </div>
    </Layout>
  )
}
