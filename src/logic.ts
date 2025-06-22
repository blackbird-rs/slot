import { REEL_COUNT, ROW_COUNT } from "./slotGrid";
import type { SpinResult } from "./types";
import { getWinningPositions } from "./slotGrid";

export function calculateWin(resultIndices: number[][]): number {
  let win = 0;
  for (let row = 0; row < ROW_COUNT; row++) {
    let col = 0;
    while (col < REEL_COUNT) {
      const symbol = resultIndices[col][row];
      let count = 1;
      for (let k = col + 1; k < REEL_COUNT; k++) {
        if (resultIndices[k][row] === symbol) {
          count++;
        } else {
          break;
        }
      }
      if (count >= 2) {
        win += count;
        col += count;
      } else {
        col++;
      }
    }
  }
  return win;
}

export function getSpinResult(resultIndices: number[][]): SpinResult {
  const winningPositions = getWinningPositions(resultIndices);
  const winAmount = calculateWin(resultIndices);
  return { resultIndices, winningPositions, winAmount };
}