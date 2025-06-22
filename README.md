# Slot

A slot machine game built with [PixiJS](https://pixijs.com/), TypeScript, and HTML5. 

## Features

- Responsive design (desktop & mobile)
- Animated slot reels
- Animation cancelation with spin button for quicker play
- Sound effects and background music (toggleable)
- Win calculation logic based on matching symbols
- Settings popup
- Clean modular code

---

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/blackbird-rs/slot.git
cd slot
```

### 2. Install Dependencies

This project uses [npm](https://www.npmjs.com/).  
If you don’t have it, [install Node.js](https://nodejs.org/).

```bash
npm install
```

### 3. Run the Development Server

```bash
npm run dev
```

This will serve the project with hot reload (using [Vite](https://vitejs.dev/) or similar).  
Open [http://localhost:5173](http://localhost:5173) (or the port displayed in your terminal) to play.

---

## Building for Production

```bash
npm run build
```

The static site will be output to the `dist/` folder. To run:

```bash
npm install -g serve
serve dist
```

---

## Directory Structure

```
.
├── assets/         # Images and sound assets 
├── src/            # TypeScript source code
│   ├── main.ts
│   ├── audioManager.ts
│   ├── slotGrid.ts
│   ├── logic.ts
│   ├── types.ts
│   └── ui.ts
├── style.css
├── index.html
└── README.md
```

---

## Asset Requirements

- Place all images (symbols, frames, backgrounds, icons) in `/assets/`
- Place all sound files (`.mp3`/`.wav`) in `/assets/`
- Update asset paths in the code if you change file names

---

## Customization

- To change slot graphics, update image files in `/assets/` and update the `SYMBOLS` array in `src/main.ts`
- To add or change sound effects, update `/assets/` and `src/audioManager.ts`

---

## Win Calculations

- Win logic is handled in `src/logic.ts` and `src/slotGrid.ts`.
- The win amount is calculated based on the number of matching symbols in a row.

---
