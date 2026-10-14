# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Vanilla JS Tetris (HTML5 Canvas). No dependencies, no build step, no package.json, no tests, no linter. README and UI text are in Spanish; keep user-facing strings in Spanish.

## Running

Open `index.html` directly, or serve statically (e.g. `python -m http.server 8000`) and visit `http://localhost:8000`.

## Architecture

Three files: `index.html` (canvas `#board` 300x600, `#next-canvas` 120x120, HUD spans, `#overlay`), `style.css`, and `game.js` (all logic, loaded as a plain script with `'use strict'`).

`game.js` is one flat script with module-level mutable state (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval`, ...) declared in a single `let` and reset by `init()`.

- **Board**: `ROWS x COLS` grid of ints; `0` is empty, `1-7` index into both `COLORS` and `PIECES`. Piece shapes embed their own color index as cell values, so `merge()` writes them straight into the board.
- **Game loop**: `requestAnimationFrame` `loop()` accumulates `dropAccum` and gravity-drops when it exceeds `dropInterval`; `draw()` runs every frame. Pause/game-over stop it via `cancelAnimationFrame(animId)`; `togglePause` and `init` restart it.
- **Piece flow**: `lockPiece()` -> `merge()` -> `clearLines()` -> `spawn()`. `spawn()` promotes `next`, generates a new one, and calls `endGame()` if the spawn position collides.
- **Rotation**: `rotateCW` + `tryRotate` with simple horizontal kicks `[0,-1,1,-2,2]` (not SRS). Pieces are random (no 7-bag).
- **Scoring/level**: `LINE_SCORES * level`; level = `lines/10 + 1`; `dropInterval = max(100, 1000 - (level-1)*90)`. Soft drop +1/cell, hard drop +2/cell.
- **Input**: single `keydown` listener (arrows, `X` rotate, `Space` hard drop, `P` pause); it calls `updateHUD()` after every key. Note `softDrop`/`hardDrop` mutate score, so HUD refresh relies on that call or `clearLines`.
- **Ghost piece** is drawn in `draw()` via `ghostY()` with alpha 0.2.

Keep the README's controls/feature list in sync when changing behavior.
