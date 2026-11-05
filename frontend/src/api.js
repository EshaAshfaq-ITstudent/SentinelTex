// Every call to the SentinelTex backend goes through here.
// The login token is kept in sessionStorage, so closing the app logs the user out.

// In development (npm run dev, port 5173) the API is on port 8000. In the desktop app the backend serves
// the interface itself, so the API is on the same address and a relative path is enough.
const API = import.meta.env.VITE_API_URL || (window.location.port === '5173' ? 'http://127.0.0.1:8000' : '')

export function getToken() {
  try { return sessionStorage.getItem('st_token') } catch { return null }
}
export function setToken(token) {
  try { token ? sessionStorage.setItem('st_token', token) : sessionStorage.removeItem('st_token') } catch { /* ignore */ }
}

async function request(path, { method = 'GET', body, form, raw } = {}) {
  const headers = {}
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  let payload
  if (form) payload = form                                   // FormData: browser sets the content type
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body) }

  const res = await fetch(API + path, { method, headers, body: payload })
  if (res.status === 401 && path !== '/auth/login') {
    setToken(null)
    window.location.hash = '#/login'
  }
  if (!res.ok) {
    let msg = `Error ${res.status}`
    try {
      const data = await res.json()
      msg = typeof data.detail === 'string' ? data.detail : (data.detail?.[0]?.msg || msg)
    } catch { /* not JSON */ }
    throw new Error(msg)
  }
  if (raw) return res
  return res.status === 204 ? null : res.json()
}

// ---- Login -------------------------------------------------------------
export async function login(username, password) {
  const form = new URLSearchParams({ username, password })
  const res = await fetch(API + '/auth/login', { method: 'POST', body: form })
  if (!res.ok) throw new Error(res.status === 401 ? 'Wrong username or password' : `Login failed (${res.status})`)
  const data = await res.json()        // { access_token, role, full_name }
  setToken(data.access_token)
  return data
}
export const me = () => request('/auth/me')

// ---- Samples (Lab Analyst) ----------------------------------------------
export const listSamples = () => request('/samples')
export const getSample = (code) => request(`/samples/${code}`)
export const createSample = (sample_code, description = '') =>
  request('/samples', { method: 'POST', body: { sample_code, description } })

function upload(code, kind, file) {
  const form = new FormData()
  form.append('file', file)
  return request(`/samples/${code}/${kind}`, { method: 'POST', form })
}
export const uploadImage = (code, file) => upload(code, 'image', file)
export const uploadLabReport = (code, file) => upload(code, 'lab-report', file)
export const analyzeSample = (code) => request(`/samples/${code}/analyze`, { method: 'POST' })
export const deleteFile = (fileId) => request(`/samples/files/${fileId}`, { method: 'DELETE' })
export const submitReport = (id) => request(`/reports/${id}/submit`, { method: 'POST' })   // draft -> waiting for AM

// Uploaded files need the login token, so they are fetched as a blob and shown with an object URL
export async function fileUrl(fileId, annotated = false, ocrPage = false) {
  const res = await request(`/samples/files/${fileId}?annotated=${annotated}&ocr_page=${ocrPage}`, { raw: true })
  return URL.createObjectURL(await res.blob())
}

// ---- Quality Assessment Reports (AM / DM) -------------------------------
export const getReport = (id) => request(`/reports/${id}`)
export const listReports = (status) => request('/reports' + (status ? `?status_filter=${status}` : ''))
export const reviewReport = (id, approve, comment = '') =>
  request(`/reports/${id}/review`, { method: 'POST', body: { approve, comment } })

// details_json comes as text from the backend; this turns it into an object
export function reportDetails(report) {
  try { return JSON.parse(report.details_json || '{}') } catch { return {} }
}

export const health = () => request('/health')

// ---- Knowledge base, LLM explanation, Lab Chatbot ------------------------
export const knowledgeStatus = () => request('/knowledge/status')
export const askChatbot = (question) => request('/chat', { method: 'POST', body: { question } })
export const explainReport = (id, refresh = false) =>
  request(`/reports/${id}/explain?refresh=${refresh}`, { method: 'POST' })

// ---- Trend Analysis (AM / DM) --------------------------------------------
function qs(params) {
  const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v != null))
  return q.toString() ? `?${q}` : ''
}
export const trendOverview = (filters) => request('/trends/overview' + qs(filters))
export const clauseTrend = (clause, filters) => request(`/trends/clause/${clause}` + qs(filters))
export const trendSuppliers = () => request('/trends/suppliers')

// ---- Messages between Lab Analyst, AM and DM (one thread per sample) -----
export const listThreads = () => request('/messages')
export const getThread = (code) => request(`/samples/${code}/messages`)
export const sendMessage = (code, text, toUserId = null) =>
  request(`/samples/${code}/messages`, { method: 'POST', body: { text, to_user_id: toUserId } })
export const messagePeople = () => request('/messages/people')
