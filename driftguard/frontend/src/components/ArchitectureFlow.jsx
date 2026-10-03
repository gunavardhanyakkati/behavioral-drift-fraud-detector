import { C, BANK_COLORS } from '../lib/theme'

const PATHS = {
  tFl: 'M210,200 C258,200 252,110 300,110',
  tBp: 'M210,200 C258,200 252,290 300,290',
  flFu: 'M540,110 C590,110 585,200 630,200',
  bpFu: 'M540,290 C590,290 585,200 630,200',
  fuDe: 'M800,200 L850,200',
}

function Particles({ path, color, dur = 2.6, count = 3, delay = 0 }) {
  return Array.from({ length: count }).map((_, i) => (
    <circle key={i} r="4" fill={color} style={{ filter: `drop-shadow(0 0 6px ${color})` }}>
      {/* negative begin = already mid-flight on first paint (otherwise the dot waits at the SVG origin) */}
      <animateMotion dur={`${dur}s`} repeatCount="indefinite" path={path} begin={`-${(dur - ((delay + (i * dur) / count) % dur)).toFixed(2)}s`} />
    </circle>
  ))
}

function Node({ x, y, w, h, color, title, lines, icon }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="16" fill="#0f1524" stroke={color} strokeOpacity="0.55" strokeWidth="1.5" />
      <rect x={x} y={y} width={w} height={h} rx="16" fill={color} fillOpacity="0.07" />
      {icon && (
        <g transform={`translate(${x + 16}, ${y + 16})`}>
          <rect width="26" height="26" rx="7" fill={color} fillOpacity="0.2" />
          <text x="13" y="18" textAnchor="middle" fontSize="14" fill="#fff">{icon}</text>
        </g>
      )}
      <text x={x + (icon ? 52 : 16)} y={y + 34} fill="#f1f4fa" fontSize="15" fontWeight="600">{title}</text>
      {lines.map((l, i) => (
        <text key={i} x={x + 16} y={y + 60 + i * 18} fill="#9aa3b8" fontSize="12">{l}</text>
      ))}
    </g>
  )
}

export default function ArchitectureFlow() {
  return (
    <svg viewBox="0 0 1000 360" className="h-auto w-full" role="img" aria-label="System architecture: transaction flows to global model and behavioral profile, fused into a final decision">
      <defs>
        <linearGradient id="decGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={C.fraud} stopOpacity="0.25" />
          <stop offset="1" stopColor={C.legit} stopOpacity="0.25" />
        </linearGradient>
      </defs>

      {/* banks feeding the global model via FedAvg */}
      {['Bank A', 'Bank B', 'Bank C'].map((b, i) => {
        const bx = 318 + i * 74
        return (
          <g key={b}>
            <path d={`M${bx + 30},34 L${bx + 30},70`} stroke={BANK_COLORS[b]} strokeOpacity="0.7" strokeWidth="1.5" className="dash-flow" fill="none" />
            <rect x={bx} y="6" width="62" height="26" rx="8" fill="#0f1524" stroke={BANK_COLORS[b]} strokeOpacity="0.6" />
            <text x={bx + 31} y="23" textAnchor="middle" fontSize="11.5" fill="#dfe4ee" fontWeight="500">{b}</text>
          </g>
        )
      })}
      <text x="560" y="24" fontSize="11" fill="#7e879c">FedAvg · weights only</text>

      {Object.entries(PATHS).map(([k, d]) => (
        <path key={k} d={d} fill="none" stroke="#2a3349" strokeWidth="2" />
      ))}

      <Particles path={PATHS.tFl} color={C.fl} />
      <Particles path={PATHS.tBp} color={C.drift} delay={0.3} />
      <Particles path={PATHS.flFu} color={C.fl} delay={1.2} />
      <Particles path={PATHS.bpFu} color={C.drift} delay={1.5} />
      <Particles path={PATHS.fuDe} color={C.fuseSoft} dur={1.4} count={2} delay={2} />

      <Node x={20} y={150} w={190} h={100} color="#8b93a7" title="Transaction" icon="₹"
        lines={['amount · hour · merchant', 'location · type · device']} />
      <Node x={300} y={70} w={240} h={90} color={C.fl} title="Global FL Model" icon="◆"
        lines={['Flower + PyTorch MLP (26→64→32→1)', '→ fraud probability P']} />
      <Node x={300} y={250} w={240} h={90} color={C.drift} title="Behavioral Profile" icon="●"
        lines={['Local to the customer’s bank', '→ drift score S (5 signals)']} />
      <Node x={630} y={150} w={170} h={100} color={C.fuse} title="Score Fusion" icon="Σ"
        lines={['α·P + (1−α)·S', 'α = 0.7 · threshold 0.5']} />

      <g>
        <rect x="850" y="150" width="130" height="100" rx="16" fill="#0f1524" stroke="#3a4560" strokeWidth="1.5" />
        <rect x="850" y="150" width="130" height="100" rx="16" fill="url(#decGrad)" />
        <text x="915" y="184" textAnchor="middle" fill="#f1f4fa" fontSize="15" fontWeight="600">Decision</text>
        <rect x="866" y="198" width="98" height="16" rx="5" fill={C.fraud} fillOpacity="0.25" />
        <text x="915" y="210" textAnchor="middle" fontSize="11" fontWeight="700" fill="#ffd0d0">FRAUD</text>
        <rect x="866" y="220" width="98" height="16" rx="5" fill={C.legit} fillOpacity="0.2" />
        <text x="915" y="232" textAnchor="middle" fontSize="11" fontWeight="700" fill="#c9f7d8">LEGITIMATE</text>
      </g>
    </svg>
  )
}
