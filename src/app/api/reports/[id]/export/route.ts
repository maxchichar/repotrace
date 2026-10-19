import { readReport } from '@/lib/store';
import { reportCSV } from '@/lib/export';
import { errorResponse } from '@/lib/security';
import { AppError } from '@/lib/validation';
export const runtime = 'nodejs';
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const report = await readReport((await params).id);
    const format = new URL(request.url).searchParams.get('format') || 'json';
    if (format !== 'json' && format !== 'csv')
      throw new AppError('Export format must be json or csv.');
    const body = format === 'json' ? JSON.stringify(report, null, 2) : reportCSV(report);
    if (process.env.VERCEL === '1' && Buffer.byteLength(body) > 4_000_000) {
      throw new AppError(
        'This export is too large for the hosted response limit. Choose a smaller analysis window.',
        413,
      );
    }
    return new Response(body, {
      headers: {
        'Content-Type':
          format === 'json' ? 'application/json; charset=utf-8' : 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="repotrace-${report.id}.${format}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
