import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import { usePlatform } from '../context/PlatformContext'
import client from '../api/client'
import toast from 'react-hot-toast'

export default function FAQs() {
  const { isAdmin } = useAuth()
  const { activePlatform } = usePlatform()
  const [faqs, setFaqs] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [uploadingFile, setUploadingFile] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [selectedUploadPlatformId, setSelectedUploadPlatformId] = useState(null)
  const [allPlatforms, setAllPlatforms] = useState([])
  const [selectedFaq, setSelectedFaq] = useState(null)
  const [chunks, setChunks] = useState([])
  const [chunksLoading, setChunksLoading] = useState(false)
  const [chunksError, setChunksError] = useState(null)

  useEffect(() => {
    client.get('/platforms/', { params: { include_global: true } })
      .then(r => setAllPlatforms(r.data))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (activePlatform) setSelectedUploadPlatformId(activePlatform.id)
  }, [activePlatform])

  useEffect(() => {
    if (selectedUploadPlatformId) fetchFaqs()
  }, [selectedUploadPlatformId]) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchFaqs = async () => {
    if (!selectedUploadPlatformId) return
    setIsLoading(true)
    setError(null)
    try {
      const response = await client.get('/faqs', { params: { platform_id: selectedUploadPlatformId } })
      setFaqs(response.data)
    } catch (err) {
      const message = err.response?.data?.detail || 'Failed to load FAQ documents. Please try again.'
      setError(message)
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileUpload = async (event) => {
    const file = event.target.files[0]
    if (!file) {
      toast.error('Please select a file')
      return
    }

    const validExtensions = ['.docx', '.xlsx']
    const fileExt = file.name.toLowerCase().slice(file.name.lastIndexOf('.'))
    if (!validExtensions.includes(fileExt)) {
      toast.error('Only DOCX and XLSX files are supported')
      return
    }

    if (!selectedUploadPlatformId) {
      toast.error('Please select a platform')
      return
    }

    setUploadingFile(file.name)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('platform_id', selectedUploadPlatformId)

    try {
      const response = await client.post('/faqs/upload', formData)
      setFaqs((prev) => [response.data, ...prev])
      toast.success(`"${file.name}" uploaded successfully`)
    } catch (err) {
      let message = 'Failed to upload file. Please try again.'
      const detail = err.response?.data?.detail
      if (typeof detail === 'string') {
        message = detail
      } else if (Array.isArray(detail) && detail[0]?.msg) {
        message = detail[0].msg
      }
      toast.error(message)
    } finally {
      setUploadingFile(null)
      if (event.target) {
        event.target.value = ''
      }
    }
  }

  const handleDeleteClick = (faq) => {
    setDeleteConfirm(faq)
  }

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return

    setDeletingId(deleteConfirm.id)

    try {
      await client.delete(`/faqs/${deleteConfirm.id}`)
      setFaqs((prev) => prev.filter((f) => f.id !== deleteConfirm.id))
      toast.success('FAQ document deleted successfully')
    } catch (err) {
      const message = err.response?.data?.detail || 'Failed to delete FAQ document. Please try again.'
      toast.error(message)
    } finally {
      setDeletingId(null)
      setDeleteConfirm(null)
    }
  }

  const handleDeleteCancel = () => {
    setDeleteConfirm(null)
  }

  const openChunksModal = async (faq) => {
    if (!isAdmin) return
    setSelectedFaq(faq)
    setChunks([])
    setChunksError(null)
    setChunksLoading(true)
    try {
      const response = await client.get(`/faqs/${faq.id}/chunks`)
      setChunks(response.data)
    } catch (err) {
      setChunksError(err.response?.data?.detail || 'Failed to load chunks.')
    } finally {
      setChunksLoading(false)
    }
  }

  const closeChunksModal = () => {
    setSelectedFaq(null)
    setChunks([])
    setChunksError(null)
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const totalChunks = faqs.reduce((sum, faq) => sum + faq.chunk_count, 0)

  return (
    <Layout>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800">FAQ Documents</h2>
        <p className="text-gray-600 mt-1">
          Manage DOCX and XLSX files containing FAQ content for response generation
        </p>
      </div>

      {/* Stats Card */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">Total FAQ Documents</p>
            <p className="text-3xl font-bold text-gray-900">{faqs.length}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Total Chunks</p>
            <p className="text-3xl font-bold text-blue-600">{totalChunks}</p>
          </div>
          {isAdmin && (
            <div className="ml-auto flex items-center space-x-3">
              <select
                value={selectedUploadPlatformId ?? ''}
                onChange={(e) => setSelectedUploadPlatformId(parseInt(e.target.value))}
                className="text-sm border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {allPlatforms.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.is_global ? `${p.name} (Global)` : p.name}
                  </option>
                ))}
              </select>
              <label
                htmlFor="file-upload"
                className={`inline-flex items-center px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 cursor-pointer transition-colors ${
                  uploadingFile ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {uploadingFile ? (
                  <span className="flex items-center">
                    <svg
                      className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Uploading...
                  </span>
                ) : (
                  <>
                    <svg
                      className="w-5 h-5 mr-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                    Upload DOCX/XLSX
                  </>
                )}
                <input
                  id="file-upload"
                  type="file"
                  accept=".docx,.xlsx"
                  onChange={handleFileUpload}
                  disabled={uploadingFile}
                  className="sr-only"
                />
              </label>
            </div>
          )}
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <svg
              className="w-5 h-5 text-red-500 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="text-red-700">{error}</span>
            <button
              onClick={fetchFaqs}
              className="ml-4 text-sm text-red-600 hover:text-red-800 underline"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="bg-white rounded-lg shadow-md p-12">
          <div className="flex flex-col items-center justify-center">
            <svg
              className="animate-spin h-10 w-10 text-blue-600 mb-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <p className="text-gray-500">Loading FAQ documents...</p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && faqs.length === 0 && (
        <div className="bg-white rounded-lg shadow-md p-12">
          <div className="flex flex-col items-center justify-center text-center">
            <svg
              className="w-16 h-16 text-gray-300 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No FAQ documents yet</h3>
            {isAdmin ? (
              <p className="text-gray-500 mb-4">
                Upload a DOCX or XLSX file to start building your FAQ knowledge base
              </p>
            ) : (
              <p className="text-gray-500">
                An administrator needs to upload FAQ documents
              </p>
            )}
          </div>
        </div>
      )}

      {/* FAQ Documents Table */}
      {!isLoading && !error && faqs.length > 0 && (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Filename
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Chunks
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Uploaded Date
                </th>
                {isAdmin && (
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {faqs.map((faq) => (
                <tr
                  key={faq.id}
                  className={`hover:bg-gray-50 transition-colors ${isAdmin ? 'cursor-pointer' : ''}`}
                  onClick={() => isAdmin && openChunksModal(faq)}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <svg
                        className="w-5 h-5 text-blue-500 mr-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      <span className="text-sm font-medium text-gray-900">{faq.filename}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {faq.chunk_count} chunks
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(faq.uploaded_at)}
                  </td>
                  {isAdmin && (
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteClick(faq) }}
                        disabled={deletingId === faq.id}
                        className="text-red-600 hover:text-red-900 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {deletingId === faq.id ? (
                          <span className="flex items-center justify-end">
                            <svg
                              className="animate-spin h-4 w-4 mr-1"
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                            >
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                              ></circle>
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                              ></path>
                            </svg>
                            Deleting...
                          </span>
                        ) : (
                          <>
                            <svg
                              className="w-4 h-4 inline mr-1"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                            Delete
                          </>
                        )}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0">
                <svg
                  className="h-6 w-6 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <h3 className="ml-3 text-lg font-medium text-gray-900">Delete FAQ Document</h3>
            </div>
            <p className="text-gray-500 mb-6">
              Are you sure you want to delete <span className="font-medium text-gray-900">"{deleteConfirm.filename}"</span>?
              This will remove all {deleteConfirm.chunk_count} chunks and cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={handleDeleteCancel}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chunks Modal */}
      {selectedFaq && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50" onClick={closeChunksModal}>
          <div
            className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 flex flex-col max-h-[80vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-medium text-gray-900">{selectedFaq.filename}</h3>
                <p className="text-sm text-gray-500">{selectedFaq.chunk_count} chunks</p>
              </div>
              <button
                onClick={closeChunksModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto px-6 py-4 space-y-3">
              {chunksLoading && (
                <div className="flex justify-center py-8">
                  <svg className="animate-spin h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                </div>
              )}
              {chunksError && (
                <p className="text-red-600 text-sm">{chunksError}</p>
              )}
              {!chunksLoading && !chunksError && chunks.map((chunk) => (
                <div key={chunk.id} className="border border-gray-200 rounded-md p-4">
                  <p className="text-xs font-semibold text-blue-600 mb-1">Chunk #{chunk.chunk_index + 1}</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{chunk.content}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}