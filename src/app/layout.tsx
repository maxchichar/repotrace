import type { Metadata } from 'next';
import './globals.css';
import { themeBootstrap } from '@/lib/theme';
export const metadata: Metadata = {
  title: { default: 'RepoTrace | Contribution intelligence', template: '%s · RepoTrace' },
  icons: {
    icon: [
      { url: '/icon-32.png', type: 'image/png', sizes: '32x32' },
      { url: '/icon.svg', type: 'image/svg+xml', sizes: 'any' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  description:
    'Understand who contributed, what changed, and what the evidence actually says. Transparent GitHub contribution analysis.',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
