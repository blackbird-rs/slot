import { Application, Assets, Sprite, Container, Graphics, Text } from "pixi.js";
import { SymbolCell, LayoutMode } from "./types";
import {
  REEL_COUNT, ROW_COUNT, SPRITE_SIZE, CELL_MARGIN, DESIGN_WIDTH, DESIGN_HEIGHT,
  getRandomSymbolIdx, getRandomColumnResult, setupGrid, computeGridOrigin, getWinningPositions
} from "./slotGrid";
import { createTextFieldStyle } from "./ui";
import { calculateWinAmount } from "./logic";

// --- Responsive helpers ---
function getLayoutMode(width: number, height: number): LayoutMode {
  if (width < 700 || width < height * 1.05) return "mobile";
  return "desktop";
}
function getScale(width: number, height: number): number {
  return Math.min(1, width / DESIGN_WIDTH, height / DESIGN_HEIGHT);
}

const SYMBOLS = [
  { img: "/assets/sym1.png", frame: "/assets/sym1_frame.png" },
  { img: "/assets/sym2.png", frame: "/assets/sym2_frame.png" },
  { img: "/assets/sym3.png", frame: "/assets/sym3_frame.png" },
  { img: "/assets/sym4.png", frame: "/assets/sym4_frame.png" },
];

const BACKGROUND_IMAGE = "/assets/bg.jpeg"; // Place your background image here (see note below)

const SPIN_DURATION = 1100;
const BET_AMOUNT = 2;
const INITIAL_BALANCE = 1000;

type ReelAnimPhase = "spinning" | "bouncingOut" | "bouncingBack" | "done";
interface ReelAnim {
  startTime: number;
  spinning: boolean;
  col: number;
  resultIndices: number[];
  container: Container;
  speed: number;
  duration: number;
  startGridY: number;
  phase: ReelAnimPhase;
  bounceStart?: number;
  bounceFrom?: number;
  bounceTo?: number;
}

(async () => {
  const app = new Application();
  await app.init({ background: "#1099bb", resizeTo: window });
  document.getElementById("pixi-container")!.appendChild(app.canvas);

  // --- Load background image and game assets ---
  await Assets.load([
    BACKGROUND_IMAGE, // Make sure this file exists in your assets (see note below)
    ...SYMBOLS.flatMap(s => [s.img, s.frame]),
    "/assets/spin.svg"
  ]);

  // --- Background sprite setup ---
  const bgSprite = new Sprite(Assets.get(BACKGROUND_IMAGE));
  bgSprite.anchor.set(0);
  bgSprite.position.set(0, 0);
  app.stage.addChildAt(bgSprite, 0);

  function resizeBackground() {
    const screenW = app.screen.width;
    const screenH = app.screen.height;
    const texture = bgSprite.texture;
    //if (!texture.valid) return;

    // Stretch to cover (cover mode)
    const scaleX = screenW / texture.width;
    const scaleY = screenH / texture.height;
    const scale = Math.max(scaleX, scaleY);
    bgSprite.width = texture.width * scale;
    bgSprite.height = texture.height * scale;
    bgSprite.x = (screenW - bgSprite.width) / 2;
    bgSprite.y = (screenH - bgSprite.height) / 2;
  }

  let balance = INITIAL_BALANCE;

  // --- Slot Grid ---
  const gridMask = new Graphics();
  const reelContainer = new Container();
  app.stage.addChild(reelContainer);

  const reelColumns: Container[] = [];
  const reels: SymbolCell[][] = [];

  let layoutMode: LayoutMode = getLayoutMode(window.innerWidth, window.innerHeight);
  let scale = getScale(window.innerWidth, window.innerHeight);

  setupGrid(SYMBOLS, reels, reelColumns, reelContainer, scale);

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
  let textFieldStyle = createTextFieldStyle(scale);
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
      sprite.scale.set(scale, scale);
    }
    pulsingSprites = [];
    pulseTicker = 0;
  }

  let isSpinning = false;
  let spinningFastForward = false;
  let reelAnimations: ReelAnim[] = [];

  // Helper for layout
  function getStackBaseY(scale: number): number {
    // Bottom of grid
    const spacingY = scale * (SPRITE_SIZE + CELL_MARGIN);
    const { startY } = computeGridOrigin(app.screen.width, app.screen.height, scale);
    return startY + (ROW_COUNT - 1) * spacingY + scale * SPRITE_SIZE / 2;
  }

  function relayoutAll() {
    app.renderer.resize(window.innerWidth, window.innerHeight);

    // --- resize background ---
    resizeBackground();

    layoutMode = getLayoutMode(window.innerWidth, window.innerHeight);
    scale = getScale(window.innerWidth, window.innerHeight);

    // Update text style/font size
    textFieldStyle = createTextFieldStyle(scale);
    betText.style = textFieldStyle;
    balanceText.style = textFieldStyle;
    winText.style = textFieldStyle;

    // Update all grid symbols/frames scaling and position
    for (let col = 0; col < REEL_COUNT; col++) {
      for (let row = 0; row < ROW_COUNT; row++) {
        const cell = reels[col][row];
        if (cell) {
          cell.symbol.scale.set(scale);
          cell.frame.scale.set(scale);
          cell.symbol.y = row * scale * (SPRITE_SIZE + CELL_MARGIN);
          cell.frame.y = cell.symbol.y;
        }
      }
    }
    // Update reel columns' positions (for each reel)
    const spacingX = scale * (SPRITE_SIZE + CELL_MARGIN);
    const { startX, startY } = computeGridOrigin(app.screen.width, app.screen.height, scale);
    for (let col = 0; col < REEL_COUNT; col++) {
      reelColumns[col].x = startX + col * spacingX;
      reelColumns[col].y = startY;
    }

    // Update spin button scale
    spinButton.scale.set(scale);

    // --- UI vertical stack below grid ---
    const stackBaseY = getStackBaseY(scale);
    let stackY = stackBaseY + 32 * scale;

    // Win text (centered)
    winText.x = app.screen.width / 2 - winText.width / 2;
    winText.y = stackY;
    stackY += winText.height + 16 * scale;

    // Bet/Balance (side by side, centered as group)
    const betBalanceGap = 24 * scale;
    const betBalanceWidth = betText.width + betBalanceGap + balanceText.width;
    betText.x = app.screen.width / 2 - betBalanceWidth / 2;
    betText.y = stackY;
    balanceText.x = betText.x + betText.width + betBalanceGap;
    balanceText.y = stackY;

    stackY += betText.height + 32 * scale;

    if (layoutMode === "mobile") {
      // Spin button in stack, centered
      spinButton.x = app.screen.width / 2;
      spinButton.y = stackY + spinButton.height / 2;
    } else {
      // Spin button in bottom right
      spinButton.x = app.screen.width - spinButton.width / 2 - 32 * scale;
      spinButton.y = app.screen.height - spinButton.height / 2 - 32 * scale;
    }

    // Update grid mask
    gridMask.clear();
    const maskX = startX - scale * SPRITE_SIZE / 2;
    const maskY = startY - scale * SPRITE_SIZE / 2;
    gridMask.beginFill(0xffffff);
    gridMask.drawRect(
      maskX,
      maskY,
      REEL_COUNT * scale * SPRITE_SIZE + (REEL_COUNT - 1) * scale * CELL_MARGIN,
      ROW_COUNT * scale * SPRITE_SIZE + (ROW_COUNT - 1) * scale * CELL_MARGIN
    );
    gridMask.endFill();
  }

  // --- Resize observer for container (robust fix for inspector/devtools) ---
  const container = document.getElementById('pixi-container')!;
  const observer = new ResizeObserver(() => {
    app.renderer.resize(window.innerWidth, window.innerHeight);
    relayoutAll();
  });
  observer.observe(container);

  // Fallback in case of missed events
  window.addEventListener("resize", () => {
    app.renderer.resize(window.innerWidth, window.innerHeight);
    relayoutAll();
  });

  // Polling fallback for browser quirks (e.g. devtools close w/o resize)
  let lastW = window.innerWidth;
  let lastH = window.innerHeight;
  function checkResize() {
    if (window.innerWidth !== lastW || window.innerHeight !== lastH) {
      lastW = window.innerWidth;
      lastH = window.innerHeight;
      app.renderer.resize(window.innerWidth, window.innerHeight);
      relayoutAll();
    }
    requestAnimationFrame(checkResize);
  }
  checkResize();

  document.addEventListener('visibilitychange', () => {
    app.renderer.resize(window.innerWidth, window.innerHeight);
    relayoutAll();
  });

  relayoutAll();

  spinButton.on('pointertap', () => {
    if (isSpinning && !spinningFastForward) {
      // Fast forward if already spinning!
      spinningFastForward = true;
      return;
    }
    if (isSpinning) return; // ignore further clicks

    clearPulsingSprites();
    balance -= BET_AMOUNT;
    updateBalanceText();
    updateWinText(0);

    isSpinning = true;
    spinningFastForward = false;

    // --- Animate spin button rotation: to one side, then back ---
    spinBtnIsAnimating = true;
    spinBtnRotationPhase = 0;
    spinBtnRotationTarget = Math.PI * 0.6;
    spinBtnRotationSpeed = 0.13;

    const finalResultIndices: number[][] = [];
    reelAnimations = [];
    const spacingY = scale * (SPRITE_SIZE + CELL_MARGIN);
    const { startY } = computeGridOrigin(app.screen.width, app.screen.height, scale);

    for (let col = 0; col < REEL_COUNT; col++) {
      const resultIndices = getRandomColumnResult(SYMBOLS);
      finalResultIndices[col] = resultIndices;
      const baseSpeed = spacingY * 0.0125;
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
        startGridY: startY,
        phase: "spinning"
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
        symbol.y = (i - 1) * spacingY;
        symbol.scale.set(scale);

        const frame = new Sprite(Assets.get(SYMBOLS[idx].frame));
        frame.anchor.set(0.5);
        frame.x = symbol.x;
        frame.y = symbol.y;
        frame.scale.set(scale);

        colSprites.addChild(symbol, frame);
      }
      colSprites.y = startY;
    }

    (spinButton as any)._finalResultIndices = finalResultIndices;
  });

  reelContainer.mask = gridMask;
  app.stage.addChild(gridMask);

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

    // --- Reel spinning, bounce, and fast forward ---
    let allDone = true;
    const spacingY = scale * (SPRITE_SIZE + CELL_MARGIN);
    const BOUNCE_AMOUNT = 36 * scale;          // more expressive overshoot
    const BOUNCE_BACK_AMOUNT = 12 * scale;     // expressive reverse
    const BOUNCE_OUT_TIME = 120;               // ms
    const BOUNCE_BACK_TIME = 110;              // ms

    for (const anim of reelAnimations) {
      if (anim.phase === "spinning") {
        allDone = false;
        if (spinningFastForward || (performance.now() - anim.startTime > anim.duration)) {
          // Snap to result and start first bounce (overshoot)
          anim.spinning = false;
          anim.container.removeChildren();
          for (let row = 0; row < ROW_COUNT; row++) {
            const idx = anim.resultIndices[row];
            const symbol = new Sprite(Assets.get(SYMBOLS[idx].img));
            symbol.anchor.set(0.5);
            symbol.x = 0;
            symbol.y = row * spacingY;
            symbol.scale.set(scale);
            const frame = new Sprite(Assets.get(SYMBOLS[idx].frame));
            frame.anchor.set(0.5);
            frame.x = symbol.x;
            frame.y = symbol.y;
            frame.scale.set(scale);
            anim.container.addChild(symbol, frame);
            reels[anim.col][row] = { symbol, frame, finalIndex: idx };
          }
          anim.container.y = anim.startGridY + BOUNCE_AMOUNT;
          anim.phase = "bouncingOut";
          anim.bounceStart = performance.now();
          anim.bounceFrom = anim.startGridY + BOUNCE_AMOUNT;
          anim.bounceTo = anim.startGridY - BOUNCE_BACK_AMOUNT;
        } else {
          anim.container.y += anim.speed * app.ticker.deltaMS;
          if (anim.container.y > anim.startGridY + spacingY) {
            anim.container.y -= spacingY;
          }
        }
      } else if (anim.phase === "bouncingOut") {
        allDone = false;
        const t = Math.min(1, (performance.now() - (anim.bounceStart ?? 0)) / BOUNCE_OUT_TIME);
        anim.container.y = (anim.bounceFrom ?? 0) + ((anim.bounceTo ?? 0) - (anim.bounceFrom ?? 0)) * (1 - Math.pow(1 - t, 1.7));
        if (t >= 1) {
          anim.phase = "bouncingBack";
          anim.bounceStart = performance.now();
          anim.bounceFrom = anim.bounceTo;
          anim.bounceTo = anim.startGridY;
        }
      } else if (anim.phase === "bouncingBack") {
        allDone = false;
        const t = Math.min(1, (performance.now() - (anim.bounceStart ?? 0)) / BOUNCE_BACK_TIME);
        anim.container.y = (anim.bounceFrom ?? 0) + ((anim.bounceTo ?? 0) - (anim.bounceFrom ?? 0)) * t;
        if (t >= 1) {
          anim.container.y = anim.bounceTo ?? anim.container.y;
          anim.phase = "done";
        }
      }
    }

    if (!isSpinning) {
      // --- Pulse animation for winning symbols ---
      if (pulsingSprites.length > 0) {
        pulseTicker += 0.05;
        const pulse = 1 + 0.1 * Math.sin(pulseTicker * 2 * Math.PI);
        for (const sprite of pulsingSprites) {
          sprite.scale.set(scale * pulse, scale * pulse);
        }
      }
      return;
    }

    if (allDone && isSpinning) {
      isSpinning = false;
      spinningFastForward = false;
      // --- Show win ---
      const resultIndices: number[][] = (spinButton as any)._finalResultIndices;
      const winningPositions = getWinningPositions(resultIndices);

      // $1 per unique winning symbol (max 9)
      const winAmount = calculateWinAmount(winningPositions);
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
      relayoutAll();
    }
  });
})();