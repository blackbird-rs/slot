export function calculateWinAmount(
  winningPositions: { col: number; row: number }[],
): number {
  const uniqueSymbols = new Set(
    winningPositions.map((pos) => `${pos.col},${pos.row}`),
  );
  return uniqueSymbols.size;
}
