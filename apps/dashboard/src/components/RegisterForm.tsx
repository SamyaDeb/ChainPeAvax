'use client'

import { useState } from 'react'
import {
  createWalletClient,
  createPublicClient,
  custom,
  http,
  type Address
} from 'viem'
import {
  NETWORK,
  CHAINS,
  CHAIN_ID,
  RPC_URLS,
  registryFor,
  explorerTx
} from '@/lib/networks'
import { REGISTRY_ABI, ERC20_ABI } from '@/lib/abi'
import { shortAddr } from '@/lib/format'

type Status = 'idle' | 'connecting' | 'approving' | 'registering' | 'done'

interface Fields {
  name: string
  description: string
  tags: string
  endpoint: string
  pricePerRequest: string
  payTo: string
  agentId: string
}

const EMPTY: Fields = {
  name: '',
  description: '',
  tags: '',
  endpoint: '',
  pricePerRequest: '0.01',
  payTo: '',
  agentId: ''
}

export function RegisterForm() {
  const [account, setAccount] = useState<Address | null>(null)
  const [fields, setFields] = useState<Fields>(EMPTY)
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const [approveTx, setApproveTx] = useState<string | null>(null)
  const [registerTx, setRegisterTx] = useState<string | null>(null)

  const set = (k: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setFields(f => ({ ...f, [k]: e.target.value }))

  async function connect() {
    setError(null)
    if (!window.ethereum) {
      setError('No browser wallet found. Install MetaMask or Core.')
      return
    }
    try {
      setStatus('connecting')
      const accounts = (await window.ethereum.request({
        method: 'eth_requestAccounts'
      })) as string[]
      const addr = accounts[0] as Address
      setAccount(addr)
      setFields(f => ({ ...f, payTo: f.payTo || addr }))
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: `0x${CHAIN_ID[NETWORK].toString(16)}` }]
        })
      } catch {
        /* user may already be on the right chain, or declined */
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setStatus(s => (s === 'connecting' ? 'idle' : s))
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setApproveTx(null)
    setRegisterTx(null)
    if (!account || !window.ethereum) return

    const registry = registryFor(NETWORK)
    const chain = CHAINS[NETWORK]
    const wallet = createWalletClient({
      account,
      chain,
      transport: custom(window.ethereum)
    })
    const pub = createPublicClient({ chain, transport: http(RPC_URLS[NETWORK]) })

    try {
      // 1. Read the registration fee + fee token.
      const [fee, feeToken] = await Promise.all([
        pub.readContract({
          address: registry,
          abi: REGISTRY_ABI,
          functionName: 'registrationFee'
        }) as Promise<bigint>,
        pub.readContract({
          address: registry,
          abi: REGISTRY_ABI,
          functionName: 'feeToken'
        }) as Promise<Address>
      ])

      // 2. Approve the fee (skip if allowance already covers it).
      const allowance = (await pub.readContract({
        address: feeToken,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [account, registry]
      })) as bigint
      if (allowance < fee) {
        setStatus('approving')
        const aHash = await wallet.writeContract({
          account,
          chain,
          address: feeToken,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [registry, fee]
        })
        setApproveTx(aHash)
        await pub.waitForTransactionReceipt({ hash: aHash })
      }

      // 3. Register the service.
      setStatus('registering')
      const rHash = await wallet.writeContract({
        account,
        chain,
        address: registry,
        abi: REGISTRY_ABI,
        functionName: 'register',
        args: [
          {
            name: fields.name,
            description: fields.description,
            tags: fields.tags,
            endpoint: fields.endpoint,
            pricePerRequest: fields.pricePerRequest,
            paymentToken: 'USDC',
            network: NETWORK,
            payTo: (fields.payTo || account) as Address,
            agentId: BigInt(fields.agentId.trim() || '0')
          }
        ]
      })
      setRegisterTx(rHash)
      await pub.waitForTransactionReceipt({ hash: rHash })
      setStatus('done')
    } catch (err) {
      setError(humanizeError(err))
      setStatus('idle')
    }
  }

  const busy =
    status === 'connecting' || status === 'approving' || status === 'registering'

  return (
    <div className="panel">
      {!account ? (
        <>
          <p className="muted" style={{ marginTop: 0 }}>
            Connect a browser wallet on Avalanche {NETWORK} to register your
            service on-chain. You sign the approval + registration yourself — no
            private key leaves your wallet.
          </p>
          <button className="btn" onClick={connect} disabled={busy}>
            {status === 'connecting' ? 'Connecting…' : 'Connect wallet'}
          </button>
        </>
      ) : (
        <form onSubmit={submit}>
          <p className="muted" style={{ marginTop: 0 }}>
            Connected: <span className="mono">{shortAddr(account)}</span>
          </p>

          <Field label="Service name" v={fields.name} on={set('name')} placeholder="My Research Agent" />
          <Field label="Description" v={fields.description} on={set('description')} placeholder="What it does" />
          <Field label="Tags (comma-separated)" v={fields.tags} on={set('tags')} placeholder="ai, research" />
          <Field label="Endpoint URL" v={fields.endpoint} on={set('endpoint')} placeholder="https://your-proxy.example.com" />
          <Field label="Price per request (USDC)" v={fields.pricePerRequest} on={set('pricePerRequest')} placeholder="0.01" />
          <Field label="Pay-to address" v={fields.payTo} on={set('payTo')} placeholder={account} />
          <Field label="ERC-8004 agent id (optional)" v={fields.agentId} on={set('agentId')} placeholder="0" />

          <button className="btn" type="submit" disabled={busy || !fields.name || !fields.endpoint}>
            {status === 'approving'
              ? 'Approve USDC fee…'
              : status === 'registering'
                ? 'Registering…'
                : 'Register service'}
          </button>

          {approveTx && (
            <p className="muted" style={{ fontSize: 13 }}>
              Fee approved:{' '}
              <a className="link" href={explorerTx(NETWORK, approveTx)} target="_blank" rel="noreferrer">
                {shortAddr(approveTx)}
              </a>
            </p>
          )}
          {status === 'done' && registerTx && (
            <div className="notice ok">
              Registered on-chain!{' '}
              <a className="link" href={explorerTx(NETWORK, registerTx)} target="_blank" rel="noreferrer">
                View transaction
              </a>
              . It will appear in the marketplace shortly.
            </div>
          )}
          {error && <div className="notice err">{error}</div>}
        </form>
      )}
    </div>
  )
}

function Field({
  label,
  v,
  on,
  placeholder
}: {
  label: string
  v: string
  on: (e: React.ChangeEvent<HTMLInputElement>) => void
  placeholder?: string
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <input value={v} onChange={on} placeholder={placeholder} />
    </div>
  )
}

function humanizeError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (/insufficient funds/i.test(msg)) return 'Insufficient funds for gas or the USDC fee.'
  if (/User rejected|denied/i.test(msg)) return 'Transaction rejected in the wallet.'
  return msg.split('\n')[0]
}
