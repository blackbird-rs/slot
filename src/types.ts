import { Sprite } from "pixi.js";

export type SymbolCell = { symbol: Sprite, frame: Sprite, finalIndex: number };

export interface SpinResult {
  resultIndices: number[][];
  winningPositions: { col: number, row: number }[];
  winAmount: number;
}

export type LayoutMode = "desktop" | "mobile";