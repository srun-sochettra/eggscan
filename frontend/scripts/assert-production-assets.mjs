import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const frontendDirectory = resolve(scriptDirectory, '..')
const sourceWranglerPath = resolve(frontendDirectory, 'wrangler.jsonc')
const generatedWranglerPath = resolve(frontendDirectory, 'dist/eggscan/wrangler.json')
const sourceWrangler = readFileSync(sourceWranglerPath, 'utf8')

if (!existsSync(generatedWranglerPath)) {
  throw new Error('Production asset check failed: Vite did not generate dist/eggscan/wrangler.json.')
}

const generatedWrangler = JSON.parse(readFileSync(generatedWranglerPath, 'utf8'))
const configuredAssetDirectory = generatedWrangler.assets?.directory
if (typeof configuredAssetDirectory !== 'string' || !configuredAssetDirectory) {
  throw new Error('Production asset check failed: generated Wrangler assets.directory is missing.')
}

const sourceAssetDirectoryMatch = sourceWrangler.match(/"assets"\s*:\s*\{[\s\S]*?"directory"\s*:\s*"([^"]+)"/)
if (!sourceAssetDirectoryMatch) {
  throw new Error('Production asset check failed: source Wrangler assets.directory is missing.')
}

const expectedAssetDirectory = resolve(frontendDirectory, sourceAssetDirectoryMatch[1])
const generatedAssetDirectory = resolve(dirname(generatedWranglerPath), configuredAssetDirectory)
if (generatedAssetDirectory !== expectedAssetDirectory) {
  throw new Error(`Production asset check failed: generated Wrangler assets.directory resolves to ${generatedAssetDirectory}, expected ${expectedAssetDirectory}.`)
}

const assetDirectory = generatedAssetDirectory
const htmlPath = resolve(assetDirectory, 'index.html')
const buildHtmlFiles = readdirSync(assetDirectory).filter((fileName) => /^eggscan-[0-9a-f]{12}-\d{8}T\d{6}Z$/i.test(fileName))

if (!existsSync(htmlPath)) {
  throw new Error(`Production asset check failed: ${htmlPath} does not exist.`)
}

if (buildHtmlFiles.length !== 1) {
  throw new Error(`Production asset check failed: expected exactly one build-specific HTML file, found ${buildHtmlFiles.length}.`)
}

const html = readFileSync(htmlPath, 'utf8')

const buildMarkerMatch = html.match(/<meta\s+name=["']eggscan-build["']\s+content=["']([^"']+)["'][^>]*>/i)
if (!buildMarkerMatch?.[1] || !/^[0-9a-f]{12}-\d{8}T\d{6}Z$/i.test(buildMarkerMatch[1])) {
  throw new Error('Production asset check failed: generated HTML is missing a valid eggscan-build marker.')
}

if (/\/src\/main\.jsx/i.test(html) || /(?:src|href)=["'][^"']*\.jsx(?:["']|\?)/i.test(html)) {
  throw new Error('Production asset check failed: deployed HTML references a JSX source module.')
}

const moduleAssetMatch = html.match(/<script\s+[^>]*type=["']module["'][^>]*src=["']([^"']+)["']/i)
if (!moduleAssetMatch || !moduleAssetMatch[1].startsWith('/assets/') || extname(moduleAssetMatch[1]) !== '.js') {
  throw new Error('Production asset check failed: compiled /assets/*.js module is missing from deployed HTML.')
}

const moduleAssetPath = resolve(assetDirectory, moduleAssetMatch[1].replace(/^\//, ''))
if (!existsSync(moduleAssetPath)) {
  throw new Error(`Production asset check failed: referenced JavaScript asset ${moduleAssetPath} does not exist.`)
}

const moduleAsset = readFileSync(moduleAssetPath, 'utf8')
if (!moduleAsset.trim() || /\bfrom\s+['"][^'"]+\.(?:jsx|tsx)['"]/i.test(moduleAsset) || /(?:import|export)\s+[^;]*['"]\/src\//i.test(moduleAsset)) {
  throw new Error('Production asset check failed: referenced JavaScript asset is empty or contains source JSX imports.')
}

console.log(`Production asset check passed: ${htmlPath} marker=${buildMarkerMatch[1]} references ${moduleAssetMatch[1]} via generated Wrangler config ${generatedWranglerPath}.`)