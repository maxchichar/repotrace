export class ApiRequestError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public requestId?: string,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}
export async function readApiResponse<T>(response: Response): Promise<T> {
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    data = undefined;
  }
  const payload = data && typeof data === 'object' ? (data as Record<string, unknown>) : undefined;
  if (!response.ok) {
    const requestId =
      typeof payload?.requestId === 'string'
        ? payload.requestId
        : (response.headers.get('x-request-id') ??
          response.headers.get('x-vercel-id') ??
          undefined);
    let message =
      typeof payload?.error === 'string'
        ? payload.error
        : response.status === 504
          ? 'The analysis exceeded the server execution time. Try again or use a smaller scope.'
          : response.status === 413
            ? 'The server rejected a report that exceeds its size limit. Choose a smaller scope.'
            : response.status === 429
              ? 'The request allowance has been reached. Please wait before retrying.'
              : response.status >= 500
                ? 'The server could not complete this request. Check the Vercel function logs.'
                : `Request failed (HTTP ${response.status}).`;
    const retryAfter = Number(response.headers.get('retry-after'));
    if (response.status === 429 && Number.isFinite(retryAfter) && retryAfter > 0)
      message += ` Retry in about ${Math.ceil(retryAfter / 60)} minute(s).`;
    if (requestId && !message.includes(requestId)) message += ` Reference: ${requestId}.`;
    throw new ApiRequestError(
      message,
      response.status,
      typeof payload?.code === 'string' ? payload.code : undefined,
      requestId,
    );
  }
  if (!payload)
    throw new ApiRequestError('The server returned an invalid response. Please retry.', 502);
  return data as T;
}
export function requestFailureMessage(error: unknown) {
  if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError'))
    return 'The analysis timed out before a report was returned. Try again or use a smaller scope.';
  if (error instanceof TypeError)
    return 'The server could not be reached. Check your connection and retry.';
  return error instanceof Error
    ? error.message
    : 'The request could not be completed. Please retry.';
}
