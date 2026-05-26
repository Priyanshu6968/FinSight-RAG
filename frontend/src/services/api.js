import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 120000, // 2 min timeout for large files / slow LLM
})

export const uploadDocument = async (file, onProgress) => {
  const formData = new FormData()
  formData.append('file', file)
  const response = await api.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (evt) => {
      if (onProgress && evt.total) {
        onProgress(Math.round((evt.loaded / evt.total) * 100))
      }
    },
  })
  return response.data
}

export const queryDocuments = async (question, filterDocId = null) => {
  const payload = { question }
  if (filterDocId) payload.filter_doc_id = filterDocId
  const response = await api.post('/query', payload)
  return response.data
}

export const getDocuments = async () => {
  const response = await api.get('/documents')
  return response.data
}

export const deleteDocument = async (docId) => {
  const response = await api.delete(`/documents/${docId}`)
  return response.data
}

export default api
