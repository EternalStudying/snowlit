/**
 * Message to show for a failed operation: the error's own message when it has one, otherwise the fallback.
 */
export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

/**
 * A timestamp or calendar date shown as YYYY.MM.DD in the viewer's time zone; unparseable input keeps its
 * first ten characters.
 */
export function formatDottedDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10);
  }
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}.${month}.${day}`;
}
