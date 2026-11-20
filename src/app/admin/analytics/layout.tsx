import { Suspense } from 'react'
import { AnalyticsNav } from './analytics-nav'

export default function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense fallback={null}>
        <AnalyticsNav />
      </Suspense>
      {children}
    </>
  )
}
