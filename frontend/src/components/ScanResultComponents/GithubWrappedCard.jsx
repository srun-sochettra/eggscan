import { IconSparkle } from '../Icons'

export default function GithubWrappedCard({ wrappedText }) {
  if (!wrappedText) return null;

  return (
    <div className="card p-6 bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-xl transform rotate-1">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-white/20 rounded-lg">
          <IconSparkle className="w-6 h-6 text-white" />
        </div>
        <h3 className="font-display text-xl font-bold">
          GitHub Wrapped
        </h3>
      </div>
      <p className="text-lg font-medium leading-relaxed italic opacity-90">
        "{wrappedText}"
      </p>
    </div>
  )
}