import type { Metadata } from 'next'
import Link from 'next/link'
import './globals.css'
import { NETWORK } from '@/lib/networks'

export const metadata: Metadata = {
  title: 'ChainPe — x402 marketplace on Avalanche',
  description:
    'Browse x402 services + AI agents with on-chain ERC-8004 reputation, and monetize your own API — on Avalanche C-Chain.'
}

export default function RootLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <header className="nav">
          <div className="container nav-inner">
            <Link href="/" className="brand">
              Chain<span className="dot">Pe</span>
            </Link>
            <nav className="nav-links">
              <Link href="/">Marketplace</Link>
              <Link href="/register">Register a service</Link>
              <span className="mono">{NETWORK}</span>
            </nav>
          </div>
        </header>
        <main className="container">{children}</main>
      </body>
    </html>
  )
}
