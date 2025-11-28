"use client";

import { useState, useEffect, useRef } from "react";
import { sdk } from "@farcaster/miniapp-sdk";
import styles from "./game.module.css";

const SIZE = 4;

export default function Game() {
  const [grid, setGrid] = useState<number[][]>([]);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [visuals, setVisuals] = useState<{ [key: string]: { r: number; c: number; value: number; id: number } }>({});
  const nextIdRef = useRef(1);
  const boardRef = useRef<HTMLDivElement>(null);

  // Initialize game
  useEffect(() => {
    // migrate legacy best score key if present
    const legacyKey = localStorage.getItem("2048_best");
    const newKey = localStorage.getItem("number_puzzle_best");
    let savedBest = 0;
    if (newKey) {
      savedBest = Number(newKey || 0);
    } else if (legacyKey) {
      savedBest = Number(legacyKey || 0);
      try {
        localStorage.setItem("number_puzzle_best", savedBest.toString());
      } catch {}
    }
    setBest(savedBest);
    initNewGame();

    // Initialize Farcaster SDK
    (async () => {
      try {
        await sdk.actions.ready();
      } catch (err) {
        console.warn("Farcaster SDK not available:", err);
      }
    })();
  }, []);

  const createEmptyGrid = () => {
    return Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => 0));
  };

  const getTilePosition = (r: number, c: number) => {
    const gap = 12;
    const boardWidth = boardRef.current?.clientWidth || 340;
    const totalGap = gap * (SIZE - 1);
    const inner = boardWidth - totalGap - 24;
    const cell = Math.floor(inner / SIZE);
    const left = c * (cell + gap);
    const top = r * (cell + gap);
    return { left, top, size: cell };
  };

  const addRandomTile = (currentGrid: number[][]) => {
    const empty: [number, number][] = [];
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (currentGrid[r][c] === 0) empty.push([r, c]);
      }
    }
    if (empty.length === 0) return currentGrid;

    const [r, c] = empty[Math.floor(Math.random() * empty.length)];
    const newGrid = currentGrid.map((row) => [...row]);
    newGrid[r][c] = Math.random() < 0.9 ? 2 : 4;

    const id = nextIdRef.current++;
    setVisuals((prev) => ({
      ...prev,
      [id]: { r, c, value: newGrid[r][c], id },
    }));

    return newGrid;
  };

  const slideRowLeft = (row: number[]) => {
    const arr = row.filter((v) => v !== 0);
    let gained = 0;
    for (let i = 0; i < arr.length - 1; i++) {
      if (arr[i] === arr[i + 1]) {
        arr[i] *= 2;
        gained += arr[i];
        arr.splice(i + 1, 1);
      }
    }
    while (arr.length < SIZE) arr.push(0);
    return { newRow: arr, gained };
  };

  const arraysEqual = (a: number[], b: number[]) => {
    return a.length === b.length && a.every((v, i) => v === b[i]);
  };

  const moveLeft = (currentGrid: number[][]) => {
    let moved = false;
    let gain = 0;
    const newGrid = currentGrid.map((row) => {
      const { newRow, gained } = slideRowLeft(row);
      if (!arraysEqual(newRow, row)) {
        moved = true;
        gain += gained;
      }
      return newRow;
    });

    if (gain > 0) {
      setScore((prev) => {
        const newScore = prev + gain;
        if (newScore > best) {
          setBest(newScore);
          localStorage.setItem("2048_best", newScore.toString());
        }
        return newScore;
      });
    }

    return { moved, newGrid };
  };

  const moveRight = (currentGrid: number[][]) => {
    let moved = false;
    let gain = 0;
    const newGrid = currentGrid.map((row) => {
      const rev = [...row].reverse();
      const { newRow, gained } = slideRowLeft(rev);
      const out = newRow.reverse();
      if (!arraysEqual(out, row)) {
        moved = true;
        gain += gained;
      }
      return out;
    });

    if (gain > 0) {
      setScore((prev) => {
        const newScore = prev + gain;
        if (newScore > best) {
          setBest(newScore);
          localStorage.setItem("2048_best", newScore.toString());
        }
        return newScore;
      });
    }

    return { moved, newGrid };
  };

  const transpose = (m: number[][]) => {
    return m[0].map((_, i) => m.map((row) => row[i]));
  };

  const moveUp = (currentGrid: number[][]) => {
    const transposed = transpose(currentGrid);
    const { moved, newGrid: newTransposed } = moveLeft(transposed);
    return { moved, newGrid: transpose(newTransposed) };
  };

  const moveDown = (currentGrid: number[][]) => {
    const transposed = transpose(currentGrid);
    const { moved, newGrid: newTransposed } = moveRight(transposed);
    return { moved, newGrid: transpose(newTransposed) };
  };

  const hasMoves = (currentGrid: number[][]) => {
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (currentGrid[r][c] === 0) return true;
      }
    }
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE - 1; c++) {
        if (currentGrid[r][c] === currentGrid[r][c + 1]) return true;
      }
    }
    for (let c = 0; c < SIZE; c++) {
      for (let r = 0; r < SIZE - 1; r++) {
        if (currentGrid[r][c] === currentGrid[r + 1][c]) return true;
      }
    }
    return false;
  };

  const checkWin = (currentGrid: number[][]) => {
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (currentGrid[r][c] === 2048) return true;
      }
    }
    return false;
  };

  const handleMove = (moveFunc: (g: number[][]) => { moved: boolean; newGrid: number[][] }) => {
    if (gameOver || won) return;

    const { moved, newGrid } = moveFunc(grid);
    if (!moved) return;

    setGrid(newGrid);
    setVisuals({});

    setTimeout(() => {
      const gridWithTile = addRandomTile(newGrid);
      setGrid(gridWithTile);

      if (checkWin(gridWithTile)) {
        setWon(true);
      } else if (!hasMoves(gridWithTile)) {
        setGameOver(true);
      }
    }, 160);
  };

  const initNewGame = () => {
    const newGrid = createEmptyGrid();
    const withFirstTile = addRandomTile(newGrid);
    const withSecondTile = addRandomTile(withFirstTile);
    setGrid(withSecondTile);
    setScore(0);
    setGameOver(false);
    setWon(false);
    setVisuals({});
    nextIdRef.current = 1;
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
        e.preventDefault();
      }
      switch (e.key) {
        case "ArrowLeft":
          handleMove(moveLeft);
          break;
        case "ArrowRight":
          handleMove(moveRight);
          break;
        case "ArrowUp":
          handleMove(moveUp);
          break;
        case "ArrowDown":
          handleMove(moveDown);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [grid, gameOver, won]);

  // Touch / pointer swipe handling
  useEffect(() => {
    const board = boardRef.current;
    if (!board) return;

    let startX = 0;
    let startY = 0;
    let isPointer = false;

    const threshold = 30; // min px for swipe

    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0];
      startX = t.clientX;
      startY = t.clientY;
    };

    const onTouchEnd = (e: TouchEvent) => {
      const t = e.changedTouches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > threshold) {
        if (dx > 0) handleMove(moveRight);
        else handleMove(moveLeft);
      } else if (Math.abs(dy) > threshold) {
        if (dy > 0) handleMove(moveDown);
        else handleMove(moveUp);
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      isPointer = true;
      startX = e.clientX;
      startY = e.clientY;
      (board as HTMLElement).setPointerCapture?.(e.pointerId);
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!isPointer) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > threshold) {
        if (dx > 0) handleMove(moveRight);
        else handleMove(moveLeft);
      } else if (Math.abs(dy) > threshold) {
        if (dy > 0) handleMove(moveDown);
        else handleMove(moveUp);
      }
      isPointer = false;
    };

    board.addEventListener("touchstart", onTouchStart, { passive: true });
    board.addEventListener("touchend", onTouchEnd);
    board.addEventListener("pointerdown", onPointerDown);
    board.addEventListener("pointerup", onPointerUp);

    return () => {
      board.removeEventListener("touchstart", onTouchStart);
      board.removeEventListener("touchend", onTouchEnd);
      board.removeEventListener("pointerdown", onPointerDown);
      board.removeEventListener("pointerup", onPointerUp);
    };
  }, [grid, gameOver, won]);

  const shareScore = async () => {
    const text = `I scored ${score} in Number Puzzle Game — can you beat me?`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Number Puzzle Game", text, url: location.href });
        return;
      }
      await navigator.clipboard.writeText(text);
      alert("Score copied to clipboard!");
    } catch (err) {
      console.warn("Share failed:", err);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Number Puzzle Game</h1>
        <div className={styles.scores}>
          <div className={styles.scoreBox}>
            <div className={styles.scoreLabel}>Score</div>
            <div className={styles.scoreValue}>{score}</div>
          </div>
          <div className={styles.scoreBox}>
            <div className={styles.scoreLabel}>Best</div>
            <div className={styles.scoreValue}>{best}</div>
          </div>
        </div>
      </div>

      <div className={styles.controls}>
        <button className={styles.button} onClick={initNewGame}>
          Restart
        </button>
        <button className={styles.button} onClick={shareScore}>
          Share
        </button>
      </div>

      <div className={styles.board} ref={boardRef}>
        {grid.map((row, r) =>
          row.map((value, c) =>
            value !== 0 ? (
              <div
                key={`${r}-${c}`}
                className={`${styles.tile} ${styles[`v${value}`]}`}
                style={{
                  gridRow: r + 1,
                  gridColumn: c + 1,
                }}
              >
                {value}
              </div>
            ) : null
          )
        )}
      </div>

      {gameOver && (
        <div className={styles.modal}>
          <div className={styles.dialog}>
            <h2>Game Over</h2>
            <p>No more moves available.</p>
            <button className={styles.button} onClick={initNewGame}>
              Try Again
            </button>
          </div>
        </div>
      )}

      {won && (
        <div className={styles.modal}>
          <div className={styles.dialog}>
            <h2>You Win! 🎉</h2>
            <p>You reached the target tile!</p>
            <button className={styles.button} onClick={initNewGame}>
              Play Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
