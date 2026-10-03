import { motion } from 'framer-motion'
import {
  ArrowRight, Building2, Database, Fingerprint, GitCompareArrows, Lock, Network, ScanSearch, Trophy, Users,
  AlertTriangle, CheckCircle2, Share2, ShieldOff,
} from 'lucide-react'
import ArchitectureFlow from '../components/ArchitectureFlow'
import { Button, Card, Stat } from '../components/ui'
import { usePipeline } from '../lib/pipeline'
import { C, num, pct, kb } from '../lib/theme'

const JOURNEY = [
  { id: 'data', icon: Database, title: 'Data & Banks', text: '6,000 synthetic transactions split into three banks that never see each other’s data.' },
  { id: 'federated', icon: Network, title: 'Federated Training', text: 'Watch Flower + FedAvg train one global model live. Only weights travel.' },
  { id: 'profiles', icon: Fingerprint, title: 'Behavioral Profiles', text: 'Each bank learns every customer’s normal: amounts, hours, merchants, places.' },
  { id: 'analyzer', icon: ScanSearch, title: 'Live Analyzer', text: 'Compose any transaction and watch it flow through both brains to a verdict.' },
  { id: 'compare', icon: GitCompareArrows, title: 'User A vs User B', text: 'The same ₹10,000 purchase: fraud for one customer, normal for the other.' },
  { id: 'results', icon: Trophy, title: 'Results', text: 'Measured on held-out data: local-only vs federated vs federated + drift.' },
]

const fade = (i) => ({ initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { delay: 0.06 * i, duration: 0.4 } })

export default function Overview({ go }) {
  const { overview, status } = usePipeline()
  const model = status?.model

  return (
    <div>
      {/* Hero */}
      <section className="relative pt-2 pb-8">
        <motion.div {...fade(0)} className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[12px] text-slate-300">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: C.fl }} />
          Federated Learning
          <span className="text-slate-600">×</span>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: C.drift }} />
          Personalized Behavioral Profiling
        </motion.div>
        <motion.h1 {...fade(1)} className="max-w-4xl text-[38px] font-semibold leading-[1.08] tracking-tight text-white md:text-[52px]">
          Catch the fraud a global model can’t see —{' '}
          <span className="text-gradient">without any bank sharing a single transaction.</span>
        </motion.h1>
        <motion.p {...fade(2)} className="mt-5 max-w-3xl text-[16.5px] leading-relaxed text-slate-400">
          Three banks train one fraud model together with <span className="text-slate-200">Flower + PyTorch</span>, while each bank
          privately learns how <em className="text-slate-200 not-italic font-medium">its own</em> customers normally spend. A ₹10,000 purchase
          can be routine for one person and a red flag for another — this system knows the difference.
        </motion.p>
        <motion.div {...fade(3)} className="mt-7 flex flex-wrap gap-3">
          <Button icon={ArrowRight} onClick={() => go('data')}>Start the walkthrough</Button>
          <Button variant="ghost" icon={ScanSearch} onClick={() => go('analyzer')}>Jump to live analyzer</Button>
        </motion.div>
      </section>

      {/* KPIs */}
      <motion.section {...fade(4)} className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat icon={Database} label="Transactions" value={num(overview?.total ?? 6000)} hint="synthetic, PaySim-inspired" />
        <Stat icon={Building2} label="Banks" value="3" hint="isolated data silos" />
        <Stat icon={Users} label="Customers" value={num(overview?.users ?? 150)} hint="persistent user IDs" />
        <Stat icon={AlertTriangle} label="Fraud rate" value={overview ? pct(overview.fraud_rate) : '—'} hint={overview ? `${num(overview.fraud)} injected frauds` : ''} />
        <Stat icon={Share2} label="Shared per update" value={model ? num(model.num_params) : '—'} hint={model ? `parameters · ${kb(model.payload_bytes)}` : 'parameters'} />
        <Stat icon={ShieldOff} label="Raw rows shared" value={<span className="text-emerald-300">0</span>} hint="ever, by any bank" />
      </motion.section>

      {/* Architecture */}
      <motion.section {...fade(5)} className="mt-6">
        <Card className="overflow-hidden p-6">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-[17px] font-semibold text-white">How a transaction is judged</h2>
              <p className="text-[13px] text-slate-400">Two independent opinions — one shared across banks, one personal to the customer — fused into a single score.</p>
            </div>
            <div className="flex gap-4 text-[12px] text-slate-400">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: C.fl }} />Shared knowledge</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: C.drift }} />Personal baseline</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: C.fuse }} />Fusion</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[720px]">
              <ArchitectureFlow />
            </div>
          </div>
        </Card>
      </motion.section>

      {/* Problem → Solution */}
      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        {[
          {
            problem: 'Data silos',
            pText: 'Privacy law (GDPR, banking secrecy) stops banks pooling customer records, so each bank trains on a thin slice and misses fraud patterns other banks have already seen.',
            solution: 'Federated learning',
            sText: 'Banks train one global model together. Only neural-network weights (≈16 KB per update) leave a bank — never transactions.',
            color: C.fl, icon: Network,
          },
          {
            problem: 'One-size-fits-all scoring',
            pText: 'A global model judges a ₹10,000 purchase the same way for a student who spends ₹500 and an executive who spends ₹12,000.',
            solution: 'Personal behavioral drift',
            sText: 'Each bank scores how far a transaction drifts from that customer’s own history — amount, time, merchant, location, type.',
            color: C.drift, icon: Fingerprint,
          },
        ].map((x, i) => (
          <motion.div key={x.problem} {...fade(6 + i)}>
            <Card className="h-full p-6">
              <div className="flex items-start gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-rose-400/10 text-rose-300"><AlertTriangle size={17} /></div>
                <div>
                  <div className="text-[11.5px] font-medium uppercase tracking-wider text-slate-500">Problem</div>
                  <h3 className="text-[16px] font-semibold text-white">{x.problem}</h3>
                  <p className="mt-1 text-[13.5px] leading-relaxed text-slate-400">{x.pText}</p>
                </div>
              </div>
              <div className="my-4 ml-4 h-5 border-l border-dashed border-white/15" />
              <div className="flex items-start gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg" style={{ background: `${x.color}22`, color: x.color }}><x.icon size={17} /></div>
                <div>
                  <div className="text-[11.5px] font-medium uppercase tracking-wider text-slate-500">Our solution</div>
                  <h3 className="text-[16px] font-semibold text-white">{x.solution}</h3>
                  <p className="mt-1 text-[13.5px] leading-relaxed text-slate-400">{x.sText}</p>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </section>

      {/* Privacy guarantee */}
      <motion.section {...fade(8)} className="mt-6">
        <div className="relative overflow-hidden rounded-2xl border border-emerald-400/20 bg-gradient-to-r from-emerald-500/[0.08] via-emerald-500/[0.03] to-transparent p-6">
          <div className="flex flex-wrap items-center gap-5">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-emerald-400/15 text-emerald-300"><Lock size={22} /></div>
            <div className="min-w-0 flex-1">
              <h3 className="text-[16px] font-semibold text-white">Core privacy guarantee</h3>
              <p className="mt-1 max-w-4xl text-[14px] leading-relaxed text-slate-300">
                Raw transactions and customer behavioral profiles stay inside each bank. Only model parameters travel to the
                Flower server for FedAvg aggregation — no central party ever sees a customer record.
              </p>
            </div>
            <div className="flex gap-6 text-center">
              <div><div className="text-[26px] font-semibold text-white">{model ? kb(model.payload_bytes) : '—'}</div><div className="text-[11.5px] text-slate-400">per model update</div></div>
              <div><div className="text-[26px] font-semibold text-emerald-300">0</div><div className="text-[11.5px] text-slate-400">customer records shared</div></div>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Journey */}
      <section className="mt-10">
        <h2 className="mb-4 text-[17px] font-semibold text-white">The walkthrough</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {JOURNEY.map((j, i) => (
            <motion.button key={j.id} {...fade(9 + i)} onClick={() => go(j.id)}
              className="glass group rounded-2xl p-5 text-left transition-all hover:-translate-y-0.5 hover:border-white/15">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-white/[0.05] text-slate-200 group-hover:bg-white group-hover:text-ink-950 transition-colors"><j.icon size={17} /></span>
                <span className="font-mono text-[11px] text-slate-500">STEP {i + 1}</span>
                <ArrowRight size={15} className="ml-auto text-slate-600 transition-all group-hover:translate-x-0.5 group-hover:text-slate-200" />
              </div>
              <h3 className="mt-3 text-[15px] font-semibold text-white">{j.title}</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-slate-400">{j.text}</p>
            </motion.button>
          ))}
        </div>
      </section>

      <p className="mt-6 flex items-center gap-2 text-[12px] text-slate-500">
        <CheckCircle2 size={13} className="text-emerald-400/70" />
        Every number in this app is computed live by the project’s own Python code (src/), served through FastAPI.
      </p>
    </div>
  )
}
