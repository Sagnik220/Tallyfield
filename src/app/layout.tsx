import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import type { ReactNode } from 'react'
import { site } from '@/config/site'
import { Tracker } from '@/components/site/tracker'
import './globals.css'

// Fonts ship with the site (from the @fontsource packages), so the build needs no network and visitors make no third-party font requests.
const display = localFont({
  src: '../../node_modules/@fontsource/anton/files/anton-latin-400-normal.woff2',
  weight: '400',
  variable: '--font-display',
  display: 'swap',
})
const sans = localFont({
  src: '../../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2',
  weight: '100 900',
  variable: '--font-sans',
  display: 'swap',
})

// Reading face for article text (variable weight, with italics).
const serif = localFont({
  src: [
    { path: '../../node_modules/@fontsource-variable/source-serif-4/files/source-serif-4-latin-wght-normal.woff2', weight: '200 900', style: 'normal' },
    { path: '../../node_modules/@fontsource-variable/source-serif-4/files/source-serif-4-latin-wght-italic.woff2', weight: '200 900', style: 'italic' },
  ],
  variable: '--font-serif',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: { default: `${site.name} · ${site.tagline}`, template: `%s · ${site.name}` },
  description: 'Watch comparisons, reviews and buying guides with India prices. ' + site.tagline,
  openGraph: { siteName: site.name, type: 'website', locale: 'en_IN' },
}

export const viewport: Viewport = { themeColor: '#050505', colorScheme: 'dark' }

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${serif.variable}`}>
      <body>
        {children}
        <Tracker />
      </body>
    </html>
  )
}
