import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { createPaymentHeader } from 'x402/client'
import type { PaymentRequirements } from 'x402/types'
import { decodeXPaymentResponse } from 'x402-fetch'
import type { AppConfig, PaymentNetwork } from '@/types.js'
import type { SpendingTracker } from '@/spending.js'
import { buildSigner, USDC_DECIMALS } from '@/clients.js'

interface PaymentAccept {
  scheme: string
  network: string
  asset: string
  maxAmountRequired: string
  payTo: string
  maxTimeoutSeconds?: number
  resource?: string
  description?: string
  mimeType?: string
  extra?: Record<string, unknown>
}

interface PaymentRequiredBody {
  x402Version: number
  error?: string
  accepts: PaymentAccept[]
}

const X402_TO_NETWORK: Record<string, PaymentNetwork> = {
  'avalanche-fuji': 'fuji',
  avalanche: 'avalanche'
}

function isLikelyTextContentType(contentType: string | null): boolean {
  if (!contentType) return false
  const n = contentType.toLowerCase()
  return (
    n.startsWith('text/') ||
    n.includes('application/json') ||
    n.includes('application/xml') ||
    n.includes('application/javascript') ||
    n.includes('application/x-www-form-urlencoded')
  )
}

async function formatResponseBody(response: Response): Promise<{
  body: string
  bodyEncoding: 'text' | 'base64'
  contentType: string | null
  contentLength: string | null
}> {
  const contentType = response.headers.get('content-type')
  const contentLength = response.headers.get('content-length')
  if (isLikelyTextContentType(contentType)) {
    return {
      body: await response.text(),
      bodyEncoding: 'text',
      contentType,
      contentLength
    }
  }
  const arrayBuffer = await response.arrayBuffer()
  return {
    body: Buffer.from(arrayBuffer).toString('base64'),
    bodyEncoding: 'base64',
    contentType,
    contentLength
  }
}

function atomicToUsdc(atomic: string): string {
  const raw = BigInt(atomic)
  const whole = raw / BigInt(10 ** USDC_DECIMALS)
  const frac = raw % BigInt(10 ** USDC_DECIMALS)
  return `${whole}.${frac.toString().padStart(USDC_DECIMALS, '0')}`
}

export function registerX402Fetch(
  server: McpServer,
  config: AppConfig,
  spending: SpendingTracker
): void {
  server.tool(
    'x402_fetch',
    'Fetch a URL with automatic x402 payment. Makes the HTTP request, and if the server responds ' +
      'with 402 Payment Required, automatically signs the USDC payment (EIP-3009) and retries with ' +
      'the X-PAYMENT header. Returns the final response.',
    {
      url: z.string().url().describe('The URL to fetch'),
      method: z
        .enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH'])
        .default('GET')
        .describe('HTTP method (default: GET)'),
      headers: z
        .record(z.string())
        .optional()
        .describe('Optional HTTP headers'),
      body: z.string().optional().describe('Optional request body')
    },
    async ({ url, method, headers, body }) => {
      if (!config.canPay) {
        return {
          content: [
            {
              type: 'text' as const,
              text: 'No wallet configured. Set CHAINPE_PRIVATE_KEY environment variable.'
            }
          ],
          isError: true
        }
      }

      try {
        const baseOptions: RequestInit = { method, headers: headers ?? {} }
        if (body && method !== 'GET') baseOptions.body = body

        const initial = await fetch(url, baseOptions)
        if (initial.status !== 402) {
          const payload = await formatResponseBody(initial)
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(
                  {
                    status: initial.status,
                    statusText: initial.statusText,
                    body: payload.body,
                    bodyEncoding: payload.bodyEncoding,
                    contentType: payload.contentType,
                    contentLength: payload.contentLength
                  },
                  null,
                  2
                )
              }
            ]
          }
        }

        // Parse the 402 (x402 v1 returns payment info in the JSON body).
        const paymentRequired = (await initial.json()) as PaymentRequiredBody
        if (!paymentRequired.accepts || paymentRequired.accepts.length === 0) {
          return {
            content: [
              {
                type: 'text' as const,
                text: 'Server returned 402 but provided no payment options.'
              }
            ],
            isError: true
          }
        }

        const accept = paymentRequired.accepts.find(a => {
          const net = X402_TO_NETWORK[a.network]
          return !!net && net === config.network
        })

        if (!accept) {
          const nets = paymentRequired.accepts.map(a => a.network).join(', ')
          return {
            content: [
              {
                type: 'text' as const,
                text: `Cannot fulfill payment. Server accepts: [${nets}], wallet is on ${config.network}.`
              }
            ],
            isError: true
          }
        }

        const network = X402_TO_NETWORK[accept.network]
        const usdcAmount = atomicToUsdc(accept.maxAmountRequired)

        spending.check(usdcAmount)

        const signer = await buildSigner(network, config)

        const headerValue = await createPaymentHeader(
          signer,
          paymentRequired.x402Version,
          accept as unknown as PaymentRequirements
        )
        if (!headerValue) throw new Error('Failed to generate payment header')

        const retryOptions: RequestInit = {
          method,
          headers: { ...(headers ?? {}), 'X-PAYMENT': headerValue }
        }
        if (body && method !== 'GET') retryOptions.body = body

        const paid = await fetch(url, retryOptions)
        const payload = await formatResponseBody(paid)

        if (paid.status === 402) {
          return {
            content: [
              {
                type: 'text' as const,
                text: [
                  'Payment signed and sent, but the server could not settle the transaction.',
                  'This usually means the paying wallet needs:',
                  `  1. USDC on ${network} — at least ${usdcAmount} USDC`,
                  '  2. (the facilitator pays gas, so you do not need AVAX to pay)',
                  '',
                  'Get Fuji testnet funds:',
                  '  • AVAX: https://faucet.avax.network/',
                  '  • USDC: https://faucet.circle.com  (select Avalanche Fuji)',
                  '',
                  `Attempted payment: ${usdcAmount} USDC → ${accept.payTo} on ${network}`
                ].join('\n')
              }
            ],
            isError: true
          }
        }

        spending.record(usdcAmount, accept.payTo, network)

        let settlement: unknown
        const settleHeader = paid.headers.get('X-PAYMENT-RESPONSE')
        if (settleHeader) {
          try {
            settlement = decodeXPaymentResponse(settleHeader)
          } catch {
            /* ignore */
          }
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  status: paid.status,
                  statusText: paid.statusText,
                  body: payload.body,
                  bodyEncoding: payload.bodyEncoding,
                  contentType: payload.contentType,
                  contentLength: payload.contentLength,
                  payment: {
                    amount: `${usdcAmount} USDC`,
                    recipient: accept.payTo,
                    network
                  },
                  settlement: settlement ?? undefined
                },
                null,
                2
              )
            }
          ]
        }
      } catch (err) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `x402 fetch failed: ${err instanceof Error ? err.message : String(err)}`
            }
          ],
          isError: true
        }
      }
    }
  )
}
