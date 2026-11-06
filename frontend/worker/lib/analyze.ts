import type { Env } from '../types'
import { scanGitHub, fetchReadmes, fetchRepoEvidence, fetchCommits, fetchUserCommitMessages, fetchReadme } from './github'
import { groqJson } from './groq'
import { AiInsightsSchema, BattleAiSchema, CommitShameSchema, DeepDiveSchema, ReadmeRaterSchema, StackRoastSchema } from './schemas'
import { getRecentScan, saveScan } from './db'
import { AppError } from './errors'

const tone = (value: string) => ({
  professional: 'Use a polite, constructive, professional tone.',
  roast: 'Use sharp but non-abusive comedic criticism.', hype: 'Use enthusiastic startup-style language.',
  pirate: 'Use light nautical phrasing while remaining clear.', parent: 'Use mildly disappointed but constructive language.',
  techbro: 'Use satirical startup jargon while remaining useful.', gordon: 'Use an intense fictional chef-reviewer tone without impersonating a real person.',
  honest: 'Use direct, specific, recruiter-style judgment.',
}[value] ?? 'Use direct, specific judgment.')


export async function scan(env: Env, username: string, mode: string) {
  const cached = await getRecentScan(env, username, mode)
  if (cached) return cached
  const data = await scanGitHub(env, username)
  const readmes = await fetchReadmes(env, username, data.repos, 5)
  data.reposWithReadme = Object.values(readmes).filter(Boolean).length
  const insights = await groqJson(env,
    `Analyze a developer GitHub profile. ${tone(mode)} Return JSON with firstImpression, skills, improvements, vibe, eggScore (0-100), and eggVerdict (Golden Egg, Hard Boiled, Fresh Egg, Cracked, or Scrambled). Be specific and do not use emojis.`,
    { profile: data.profile, statistics: { totalOwnRepos: data.repos.length, languageBreakdown: data.languageBreakdown, totalStars: data.totalStars, activeRepos: data.activeRepos, reposWithReadmeInSample: data.reposWithReadme, readmeSampleSize: Object.keys(readmes).length, lastActivity: data.lastActivity }, contributionStats: data.stats, repos: data.repos.slice(0, 10), readmes }, AiInsightsSchema)
  const result = {
    id: crypto.randomUUID(), username: data.profile.login, avatarUrl: data.profile.avatar_url,
    name: data.profile.name, bio: data.profile.bio, eggVerdict: insights.eggVerdict,
    eggEmoji: '', eggScore: insights.eggScore,
    firstImpression: insights.firstImpression, skills: insights.skills,
    improvements: insights.improvements, vibe: insights.vibe,
    rawData: { profile: data.profile, repos: data.repos.slice(0, 30), languageBreakdown: data.languageBreakdown, totalStars: data.totalStars, activeRepos: data.activeRepos, reposWithReadme: data.reposWithReadme, readmeSampleSize: Object.keys(readmes).length, lastActivity: data.lastActivity },
    stats: data.stats,
  }
  // Every result is persisted so its share link (/?id=...) resolves; only honest
  // scans are ranked on the leaderboard (see db.leaderboard).
  try {
    await saveScan(env, result, mode)
  } catch (error) {
    console.error('Failed to persist scan result', { username: result.username, error: error instanceof Error ? error.message : String(error) })
  }
  return result
}

export async function battle(env: Env, u1: string, u2: string) {
  const [user1, user2] = await Promise.all([scan(env, u1, 'honest'), scan(env, u2, 'honest')])
  const ai = await groqJson(env, 'Compare two developer profiles. Return JSON with winner (exact username) and report (one entertaining but non-abusive paragraph).',
    { player1: user1, player2: user2 }, BattleAiSchema)
  const claimed = ai.winner.trim().replace(/^@/, '').toLowerCase()
  const fallbackWinner = user2.eggScore > user1.eggScore ? user2.username : user1.username
  const winnerUsername = [user1.username, user2.username].find((name) => name.toLowerCase() === claimed) ?? fallbackWinner
  return { user1, user2, winnerUsername, battleReport: ai.report }
}

export async function deepDive(env: Env, username: string, repo: string, branch?: string) {
  const evidence = await fetchRepoEvidence(env, username, repo, branch)
  return groqJson(env, 'Perform a senior-engineer repository review. Return one JSON object with exactly these fields: summary (string), architectureAndStack (string), codeStructureFeedback (string), commitQualityFeedback (string), and actionableImprovements (array of strings; use an empty array when none). Do not claim to have inspected anything outside the supplied evidence.', evidence, DeepDiveSchema)
}

export async function shameCommits(env: Env, username: string, repo: string | undefined, selectedTone: string) {
  const commits = repo ? await fetchCommits(env, username, repo) : await fetchUserCommitMessages(env, username)
  if (!commits.length) {
    throw new AppError(404, 'NO_COMMITS_FOUND', repo ? 'No commits were found for that repository.' : 'No recent public commits were found for that user.')
  }
  return groqJson(env, `Review commit-message quality. ${tone(selectedTone)} Return JSON with summary, lazinessScore (0-100), worstCommits (copied verbatim from the supplied commits), and roast.`, { commits }, CommitShameSchema)
}

export async function rateReadmes(env: Env, username: string, selectedTone: string) {
  const data = await scanGitHub(env, username)
  const [readmes, profileReadme] = await Promise.all([
    fetchReadmes(env, username, data.repos, 3),
    fetchReadme(env, username, data.profile.login),
  ])
  if (profileReadme) readmes[`${data.profile.login}/${data.profile.login} (Profile)`] = profileReadme
  return groqJson(env, `Review documentation quality. ${tone(selectedTone)} Return JSON with summary, uselessnessScore (0-100), nitpicks, and roast.`, { readmes }, ReadmeRaterSchema)
}

export async function roastStack(env: Env, username: string, selectedTone: string) {
  const data = await scanGitHub(env, username)
  const repos = data.repos.slice(0, 2)
  const evidence = await Promise.all(repos.map((repo) => fetchRepoEvidence(env, username, repo.name, repo.default_branch).catch(() => null)))
  return groqJson(env, `Review the technology stack. ${tone(selectedTone)} Return JSON with topLanguagesRoast, configDeepDiveRoast, and overallVerdict.`, { languages: data.languageBreakdown, repositories: evidence.filter(Boolean).map((item: any) => ({ configs: item.configs })) }, StackRoastSchema)
}
