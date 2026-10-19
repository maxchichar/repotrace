import { enforceDeploymentQuota } from '@/lib/deployment-quota';
import { readReport, saveReport } from '@/lib/store';
import { generateInsights } from '@/lib/ai';
import { guardRequest, errorResponse } from '@/lib/security';
import { AppError } from '@/lib/validation';
export const runtime = 'nodejs';
export const maxDuration = 60;
let busy = false;
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let acquired = false;
  try {
    guardRequest(request, 'ai');
    await enforceDeploymentQuota('ai');
    const report = await readReport((await params).id);
    if (report.insights) return Response.json(report, { headers: { 'Cache-Control': 'no-store' } });
    if (busy) throw new AppError('An AI estimate is already running. Try again shortly.', 429, 30);
    if (!report.evidence.length) throw new AppError('There is no evidence to summarize.', 422);
    busy = true;
    acquired = true;
    report.insights = await generateInsights(report);
    await saveReport(report);
    return Response.json(report, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return errorResponse(e);
  } finally {
    if (acquired) busy = false;
  }
}
