async function request(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    let detail = res.statusText
    try {
      detail = (await res.json()).detail || detail
    } catch {
      /* not JSON */
    }
    const err = new Error(detail)
    err.status = res.status
    throw err
  }
  return res.json()
}

export const api = {
  status: () => request('/api/status'),
  overview: () => request('/api/overview'),
  users: () => request('/api/users'),
  profile: (userId) => request(`/api/profile/${encodeURIComponent(userId)}`),
  evaluation: () => request('/api/evaluation'),
  predict: (txn, alpha = 0.7, threshold = 0.5) =>
    request('/api/predict', { method: 'POST', body: JSON.stringify({ txn, alpha, threshold }) }),
  sweep: (txn, userIds, alpha = 0.7, threshold = 0.5) =>
    request('/api/sweep', { method: 'POST', body: JSON.stringify({ txn, user_ids: userIds, alpha, threshold }) }),
}

/** Reads the Server-Sent Events stream of a pipeline run. Calls onEvent for every message. */
export async function streamPipeline({ rounds, epochs, pace, seed = 42 }, onEvent, signal) {
  const res = await fetch(`/api/pipeline/run?rounds=${rounds}&epochs=${epochs}&pace=${pace}&seed=${seed}`, { signal })
  if (!res.ok) {
    let detail = res.statusText
    try {
      detail = (await res.json()).detail || detail
    } catch {
      /* not JSON */
    }
    throw new Error(detail)
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let idx
    while ((idx = buffer.indexOf('\n\n')) >= 0) {
      const chunk = buffer.slice(0, idx)
      buffer = buffer.slice(idx + 2)
      const line = chunk.split('\n').find((l) => l.startsWith('data: '))
      if (line) onEvent(JSON.parse(line.slice(6)))
    }
  }
}
