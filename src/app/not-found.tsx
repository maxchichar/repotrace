import Link from 'next/link';
export default function NotFound() {
  return (
    <main id="main" className="error-page">
      <span className="eyebrow">REPOTRACE / REPORTS</span>
      <h1>This report is unavailable.</h1>
      <p>
        It may have expired, or this server may not have its stored report. Reports are retained for
        up to seven days.
      </p>
      <Link href="/" className="text-emerald-800 underline">
        Run a new repository analysis →
      </Link>
    </main>
  );
}
