import React, { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import {
  Upload,
  FileText,
  File,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { uploadDocument, deleteDocument } from '../services/api'

const FILE_ICONS = {
  pdf: '📄',
  docx: '📝',
  txt: '📃',
}

const ALLOWED_TYPES = {
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'text/plain': ['.txt'],
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

function DocumentItem({ doc, onDelete }) {
  const [deleting, setDeleting] = useState(false)
  const ext = doc.filename?.split('.').pop()?.toLowerCase() || 'txt'

  const handleDelete = async () => {
    if (!window.confirm(`Remove "${doc.filename}" from the index?`)) return
    setDeleting(true)
    try {
      await onDelete(doc.doc_id)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="glass-panel-light p-3 flex items-center gap-3 group animate-slide-up">
      <span className="text-xl flex-shrink-0">{FILE_ICONS[ext] || '📄'}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-200 truncate">{doc.filename}</p>
        <p className="text-xs text-slate-500 mt-0.5">
          {doc.file_type} · {doc.total_chunks} chunks
          {doc.size_bytes ? ` · ${formatBytes(doc.size_bytes)}` : ''}
        </p>
      </div>
      <button
        id={`delete-doc-${doc.doc_id}`}
        onClick={handleDelete}
        disabled={deleting}
        className="flex-shrink-0 p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-400/10
                   opacity-0 group-hover:opacity-100 transition-all duration-200 disabled:opacity-30"
        title="Remove document"
      >
        {deleting ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <Trash2 size={14} />
        )}
      </button>
    </div>
  )
}

export default function UploadPanel({ documents, setDocuments, onDocumentsChange }) {
  const [uploadState, setUploadState] = useState('idle') // idle | uploading | success | error
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadMessage, setUploadMessage] = useState('')
  const [showDocs, setShowDocs] = useState(true)

  const processFile = async (file) => {
    setUploadState('uploading')
    setUploadProgress(0)
    setUploadMessage(`Uploading ${file.name}...`)

    try {
      const result = await uploadDocument(file, (pct) => {
        setUploadProgress(pct)
        if (pct === 100) setUploadMessage('Embedding and indexing chunks…')
      })
      setUploadState('success')
      setUploadMessage(result.message || `Successfully indexed "${file.name}"`)
      onDocumentsChange()
    } catch (err) {
      setUploadState('error')
      const detail = err?.response?.data?.detail || err.message || 'Upload failed.'
      setUploadMessage(detail)
    }

    // Reset after 4s
    setTimeout(() => {
      setUploadState('idle')
      setUploadProgress(0)
      setUploadMessage('')
    }, 4000)
  }

  const onDrop = useCallback(
    (acceptedFiles, rejectedFiles) => {
      if (rejectedFiles.length > 0) {
        setUploadState('error')
        setUploadMessage('Unsupported file type. Please upload PDF, DOCX, or TXT.')
        setTimeout(() => { setUploadState('idle'); setUploadMessage('') }, 4000)
        return
      }
      if (acceptedFiles.length > 0) {
        processFile(acceptedFiles[0])
      }
    },
    [onDocumentsChange]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ALLOWED_TYPES,
    maxFiles: 1,
    disabled: uploadState === 'uploading',
  })

  const handleDelete = async (docId) => {
    await deleteDocument(docId)
    setDocuments((prev) => prev.filter((d) => d.doc_id !== docId))
  }

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gold-500/20 flex items-center justify-center">
          <FileText size={16} className="text-gold-400" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-slate-100">Documents</h2>
          <p className="text-xs text-slate-500">{documents.length} indexed</p>
        </div>
      </div>

      {/* Drop Zone */}
      <div
        {...getRootProps()}
        id="upload-dropzone"
        className={`
          relative rounded-2xl border-2 border-dashed p-6 cursor-pointer
          transition-all duration-300 flex flex-col items-center gap-3 text-center
          ${isDragActive
            ? 'border-gold-500/60 bg-gold-500/5'
            : 'border-white/10 hover:border-white/20 hover:bg-white/2'}
          ${uploadState === 'uploading' ? 'pointer-events-none' : ''}
        `}
      >
        <input {...getInputProps()} id="upload-file-input" />

        {uploadState === 'uploading' ? (
          <>
            <div className="w-12 h-12 rounded-full bg-navy-800 flex items-center justify-center">
              <Loader2 size={22} className="text-navy-400 animate-spin" />
            </div>
            <div className="w-full max-w-xs">
              <p className="text-xs text-slate-400 mb-2">{uploadMessage}</p>
              <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-navy-500 to-blue-400 transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-xs text-slate-600 mt-1">{uploadProgress}%</p>
            </div>
          </>
        ) : uploadState === 'success' ? (
          <>
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 size={22} className="text-emerald-400" />
            </div>
            <p className="text-xs text-emerald-400">{uploadMessage}</p>
          </>
        ) : uploadState === 'error' ? (
          <>
            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
              <AlertCircle size={22} className="text-red-400" />
            </div>
            <p className="text-xs text-red-400">{uploadMessage}</p>
          </>
        ) : (
          <>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300
              ${isDragActive ? 'bg-gold-500/20' : 'bg-white/5'}`}>
              <Upload size={22} className={isDragActive ? 'text-gold-400' : 'text-slate-500'} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-300">
                {isDragActive ? 'Drop your document here' : 'Drag & drop or click to upload'}
              </p>
              <p className="text-xs text-slate-600 mt-1">PDF, DOCX, TXT — max 50 MB</p>
            </div>
            <div className="flex gap-2 mt-1">
              {['PDF', 'DOCX', 'TXT'].map((t) => (
                <span key={t} className="text-xs px-2 py-0.5 rounded bg-white/5 text-slate-500 font-mono">
                  {t}
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Document List */}
      {documents.length > 0 && (
        <div className="flex flex-col gap-2 flex-1 min-h-0">
          <button
            id="toggle-doc-list"
            onClick={() => setShowDocs((p) => !p)}
            className="flex items-center justify-between text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            <span className="font-medium uppercase tracking-wider">Indexed Documents</span>
            {showDocs ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {showDocs && (
            <div className="flex flex-col gap-2 overflow-y-auto flex-1 pr-1">
              {documents.map((doc) => (
                <DocumentItem
                  key={doc.doc_id}
                  doc={doc}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {documents.length === 0 && uploadState === 'idle' && (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-4">
          <File size={32} className="text-slate-700 mb-2" />
          <p className="text-xs text-slate-600">No documents indexed yet.</p>
          <p className="text-xs text-slate-700 mt-1">Upload a financial document to get started.</p>
        </div>
      )}
    </div>
  )
}
