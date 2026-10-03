import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeft, ArrowRight, Database, Fingerprint, GitCompareArrows, Network, ScanSearch, Sparkles, Trophy,
  Loader2, CircleAlert, Shield,
} from 'lucide-react'
import { usePipeline } from './lib/pipeline'
import { num, pct } from './lib/theme'
import Overview from './pages/Overview'
import DataBanks from './pages/DataBanks'
import Federated from './pages/Federated'
import Profiles from './pages/Profiles'
import Analyzer from './pages/Analyzer'
import Compare from './pages/Compare'
import Results from './pages/Results'

export const PAGES = [
  { id: 'overview', label: 'Overview', sub: 'The big picture', icon: Sparkles, el: Overview },
  { id: 'data', label: 'Data & Banks', sub: 'Isolated data silos', icon: Database, el: DataBanks },
  { id: 'federated', label: 'Federated Training', sub: 'Learn together, share nothing', icon: Network, el: Federated },
  { id: 'profiles', label: 'Behavioral Profiles', sub: 'Know each customer', icon: Fingerprint, el: Profiles },
  { id: 'analyzer', label: 'Live Analyzer', sub: 'Score any transaction', icon: ScanSearch, el: Analyzer },
  { id: 'compare', label: 'User A vs User B', sub: 'Same purchase, two verdicts', icon: GitCompareArrows, el: Compare },
  { id: 'results', label: 'Results', sub: 'Does it actually work?', icon: Trophy, el: Results },
]

const pageFromHash = () => {
  const id = window.location.hash.replace('#', '')
  return PAGES.some((p) => p.id === id) ? id : 'overview'
}

export default function App() {
  const [page, setPage] = useState(pageFromHash)
  const { status, ready, run, backendDown } = usePipeline()

  const go = (id) => {
    setPage(id)
    window.location.hash = id
    document.getElementById('main-scroll')?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  useEffect(() => {
    const onHash = () => setPage(pageFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target?.tagName
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return
      const i = PAGES.findIndex((p) => p.id === page)
      if (e.key === 'ArrowRight' && i < PAGES.length - 1) go(PAGES[i + 1].id)
      if (e.key === 'ArrowLeft' && i > 0) go(PAGES[i - 1].id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const idx = PAGES.findIndex((p) => p.id === page)
  const Page = PAGES[idx].el
  const model = status?.model

  return (
    <div className="app-bg flex h-full">
      {/* Sidebar */}
      <aside className="relative z-10 hidden w-[272px] shrink-0 flex-col border-r border-white/[0.06] bg-ink-950/60 backdrop-blur-xl lg:flex">
        <div className="flex items-center gap-3 px-5 pt-6 pb-5">
          <div className="relative grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-[#3987e5] via-[#a05aa8] to-[#d55181] shadow-lg shadow-[#3987e5]/20">
            <Shield size={20} className="text-white" />
          </div>
          <div className="leading-tight">
            <div className="text-[14.5px] font-semibold text-white">Behavioral-Drift</div>
            <div className="text-[12px] text-slate-400">Fraud Detector</div>
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
          {PAGES.map((p, i) => {
            const active = p.id === page
            const Icon = p.icon
            return (
              <button
                key={p.id}
                onClick={() => go(p.id)}
                className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                  active ? 'text-white' : 'text-slate-400 hover:bg-white/[0.03] hover:text-slate-200'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-0 rounded-xl bg-white/[0.06] ring-1 ring-white/[0.08]"
                    transition={{ type: 'spring', stiffness: 400, damping: 34 }}
                  />
                )}
                <span
                  className={`relative grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[11px] font-semibold ${
                    active ? 'bg-white text-ink-950' : 'bg-white/[0.04] text-slate-400 group-hover:text-slate-200'
                  }`}
                >
                  <Icon size={15} />
                </span>
                <span className="relative min-w-0">
                  <span className="block text-[13.5px] font-medium leading-tight">{p.label}</span>
                  <span className="block truncate text-[11.5px] text-slate-500">
                    {i === 0 ? '' : `Step ${i} · `}
                    {p.sub}
                  </span>
                </span>
              </button>
            )
          })}
        </nav>

        <div className="m-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5">
          <ModelStatus status={status} ready={ready} running={run.running} backendDown={backendDown} model={model} />
        </div>
        <div className="px-5 pb-4 text-[11px] text-slate-500">
          Tip: use <kbd className="rounded bg-white/10 px-1">←</kbd> <kbd className="rounded bg-white/10 px-1">→</kbd> to move between steps
        </div>
      </aside>

      {/* Main */}
      <div className="relative flex min-w-0 flex-1 flex-col">
        <div className="pointer-events-none absolute inset-0 grid-bg" />
        {/* compact nav for small screens */}
        <div className="relative z-10 flex gap-1 overflow-x-auto border-b border-white/[0.06] px-3 py-2 lg:hidden">
          {PAGES.map((p) => (
            <button
              key={p.id}
              onClick={() => go(p.id)}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-[12.5px] ${p.id === page ? 'bg-white text-ink-950' : 'text-slate-400'}`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <main id="main-scroll" className="relative flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1440px] px-4 py-8 sm:px-6 lg:px-10">
            {backendDown && (
              <div className="mb-6 flex items-center gap-2 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                <CircleAlert size={16} /> Can't reach the backend on port 8000. Start it with <code className="font-mono">start-driftguard.bat</code>.
              </div>
            )}
            <AnimatePresence mode="wait">
              <motion.div
                key={page}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
              >
                <Page go={go} />
              </motion.div>
            </AnimatePresence>

            {/* prev / next */}
            <div className="mt-12 flex items-center justify-between border-t border-white/[0.06] pt-6">
              {idx > 0 ? (
                <button onClick={() => go(PAGES[idx - 1].id)} className="group flex items-center gap-2 text-left text-slate-400 hover:text-white">
                  <ArrowLeft size={18} className="transition-transform group-hover:-translate-x-0.5" />
                  <span>
                    <span className="block text-[11px] uppercase tracking-wider text-slate-500">Previous</span>
                    <span className="text-[14px] font-medium">{PAGES[idx - 1].label}</span>
                  </span>
                </button>
              ) : <span />}
              {idx < PAGES.length - 1 && (
                <button onClick={() => go(PAGES[idx + 1].id)} className="group flex items-center gap-2 text-right text-slate-300 hover:text-white">
                  <span>
                    <span className="block text-[11px] uppercase tracking-wider text-slate-500">Next step</span>
                    <span className="text-[14px] font-medium">{PAGES[idx + 1].label}</span>
                  </span>
                  <ArrowRight size={18} className="transition-transform group-hover:translate-x-0.5" />
                </button>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

function ModelStatus({ status, ready, running, backendDown, model }) {
  let tone = '#8b93a7'
  let label = 'Connecting…'
  if (backendDown) { tone = '#e66767'; label = 'Backend offline' }
  else if (running) { tone = '#f2bf4a'; label = 'Training live…' }
  else if (status?.status === 'error') { tone = '#e66767'; label = 'Error' }
  else if (ready) { tone = '#22c55e'; label = 'Global model ready' }
  else if (status) { tone = '#f2bf4a'; label = 'Warming up…' }

  return (
    <div>
      <div className="flex items-center gap-2 text-[12.5px] font-medium text-slate-200">
        <span className="relative flex h-2.5 w-2.5">
          {(running || (!ready && !backendDown)) && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: tone }} />
          )}
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full" style={{ background: tone }} />
        </span>
        {label}
        {(running || (!ready && !backendDown && status)) && <Loader2 size={12} className="ml-auto animate-spin text-slate-400" />}
      </div>
      {model && (
        <div className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11.5px]">
          <span className="text-slate-500">FL rounds</span>
          <span className="text-right font-mono text-slate-300">{model.config.rounds} × {model.config.local_epochs} ep</span>
          <span className="text-slate-500">Global acc.</span>
          <span className="text-right font-mono text-slate-300">{pct(model.final_accuracy, 2)}</span>
          <span className="text-slate-500">Params shared</span>
          <span className="text-right font-mono text-slate-300">{num(model.num_params)}</span>
          <span className="text-slate-500">Raw rows shared</span>
          <span className="text-right font-mono text-emerald-300">0</span>
        </div>
      )}
    </div>
  )
}
