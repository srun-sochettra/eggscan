const BASE = ''

async function handleResponse(res, fallback) {
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const error = new Error(body?.error?.message || body?.error || fallback)
    error.code = body?.error?.code
    throw error
  }
  return body
}

const get = async (path, fallback) => handleResponse(await fetch(`${BASE}${path}`), fallback)

export const scanGithub = (username, mode = 'honest') => get(`/api/scan/${encodeURIComponent(username)}?mode=${encodeURIComponent(mode)}`, 'Scan failed')
export const battleGithub = (u1, u2) => get(`/api/battle?u1=${encodeURIComponent(u1)}&u2=${encodeURIComponent(u2)}`, 'Battle failed')
export const getLeaderboard = () => get('/api/leaderboard', 'Failed to fetch leaderboard')
export const getScanResult = (id) => get(`/api/scan/result/${encodeURIComponent(id)}`, 'Scan failed')
export const deepDiveRepo = (username, repo, branch = 'main') => get(`/api/scan/${encodeURIComponent(username)}/repo/${encodeURIComponent(repo)}?defaultBranch=${encodeURIComponent(branch)}`, 'Repo deep dive failed')
export const shameCommitsApi = (username, repo, tone = 'honest') => get(`/api/shame/commits/${encodeURIComponent(username)}?tone=${encodeURIComponent(tone)}${repo ? `&repo=${encodeURIComponent(repo)}` : ''}`, 'Commit shame failed')
export const rateReadmeApi = (username, tone = 'honest') => get(`/api/shame/readme/${encodeURIComponent(username)}?tone=${encodeURIComponent(tone)}`, 'README rater failed')
export const roastStackApi = (username, tone = 'honest') => get(`/api/shame/stack/${encodeURIComponent(username)}?tone=${encodeURIComponent(tone)}`, 'Stack roast failed')