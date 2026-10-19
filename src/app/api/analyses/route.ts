import { enforceDeploymentQuota } from '@/lib/deployment-quota';
import { runAnalysis } from '@/lib/service';
import { guardRequest, readBody, errorResponse } from '@/lib/security';
export const runtime = 'nodejs';
export const maxDuration = 120;
export async function POST(request: Request) {
  try {
    guardRequest(request, 'analysis');
    await enforceDeploymentQuota('analysis');
    const report = await runAnalysis(await readBody(request));
    return Response.json(report, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return errorResponse(e);
  }
}
