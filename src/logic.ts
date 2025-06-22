// Handles win calculation for the slot machine

/**
 * Calculates the win amount given the positions of winning symbols.
 * Each unique winning symbol (by col,row) awards $1.
 * @param winningPositions Array of {col, row} for all winning symbols
 * @returns win amount (integer, max 9)
 */
export function calculateWinAmount(winningPositions: {col:number, row:number}[]): number {
  const uniqueSymbols = new Set(winningPositions.map(pos => `${pos.col},${pos.row}`));
  return uniqueSymbols.size;
}