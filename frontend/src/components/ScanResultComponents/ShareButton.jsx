import { useState } from 'react'
import { toPng } from 'html-to-image'
import { IconShare, IconTwitter } from '../Icons'

const TAGLINES = {
  'Golden Egg': 'recruiter ready',
  'Hard Boiled': 'solid profile',
  'Fresh Egg': 'just getting started',
  Cracked: 'needs work',
  Scrambled: 'do not apply yet',
}

export default function ShareButton({ data, resultRef }) {
  const [copied, setCopied] = useState(false)

  const buildShareText = () => {
    const topSkills = (data.skills ?? []).slice(0, 3).join(', ')
    const tagline =
      TAGLINES[data.eggVerdict] || 'rated in eggs'

    const shareUrl = data.id ? `${window.location.origin}/?id=${data.id}` : window.location.origin

    return `I just got scanned on EggScan

Verdict: ${data.eggVerdict} — ${tagline}
Score: ${data.eggScore}/100
Vibe: ${data.vibe}
${topSkills ? `Top skills: ${topSkills}` : ''}

Get your GitHub rated in eggs ↓
${shareUrl}`
  }

  const handleShare = async () => {
    const text = buildShareText()

    if (navigator.share) {
      try {
        await navigator.share({
          title: `EggScan — ${data.eggVerdict}`,
          text,
        })
        return
      } catch (error) {
        // The user dismissed the share sheet: respect that instead of silently copying.
        if (error?.name === 'AbortError') return
      }
    }

    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2200)
    } catch (error) {
      console.error('Clipboard write failed', error)
    }
  }

  const tweetUrl = () => {
    const tweet = `I'm a ${data.eggVerdict} on EggScan  (${data.eggScore}/100)

Vibe: ${data.vibe}

Get rated ↓`

    return `https://twitter.com/intent/tweet?text=${encodeURIComponent(
      tweet
    )}&url=${encodeURIComponent(
      data.id ? `${window.location.origin}/?id=${data.id}` : window.location.origin
    )}`
  }

  const handleDownload = async () => {
    if (!resultRef.current) return
    try {
      const url = await toPng(resultRef.current, {
        backgroundColor: '#FFFDF7',
        pixelRatio: 2,
      })
      const a = document.createElement('a')
      a.href = url
      a.download = `eggscan-${data.username}.png`
      a.click()
    } catch (e) {
      console.error('Failed to generate image', e)
    }
  }

  return (
    <div
      className="card p-6 mt-2"
      style={{ background: '#FCE9B8' }}
    >
      <h3 className="font-display font-bold text-lg text-brown-700 text-center mb-1">
        Share your verdict
      </h3>

      <p className="text-brown-500 text-sm text-center mb-5">
        Flex on your timeline. Or warn your friends.
      </p>

      <div className="flex flex-col sm:flex-row gap-3 justify-center flex-wrap">
        <button
          onClick={handleShare}
          className="btn-primary inline-flex items-center justify-center gap-2 focus-visible:ring-2 focus-visible:ring-brown-500 outline-none"
        >
          <IconShare size={18} />
          {copied ? 'Copied!' : 'Copy share text'}
        </button>

        <a
          href={tweetUrl()}
          target="_blank"
          rel="noreferrer"
          className="btn-primary inline-flex items-center justify-center gap-2 focus-visible:ring-2 focus-visible:ring-brown-500 outline-none"
          style={{ background: '#FFFDF7' }}
        >
          <IconTwitter size={18} />
          Post to X
        </a>

        <button
          onClick={handleDownload}
          className="btn-primary inline-flex items-center justify-center gap-2 focus-visible:ring-2 focus-visible:ring-brown-500 outline-none"
          style={{ background: '#FFFDF7' }}
        >
          <svg aria-hidden="true" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download Image
        </button>
      </div>

      {/* Preview */}
      <div className="mt-5 p-4 bg-white/60 border-2 border-brown-700 border-dashed rounded-xl">
        <p className="text-xs uppercase tracking-wider text-brown-400 font-bold mb-2">
          preview
        </p>

        <pre className="text-xs text-brown-600 whitespace-pre-wrap font-sans leading-relaxed">
          {buildShareText()}
        </pre>
      </div>
    </div>
  )
}
