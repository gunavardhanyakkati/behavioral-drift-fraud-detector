import { motion } from 'framer-motion'
import { Clock, CreditCard, IndianRupee, MapPin, ShoppingBag } from 'lucide-react'
import { C, inr, pct, pretty } from '../lib/theme'

const META = {
  amount: { label: 'Amount', icon: IndianRupee },
  time: { label: 'Time of day', icon: Clock },
  merchant: { label: 'Merchant', icon: ShoppingBag },
  location: { label: 'Location', icon: MapPin },
  tx_type: { label: 'Txn type', icon: CreditCard },
}

function detail(key, r) {
  const t = r.txn, s = r.profile_stats
  switch (key) {
    case 'amount':
      return `${inr(t.amount)} vs usual ${inr(s.amount_mean)} (σ ${inr(s.amount_std)}) · z = ${r.breakdown.z_amount}`
    case 'time':
      return `${String(t.hour).padStart(2, '0')}:00 vs usual ${s.hour_mean.toFixed(1)}h ± ${s.hour_std.toFixed(1)}h`
    case 'merchant': {
      const f = s.merchant_freq
      return `${pretty(t.merchant_category)}: ${pct(f, 0)} of history → ${f >= 0.15 ? 'common' : f > 0 ? 'rare' : 'never seen'}`
    }
    case 'location': {
      const f = s.location_freq
      return `${pretty(t.location)}: ${pct(f, 0)} of history → ${f >= 0.2 ? 'home turf' : f > 0 ? 'occasional' : 'new place'}`
    }
    case 'tx_type': {
      const f = s.tx_type_freq
      return `${pretty(t.transaction_type)}: ${pct(f, 0)} of history → ${f >= 0.2 ? 'usual' : f > 0 ? 'rare' : 'new'}`
    }
    default:
      return ''
  }
}

export default function DriftBreakdown({ result, animKey, compact = false, delay = 0 }) {
  return (
    <div className={compact ? 'space-y-2.5' : 'space-y-3'}>
      {result.drift_components.map((c, i) => {
        const m = META[c.key]
        const hot = c.score >= 0.6
        return (
          <motion.div
            key={`${animKey}-${c.key}`}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: delay + i * 0.08 }}
          >
            <div className="flex items-center gap-2 text-[12.5px]">
              <m.icon size={13} className={hot ? 'text-rose-300' : 'text-slate-500'} />
              <span className="font-medium text-slate-200">{m.label}</span>
              <span className="ml-auto font-mono text-[11.5px] text-slate-400">
                <span className="text-slate-100">{c.score.toFixed(2)}</span> × {c.weight.toFixed(2)} ={' '}
                <span className="text-slate-100">{c.contribution.toFixed(3)}</span>
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
              <motion.div
                className="h-full rounded-full"
                style={{ background: C.drift }}
                initial={{ width: 0 }}
                animate={{ width: `${c.score * 100}%` }}
                transition={{ duration: 0.6, delay: delay + 0.1 + i * 0.08 }}
              />
            </div>
            {!compact && <div className="mt-1 text-[11.5px] text-slate-500">{detail(c.key, result)}</div>}
          </motion.div>
        )
      })}
    </div>
  )
}
