export const C = {
  fl: '#3987e5',
  flSoft: '#7db4f3',
  drift: '#d55181',
  driftSoft: '#ec93b4',
  fuse: '#c98500',
  fuseSoft: '#f2bf4a',
  fraud: '#e66767',
  legit: '#22c55e',
  neutral: '#56607a',
  grid: '#1c2436',
  axis: '#8b93a7',
  text: '#e6e9f2',
  muted: '#8b93a7',
}

export const BANK_COLORS = { 'Bank A': '#d95926', 'Bank B': '#199e70', 'Bank C': '#9085e9' }
export const USER_COLORS = { U001: '#d95926', U002: '#199e70' }
export const BANKS = ['Bank A', 'Bank B', 'Bank C']

export const VOCAB = {
  merchant_category: ['Grocery', 'Fuel', 'Dining', 'Online_Retail', 'Electronics', 'Travel', 'Jewelry', 'Luxury_Goods'],
  location: ['Hyderabad', 'Bengaluru', 'Mumbai', 'Delhi', 'Chennai', 'Kolkata', 'Overseas_Unknown'],
  transaction_type: ['POS', 'Online', 'ATM_Withdrawal', 'Transfer'],
  device_type: ['Mobile_App', 'Web_Browser', 'POS_Terminal', 'ATM'],
}

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const inrFmt = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 })
const inrFmt2 = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const inr = (v, decimals = false) => (v == null ? '—' : `₹${(decimals ? inrFmt2 : inrFmt).format(v)}`)
export const inrShort = (v) => {
  if (v == null) return '—'
  if (v >= 100000) return `₹${(v / 100000).toFixed(v % 100000 === 0 ? 0 : 1)}L`
  if (v >= 1000) return `₹${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k`
  return `₹${Math.round(v)}`
}
export const pct = (v, d = 1) => (v == null ? '—' : `${(v * 100).toFixed(d)}%`)
export const num = (v) => (v == null ? '—' : new Intl.NumberFormat('en-IN').format(v))
export const f3 = (v) => (v == null ? '—' : Number(v).toFixed(3))
export const hourLabel = (h) => {
  const hh = ((h % 24) + 24) % 24
  const suffix = hh < 12 ? 'AM' : 'PM'
  const h12 = hh % 12 === 0 ? 12 : hh % 12
  return `${String(h12).padStart(2, '0')}:00 ${suffix}`
}
export const pretty = (s) => (s ? String(s).replace(/_/g, ' ') : s)
export const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`

export const chartAxis = {
  tick: { fill: C.axis, fontSize: 11 },
  axisLine: { stroke: '#2a3349' },
  tickLine: false,
}
