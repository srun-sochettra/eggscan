declare const __EGGSCAN_BUILD_MARKER__: string

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { AppBindings } from './types'
import { errorResponse } from './lib/errors'
import { BranchSchema, IdSchema, RepoSchema, ToneSchema, UsernameSchema } from './lib/schemas'
import { battle, deepDive, rateReadmes, roastStack, scan, shameCommits } from './lib/analyze'
import { getScanById, leaderboard } from './lib/db'

const app = new Hono<AppBindings>()
app.use('/api/*', cors({ origin: (origin) => origin, allowMethods: ['GET'], credentials: false }))
app.onError((error, c) => errorResponse(c, error))

const parse = <T>(schema: { parse(value: unknown): T }, value: unknown) => schema.parse(value)
const tone = (value: string | undefined) => parse(ToneSchema, value ?? 'honest')

app.get('/api/health', (c) => c.json({ status: 'ok', service: 'eggscan-worker' }))
app.get('/api/scan/:username', async (c) => c.json(await scan(c.env, parse(UsernameSchema, c.req.param('username')), tone(c.req.query('mode')))))
app.get('/api/scan/result/:id', async (c) => c.json(await getScanById(c.env, parse(IdSchema, c.req.param('id')))))
app.get('/api/leaderboard', async (c) => c.json(await leaderboard(c.env)))
app.get('/api/battle', async (c) => c.json(await battle(c.env, parse(UsernameSchema, c.req.query('u1')), parse(UsernameSchema, c.req.query('u2')))))
app.get('/api/scan/:username/repo/:repo', async (c) => c.json(await deepDive(c.env, parse(UsernameSchema, c.req.param('username')), parse(RepoSchema, c.req.param('repo')), parse(BranchSchema, c.req.query('defaultBranch') ?? 'main'))))
app.get('/api/shame/commits/:username', async (c) => c.json(await shameCommits(c.env, parse(UsernameSchema, c.req.param('username')), c.req.query('repo') ? parse(RepoSchema, c.req.query('repo')) : undefined, tone(c.req.query('tone')))))
app.get('/api/shame/readme/:username', async (c) => c.json(await rateReadmes(c.env, parse(UsernameSchema, c.req.param('username')), tone(c.req.query('tone')))))
app.get('/api/shame/stack/:username', async (c) => c.json(await roastStack(c.env, parse(UsernameSchema, c.req.param('username')), tone(c.req.query('tone')))))

export default app