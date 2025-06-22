import { Container, Sprite, Graphics, Assets } from "pixi.js";
import { SymbolCell } from "./types";

export const REEL_COUNT = 3;
export const ROW_COUNT = 3;
export const SPRITE_SIZE = 200;
export const CELL_MARGIN = 32;

export interface SymbolAsset {
  img: string;
  frame: string;
}

export function getRandomSymbolIdx(symbols: SymbolAsset[]) {
  return Math.floor(Math.random() * symbols.length);
}
export function getRandomColumnResult(symbols: SymbolAsset[]): number[] {
  return Array.from({ length: ROW_COUNT }, () => getRandomSymbolIdx(symbols));
}

export function computeGridOrigin(
  screenWidth: number,
  screenHeight: number
): { startX: number; startY: number } {
  const totalWidth = (REEL_COUNT - 1) * (SPRITE_SIZE + CELL_MARGIN);
  const totalHeight = (ROW_COUNT - 1) * (SPRITE_SIZE + CELL_MARGIN);
  return {
    startX: (screenWidth - totalWidth - SPRITE_SIZE) / 2 + SPRITE_SIZE / 2,
    startY: (screenHeight - totalHeight - SPRITE_SIZE) / 2 + SPRITE_SIZE / 2,
  };
}

export function drawGridMask(
  gridMask: Graphics,
  screenWidth: number,
  screenHeight: number
) {
  const { startX, startY } = computeGridOrigin(screenWidth, screenHeight);
  gridMask.clear();
  gridMask.beginFill(0xffffff);
  gridMask.drawRect(
    startX - SPRITE_SIZE / 2,
    startY - SPRITE_SIZE / 2,
    REEL_COUNT * SPRITE_SIZE + (REEL_COUNT - 1) * CELL_MARGIN,
    ROW_COUNT * SPRITE_SIZE + (ROW_COUNT - 1) * CELL_MARGIN
  );
  gridMask.endFill();
}

export function setupGrid(
  symbols: SymbolAsset[],
  reels: SymbolCell[][],
  reelColumns: Container[],
  reelContainer: Container
) {
  for (let col = 0; col < REEL_COUNT; col++) {
    const colContainer = new Container();
    reelContainer.addChild(colContainer);
    reelColumns.push(colContainer);
    reels[col] = [];
    for (let row = 0; row < ROW_COUNT; row++) {
      const symbolIndex = getRandomSymbolIdx(symbols);
      const symbol = new Sprite(Assets.get(symbols[symbolIndex].img));
      symbol.anchor.set(0.5);
      symbol.x = 0;
      symbol.y = row * (SPRITE_SIZE + CELL_MARGIN);

      const frame = new Sprite(Assets.get(symbols[symbolIndex].frame));
      frame.anchor.set(0.5);
      frame.x = symbol.x;
      frame.y = symbol.y;
      colContainer.addChild(symbol, frame);
      reels[col][row] = { symbol, frame, finalIndex: symbolIndex };
    }
  }
}

/**
 * Returns all {col, row} positions that are part of a winning streak in the grid.
 */
export function getWinningPositions(resultIndices: number[][]): { col: number, row: number }[] {
  const winning: { col: number, row: number }[] = [];
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
        for (let j = 0; j < count; j++) {
          winning.push({ col: col + j, row });
        }
        col += count;
      } else {
        col++;
      }
    }
  }
  return winning;
}