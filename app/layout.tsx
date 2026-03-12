import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Showst',
  description: '폰으로 즐기는 단체 게임',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </head>
      <body style={{ background: '#08080e', minHeight: '100vh' }}>{children}</body>
    </html>
  )
}
