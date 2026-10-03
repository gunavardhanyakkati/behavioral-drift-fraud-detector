import { useState } from 'react'
import { C } from '../lib/theme'

const TAU = Math.PI * 2
const angle = (h) => (h / 24) * TAU - Math.PI / 2
const pt = (cx, cy, r, a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)]

function wedge(cx, cy, r0, r1, a0, a1) {
  const [x0, y0] = pt(cx, cy, r0, a0)
  const [x1, y1] = pt(cx, cy, r1, a0)
  const [x2, y2] = pt(cx, cy, r1, a1)
  const [x3, y3] = pt(cx, cy, r0, a1)
  const large = a1 - a0 > Math.PI ? 1 : 0
  return `M${x0},${y0} L${x1},${y1} A${r1},${r1} 0 ${large} 1 ${x2},${y2} L${x3},${y3} A${r0},${r0} 0 ${large} 0 ${x0},${y0} Z`
}

/**
 * 24-hour radial histogram of a customer's transaction hours, with their typical
 * window (mean ± std, as used by the drift calculator) drawn as an outer arc.
 * `marker` optionally highlights one hour (e.g. the transaction under test).
 */
export default function ClockChart({ hours = [], mean, std, marker, color = C.drift, size = 250 }) {
  const [hover, setHover] = useState(null)
  const counts = Array.from({ length: 24 }, (_, h) => hours.filter((x) => x === h).length)
  const max = Math.max(1, ...counts)
  const cx = size / 2, cy = size / 2
  const r0 = size * 0.17, rMax = size * 0.39, rBand = size * 0.43

  const lo = mean - std, hi = mean + std
  const gap = 0.012

  return (
    <svg viewBox={`-16 -4 ${size + 32} ${size + 8}`} className="h-auto w-full max-w-[280px]" role="img" aria-label="Transactions by hour of day">
      <circle cx={cx} cy={cy} r={rMax} fill="none" stroke={C.grid} />
      <circle cx={cx} cy={cy} r={(r0 + rMax) / 2} fill="none" stroke={C.grid} strokeOpacity="0.6" />
      <circle cx={cx} cy={cy} r={r0} fill="#0a0f1b" stroke={C.grid} />
      {/* typical window */}
      {std > 0 && (
        <path d={wedge(cx, cy, rBand - 3, rBand + 3, angle(lo), angle(hi))} fill={color} fillOpacity="0.85" />
      )}
      {counts.map((c, h) => {
        const len = c === 0 ? 0 : (c / max) * (rMax - r0)
        const a0 = angle(h) + gap, a1 = angle(h + 1) - gap
        return (
          <g key={h} onMouseEnter={() => setHover(h)} onMouseLeave={() => setHover(null)}>
            <path d={wedge(cx, cy, r0, rMax, a0, a1)} fill="transparent" />
            {len > 0 && <path d={wedge(cx, cy, r0 + 1, r0 + 1 + len, a0, a1)} fill={color} fillOpacity={hover === h ? 1 : 0.55} />}
          </g>
        )
      })}
      {marker != null && (
        <g>
          <line x1={pt(cx, cy, r0, angle(marker + 0.5))[0]} y1={pt(cx, cy, r0, angle(marker + 0.5))[1]}
            x2={pt(cx, cy, rBand + 8, angle(marker + 0.5))[0]} y2={pt(cx, cy, rBand + 8, angle(marker + 0.5))[1]}
            stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx={pt(cx, cy, rBand + 8, angle(marker + 0.5))[0]} cy={pt(cx, cy, rBand + 8, angle(marker + 0.5))[1]} r="4" fill="#fff" />
        </g>
      )}
      {[0, 6, 12, 18].map((h) => {
        const [x, y] = pt(cx, cy, size * 0.485, angle(h))
        return <text key={h} x={x} y={y + 4} textAnchor="middle" fontSize="10.5" fill={C.axis}>{`${String(h).padStart(2, '0')}h`}</text>
      })}
      <text x={cx} y={cy - 3} textAnchor="middle" fontSize="15" fontWeight="600" fill="#f1f4fa">
        {hover != null ? `${counts[hover]}` : `${String(Math.floor(mean)).padStart(2, '0')}:${String(Math.round((mean % 1) * 60)).padStart(2, '0')}`}
      </text>
      <text x={cx} y={cy + 13} textAnchor="middle" fontSize="9.5" fill={C.axis}>
        {hover != null ? `txns at ${String(hover).padStart(2, '0')}h` : 'avg hour'}
      </text>
    </svg>
  )
}
