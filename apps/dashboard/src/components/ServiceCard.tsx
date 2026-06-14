import Link from 'next/link'
import type { ServiceView } from '@/lib/types'
import { Stars } from './Stars'

export function ServiceCard({ service }: { service: ServiceView }) {
  return (
    <Link href={`/services/${encodeURIComponent(service.id)}`}>
      <div className="card">
        <div className="row">
          <h3>{service.name}</h3>
          <Stars reputation={service.reputation} />
        </div>
        <p className="desc">{service.description || 'No description provided.'}</p>
        <div className="row">
          <span className="price">{service.pricePerRequest} USDC</span>
          <span className="muted" style={{ fontSize: 12 }}>
            {service.agentId ? `agent #${service.agentId}` : 'no agent id'}
          </span>
        </div>
        {service.tags.length > 0 && (
          <div className="tags">
            {service.tags.slice(0, 5).map(t => (
              <span className="tag" key={t}>
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  )
}
