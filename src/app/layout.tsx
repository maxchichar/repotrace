import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: { default: 'RepoTrace | Contribution intelligence', template: '%s · RepoTrace' },
  description:
    'Understand who contributed, what changed, and what the evidence actually says. Transparent GitHub contribution analysis.',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
