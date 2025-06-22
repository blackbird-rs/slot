import {
  Application,
  Assets,
  Sprite,
  Container,
  Graphics,
  Text,
} from "pixi.js";
import { SymbolCell, LayoutMode } from "./types";
import {
  REEL_COUNT,
  ROW_COUNT,
  SPRITE_SIZE,
  CELL_MARGIN,
  DESIGN_WIDTH,
  DESIGN_HEIGHT,
  getRandomSymbolIdx,
  getRandomColumnResult,
  setupGrid,
  computeGridOrigin,
  getWinningPositions,
} from "./slotGrid";
import { createTextFieldStyle } from "./ui";
import { calculateWinAmount } from "./logic";
import { AudioManager } from "./audioManager";

// Responsiveness stuff
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

const BACKGROUND_IMAGE = "/assets/bg.jpeg";
const SETTINGS_ICON = "/assets/settings.svg";
const SPIN_ICON = "/assets/spin.svg";

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

  await AudioManager.init();

  await Assets.load([
    BACKGROUND_IMAGE,
    SETTINGS_ICON,
    ...SYMBOLS.flatMap((s) => [s.img, s.frame]),
    SPIN_ICON,
  ]);

  const bgSprite = new Sprite(Assets.get(BACKGROUND_IMAGE));
  bgSprite.anchor.set(0);
  bgSprite.position.set(0, 0);
  app.stage.addChildAt(bgSprite, 0);

  function resizeBackground() {
    const screenW = app.screen.width;
    const screenH = app.screen.height;
    const texture = bgSprite.texture;
    const scaleX = screenW / texture.width;
    const scaleY = screenH / texture.height;
    const scale = Math.max(scaleX, scaleY);
    bgSprite.width = texture.width * scale;
    bgSprite.height = texture.height * scale;
    bgSprite.x = (screenW - bgSprite.width) / 2;
    bgSprite.y = (screenH - bgSprite.height) / 2;
  }

  let balance = INITIAL_BALANCE;

  // Slot Grid
  const gridMask = new Graphics();
  const reelContainer = new Container();
  app.stage.addChild(reelContainer);

  const reelColumns: Container[] = [];
  const reels: SymbolCell[][] = [];

  let layoutMode: LayoutMode = getLayoutMode(
    window.innerWidth,
    window.innerHeight,
  );
  let scale = getScale(window.innerWidth, window.innerHeight);

  setupGrid(SYMBOLS, reels, reelColumns, reelContainer, scale);

  // Spin Button
  const spinButton = new Sprite(Assets.get(SPIN_ICON));
  spinButton.anchor.set(0.5);
  spinButton.eventMode = "static";
  spinButton.cursor = "pointer";

  let spinBtnRotationPhase: 0 | 1 | null = null;
  let spinBtnRotationTarget = 0;
  let spinBtnRotationSpeed = 0;
  let spinBtnIsAnimating = false;

  // Settings Button
  const settingsButton = new Sprite(Assets.get(SETTINGS_ICON));
  settingsButton.anchor.set(1, 0); // top-right
  settingsButton.eventMode = "static";
  settingsButton.cursor = "pointer";
  app.stage.addChild(settingsButton);

  // Settings Popup
  const settingsPopup = new Container();
  settingsPopup.visible = false;
  const popupBg = new Graphics();
  const popupWidth = 320;
  const popupHeight = 180;
  popupBg.beginFill(0x222235, 0.98);
  popupBg.drawRoundedRect(0, 0, popupWidth, popupHeight, 32);
  popupBg.endFill();
  settingsPopup.addChild(popupBg);

  // Toggles
  let musicOn = true;
  let sfxOn = true;

  try {
    musicOn = localStorage.getItem("slot_musicOn") !== "false";
    sfxOn = localStorage.getItem("slot_sfxOn") !== "false";
  } catch {
    console.log("AudioManager error");
  }

  AudioManager.setMusicVolume(musicOn ? 0.5 : 0);
  AudioManager.setSfxVolume(sfxOn ? 1 : 0);
  if (!musicOn) {
    AudioManager.stopMusic();
  }

  function makeToggle(
    text: string,
    state: boolean,
    y: number,
    cb: (val: boolean) => void,
  ): Container {
    const cont = new Container();
    const lbl = new Text(text, {
      fill: "white",
      fontSize: 24,
      fontWeight: "bold",
    });
    lbl.x = 24;
    lbl.y = 0;
    cont.addChild(lbl);

    const box = new Graphics();
    function renderBox() {
      box.clear();
      box.lineStyle(3, 0xffffff, 0.7);
      box.beginFill(state ? 0x4ee44e : 0x222235, 1);
      box.drawRoundedRect(0, 0, 50, 36, 10);
      box.endFill();
      if (state) {
        box.lineStyle(0);
        box.beginFill(0xffffff);
        box.drawCircle(36, 18, 8);
        box.endFill();
      } else {
        box.lineStyle(0);
        box.beginFill(0xffffff);
        box.drawCircle(14, 18, 8);
        box.endFill();
      }
    }
    renderBox();
    box.x = popupWidth - 80;
    box.y = 0;
    box.eventMode = "static";
    box.cursor = "pointer";
    box.on("pointertap", () => {
      state = !state;
      renderBox();
      cb(state);
    });
    cont.addChild(box);
    cont.y = y;
    return cont;
  }

  // Music toggle
  const musicToggle = makeToggle("Music", musicOn, 30, (val) => {
    musicOn = val;
    AudioManager.setMusicVolume(musicOn ? 0.5 : 0);
    try {
      localStorage.setItem("slot_musicOn", String(musicOn));
    } catch {
      console.log("Music Toggle error");
    }
    if (musicOn) AudioManager.playMusic();
    else AudioManager.stopMusic();
  });

  // SFX toggle
  const sfxToggle = makeToggle("Sound Effects", sfxOn, 90, (val) => {
  sfxOn = val;
  AudioManager.setSfxVolume(sfxOn ? 1 : 0);
  try {
    localStorage.setItem("slot_sfxOn", String(sfxOn));
  } catch {
    console.log("SFX Toggle error");
  }
  if (!sfxOn) {
    AudioManager.stopLoop("win");
  }
});

  settingsPopup.addChild(musicToggle);
  settingsPopup.addChild(sfxToggle);

  // Close button
  const closeBtn = new Text("Close", {
    fill: "white",
    fontSize: 20,
    fontWeight: "bold",
  });
  closeBtn.anchor.set(0.5);
  closeBtn.eventMode = "static";
  closeBtn.cursor = "pointer";
  closeBtn.x = popupWidth / 2;
  closeBtn.y = popupHeight - 28;
  closeBtn.on("pointertap", () => {
    settingsPopup.visible = false;
  });
  settingsPopup.addChild(closeBtn);

  app.stage.addChild(settingsPopup);

  function layoutSettings() {
    const pad = 24 * scale;
    settingsButton.scale.set(scale * 0.2);
    settingsButton.x = app.screen.width - pad;
    settingsButton.y = pad;

    settingsPopup.x = (app.screen.width - popupWidth) / 2;
    settingsPopup.y = (app.screen.height - popupHeight) / 2;
    settingsPopup.zIndex = 100;
  }

  settingsButton.on("pointertap", () => {
    settingsPopup.visible = !settingsPopup.visible;
  });

  //Text Fields

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

  // Layout
  function getStackBaseY(scale: number): number {
    const spacingY = scale * (SPRITE_SIZE + CELL_MARGIN);
    const { startY } = computeGridOrigin(
      app.screen.width,
      app.screen.height,
      scale,
    );
    return startY + (ROW_COUNT - 1) * spacingY + (scale * SPRITE_SIZE) / 2;
  }

  function relayoutAll() {
    app.renderer.resize(window.innerWidth, window.innerHeight);

    resizeBackground();

    layoutMode = getLayoutMode(window.innerWidth, window.innerHeight);
    scale = getScale(window.innerWidth, window.innerHeight);

    textFieldStyle = createTextFieldStyle(scale);
    betText.style = textFieldStyle;
    balanceText.style = textFieldStyle;
    winText.style = textFieldStyle;

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
    const spacingX = scale * (SPRITE_SIZE + CELL_MARGIN);
    const { startX, startY } = computeGridOrigin(
      app.screen.width,
      app.screen.height,
      scale,
    );
    for (let col = 0; col < REEL_COUNT; col++) {
      reelColumns[col].x = startX + col * spacingX;
      reelColumns[col].y = startY;
    }

    spinButton.scale.set(scale);

    const stackBaseY = getStackBaseY(scale);
    let stackY = stackBaseY + 32 * scale;

    winText.x = app.screen.width / 2 - winText.width / 2;
    winText.y = stackY;
    stackY += winText.height + 16 * scale;

    const betBalanceGap = 24 * scale;
    const betBalanceWidth = betText.width + betBalanceGap + balanceText.width;
    betText.x = app.screen.width / 2 - betBalanceWidth / 2;
    betText.y = stackY;
    balanceText.x = betText.x + betText.width + betBalanceGap;
    balanceText.y = stackY;

    stackY += betText.height + 32 * scale;

    if (layoutMode === "mobile") {
      spinButton.x = app.screen.width / 2;
      spinButton.y = stackY + spinButton.height / 2;
    } else {
      spinButton.x = app.screen.width - spinButton.width / 2 - 32 * scale;
      spinButton.y = app.screen.height - spinButton.height / 2 - 32 * scale;
    }

    gridMask.clear();
    const maskX = startX - (scale * SPRITE_SIZE) / 2;
    const maskY = startY - (scale * SPRITE_SIZE) / 2;
    gridMask.beginFill(0xffffff);
    gridMask.drawRect(
      maskX,
      maskY,
      REEL_COUNT * scale * SPRITE_SIZE + (REEL_COUNT - 1) * scale * CELL_MARGIN,
      ROW_COUNT * scale * SPRITE_SIZE + (ROW_COUNT - 1) * scale * CELL_MARGIN,
    );
    gridMask.endFill();

    layoutSettings();
  }

  // Hacky, for inspector resizing
  const container = document.getElementById("pixi-container")!;
  const observer = new ResizeObserver(() => {
    app.renderer.resize(window.innerWidth, window.innerHeight);
    relayoutAll();
  });
  observer.observe(container);

  window.addEventListener("resize", () => {
    app.renderer.resize(window.innerWidth, window.innerHeight);
    relayoutAll();
  });

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

  document.addEventListener("visibilitychange", () => {
    app.renderer.resize(window.innerWidth, window.innerHeight);
    relayoutAll();
  });

  relayoutAll();

  // Play music only when something is clicked
  let musicStarted = false;
  function ensureMusic() {
    if (!musicStarted) {
      AudioManager.playMusic();
      musicStarted = true;
    }
  }
  window.addEventListener("pointerdown", ensureMusic, { once: true });

  spinButton.on("pointertap", () => {
    AudioManager.stopLoop("win");

    ensureMusic();

    if (isSpinning && !spinningFastForward) {
      spinningFastForward = true;
      return;
    }
    if (isSpinning) return;

    clearPulsingSprites();
    balance -= BET_AMOUNT;
    updateBalanceText();
    updateWinText(0);

    isSpinning = true;
    spinningFastForward = false;

    AudioManager.play("spin");
    AudioManager.playLoop("reel");

    spinBtnIsAnimating = true;
    spinBtnRotationPhase = 0;
    spinBtnRotationTarget = Math.PI * 0.6;
    spinBtnRotationSpeed = 0.13;

    const finalResultIndices: number[][] = [];
    reelAnimations = [];
    const spacingY = scale * (SPRITE_SIZE + CELL_MARGIN);
    const { startY } = computeGridOrigin(
      app.screen.width,
      app.screen.height,
      scale,
    );

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
        phase: "spinning",
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
    if (spinBtnIsAnimating && spinBtnRotationPhase !== null) {
      if (spinBtnRotationPhase === 0) {
        if (Math.abs(spinButton.rotation - spinBtnRotationTarget) > 0.01) {
          const diff = spinBtnRotationTarget - spinButton.rotation;
          spinButton.rotation +=
            Math.sign(diff) * Math.min(Math.abs(diff), spinBtnRotationSpeed);
        } else {
          spinButton.rotation = spinBtnRotationTarget;
          spinBtnRotationPhase = 1;
          spinBtnRotationTarget = 0;
        }
      } else if (spinBtnRotationPhase === 1) {
        if (Math.abs(spinButton.rotation) > 0.01) {
          const diff = 0 - spinButton.rotation;
          spinButton.rotation +=
            Math.sign(diff) * Math.min(Math.abs(diff), spinBtnRotationSpeed);
        } else {
          spinButton.rotation = 0;
          spinBtnIsAnimating = false;
          spinBtnRotationPhase = null;
        }
      }
    }

    let allDone = true;
    const spacingY = scale * (SPRITE_SIZE + CELL_MARGIN);
    const BOUNCE_AMOUNT = 36 * scale;
    const BOUNCE_BACK_AMOUNT = 12 * scale;
    const BOUNCE_OUT_TIME = 120;
    const BOUNCE_BACK_TIME = 110;

    for (const anim of reelAnimations) {
      if (anim.phase === "spinning") {
        allDone = false;
        if (
          spinningFastForward ||
          performance.now() - anim.startTime > anim.duration
        ) {
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
        const t = Math.min(
          1,
          (performance.now() - (anim.bounceStart ?? 0)) / BOUNCE_OUT_TIME,
        );
        anim.container.y =
          (anim.bounceFrom ?? 0) +
          ((anim.bounceTo ?? 0) - (anim.bounceFrom ?? 0)) *
            (1 - Math.pow(1 - t, 1.7));
        if (t >= 1) {
          anim.phase = "bouncingBack";
          anim.bounceStart = performance.now();
          anim.bounceFrom = anim.bounceTo;
          anim.bounceTo = anim.startGridY;
        }
      } else if (anim.phase === "bouncingBack") {
        allDone = false;
        const t = Math.min(
          1,
          (performance.now() - (anim.bounceStart ?? 0)) / BOUNCE_BACK_TIME,
        );
        anim.container.y =
          (anim.bounceFrom ?? 0) +
          ((anim.bounceTo ?? 0) - (anim.bounceFrom ?? 0)) * t;
        if (t >= 1) {
          anim.container.y = anim.bounceTo ?? anim.container.y;
          anim.phase = "done";
        }
      }
    }

    if (!isSpinning) {
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

      AudioManager.stopLoop("reel");

      const resultIndices: number[][] = (spinButton as any)._finalResultIndices;
      const winningPositions = getWinningPositions(resultIndices);

      const winAmount = calculateWinAmount(winningPositions);
      if (winAmount > 0) {
        balance += winAmount;
        updateBalanceText();
        AudioManager.playLoop("win");
      }
      updateWinText(winAmount);

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
