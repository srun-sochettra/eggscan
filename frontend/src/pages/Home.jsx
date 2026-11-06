import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import ScanForm from '../components/ScanForm'
import ScanResult from '../components/ScanResult'
import Loader from '../components/Loader'
import EggLogo from '../components/EggLogo'
import { IconBrokenEgg } from '../components/Icons'
import Leaderboard from '../components/Leaderboard'
import BattleForm from '../components/BattleForm'
import BattleResult from '../components/BattleResult'
import { scanGithub, getScanResult, battleGithub } from '../api/eggscan'

export default function Home() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)
  const [battleMode, setBattleMode] = useState(false)
  const [battleData, setBattleData] = useState(null)

  useEffect(() => {
    const id = searchParams.get('id');
    if (id) {
      fetchResult(id);
    }
  }, []);

  const executeWithLoading = async (action) => {
    setLoading(true)
    setError(null)
    setResult(null)
    setBattleData(null)
    try {
      await action()
    } catch (e) {
      setError(e)
    } finally {
      setLoading(false)
    }
  }

  const fetchResult = async (id) => {
    await executeWithLoading(async () => {
      const data = await getScanResult(id)
      setResult(data)
    })
  }

  const handleScan = async (username, mode) => {
    setSearchParams({})
    await executeWithLoading(async () => {
      const data = await scanGithub(username, mode)
      setResult(data)
      setSearchParams({ id: data.id })
    })
  }

  const handleBattle = async (u1, u2) => {
    setSearchParams({})
    await executeWithLoading(async () => {
      const data = await battleGithub(u1, u2)
      setBattleData(data)
    })
  }

  return (
    <div className="min-h-screen">
      {/* Floating decorative SVG eggs */}
      <FloatingEgg className="hidden md:block fixed top-20 left-10" size={60} delay={0} opacity={0.35} />
      <FloatingEgg className="hidden md:block fixed bottom-32 right-12" size={48} delay={1} opacity={0.3} />
      <FloatingEgg className="hidden lg:block fixed top-1/2 right-20" size={40} delay={2} opacity={0.25} />
      <FloatingEgg className="hidden lg:block fixed bottom-20 left-20" size={36} delay={1.5} opacity={0.25} />

      <div className="max-w-2xl mx-auto px-4 py-12 sm:py-16 relative">
        <header className="text-center mb-10">
          <div className="flex justify-center mb-4">
            <EggLogo size={80} animated />
          </div>
          <h1 className="font-display font-black text-5xl sm:text-6xl text-brown-700 tracking-tight">
            EggScan
          </h1>
          <p className="text-brown-500 mt-3 text-lg font-medium">
            Your GitHub, through a recruiter's eyes.
            <br />
            <span className="text-brown-400">Rated in eggs.</span>
          </p>
        </header>

        <div className="flex justify-center mb-6">
          <button
            type="button"
            onClick={() => { setBattleMode(!battleMode); setError(null); setResult(null); setBattleData(null); setSearchParams({}); }}
            className="text-brown-500 font-bold hover:text-brown-700 underline underline-offset-4 transition-colors text-sm focus-visible:ring-2 focus-visible:ring-brown-500 outline-none rounded"
          >
            {battleMode ? "Switch to Normal Scan" : "Try 1v1 Battle Mode "}
          </button>
        </div>

        {battleMode ? (
          <BattleForm onBattle={handleBattle} loading={loading} />
        ) : (
          <ScanForm onScan={handleScan} loading={loading} />
        )}

        {!loading && !result && !battleData && !error && !battleMode && (
          <p className="text-center text-brown-400 text-sm mt-6 italic">
            warning: brutally honest
          </p>
        )}

        {loading && <Loader />}

        {error && (
          <div className="card mt-8 p-6 text-center" style={{ background: '#F8D5C8' }}>
            <div className="flex justify-center mb-2">
              <IconBrokenEgg size={56} />
            </div>
            <p className="text-brown-700 font-semibold">Oops — {error.message || error}</p>
            <p className="text-brown-500 text-sm mt-1">
              {error.code === 'GITHUB_USER_NOT_FOUND' || error.code === 'INVALID_INPUT'
                ? 'Double-check the username and try again.'
                : error.code === 'SCAN_NOT_FOUND'
                  ? 'That shared result no longer exists. Run a fresh scan instead.'
                  : 'The analysis service is temporarily unavailable. Please try again shortly.'}
            </p>
          </div>
        )}

        {result && <ScanResult data={result} />}
        {battleData && <BattleResult data={battleData} />}

        <footer className="text-center text-brown-400 text-xs mt-16 pb-4">
          made with love · scanned with care
        </footer>
      </div>

      <Leaderboard />
    </div>
  )
}

function FloatingEgg({ className, size, delay, opacity }) {
  return (
    <div className={className} style={{ opacity }}>
      <svg
        width={size}
        height={size * 1.2}
        viewBox="0 0 80 96"
        className="animate-float"
        style={{ animationDelay: `${delay}s` }}
      >
        <ellipse cx="40" cy="52" rx="28" ry="36" fill="#FCE9B8" stroke="#2E2416" strokeWidth="3" />
        <circle cx="28" cy="42" r="1.5" fill="#B89968" />
        <circle cx="50" cy="46" r="1.2" fill="#B89968" />
        <circle cx="44" cy="68" r="1.5" fill="#B89968" />
      </svg>
    </div>
  )
}
