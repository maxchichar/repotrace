'use client';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main" className="error-page">
      <h1>Something interrupted this view.</h1>
      <p>Try loading it again. You can also start a new analysis.</p>
      <Button onClick={reset}>Try again</Button> <Link href="/">Return home</Link>
    </main>
  );
}
