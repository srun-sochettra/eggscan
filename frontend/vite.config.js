import { execSync } from 'node:child_process'
import { copyFileSync, existsSync, readdirSync, unlinkSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { cloudflare } from '@cloudflare/vite-plugin'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

function buildMarker() {
  let commit = 'nogit'
  try {
    commit = execSync('git rev-parse --short=12 HEAD', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    // Building from a ZIP/export without .git must not crash the build.
  }
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
  return `${commit}-${timestamp}`
}

function injectBuildMarker(marker) {
  return {
    name: 'inject-build-marker',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        return html.replace('</head>', `    <meta name="eggscan-build" content="${marker}" />\n  </head>`)
      },
    },
  }
}

function copyBuildHtml(marker) {
  return {
    name: 'copy-build-html',
    apply: 'build',
    closeBundle() {
      const clientDirectory = resolve(process.cwd(), 'dist/client')
      const indexPath = resolve(clientDirectory, 'index.html')
      if (existsSync(indexPath)) copyFileSync(indexPath, resolve(clientDirectory, `eggscan-${marker}`))
    },
  }
}

function stripDevVars() {
  return {
    name: 'strip-dev-vars',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      for (const fileName of Object.keys(bundle)) {
        if (fileName === '.dev.vars' || fileName.endsWith('/.dev.vars') || fileName.endsWith('\\.dev.vars')) {
          delete bundle[fileName]
        }
      }
    },
    closeBundle() {
      const distDir = resolve(process.cwd(), 'dist')
      if (!existsSync(distDir)) return

      const cleanDir = (dir) => {
        const entries = readdirSync(dir, { withFileTypes: true })
        for (const entry of entries) {
          const fullPath = join(dir, entry.name)
          if (entry.isDirectory()) {
            cleanDir(fullPath)
          } else if (entry.name === '.dev.vars') {
            unlinkSync(fullPath)
          }
        }
      }

      cleanDir(distDir)
    },
  }
}

export default defineConfig(({ mode }) => {
  const marker = buildMarker()
  return {
    define: {
      __EGGSCAN_BUILD_MARKER__: JSON.stringify(marker),
    },
    plugins: [
      react(),
      ...(mode === 'test' ? [] : [injectBuildMarker(marker)]),
      ...(mode === 'test' ? [] : [cloudflare()]),
      ...(mode === 'test' ? [] : [copyBuildHtml(marker)]),
      stripDevVars(),
    ],
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: './src/setupTests.js',
    },
  }
})
