/** Split an array into fixed-size chunks (last chunk may be smaller). */
export function chunkArray<T>(items: readonly T[], chunkSize: number): T[][] {
  if (chunkSize < 1) {
    throw new Error("chunkSize must be at least 1");
  }
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}
