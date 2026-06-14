import Link from 'next/link'
import { notFound } from 'next/navigation'
import { fetchService } from '@/lib/services'
import { Stars } from '@/components/Stars'
import { explorerAddress } from '@/lib/networks'
import { shortAddr } from '@/lib/format'

export const revalidate = 15

export default async function ServiceDetailPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const service = await fetchService(decodeURIComponent(id))
  if (!service) notFound()

  return (
    <section className="detail">
      <Link href="/" className="muted" style={{ fontSize: 13 }}>
        ← Marketplace
      </Link>

      <div className="row" style={{ marginTop: 16 }}>
        <h1>{service.name}</h1>
        <Stars reputation={service.reputation} />
      </div>
      <p className="muted" style={{ maxWidth: 640 }}>
        {service.description || 'No description provided.'}
      </p>

      <div className="panel" style={{ marginTop: 20 }}>
        <dl className="kv">
          <dt>Price</dt>
          <dd className="price">{service.pricePerRequest} USDC / request</dd>

          <dt>Endpoint</dt>
          <dd className="mono">{service.endpoint}</dd>

          <dt>Pay to</dt>
          <dd>
            <a
              className="link mono"
              href={explorerAddress(service.network, service.walletAddress)}
              target="_blank"
              rel="noreferrer"
            >
              {shortAddr(service.walletAddress)}
            </a>
          </dd>

          <dt>Developer</dt>
          <dd>
            <a
              className="link mono"
              href={explorerAddress(service.network, service.developer)}
              target="_blank"
              rel="noreferrer"
            >
              {shortAddr(service.developer)}
            </a>
          </dd>

          <dt>ERC-8004 agent</dt>
          <dd>{service.agentId ? `#${service.agentId}` : 'not linked'}</dd>

          <dt>Reputation</dt>
          <dd>
            {service.reputation && service.reputation.count > 0
              ? `${service.reputation.score?.toFixed(0)}/100 from ${service.reputation.count} client(s)`
              : 'no ratings yet'}
          </dd>

          <dt>Tags</dt>
          <dd>{service.tags.length ? service.tags.join(', ') : '—'}</dd>

          <dt>Network</dt>
          <dd>{service.network}</dd>
        </dl>
      </div>

      <p className="muted" style={{ fontSize: 13, marginTop: 16 }}>
        Pay this service with the ChainPe SDK, CLI (<span className="mono">chainpe fetch {service.endpoint}</span>),
        or the Claude wallet — settlement is in USDC on Avalanche.
      </p>
    </section>
  )
}
