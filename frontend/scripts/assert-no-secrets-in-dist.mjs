import { existsSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const distDir = resolve(__dirname, '../dist')

if (!existsSync(distDir)) {
  console.error(`Error: dist directory does not exist at ${distDir}`)
  process.exit(1)
}

function isForbidden(basename, relativePath) {
  const lowerBase = basename.toLowerCase()
  const lowerRel = relativePath.toLowerCase().replace(/\\/g, '/')

  // Exact names and extensions
  if (lowerBase === '.dev.vars') return true
  if (lowerBase === '.env' || lowerBase.startsWith('.env.')) return true
  if (lowerBase.endsWith('.pem')) return true
  if (lowerBase.endsWith('.key')) return true
  if (lowerBase.endsWith('.p12')) return true
  if (lowerBase.endsWith('.jks')) return true

  // Substrings in path
  if (lowerRel.includes('credentials')) return true
  if (lowerRel.includes('secrets')) return true

  return false
}

function getAllFiles(dir, fileList = []) {
  const entries = readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      getAllFiles(fullPath, fileList)
    } else {
      fileList.push(fullPath)
    }
  }
  return fileList
}

const allFiles = getAllFiles(distDir)
const forbiddenFiles = []

for (const filePath of allFiles) {
  const relPath = relative(distDir, filePath)
  const basename = filePath.split(/[\\/]/).pop() || ''
  if (isForbidden(basename, relPath)) {
    forbiddenFiles.push(relPath)
  }
}

if (forbiddenFiles.length > 0) {
  console.error('Forbidden secret files/paths found in dist:')
  for (const file of forbiddenFiles) {
    console.error(`  - ${file}`)
  }
  process.exit(1)
}

console.log('✓ Secret check passed: no forbidden files or secret paths in dist.')
process.exit(0)