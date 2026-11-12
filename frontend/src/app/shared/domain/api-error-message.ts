/** Mensaje legible de un error: el que envía el backend (HttpErrorResponse) o el de un Error. */
export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message;
  const apiMessage = (error as { error?: { message?: unknown } } | null)?.error?.message;
  if (Array.isArray(apiMessage)) return apiMessage.join(' ');
  return typeof apiMessage === 'string' && apiMessage ? apiMessage : fallback;
}
