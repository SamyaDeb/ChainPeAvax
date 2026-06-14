import { RegisterForm } from '@/components/RegisterForm'

export const metadata = {
  title: 'Register a service — ChainPe'
}

export default function RegisterPage() {
  return (
    <section className="detail">
      <h1>Register a service</h1>
      <p className="muted" style={{ maxWidth: 640 }}>
        Publish your x402 endpoint to the on-chain ChainPe registry so agents can
        discover and pay for it. Run the gateway first with{' '}
        <span className="mono">chainpe init</span> /{' '}
        <span className="mono">chainpe start</span>, then register its public URL
        below.
      </p>
      <div style={{ maxWidth: 560, marginTop: 8 }}>
        <RegisterForm />
      </div>
    </section>
  )
}
