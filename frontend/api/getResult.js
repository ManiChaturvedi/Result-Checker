import axios from 'axios'
import https from 'node:https'

// Simple warm-cache (persists per function instance) with 6h TTL
const memoryCache = new Map() // key: scholarNo, value: { ts, data }
const RESULT_TTL_MS = 1000 * 60 * 60 * 6

function getFromCache(scholarNo) {
  const entry = memoryCache.get(String(scholarNo))
  if (!entry) return null
  const fresh = Date.now() - entry.ts < RESULT_TTL_MS
  return fresh ? entry.data : null
}

function setInCache(scholarNo, data) {
  memoryCache.set(String(scholarNo), { ts: Date.now(), data })
}

function createAxiosClient(baseUrl) {
  const httpsAgent = new https.Agent({
    rejectUnauthorized: false,
    keepAlive: true,
    maxSockets: 50,
  })
  return axios.create({
    baseURL: baseUrl,
    httpsAgent,
    timeout: 10000,
    headers: {
      Accept: 'application/json, text/plain, */*',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
    },
  })
}

export default async function handler(req, res) {
  try {
    const { scholarNo, forceRefresh } = req.query || {}
    if (!scholarNo) {
      return res.status(400).json({ error: 'Scholar number is required' })
    }

    const collegeBaseUrl = 'https://academic.manit.ac.in'

    if (!forceRefresh) {
      const cached = getFromCache(scholarNo)
      if (cached) {
        res.setHeader('Cache-Control', `public, max-age=${RESULT_TTL_MS / 1000}`)
        return res.status(200).json(cached)
      }
    }

    const client = createAxiosClient(collegeBaseUrl)

    // 1) Get FormId
    const resp1 = await client.get('/api/StudentActivity/GetStudentData', {
      params: { scholarno: scholarNo },
    })

    if (resp1.status !== 200 || !Array.isArray(resp1.data) || resp1.data.length === 0) {
      return res.status(404).json({ error: `No results found for scholar number ${scholarNo}` })
    }

    const formId = resp1.data[0].FormId

    // 2) Get Results
    const resp2 = await client.get('/api/StudentActivity/GetStudentResult', {
      params: { FormId: formId },
    })

    if (resp2.status !== 200) {
      return res.status(resp2.status).json({ error: 'Upstream error' })
    }

    const data = resp2.data
    setInCache(scholarNo, data)
    res.setHeader('Cache-Control', `public, max-age=${RESULT_TTL_MS / 1000}`)
    return res.status(200).json(data)
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Server error' })
  }
} 