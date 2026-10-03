import { motion } from 'framer-motion'
import { C } from '../lib/theme'

/**
 * The real FraudClassifierNN (26 → 64 → 32 → 1) drawn as activation strips.
 * Cell brightness = actual activation for this transaction (normalised per layer).
 * Fans between strips denote the fully-connected layers.
 */
export default function NeuralNet({ features = [], activations = [], prob = 0, animKey }) {
  const W = 420, H = 190, top = 26, h = H - top - 18
  const strips = [
    { label: `Input · ${features.length}`, values: features.map((f) => f.value), x: 34 },
    { label: 'Hidden · 64 · ReLU', values: activations[0] || [], x: 150 },
    { label: 'Hidden · 32 · ReLU', values: activations[1] || [], x: 266 },
    { label: 'P(fraud)', values: [prob], x: 382 },
  ]
  const sw = 16

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full">
      <defs>
        <linearGradient id="fan" x1="0" x2="1">
          <stop offset="0" stopColor={C.fl} stopOpacity="0.16" />
          <stop offset="1" stopColor={C.fl} stopOpacity="0.05" />
        </linearGradient>
      </defs>
      {strips.slice(0, -1).map((s, i) => {
        const n = strips[i + 1]
        const ny0 = n.values.length === 1 ? top + h / 2 - 12 : top
        const ny1 = n.values.length === 1 ? top + h / 2 + 12 : top + h
        return (
          <polygon key={i} points={`${s.x + sw},${top} ${n.x},${ny0} ${n.x},${ny1} ${s.x + sw},${top + h}`} fill="url(#fan)" />
        )
      })}
      {strips.map((s, si) => {
        const vals = s.values
        const max = Math.max(1e-6, ...vals.map((v) => Math.abs(v)))
        const isOut = si === strips.length - 1
        const cellH = isOut ? 24 : h / Math.max(vals.length, 1)
        const y0 = isOut ? top + h / 2 - 12 : top
        return (
          <g key={si}>
            <text x={s.x + sw / 2} y={14} textAnchor="middle" fontSize="10" fill={C.axis}>{s.label}</text>
            <rect x={s.x - 1} y={y0 - 1} width={sw + 2} height={(isOut ? 24 : h) + 2} rx="4" fill="#0a0f1b" stroke="#253049" />
            {vals.map((v, i) => {
              const t = isOut ? v : Math.abs(v) / max
              return (
                <motion.rect
                  key={`${animKey}-${i}`}
                  x={s.x}
                  y={y0 + i * cellH + (cellH > 3 ? 0.5 : 0)}
                  width={sw}
                  height={Math.max(0.8, cellH - (cellH > 3 ? 1 : 0.25))}
                  rx={cellH > 4 ? 1.5 : 0}
                  fill={isOut ? (v >= 0.5 ? C.fraud : C.fl) : C.fl}
                  initial={{ fillOpacity: 0.04 }}
                  animate={{ fillOpacity: 0.06 + 0.94 * t }}
                  transition={{ delay: 0.15 + si * 0.22 + (i / vals.length) * 0.12, duration: 0.35 }}
                />
              )
            })}
            {isOut && (
              <text x={s.x + sw / 2} y={y0 + 42} textAnchor="middle" fontSize="12" fontWeight="600" fill="#f1f4fa">{v2(prob)}</text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

const v2 = (v) => Number(v).toFixed(3)
