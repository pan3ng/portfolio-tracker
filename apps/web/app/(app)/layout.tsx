// File: apps/web/app/(app)/layout.tsx
import { Nav } from '@/components/Nav'
import { SpeedInsights } from "@vercel/speed-insights/next"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Nav />
      {children}
    </>
  )
}
