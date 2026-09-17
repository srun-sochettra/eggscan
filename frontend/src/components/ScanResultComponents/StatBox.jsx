export default function StatBox({ label, value }) {
  return (
    <div className="bg-white/50 border border-brown-200 rounded-lg p-3 flex flex-col items-center justify-center text-center">
      <span className="text-2xl font-display font-bold text-brown-700">{value}</span>
      <span className="text-xs text-brown-500 uppercase tracking-wide font-semibold mt-1">{label}</span>
    </div>
  )
}