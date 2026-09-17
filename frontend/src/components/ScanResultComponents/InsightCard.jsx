export default function InsightCard({
  icon,
  title,
  rotate = '',
  children,
}) {
  return (
    <div className={`card p-5 ${rotate}`}>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-yolk/20 flex items-center justify-center">
          {icon}
        </div>

        <h3 className="font-display text-lg font-bold text-brown-700">
          {title}
        </h3>
      </div>

      {children}
    </div>
  )
}