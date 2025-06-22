import { Application, Container, Graphics, Sprite, Text, TextStyle } from "pixi.js";
import { REEL_COUNT, ROW_COUNT, SPRITE_SIZE, CELL_MARGIN, computeGridOrigin, drawGridMask } from "./slotGrid";

export const SPIN_MARGIN = 32;

export function createTextFieldStyle(): TextStyle {
  return new TextStyle({
    fontFamily: "Arial",
    fontSize: 36,
    fill: "#fff",
    stroke: "#0d2233",
    fontWeight: "bold",
    padding: 14,
    dropShadow: true,
    letterSpacing: 2,
    align: "center",
  });
}

export function layoutEverything(
  app: Application,
  spinButton: Sprite,
  betText: Text,
  balanceText: Text,
  winText: Text,
  reelColumns: Container[],
  gridMask: Graphics
) {
  const { startX, startY } = computeGridOrigin(app.screen.width, app.screen.height);

  // --- Layout spin button in bottom right ---
  spinButton.x = app.screen.width - spinButton.width / 2 - SPIN_MARGIN;
  spinButton.y = app.screen.height - spinButton.height / 2 - SPIN_MARGIN;

  // --- Layout bet & balance group centered and in line with spin button ---
  const betBalanceGap = 48;
  const betBalanceY = spinButton.y - betText.height / 2;

  // Compute total width of bet+gap+balance as a group
  const betBalanceTotalWidth = betText.width + betBalanceGap + balanceText.width;
  const groupRightEdge = app.screen.width / 2 + betBalanceTotalWidth / 2;
  const spinBtnLeftEdge = spinButton.x - spinButton.width / 2;
  let groupCenterX = app.screen.width / 2;
  if (groupRightEdge + SPIN_MARGIN > spinBtnLeftEdge) {
    groupCenterX = spinBtnLeftEdge - SPIN_MARGIN - betBalanceTotalWidth / 2;
  }
  let groupLeftX = groupCenterX - betBalanceTotalWidth / 2;
  if (groupLeftX < SPIN_MARGIN) {
    groupLeftX = SPIN_MARGIN;
    groupCenterX = groupLeftX + betBalanceTotalWidth / 2;
  }

  betText.x = groupLeftX;
  betText.y = betBalanceY;
  balanceText.x = betText.x + betText.width + betBalanceGap;
  balanceText.y = betBalanceY;

  // --- Layout win text above bet/balance row ---
  winText.x = app.screen.width / 2 - winText.width / 2;
  const gridBottomY = startY + (ROW_COUNT - 1) * (SPRITE_SIZE + CELL_MARGIN) + SPRITE_SIZE / 2;
  const winTextBottom = betText.y - 24;
  let winTextY = gridBottomY + 16;
  if (winTextBottom > winTextY + winText.height) {
    winTextY = winTextBottom - winText.height;
  }
  winText.y = winTextY;

  // --- Layout grid ---
  for (let col = 0; col < REEL_COUNT; col++) {
    reelColumns[col].x = startX + col * (SPRITE_SIZE + CELL_MARGIN);
    reelColumns[col].y = startY;
  }

  drawGridMask(gridMask, app.screen.width, app.screen.height);
}