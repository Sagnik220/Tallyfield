import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { site } from '@/config/site'
import './globals.css'

export const metadata: Metadata = {
  title: { default: site.name, template: `%s · ${site.name}` },
  description: site.tagline,
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
