import type { Env } from '../types'
import { AppError } from './errors'

export async function getScanById(env: Env, id: string) {
  const row = await env.DB.prepare('SELECT json_payload FROM scan_records WHERE id = ?1').bind(id).first<{ json_payload: string }>()
  if (!row) throw new AppError(404, 'SCAN_NOT_FOUND', 'That scan result was not found.')
  return JSON.parse(row.json_payload)
}

export async function getRecentScan(env: Env, username: string) {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const row = await env.DB.prepare('SELECT json_payload FROM scan_records WHERE username = ?1 AND scanned_at > ?2 ORDER BY scanned_at DESC LIMIT 1').bind(username, cutoff).first<{ json_payload: string }>()
  return row ? JSON.parse(row.json_payload) : null
}

export async function saveScan(env: Env, result: any) {
  await env.DB.prepare(`INSERT INTO scan_records (id, username, score, verdict, json_payload, avatar_url, vibe, scanned_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`)
    .bind(result.id, result.username, result.eggScore, result.eggVerdict, JSON.stringify(result), result.avatarUrl, result.vibe, new Date().toISOString()).run()
}

export async function leaderboard(env: Env) {
  const result = await env.DB.prepare(`
    WITH ranked AS (
      SELECT id, username, score, verdict, avatar_url, vibe,
             ROW_NUMBER() OVER (PARTITION BY username ORDER BY score DESC, scanned_at DESC, id ASC) AS position
      FROM scan_records
    )
    SELECT id, username, score AS eggScore, verdict AS eggVerdict, avatar_url AS avatarUrl, vibe
    FROM ranked WHERE position = 1 ORDER BY score DESC, username ASC LIMIT 10
  `).all()
  return result.results
}