import StatBox from './StatBox'

export default function DetailedStats({ data }) {
  return (
    <div className="card p-5 -rotate-1">
      <div className="flex items-center gap-3 mb-4">
        <h3 className="font-display text-lg font-bold text-brown-700">
          Detailed Stats
        </h3>
      </div>
      {data.predictedJobTitle && (
        <div className="mb-5 p-4 bg-yellow-50 border border-yellow-200 rounded-lg shadow-sm">
          <div className="mb-2">
            <p className="text-xs uppercase tracking-wider text-brown-400 font-bold mb-1">Predicted Job Title</p>
            <p className="font-display font-bold text-brown-800 text-lg">{data.predictedJobTitle}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-brown-400 font-bold mb-1">Estimated Salary</p>
            <p className="text-brown-600 font-medium">{data.predictedSalary}</p>
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <StatBox label="Total Stars" value={data.rawData?.totalStars || 0} />
        <StatBox label="Commits (1y)" value={data.stats?.totalContributionsLastYear || 0} />
        <StatBox label="Issues Opened" value={data.stats?.totalIssues || 0} />
        <StatBox label="Pull Requests" value={data.stats?.totalPullRequests || 0} />
        <StatBox label="Active Repos" value={data.rawData?.activeRepos || 0} />
        <StatBox label="Repos w/ README" value={data.rawData?.reposWithReadme || 0} />
      </div>
      {data.rawData?.languageBreakdown && Object.keys(data.rawData.languageBreakdown).length > 0 && (
        <div className="mt-4">
          <p className="text-xs uppercase tracking-wider text-brown-400 font-bold mb-2">Top Languages</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(data.rawData.languageBreakdown)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 5)
              .map(([lang, count]) => (
                <span key={lang} className="chip bg-white border border-brown-200">
                  {lang} <span className="text-brown-400 text-xs ml-1">({count})</span>
                </span>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}