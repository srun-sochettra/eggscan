import RepoItem from './RepoItem'

export default function KeyRepositories({ data }) {
  return (
    <div className="card p-5 rotate-1">
      <div className="flex items-center gap-3 mb-4">
        <h3 className="font-display text-lg font-bold text-brown-700">
          Key Repositories
        </h3>
      </div>
      <div className="space-y-4">
        {data.stats?.pinnedRepos?.length > 0 ? (
          data.stats.pinnedRepos.map((repo) => <RepoItem key={`${repo.owner || data.username}/${repo.name}`} repo={repo} username={repo.owner || data.username} />)
        ) : (
          data.rawData?.repos?.slice(0, 3).map((repo) => (
            <RepoItem key={repo.name} repo={{
              name: repo.name,
              description: repo.description,
              primaryLanguage: repo.language,
              stars: repo.stargazers_count,
              defaultBranch: repo.default_branch,
            }} username={data.username} />
          ))
        )}
      </div>
    </div>
  )
}
