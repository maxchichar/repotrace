import type { Metadata } from 'next';
import './globals.css';
import { themeBootstrap } from '@/lib/theme';
export const metadata: Metadata = {
  title: { default: 'RepoTrace | Contribution intelligence', template: '%s · RepoTrace' },
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
