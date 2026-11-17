import type { Metadata } from 'next'
import { site } from '@/config/site'
import { Mark, Ornaments, SiteFooter, SiteHeader } from '@/components/site/chrome'

export const metadata: Metadata = { title: 'About', description: "Tallyfield compares watches so you can find what's worth your money." }

const STEPS = [
  { title: 'The question', text: 'Every piece starts with one question a buyer is actually asking.' },
  { title: 'Head to head', text: 'Official specs and official photos, side by side. Differences in materials and presence, not imagined capability.' },
  { title: 'The value matrix', text: 'Every variant with its India price, the retailer named and the date we checked it.' },
  { title: 'The verdict', text: "The one we'd buy, a runner-up, and the drawback you should know first." },
]

export default function AboutPage() {
  return (
    <div className="tf-page">
      <Ornaments />
      <SiteHeader />
      <main>
        <section className="tf-wrap tf-split" style={{ paddingTop: 80, paddingBottom: 96 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
            <div className="tf-eyebrow">About Tallyfield</div>
            <h1 className="tf-display tf-h1">
              Thoughtful comparisons.
              <br />
              Clearer choices.
            </h1>
            <div className="tf-rule-line tf-rule-anim" />
            <p className="tf-lead" style={{ maxWidth: 620 }}>
              Tallyfield compares watches so you can find what&apos;s worth your money. Watches, reviews and buying guides, priced for India.
            </p>
          </div>
          <div className="tf-stage tf-reveal" style={{ display: 'flex', justifyContent: 'center' }}>
            <Mark size={320} className="tf-tilt tf-float" />
          </div>
        </section>

        <section className="tf-section">
          <div className="tf-wrap" style={{ display: 'flex', flexDirection: 'column', gap: 48 }}>
            <h2 className="tf-display tf-h2 tf-reveal">How a verdict is built</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))', gap: 24 }}>
              {STEPS.map((s, i) => (
                <div key={s.title} className="tf-reveal" style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '28px 24px', background: 'var(--panel)', border: '1px solid var(--stroke)' }}>
                  <div style={{ fontFamily: 'var(--display)', fontSize: 56, lineHeight: 0.9, color: 'var(--gold)' }}>{String(i + 1).padStart(2, '0')}</div>
                  <h3 style={{ margin: 0, fontSize: 22, fontWeight: 700, textTransform: 'uppercase', color: 'var(--ink-cream)' }}>{s.title}</h3>
                  <p className="tf-body" style={{ fontSize: 18, lineHeight: 1.45 }}>
                    {s.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section style={{ background: 'var(--panel)', borderTop: '1px solid var(--stroke)', borderBottom: '1px solid var(--stroke)', padding: '96px 0' }}>
          <div className="tf-wrap" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="tf-eyebrow">Get in touch</div>
            <p className="tf-body">
              Reach us on <a href={site.instagram}>Instagram @tallyfield</a>.
            </p>
          </div>
        </section>
      </main>
      <SiteFooter prompt="See the latest comparison on Instagram." />
    </div>
  )
}
