export default function Loader() {
  return (
    <div className="flex flex-col items-center gap-5 py-16">
      <BouncingEgg />
      <div className="text-center">
        <p className="text-brown-700 font-bold text-lg animate-pulse">Cracking your profile...</p>
        <p className="text-brown-400 text-sm italic mt-1">(the AI is thinking, this usually takes 5-10 seconds)</p>
      </div>
    </div>
  )
}

function BouncingEgg() {
  return (
    <div className="relative w-20 h-24">
      <svg
        aria-hidden="true"
        className="absolute inset-0 animate-bounce-slow"
        viewBox="0 0 80 96"
        style={{ filter: 'drop-shadow(0 4px 0 #2E2416)' }}
      >
        <ellipse cx="40" cy="52" rx="28" ry="36" fill="#FCE9B8" stroke="#2E2416" strokeWidth="3" />
        <circle cx="26" cy="44" r="1.5" fill="#B89968" />
        <circle cx="50" cy="40" r="1.2" fill="#B89968" />
        <circle cx="54" cy="62" r="1.5" fill="#B89968" />
        {/* dizzy eyes */}
        <path d="M 28 52 L 34 56 M 28 56 L 34 52" stroke="#2E2416" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M 46 52 L 52 56 M 46 56 L 52 52" stroke="#2E2416" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M 35 64 Q 40 68 45 64" stroke="#2E2416" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      </svg>
    </div>
  )
}