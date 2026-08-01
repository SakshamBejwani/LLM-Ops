export function fmtMs(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return "–";
  return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`;
}
