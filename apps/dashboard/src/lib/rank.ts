import type { ServiceView } from './types'

/** Ranks services: scored first, higher score, more reviews, then cheaper. */
export function rankByReputation(services: ServiceView[]): ServiceView[] {
  return [...services].sort((a, b) => {
    const sa = a.reputation?.score ?? null
    const sb = b.reputation?.score ?? null
    const aHas = sa != null
    const bHas = sb != null
    if (aHas !== bHas) return aHas ? -1 : 1
    if (aHas && bHas && sa !== sb) return sb - sa
    const ca = a.reputation?.count ?? 0
    const cb = b.reputation?.count ?? 0
    if (ca !== cb) return cb - ca
    return parseFloat(a.pricePerRequest) - parseFloat(b.pricePerRequest)
  })
}

export function filterServices(
  services: ServiceView[],
  opts: { query?: string; tag?: string; maxPrice?: string }
): ServiceView[] {
  let out = services
  if (opts.query) {
    const q = opts.query.toLowerCase()
    out = out.filter(
      s =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.tags.some(t => t.toLowerCase().includes(q))
    )
  }
  if (opts.tag) {
    const t = opts.tag.toLowerCase()
    out = out.filter(s => s.tags.some(x => x.toLowerCase() === t))
  }
  if (opts.maxPrice) {
    const max = parseFloat(opts.maxPrice)
    out = out.filter(s => parseFloat(s.pricePerRequest) <= max)
  }
  return out
}
