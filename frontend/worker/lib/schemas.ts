import { z } from 'zod'

export const UsernameSchema = z.string().regex(/^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/)
export const RepoSchema = z.string().regex(/^[a-zA-Z0-9._-]{1,100}$/).refine((value) => value !== '.' && value !== '..', 'Invalid repository name')
export const BranchSchema = z.string().min(1).max(255).regex(/^[a-zA-Z0-9._/-]+$/).refine((value) => !value.split('/').some((part) => part === '' || part === '.' || part === '..'), 'Invalid branch name')
export const IdSchema = z.string().uuid()
export const ToneSchema = z.enum(['honest', 'professional', 'roast', 'hype', 'pirate', 'gordon', 'parent', 'techbro'])
export const VerdictSchema = z.enum(['Golden Egg', 'Hard Boiled', 'Fresh Egg', 'Cracked', 'Scrambled'])

export const AiInsightsSchema = z.object({
  firstImpression: z.string().min(1).max(1600),
  skills: z.array(z.string().min(1).max(100)).max(12),
  improvements: z.array(z.string().min(1).max(300)).max(10),
  vibe: z.string().min(1).max(100),
  eggScore: z.coerce.number().int().min(0).max(100),
  eggVerdict: VerdictSchema,
})

export const BattleAiSchema = z.object({ winner: z.string().min(1).max(100), report: z.string().min(1).max(1800) })
export const CommitShameSchema = z.object({
  summary: z.string().min(1).max(500),
  lazinessScore: z.coerce.number().int().min(0).max(100),
  worstCommits: z.array(z.string().max(500)).max(5),
  roast: z.string().min(1).max(1800),
})
export const ReadmeRaterSchema = z.object({
  summary: z.string().min(1).max(500),
  uselessnessScore: z.coerce.number().int().min(0).max(100),
  nitpicks: z.array(z.string().max(500)).max(5),
  roast: z.string().min(1).max(1800),
})
export const StackRoastSchema = z.object({
  topLanguagesRoast: z.string().min(1).max(1800),
  configDeepDiveRoast: z.string().min(1).max(1800),
  overallVerdict: z.string().min(1).max(500),
})
export const DeepDiveSchema = z.object({
  summary: z.string().min(1).max(1000),
  architectureAndStack: z.string().min(1).max(1800),
  codeStructureFeedback: z.string().min(1).max(1800),
  commitQualityFeedback: z.string().min(1).max(1800),
  actionableImprovements: z.array(z.string().min(1).max(500)).max(8).default([]),
})
