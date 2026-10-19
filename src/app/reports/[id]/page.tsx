import { Workbench } from '@/components/workbench';
import { readReport } from '@/lib/store';
import { notFound } from 'next/navigation';
export const dynamic = 'force-dynamic';
export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ contributor?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const report = await readReport(id).catch(() => null);
  if (!report) notFound();
  return <Workbench initialReport={report} initialContributor={query.contributor} />;
}
