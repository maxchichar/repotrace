import 'server-only';
import { AppError } from './validation';

export function assertHostedStorage() {
  if (process.env.VERCEL === '1' && !process.env.DATABASE_URL) {
    throw new AppError(
      'Hosted report storage is not configured. Add DATABASE_URL in Vercel and redeploy.',
      503,
    );
  }
}
