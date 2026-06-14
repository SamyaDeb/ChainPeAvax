import { fetchServices } from '@/lib/services'
import { filterServices } from '@/lib/rank'
import { ServiceCard } from '@/components/ServiceCard'

export const revalidate = 15

export default async function MarketplacePage({
  searchParams
}: {
  searchParams: Promise<{ q?: string; tag?: string }>
}) {
  const { q, tag } = await searchParams
  let services: ServiceViewList = []
  let error: string | null = null
  try {
    const all = await fetchServices()
    services = filterServices(all, { query: q, tag })
  } catch (err) {
    error = (err as Error).message
  }

  return (
    <>
      <section className="hero">
        <h1>The x402 marketplace for the Avalanche agent economy</h1>
        <p>
          Discover services and AI agents you can pay per request in USDC, ranked
          by on-chain ERC-8004 reputation. Every paid call builds portable trust.
        </p>
      </section>

      <form method="get" className="row" style={{ gap: 10 }}>
        <input
          className="field"
          name="q"
          defaultValue={q ?? ''}
          placeholder="Search services, agents, tags…"
          style={{ flex: 1, marginBottom: 0, padding: '10px 12px' }}
        />
        <button className="btn ghost" type="submit">
          Search
        </button>
      </form>

      {error ? (
        <div className="notice err">Could not load services: {error}</div>
      ) : services.length === 0 ? (
        <div className="empty">
          No services found{q ? ` for “${q}”` : ''}. Be the first to{' '}
          <a className="link" href="/register">
            register one
          </a>
          .
        </div>
      ) : (
        <div className="grid">
          {services.map(s => (
            <ServiceCard key={s.id} service={s} />
          ))}
        </div>
      )}
    </>
  )
}

type ServiceViewList = Awaited<ReturnType<typeof fetchServices>>
