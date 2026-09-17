export default function VerdictIllustration({ type }) {
  const stroke = '#2E2416'
  const sw = 3
  const shadow = { filter: 'drop-shadow(0 4px 0 #2E2416)' }
  const props = { fill: 'none', stroke, strokeWidth: sw, strokeLinecap: 'round', strokeLinejoin: 'round' }

  if (type === 'golden') {
    return (
      <svg aria-hidden="true" width="90" height="108" viewBox="0 0 80 96" style={shadow}>
        <defs>
          <radialGradient id="gold" cx="0.4" cy="0.3">
            <stop offset="0" stopColor="#FFF3C4" />
            <stop offset="1" stopColor="#F5B544" />
          </radialGradient>
        </defs>
        <ellipse cx="40" cy="52" rx="30" ry="38" fill="url(#gold)" {...props} />
        {/* Crown */}
        <path d="M 24 24 L 28 14 L 34 22 L 40 10 L 46 22 L 52 14 L 56 24 Z" fill="#F5B544" {...props} />
        <circle cx="40" cy="18" r="1.5" fill={stroke} />
        {/* Happy eyes */}
        <path d="M 28 52 Q 32 48 36 52" {...props} strokeWidth="2.5" />
        <path d="M 44 52 Q 48 48 52 52" {...props} strokeWidth="2.5" />
        <path d="M 32 64 Q 40 72 48 64" {...props} strokeWidth="2.5" />
        {/* Sparkles */}
        <circle cx="14" cy="36" r="1.5" fill="#F5B544" />
        <circle cx="66" cy="42" r="2" fill="#F5B544" />
        <circle cx="68" cy="68" r="1.5" fill="#F5B544" />
      </svg>
    )
  }

  if (type === 'hard') {
    return (
      <svg aria-hidden="true" width="90" height="108" viewBox="0 0 80 96" style={shadow}>
        <ellipse cx="40" cy="52" rx="30" ry="38" fill="#F4E4C1" {...props} />
        {/* Confident eyes */}
        <circle cx="32" cy="52" r="2" fill={stroke} />
        <circle cx="48" cy="52" r="2" fill={stroke} />
        {/* Subtle smile */}
        <path d="M 33 64 Q 40 68 47 64" {...props} strokeWidth="2.5" />
        {/* Speckles */}
        <circle cx="22" cy="40" r="1.5" fill="#B89968" />
        <circle cx="54" cy="44" r="1.2" fill="#B89968" />
        <circle cx="58" cy="64" r="1.5" fill="#B89968" />
        <circle cx="24" cy="70" r="1.2" fill="#B89968" />
      </svg>
    )
  }

  if (type === 'fresh') {
    return (
      <svg aria-hidden="true" width="90" height="108" viewBox="0 0 80 96" style={shadow}>
        {/* Egg with hatching chick */}
        <path d="M 14 56 Q 12 88 40 88 Q 68 88 66 56 L 60 60 L 54 54 L 48 60 L 40 54 L 32 60 L 26 54 L 20 60 Z" fill="#FCE9B8" {...props} />
        {/* Chick top */}
        <ellipse cx="40" cy="36" rx="18" ry="20" fill="#F5B544" {...props} />
        <circle cx="34" cy="34" r="2" fill={stroke} />
        <circle cx="46" cy="34" r="2" fill={stroke} />
        <path d="M 37 42 L 40 45 L 43 42" {...props} strokeWidth="2" />
      </svg>
    )
  }

  if (type === 'cracked') {
    return (
      <svg aria-hidden="true" width="90" height="108" viewBox="0 0 80 96" style={shadow}>
        <ellipse cx="40" cy="52" rx="30" ry="38" fill="#FCE9B8" {...props} />
        {/* Big crack */}
        <path d="M 22 30 L 28 38 L 24 44 L 32 50 L 28 58 L 36 64" stroke="#C84A2E" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        {/* Worried eyes */}
        <circle cx="48" cy="52" r="2" fill={stroke} />
        <circle cx="58" cy="52" r="2" fill={stroke} />
        {/* Frown */}
        <path d="M 44 70 Q 52 64 60 70" {...props} strokeWidth="2.5" />
      </svg>
    )
  }

  // scrambled
  return (
    <svg aria-hidden="true" width="100" height="100" viewBox="0 0 100 100" style={shadow}>
      {/* Pan */}
      <ellipse cx="50" cy="70" rx="38" ry="10" fill="#4A3A25" {...props} />
      <path d="M 12 70 Q 12 50 50 50 Q 88 50 88 70" fill="#6B5436" {...props} />
      <line x1="88" y1="60" x2="98" y2="56" {...props} strokeWidth="4" />
      {/* Yolk blob */}
      <path d="M 28 60 Q 26 48 38 46 Q 44 38 54 44 Q 68 42 70 54 Q 76 60 68 64 Q 56 68 44 64 Q 32 66 28 60 Z" fill="#F5B544" {...props} />
      <circle cx="42" cy="54" r="3" fill={stroke} />
      <circle cx="58" cy="54" r="3" fill={stroke} />
      <path d="M 44 62 Q 50 58 56 62" {...props} strokeWidth="2" />
    </svg>
  )
}