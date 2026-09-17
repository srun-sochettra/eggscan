import type { Env } from '../types'
import { fetchJson } from './fetch'
import { AppError } from './errors'

const API = 'https://api.github.com'
const GQL = 'https://api.github.com/graphql'
const MAX_TEXT = 1800
const CONFIG_NAMES = new Set(['package.json', 'pom.xml', 'docker-compose.yml', 'requirements.txt', 'build.gradle', 'go.mod'])

export interface GitHubProfile {
  login: string; name: string | null; bio: string | null; avatar_url: string
  company: string | null; location: string | null; public_repos: number
  followers: number; following: number; created_at: string
}
export interface GitHubRepo {
  name: string; description: string | null; language: string | null
  stargazers_count: number; fork: boolean; pushed_at: string | null
  default_branch: string
}

function headers(env: Env) {
  return {
    Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'EggScan-Worker',
  }
}

export async function scanGitHub(env: Env, username: string) {
  let profile: GitHubProfile
  try {
    profile = await fetchJson<GitHubProfile>(`${API}/users/${encodeURIComponent(username)}`, { headers: headers(env) })
  } catch (error) {
    if (error instanceof AppError && error.status === 404) {
      throw new AppError(404, 'GITHUB_USER_NOT_FOUND', 'GitHub user was not found.')
    }
    throw error
  }
  const [repos, stats] = await Promise.all([
    fetchJson<GitHubRepo[]>(`${API}/users/${encodeURIComponent(username)}/repos?per_page=100&sort=updated`, { headers: headers(env) }),
    fetchStats(env, username),
  ])
  const own = repos.filter((repo) => !repo.fork)
  const languageBreakdown: Record<string, number> = {}
  for (const repo of own) if (repo.language) languageBreakdown[repo.language] = (languageBreakdown[repo.language] ?? 0) + 1
  const activeCutoff = Date.now() - 180 * 24 * 60 * 60 * 1000
  return {
    profile,
    repos: own,
    languageBreakdown,
    totalStars: own.reduce((sum, repo) => sum + (repo.stargazers_count ?? 0), 0),
    activeRepos: own.filter((repo) => repo.pushed_at && Date.parse(repo.pushed_at) > activeCutoff).length,
    reposWithReadme: 0,
    lastActivity: own.map((repo) => repo.pushed_at).filter(Boolean).sort().at(-1) ?? 'never',
    stats,
  }
}

async function fetchStats(env: Env, username: string) {
  const query = `query($login: String!) { user(login: $login) { contributionsCollection { contributionCalendar { totalContributions } totalIssueContributions totalPullRequestContributions } pinnedItems(first: 6, types: REPOSITORY) { nodes { ... on Repository { name description url stargazerCount primaryLanguage { name } } } } } }`
  try {
    const result = await fetchJson<any>(GQL, {
      method: 'POST', headers: { ...headers(env), 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { login: username } }),
    })
    const user = result?.data?.user
    if (!user) return emptyStats()
    const c = user.contributionsCollection
    const pinnedRepos = (user.pinnedItems?.nodes ?? []).map((node: any) => ({
      name: node.name, description: node.description, url: node.url,
      stars: node.stargazerCount ?? 0, primaryLanguage: node.primaryLanguage?.name ?? null,
    }))
    return {
      totalContributionsLastYear: c?.contributionCalendar?.totalContributions ?? 0,
      totalIssues: c?.totalIssueContributions ?? 0,
      totalPullRequests: c?.totalPullRequestContributions ?? 0,
      pinnedRepos, hasPinnedRepos: pinnedRepos.length > 0,
    }
  } catch { return emptyStats() }
}

const emptyStats = () => ({ totalContributionsLastYear: 0, totalIssues: 0, totalPullRequests: 0, pinnedRepos: [], hasPinnedRepos: false })

export async function fetchReadmes(env: Env, username: string, repos: GitHubRepo[], count: number) {
  const selected = [...repos].sort((a, b) => b.stargazers_count - a.stargazers_count || String(b.pushed_at).localeCompare(String(a.pushed_at))).slice(0, count)
  const pairs = await Promise.all(selected.map(async (repo) => [repo.name, await fetchFile(env, username, repo.name, 'README.md')] as const))
  return Object.fromEntries(pairs)
}

export async function fetchFile(env: Env, username: string, repo: string, path: string) {
  try {
    const data = await fetchJson<any>(`${API}/repos/${encodeURIComponent(username)}/${encodeURIComponent(repo)}/contents/${path.split('/').map(encodeURIComponent).join('/')}`, { headers: headers(env) })
    if (data?.encoding !== 'base64' || !data?.content) return ''
    const binary = atob(String(data.content).replace(/\s/g, ''))
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
    return new TextDecoder().decode(bytes).slice(0, MAX_TEXT)
  } catch { return '' }
}

export async function fetchCommits(env: Env, username: string, repo: string) {
  try {
    const rows = await fetchJson<any[]>(`${API}/repos/${encodeURIComponent(username)}/${encodeURIComponent(repo)}/commits?per_page=20`, { headers: headers(env) })
    return rows.map((row) => String(row?.commit?.message ?? '')).filter(Boolean).slice(0, 20)
  } catch { return [] }
}

export async function fetchUserCommitMessages(env: Env, username: string) {
  try {
    const events = await fetchJson<any[]>(`${API}/users/${encodeURIComponent(username)}/events?per_page=100`, { headers: headers(env) })
    return events.flatMap((event) => event?.type === 'PushEvent' ? (event?.payload?.commits ?? []).map((commit: any) => String(commit.message ?? '')) : []).filter(Boolean).slice(0, 30)
  } catch { return [] }
}

export async function fetchRepoEvidence(env: Env, username: string, repo: string, branch: string) {
  const [treeResult, commits, readme] = await Promise.all([
    fetchJson<any>(`${API}/repos/${encodeURIComponent(username)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(branch)}?recursive=1`, { headers: headers(env) }),
    fetchCommits(env, username, repo),
    fetchFile(env, username, repo, 'README.md'),
  ])
  if (!Array.isArray(treeResult?.tree)) throw new AppError(404, 'REPOSITORY_NOT_FOUND', 'Repository or branch was not found.')
  const tree = treeResult.tree.slice(0, 200).map((item: any) => ({ path: String(item.path), type: String(item.type) }))
  const configPaths = tree.map((item: any) => item.path).filter((path: string) => CONFIG_NAMES.has(path)).slice(0, 8)
  const values = await Promise.all(configPaths.map(async (path: string) => [path, await fetchFile(env, username, repo, path)] as const))
  return { tree, commits, readme, configs: Object.fromEntries(values.filter(([, value]) => value)) }
}