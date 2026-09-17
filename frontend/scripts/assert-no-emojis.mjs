import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const ROOT = path.resolve(process.cwd())
const SKIP = new Set(['node_modules', 'dist', '.git', 'graft'])
const EMOJI = /(?:\p{Emoji_Presentation}|\p{Extended_Pictographic}\uFE0F|\uFE0F)/gu
const TEXT_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.json', '.jsonc', '.html', '.css', '.md', '.yml', '.yaml', '.mjs'])

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    if (SKIP.has(entry.name) || entry.name === 'worker-configuration.d.ts') continue
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await walk(fullPath))
    else if (TEXT_EXTENSIONS.has(path.extname(entry.name))) files.push(fullPath)
  }
  return files
}

const violations = []
for (const file of await walk(ROOT)) {
  const content = await readFile(file, 'utf8')
  content.split(/\r?\n/).forEach((line, index) => {
    if (EMOJI.test(line)) violations.push(`${path.relative(ROOT, file)}:${index + 1}`)
    EMOJI.lastIndex = 0
  })
}

if (violations.length) {
  console.error(`Emoji check failed:\n${violations.join('\n')}`)
  process.exit(1)
}
console.log('Emoji check passed.')