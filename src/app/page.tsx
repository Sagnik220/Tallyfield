import { site } from '@/config/site'

// Placeholder. The designed homepage (see the design canvas) is built here in the UI phase.
export default function HomePage() {
  return (
    <main style={{ maxWidth: 1296, margin: '0 auto', padding: '96px 24px' }}>
      <h1 style={{ color: 'var(--ink-cream)', margin: 0 }}>{site.name}</h1>
      <p>{site.tagline}</p>
    </main>
  )
}
