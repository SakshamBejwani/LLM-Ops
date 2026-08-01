export function chunkText(text: string, chunkSize = 800, overlap = 100): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.length <= chunkSize) return [trimmed];

  const chunks: string[] = [];
  let start = 0;
  while (start < trimmed.length) {
    const end = Math.min(start + chunkSize, trimmed.length);
    chunks.push(trimmed.slice(start, end));
    if (end === trimmed.length) break;
    start = end - overlap;
  }
  return chunks;
}
