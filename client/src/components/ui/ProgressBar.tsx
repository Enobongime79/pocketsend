export function ProgressBar({ percent, label }: { percent: number; label: string }) {
  return (
    <div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(percent, 100)}
        aria-label={label}
        className="h-2 overflow-hidden rounded-full bg-success/20"
      >
        <div className="h-full rounded-full bg-success transition-[width] duration-300" style={{ width: `${Math.min(percent, 100)}%` }} />
      </div>
    </div>
  )
}
