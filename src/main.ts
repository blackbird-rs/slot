import { Application, Assets, Sprite, Container, Graphics, Text, TextStyle } from "pixi.js";

const SYMBOLS = [
  { img: "/assets/sym1.png", frame: "/assets/sym1_frame.png" },
  { img: "/assets/sym2.png", frame: "/assets/sym2_frame.png" },
  { img: "/assets/sym3.png", frame: "/assets/sym3_frame.png" },
  { img: "/assets/sym4.png", frame: "/assets/sym4_frame.png" },
];

const REEL_COUNT = 3;
const ROW_COUNT = 3;
const SPRITE_SIZE = 200;
const CELL_MARGIN = 32;
const SPIN_MARGIN = 32;
const SPIN_DURATION = 1100;

const BET_AMOUNT = 2;
const INITIAL_BALANCE = 1000;

type SymbolCell = { symbol: Sprite, frame: Sprite, finalIndex: number };

function getRandomSymbolIdx() {
  return Math.floor(Math.random() * SYMBOLS.length);
}
function getRandomColumnResult(): number[] {
  return Array.from({ length: ROW_COUNT }, getRandomSymbolIdx);
}

// Helper to find winning symbol positions for pulsing after win
function getWinningPositions(resultIndices: number[][]): {col: number, row: number}[] {
  const winning: {col: number, row: number}[] = [];
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
        // Add all involved positions
        for (let j = 0; j < count; j++) {
          winning.push({col: col + j, row});
        }
        col += count; // skip over this streak
      } else {
        col++;
      }
    }
  }
  return winning;
}

(async () => {
  const app = new Application();
  await app.init({ background: "#1099bb", resizeTo: window });
  document.getElementById("pixi-container")!.appendChild(app.canvas);

  await Assets.load([
    ...SYMBOLS.flatMap(s => [s.img, s.frame]),
    "/assets/spin.svg"
  ]);

  let balance = INITIAL_BALANCE;

  const gridMask = new Graphics();
  const reelContainer = new Container();
  app.stage.addChild(reelContainer);

  const reelColumns: Container[] = [];
  const reels: SymbolCell[][] = [];

  const spacingX = SPRITE_SIZE + CELL_MARGIN;
  const spacingY = SPRITE_SIZE + CELL_MARGIN;
  const totalWidth = (REEL_COUNT - 1) * spacingX;
  const totalHeight = (ROW_COUNT - 1) * spacingY;

  function computeGridOrigin() {
    return {
      startX: (app.screen.width - totalWidth - SPRITE_SIZE) / 2 + SPRITE_SIZE / 2,
      startY: (app.screen.height - totalHeight - SPRITE_SIZE) / 2 + SPRITE_SIZE / 2,
    };
  }

  function drawGridMask() {
    const { startX, startY } = computeGridOrigin();
    gridMask.clear();
    gridMask.beginFill(0xffffff);
    gridMask.drawRect(
      startX - SPRITE_SIZE / 2,
      startY - SPRITE_SIZE / 2,
      REEL_COUNT * SPRITE_SIZE + (REEL_COUNT - 1) * CELL_MARGIN,
      ROW_COUNT * SPRITE_SIZE + (ROW_COUNT - 1) * CELL_MARGIN,
    );
    gridMask.endFill();
  }

  // Initialize grid
  const { startX, startY } = computeGridOrigin();
  for (let col = 0; col < REEL_COUNT; col++) {
    const colContainer = new Container();
    colContainer.x = startX + col * spacingX;
    colContainer.y = startY;
    reelContainer.addChild(colContainer);
    reelColumns.push(colContainer);
    reels[col] = [];
    for (let row = 0; row < ROW_COUNT; row++) {
      const symbolIndex = getRandomSymbolIdx();
      const symbol = new Sprite(Assets.get(SYMBOLS[symbolIndex].img));
      symbol.anchor.set(0.5);
      symbol.x = 0;
      symbol.y = row * spacingY;

      const frame = new Sprite(Assets.get(SYMBOLS[symbolIndex].frame));
      frame.anchor.set(0.5);
      frame.x = symbol.x;
      frame.y = symbol.y;
      colContainer.addChild(symbol, frame);
      reels[col][row] = { symbol, frame, finalIndex: symbolIndex };
    }
  }

  // --- Spin Button ---
  const spinButton = new Sprite(Assets.get("/assets/spin.svg"));
  spinButton.anchor.set(0.5);
  spinButton.eventMode = 'static';
  spinButton.cursor = 'pointer';

  // --- Spin Button Rotation Animation State ---
  let spinBtnRotationPhase: 0 | 1 | null = null; // 0 = to side, 1 = back to 0, null = not animating
  let spinBtnRotationTarget = 0;
  let spinBtnRotationSpeed = 0;
  let spinBtnIsAnimating = false;

  // --- Text Styles ---
  const textFieldStyle = new TextStyle({
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

  const betText = new Text(`Bet: $${BET_AMOUNT}`, textFieldStyle);
  const balanceText = new Text(`Balance: $${balance}`, textFieldStyle);
  const winText = new Text(``, textFieldStyle);

  app.stage.addChild(betText, balanceText, winText, spinButton);

  function updateBalanceText() {
    balanceText.text = `Balance: $${balance}`;
  }
  function updateWinText(winAmount: number) {
    if (winAmount > 0) {
      winText.text = `You won $${winAmount}!`;
    } else {
      winText.text = "";
    }
  }

  function layoutEverything() {
    const { startX, startY } = computeGridOrigin();

    // --- Layout spin button in bottom right ---
    spinButton.x = app.screen.width - spinButton.width / 2 - SPIN_MARGIN;
    spinButton.y = app.screen.height - spinButton.height / 2 - SPIN_MARGIN;

    // --- Layout bet & balance group centered and in line with spin button ---
    const betBalanceGap = 48;
    const betBalanceY = spinButton.y - betText.height / 2;

    // Compute total width of bet+gap+balance as a group
    const betBalanceTotalWidth = betText.width + betBalanceGap + balanceText.width;
    const availableWidth = spinButton.x - SPIN_MARGIN - betBalanceTotalWidth / 2;
    // Center group horizontally, but don't overlap spin button
    let groupCenterX = app.screen.width / 2;
    const groupRightEdge = groupCenterX + betBalanceTotalWidth / 2;
    const spinBtnLeftEdge = spinButton.x - spinButton.width / 2;
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
    const gridBottomY = startY + (ROW_COUNT - 1) * spacingY + SPRITE_SIZE / 2;
    const winTextBottom = betText.y - 24;
    let winTextY = gridBottomY + 16;
    if (winTextBottom > winTextY + winText.height) {
      winTextY = winTextBottom - winText.height;
    }
    winText.y = winTextY;

    // --- Layout grid ---
    for (let col = 0; col < REEL_COUNT; col++) {
      reelColumns[col].x = startX + col * spacingX;
      reelColumns[col].y = startY;
    }

    drawGridMask();
  }

  function calculateWin(resultIndices: number[][]): number {
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

  // --- PULSE ANIMATION ---
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
    spinBtnRotationTarget = Math.PI * 0.6; // ~108 deg to the right
    spinBtnRotationSpeed = 0.13; // Radians per frame (tweak for speed)

    const finalResultIndices: number[][] = [];
    reelAnimations = [];
    for (let col = 0; col < REEL_COUNT; col++) {
      const resultIndices = getRandomColumnResult();
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
      });

      const colSprites = reelColumns[col];
      colSprites.removeChildren();

      const displayOrder = [];
      displayOrder.push(getRandomSymbolIdx());
      for (let i = 0; i < ROW_COUNT; i++) displayOrder.push(resultIndices[i]);
      displayOrder.push(getRandomSymbolIdx());

      for (let i = 0; i < displayOrder.length; i++) {
        const idx = displayOrder[i];
        const symbol = new Sprite(Assets.get(SYMBOLS[idx].img));
        symbol.anchor.set(0.5);
        symbol.x = 0;
        symbol.y = (i - 1) * spacingY;

        const frame = new Sprite(Assets.get(SYMBOLS[idx].frame));
        frame.anchor.set(0.5);
        frame.x = symbol.x;
        frame.y = symbol.y;

        colSprites.addChild(symbol, frame);
      }
    }

    (spinButton as any)._finalResultIndices = finalResultIndices;
  });

  drawGridMask();
  reelContainer.mask = gridMask;
  app.stage.addChild(gridMask);

  window.addEventListener("resize", () => {
    layoutEverything();
    app.stage.setChildIndex(gridMask, app.stage.children.length - 1);
  });

  layoutEverything();

  app.ticker.add(() => {
    // --- Spin button rotation animation (to one side, then back) ---
    if (spinBtnIsAnimating && spinBtnRotationPhase !== null) {
      if (spinBtnRotationPhase === 0) {
        // Rotating to target
        if (Math.abs(spinButton.rotation - spinBtnRotationTarget) > 0.01) {
          const diff = spinBtnRotationTarget - spinButton.rotation;
          spinButton.rotation += Math.sign(diff) * Math.min(Math.abs(diff), spinBtnRotationSpeed);
        } else {
          spinButton.rotation = spinBtnRotationTarget;
          spinBtnRotationPhase = 1;
          spinBtnRotationTarget = 0; // Rotate back to zero
        }
      } else if (spinBtnRotationPhase === 1) {
        // Rotating back to original
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
        if (anim.container.y > spacingY + computeGridOrigin().startY) {
          anim.container.y -= spacingY;
        }
      } else {
        anim.spinning = false;
        anim.container.removeChildren();
        for (let row = 0; row < ROW_COUNT; row++) {
          const idx = anim.resultIndices[row];
          const symbol = new Sprite(Assets.get(SYMBOLS[idx].img));
          symbol.anchor.set(0.5);
          symbol.x = 0;
          symbol.y = row * spacingY;
          const frame = new Sprite(Assets.get(SYMBOLS[idx].frame));
          frame.anchor.set(0.5);
          frame.x = symbol.x;
          frame.y = symbol.y;
          anim.container.addChild(symbol, frame);
          reels[anim.col][row] = { symbol, frame, finalIndex: idx };
        }
        anim.container.y = computeGridOrigin().startY;
      }
    }

    if (allStopped) {
      isSpinning = false;
      const resultIndices: number[][] = (spinButton as any)._finalResultIndices;
      const winAmount = calculateWin(resultIndices);
      if (winAmount > 0) {
        balance += winAmount;
        updateBalanceText();
      }
      updateWinText(winAmount);

      // --- Pulse winning symbols ---
      clearPulsingSprites();
      const winningPositions = getWinningPositions(resultIndices);
      for (const {col, row} of winningPositions) {
        if (
          reels[col] && reels[col][row] && reels[col][row].symbol
        ) {
          pulsingSprites.push(reels[col][row].symbol);
        }
      }

      layoutEverything();
    }
  });
})();