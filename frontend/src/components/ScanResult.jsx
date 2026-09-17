import { useRef } from 'react'
import VerdictCard from './VerdictCard'
import {
  IconEye,
  IconTools,
  IconCone,
  IconSparkle,
} from './Icons'

import ShareButton from './ScanResultComponents/ShareButton'
import InsightCard from './ScanResultComponents/InsightCard'
import ProfileHeader from './ScanResultComponents/ProfileHeader'
import DetailedStats from './ScanResultComponents/DetailedStats'
import KeyRepositories from './ScanResultComponents/KeyRepositories'
import GithubWrappedCard from './ScanResultComponents/GithubWrappedCard'

export default function ScanResult({ data }) {
  const resultRef = useRef(null)

  return (
    <div className="space-y-5 mt-10 animate-[pop_0.4s_ease-out]">
      <div ref={resultRef} className="space-y-5 bg-[#FFFDF7] p-2 rounded-xl -m-2">
      {/* Profile header */}
      <ProfileHeader data={data} />

        <VerdictCard
          verdict={data.eggVerdict}
          score={data.eggScore}
        />

        <InsightCard
          icon={<IconEye />}
          title="Recruiter first impression"
          rotate="-rotate-1"
        >
          <p className="text-brown-600 leading-relaxed">
            {data.firstImpression}
          </p>
        </InsightCard>

        <InsightCard
          icon={<IconTools />}
          title="Skills your repos actually show"
          rotate="rotate-1"
        >
          <div className="flex flex-wrap gap-2">
            {data.skills.length === 0 && (
              <span className="text-brown-400 text-sm italic">
                Nothing concrete detected.
              </span>
            )}

            {data.skills.map((skill) => (
              <span key={skill} className="chip">
                {skill}
              </span>
            ))}
          </div>
        </InsightCard>

      <InsightCard
        icon={<IconSparkle />}
        title="Your vibe as a developer"
        rotate="rotate-1"
      >
        <p className="text-brown-600 font-display font-semibold text-xl">
          {data.vibe}
        </p>
      </InsightCard>

      <DetailedStats data={data} />

      <GithubWrappedCard wrappedText={data.githubWrapped} />

      <KeyRepositories data={data} />
      </div>

      {/* Share footer */}
      <ShareButton data={data} resultRef={resultRef} />
    </div>
  )
}