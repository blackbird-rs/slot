import { Application, Assets, Sprite, Container, Graphics, Text } from "pixi.js";
import { SymbolCell } from "./types";
import {
  REEL_COUNT, ROW_COUNT, SPRITE_SIZE, CELL_MARGIN,
  getRandomSymbolIdx, getRandomColumnResult, setupGrid, computeGridOrigin
} from "./slotGrid";
import { getSpinResult } from "./logic";
import { createTextFieldStyle, layoutEverything } from "./ui";

const SYMBOLS = [
  { img: "/assets/sym1.png", frame: "/assets/sym1_frame.png" },
  { img: "/assets/sym2.png", frame: "/assets/sym2_frame.png" },
  { img: "/assets/sym3.png", frame: "/assets/sym3_frame.png" },
  { img: "/assets/sym4.png", frame: "/assets/sym4_frame.png" },
];

const SPIN_DURATION = 1100;
const BET_AMOUNT = 2;
const INITIAL_BALANCE = 1000;

(async () => {
  const app = new Application();
  await app.init({ background: "#1099bb", resizeTo: window });
  document.getElementById("pixi-container")!.appendChild(app.canvas);

  await Assets.load([
    ...SYMBOLS.flatMap(s => [s.img, s.frame]),
    "/assets/spin.svg"
  ]);

  let balance = INITIAL_BALANCE;

  // --- Slot Grid ---
  const gridMask = new Graphics();
  const reelContainer = new Container();
  app.stage.addChild(reelContainer);

  const reelColumns: Container[] = [];
  const reels: SymbolCell[][] = [];

  setupGrid(SYMBOLS, reels, reelColumns, reelContainer);

  // --- Spin Button ---
  const spinButton = new Sprite(Assets.get("/assets/spin.svg"));
  spinButton.anchor.set(0.5);
  spinButton.eventMode = 'static';
  spinButton.cursor = 'pointer';

  // --- Spin Button Rotation Animation State ---
  let spinBtnRotationPhase: 0 | 1 | null = null;
  let spinBtnRotationTarget = 0;
  let spinBtnRotationSpeed = 0;
  let spinBtnIsAnimating = false;

  // --- UI Texts ---
  const textFieldStyle = createTextFieldStyle();
  const betText = new Text(`Bet: $${BET_AMOUNT}`, textFieldStyle);
  const balanceText = new Text(`Balance: $${balance}`, textFieldStyle);
  const winText = new Text(``, textFieldStyle);

  app.stage.addChild(betText, balanceText, winText, spinButton);

  function updateBalanceText() {
    balanceText.text = `Balance: $${balance}`;
  }
  function updateWinText(winAmount: number) {
    winText.text = winAmount > 0 ? `You won $${winAmount}!` : "";
  }

  // --- Pulse Animation ---
  let pulsingSprites: Sprite[] = [];
  let pulseTicker = 0;
  function clearPulsingSprites() {
    for (const sprite of pulsingSprites) {
      sprite.scale.set(1, 1);
    }
    pulsingSprites = [];
    pulseTicker = 0;
  }

  let isSpinning = false;
  let reelAnimations: {
    startTime: number;
    spinning: boolean;
    col: number;
    resultIndices: number[];
    container: Container;
    speed: number;
    duration: number;
  }[] = [];

  spinButton.on('pointertap', () => {
    if (isSpinning) return;
    if (balance < BET_AMOUNT) return;

    clearPulsingSprites();
    balance -= BET_AMOUNT;
    updateBalanceText();
    updateWinText(0);

    isSpinning = true;

    // --- Animate spin button rotation: to one side, then back ---
    spinBtnIsAnimating = true;
    spinBtnRotationPhase = 0;
    spinBtnRotationTarget = Math.PI * 0.6;
    spinBtnRotationSpeed = 0.13;

    const finalResultIndices: number[][] = [];
    reelAnimations = [];
    for (let col = 0; col < REEL_COUNT; col++) {
      const resultIndices = getRandomColumnResult(SYMBOLS);
      finalResultIndices[col] = resultIndices;
      const baseSpeed = (SPRITE_SIZE + CELL_MARGIN) * 0.0125;
      const speed = baseSpeed * (1 + (Math.random() - 0.5) * 0.35);
      const duration = SPIN_DURATION + col * 220 + Math.random() * 180;

      reelAnimations.push({
        startTime: performance.now(),
        spinning: true,
        col,
        resultIndices,
        container: reelColumns[col],
        speed,
        duration,
      });

      const colSprites = reelColumns[col];
      colSprites.removeChildren();

      const displayOrder = [];
      displayOrder.push(getRandomSymbolIdx(SYMBOLS));
      for (let i = 0; i < ROW_COUNT; i++) displayOrder.push(resultIndices[i]);
      displayOrder.push(getRandomSymbolIdx(SYMBOLS));

      for (let i = 0; i < displayOrder.length; i++) {
        const idx = displayOrder[i];
        const symbol = new Sprite(Assets.get(SYMBOLS[idx].img));
        symbol.anchor.set(0.5);
        symbol.x = 0;
        symbol.y = (i - 1) * (SPRITE_SIZE + CELL_MARGIN);

        const frame = new Sprite(Assets.get(SYMBOLS[idx].frame));
        frame.anchor.set(0.5);
        frame.x = symbol.x;
        frame.y = symbol.y;

        colSprites.addChild(symbol, frame);
      }
    }

    (spinButton as any)._finalResultIndices = finalResultIndices;
  });

  reelContainer.mask = gridMask;
  app.stage.addChild(gridMask);

  window.addEventListener("resize", () => {
    layoutEverything(app, spinButton, betText, balanceText, winText, reelColumns, gridMask);
    app.stage.setChildIndex(gridMask, app.stage.children.length - 1);
  });

  layoutEverything(app, spinButton, betText, balanceText, winText, reelColumns, gridMask);

  app.ticker.add(() => {
    // --- Spin button rotation animation (to one side, then back) ---
    if (spinBtnIsAnimating && spinBtnRotationPhase !== null) {
      if (spinBtnRotationPhase === 0) {
        if (Math.abs(spinButton.rotation - spinBtnRotationTarget) > 0.01) {
          const diff = spinBtnRotationTarget - spinButton.rotation;
          spinButton.rotation += Math.sign(diff) * Math.min(Math.abs(diff), spinBtnRotationSpeed);
        } else {
          spinButton.rotation = spinBtnRotationTarget;
          spinBtnRotationPhase = 1;
          spinBtnRotationTarget = 0;
        }
      } else if (spinBtnRotationPhase === 1) {
        if (Math.abs(spinButton.rotation) > 0.01) {
          const diff = 0 - spinButton.rotation;
          spinButton.rotation += Math.sign(diff) * Math.min(Math.abs(diff), spinBtnRotationSpeed);
        } else {
          spinButton.rotation = 0;
          spinBtnIsAnimating = false;
          spinBtnRotationPhase = null;
        }
      }
    }

    if (!isSpinning) {
      // --- Pulse animation for winning symbols ---
      if (pulsingSprites.length > 0) {
        pulseTicker += 0.05;
        const pulse = 1 + 0.1 * Math.sin(pulseTicker * 2 * Math.PI);
        for (const sprite of pulsingSprites) {
          sprite.scale.set(pulse, pulse);
        }
      }
      return;
    }

    let allStopped = true;

    for (const anim of reelAnimations) {
      if (!anim.spinning) continue;

      allStopped = false;
      const elapsed = performance.now() - anim.startTime;

      if (elapsed < anim.duration) {
        anim.container.y += anim.speed * app.ticker.deltaMS;
        if (anim.container.y > (SPRITE_SIZE + CELL_MARGIN) + computeGridOrigin(app.screen.width, app.screen.height).startY) {
          anim.container.y -= (SPRITE_SIZE + CELL_MARGIN);
        }
      } else {
        anim.spinning = false;
        anim.container.removeChildren();
        for (let row = 0; row < ROW_COUNT; row++) {
          const idx = anim.resultIndices[row];
          const symbol = new Sprite(Assets.get(SYMBOLS[idx].img));
          symbol.anchor.set(0.5);
          symbol.x = 0;
          symbol.y = row * (SPRITE_SIZE + CELL_MARGIN);
          const frame = new Sprite(Assets.get(SYMBOLS[idx].frame));
          frame.anchor.set(0.5);
          frame.x = symbol.x;
          frame.y = symbol.y;
          anim.container.addChild(symbol, frame);
          reels[anim.col][row] = { symbol, frame, finalIndex: idx };
        }
        anim.container.y = computeGridOrigin(app.screen.width, app.screen.height).startY;
      }
    }

    if (allStopped) {
      isSpinning = false;
      const resultIndices: number[][] = (spinButton as any)._finalResultIndices;
      const { winningPositions, winAmount } = getSpinResult(resultIndices);
      if (winAmount > 0) {
        balance += winAmount;
        updateBalanceText();
      }
      updateWinText(winAmount);

      // --- Pulse winning symbols ---
      clearPulsingSprites();
      for (const { col, row } of winningPositions) {
        if (reels[col] && reels[col][row] && reels[col][row].symbol) {
          pulsingSprites.push(reels[col][row].symbol);
        }
      }

      layoutEverything(app, spinButton, betText, balanceText, winText, reelColumns, gridMask);
    }
  });
})();