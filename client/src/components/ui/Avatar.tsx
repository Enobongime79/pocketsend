import { initials } from '../../lib/format'

// Fixed palette, all light enough for dark initials. Add or change colours here.
const palette = ['#f59ac0', '#f5c04a', '#7dd3b0', '#8fa8f5', '#c4a3f5', '#f5a77d']

function hash(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

export function Avatar({ name }: { name: string }) {
  return (
    <span
      aria-hidden
      className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-semibold text-[#0b0f1a]"
      style={{ backgroundColor: palette[hash(name) % palette.length] }}
    >
      {initials(name)}
    </span>
  )
}
