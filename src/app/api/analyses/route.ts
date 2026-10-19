import { enforceDeploymentQuota } from '@/lib/deployment-quota';
import { runAnalysis } from '@/lib/service';
import { randomUUID } from 'node:crypto';
import { parseAnalysisInput } from '@/lib/validation';
import { assertSameOrigin, guardRequest, readBody, errorResponse } from '@/lib/security';
export const runtime = 'nodejs';
export const maxDuration = 120;
export async function POST(request: Request) {
  const requestId = randomUUID();
  let stage = 'request-validation';
  try {
    assertSameOrigin(request);
    const input = parseAnalysisInput(await readBody(request));
    guardRequest(request, 'analysis');
    stage = 'deployment-quota';
    await enforceDeploymentQuota('analysis');
    stage = 'repository-analysis';
    const report = await runAnalysis(input);
    return Response.json(report, {
      headers: { 'Cache-Control': 'no-store', 'X-Request-Id': requestId },
    });
  } catch (e) {
    return errorResponse(e, { requestId, stage });
  }
}
