import { useState } from 'react'
import { deepDiveRepo } from '../../api/eggscan'

export default function RepoItem({ repo, username }) {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState(null)
  const [error, setError] = useState(null)

  const handleDeepDive = async () => {
    setIsAnalyzing(true)
    setError(null)
    try {
      const result = await deepDiveRepo(username, repo.name, repo.defaultBranch)
      setAnalysis(result)
    } catch (err) {
      setError(err?.message || 'Repository analysis is temporarily unavailable.')
    } finally {
      setIsAnalyzing(false)
    }
  }

  return (
    <div className="border-b border-brown-200 last:border-0 pb-3 last:pb-0">
      <div className="flex justify-between items-start mb-1">
        <span className="font-bold text-brown-700 break-all flex items-center gap-2">
          {repo.name}
        </span>
        <div className="flex items-center gap-2 text-xs font-semibold text-brown-500 whitespace-nowrap ml-2">
          {repo.primaryLanguage && <span>{repo.primaryLanguage}</span>}
          <span className="flex items-center gap-0.5">★ {repo.stars}</span>
        </div>
      </div>
      {repo.description && <p className="text-sm text-brown-500 line-clamp-2">{repo.description}</p>}

      {!analysis && !isAnalyzing && (
         <button
           type="button"
           onClick={handleDeepDive}
           aria-label={`Deep dive into ${repo.name}`}
           className="mt-2 text-xs font-semibold bg-egg-300 text-brown-800 px-3 py-1 rounded-full hover:bg-egg-400 transition-colors focus-visible:ring-2 focus-visible:ring-brown-500 outline-none"
         >
           Deep Dive
         </button>
      )}

      {isAnalyzing && (
        <div className="mt-2 text-sm text-brown-500 animate-pulse flex items-center gap-2">
           <span className="w-4 h-4 rounded-full border-2 border-brown-300 border-t-brown-600 animate-spin"></span>
           Analyzing architecture and code quality...
        </div>
      )}

      {error && (
        <div className="mt-2 text-sm text-red-500">
           Failed to analyze: {error}
        </div>
      )}

      {analysis && (
        <div className="mt-4 bg-white/50 rounded-lg p-3 border border-brown-200 text-sm">
          <div className="flex justify-between items-center mb-2">
            <h4 className="font-bold text-brown-800 flex items-center gap-2">
              Repository Deep Dive
            </h4>
            <button
              onClick={() => setAnalysis(null)}
              className="text-brown-400 hover:text-brown-600 focus-visible:ring-2 focus-visible:ring-brown-500 outline-none rounded"
              aria-label="Close analysis"
              title="Close analysis"
            >
              ✕
            </button>
          </div>

          <div className="space-y-3 mt-3">
            <div>
              <span className="font-semibold text-brown-700 block mb-1">Summary</span>
              <p className="text-brown-600">{analysis.summary}</p>
            </div>
            <div>
              <span className="font-semibold text-brown-700 block mb-1">Architecture & Stack</span>
              <p className="text-brown-600">{analysis.architectureAndStack}</p>
            </div>
            <div>
              <span className="font-semibold text-brown-700 block mb-1">Code Structure</span>
              <p className="text-brown-600">{analysis.codeStructureFeedback}</p>
            </div>
            <div>
              <span className="font-semibold text-brown-700 block mb-1">Commits</span>
              <p className="text-brown-600">{analysis.commitQualityFeedback}</p>
            </div>
            {analysis.actionableImprovements && analysis.actionableImprovements.length > 0 && (
              <div>
                <span className="font-semibold text-brown-700 block mb-1">Improvements</span>
                <ul className="list-disc pl-4 text-brown-600 space-y-1">
                  {analysis.actionableImprovements.map((imp, idx) => (
                    <li key={idx}>{imp}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
