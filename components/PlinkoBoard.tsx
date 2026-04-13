"use client";
import { useRef, useEffect, useCallback } from "react";

export interface PegData { leftBias: number; }
export type PegMap = PegData[][];
export type PathDecision = "L" | "R";

interface Props {
  pegMap: PegMap | null;
  path: PathDecision[] | null;
  dropColumn: number;
  rows?: number;
  isAnimating: boolean;
  isGolden?: boolean;
  showDebug?: boolean;
  onAnimationComplete?: (binIndex: number) => void;
  onPegTick?: () => void;
  reducedMotion?: boolean;
}

const ROWS = 12;
const COLS = ROWS + 1; // 13 bins
const BALL_RADIUS = 7;
const PEG_RADIUS = 5;

// Paytable multipliers
const PAYTABLE = [16, 9, 4, 2, 1.5, 1.2, 1.0, 1.2, 1.5, 2, 4, 9, 16];

// Bin colors: edges = gold, middle = blue
function binColor(i: number): string {
  const dist = Math.abs(i - 6);
  if (dist >= 5) return "#f5c518";
  if (dist >= 3) return "#ff6b00";
  if (dist >= 1) return "#00e5ff";
  return "#00ff88";
}

export default function PlinkoBoard({
  pegMap,
  path,
  dropColumn,
  rows = ROWS,
  isAnimating,
  isGolden = false,
  showDebug = false,
  onAnimationComplete,
  onPegTick,
  reducedMotion = false,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number | null>(null);
  const stateRef = useRef({
    ballX: 0,
    ballY: 0,
    targetX: 0,
    targetY: 0,
    row: -1,
    step: 0,
    pos: 0, // number of R moves
    done: false,
    pulsingBin: -1,
  });

  // Compute layout from canvas size
  const getLayout = useCallback((w: number, h: number) => {
    const topPad = 60;
    const botPad = 80;
    const sidePad = 30;
    const usableH = h - topPad - botPad;
    const usableW = w - sidePad * 2;
    const rowGap = usableH / (rows + 1);
    const colGap = usableW / (COLS - 1);

    // Peg at row r, peg p (0-based). Row r has r+1 pegs, centred.
    const pegX = (r: number, p: number) => {
      const startX = sidePad + (usableW - r * colGap) / 2;
      return startX + p * colGap;
    };
    const pegY = (r: number) => topPad + (r + 1) * rowGap;
    const binX = (i: number) => sidePad + i * colGap;
    const binY = () => h - botPad;

    return { topPad, botPad, sidePad, rowGap, colGap, usableW, pegX, pegY, binX, binY };
  }, [rows]);

  // Draw static board (pegs + bins), no ball
  const drawBoard = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number, pulsingBin = -1) => {
    ctx.clearRect(0, 0, w, h);
    const layout = getLayout(w, h);
    const { pegX, pegY, binX, binY, colGap } = layout;

    // Background
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "#050508");
    grad.addColorStop(1, "#0d0d18");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Title
    ctx.fillStyle = "#f5c518";
    ctx.font = "bold 14px Orbitron, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("PLINKO LAB", w / 2, 22);

    // Pegs
    if (pegMap) {
      for (let r = 0; r < rows; r++) {
        const pegsInRow = r + 1;
        for (let p = 0; p < pegsInRow; p++) {
          const x = pegX(r, p);
          const y = pegY(r);
          const bias = pegMap[r]?.[p]?.leftBias ?? 0.5;

          // Debug: show bias as color
          if (showDebug) {
            ctx.fillStyle = `hsl(${bias * 120}, 100%, 50%)`;
            ctx.font = "7px monospace";
            ctx.textAlign = "center";
            ctx.fillText(bias.toFixed(2), x, y - 9);
          }

          ctx.beginPath();
          ctx.arc(x, y, PEG_RADIUS, 0, Math.PI * 2);
          const pegGrad = ctx.createRadialGradient(x - 1, y - 1, 0, x, y, PEG_RADIUS);
          pegGrad.addColorStop(0, "#ffffff");
          pegGrad.addColorStop(1, "#8899bb");
          ctx.fillStyle = pegGrad;
          ctx.fill();
          // Glow
          ctx.beginPath();
          ctx.arc(x, y, PEG_RADIUS + 2, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(180,200,255,0.2)";
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }
    } else {
      // Draw placeholder pegs
      for (let r = 0; r < rows; r++) {
        for (let p = 0; p <= r; p++) {
          const x = pegX(r, p);
          const y = pegY(r);
          ctx.beginPath();
          ctx.arc(x, y, PEG_RADIUS, 0, Math.PI * 2);
          ctx.fillStyle = "#334";
          ctx.fill();
        }
      }
    }

    // Drop column indicator
    const dcX = pegX(0, 0) + (dropColumn - Math.floor(rows / 2)) * colGap;
    ctx.beginPath();
    ctx.moveTo(dcX, 10);
    ctx.lineTo(dcX, layout.topPad - 10);
    ctx.strokeStyle = "rgba(245,197,24,0.6)";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
    // Arrow
    ctx.beginPath();
    ctx.moveTo(dcX - 6, 18);
    ctx.lineTo(dcX, 10);
    ctx.lineTo(dcX + 6, 18);
    ctx.strokeStyle = "#f5c518";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Bins
    const by = binY();
    const binW = colGap * 0.72;
    const binH = 38;
    for (let i = 0; i < COLS; i++) {
      const bx = binX(i) - binW / 2;
      const isPulsing = i === pulsingBin;
      const color = binColor(i);

      if (isPulsing) {
        ctx.shadowColor = color;
        ctx.shadowBlur = 30;
      }

      // Bin body
      ctx.fillStyle = isPulsing ? color : `${color}22`;
      ctx.strokeStyle = color;
      ctx.lineWidth = isPulsing ? 2.5 : 1;
      ctx.beginPath();
      ctx.roundRect(bx, by, binW, binH, 4);
      ctx.fill();
      ctx.stroke();

      ctx.shadowBlur = 0;

      // Multiplier label
      ctx.fillStyle = isPulsing ? "#000" : color;
      ctx.font = `bold ${isPulsing ? 11 : 10}px Orbitron, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(`${PAYTABLE[i]}x`, binX(i), by + binH / 2 + 4);
    }
  }, [pegMap, rows, dropColumn, showDebug, getLayout]);

  // Ball draw
  const drawBall = useCallback((ctx: CanvasRenderingContext2D, x: number, y: number) => {
    if (isGolden) {
      // Golden glow
      ctx.shadowColor = "#ffd700";
      ctx.shadowBlur = 20;
      const grad = ctx.createRadialGradient(x - 2, y - 2, 0, x, y, BALL_RADIUS);
      grad.addColorStop(0, "#fff7aa");
      grad.addColorStop(0.5, "#ffd700");
      grad.addColorStop(1, "#b8860b");
      ctx.fillStyle = grad;
    } else {
      ctx.shadowColor = "#ff0080";
      ctx.shadowBlur = 15;
      const grad = ctx.createRadialGradient(x - 2, y - 2, 0, x, y, BALL_RADIUS);
      grad.addColorStop(0, "#ffffff");
      grad.addColorStop(0.5, "#ff4488");
      grad.addColorStop(1, "#cc0055");
      ctx.fillStyle = grad;
    }
    ctx.beginPath();
    ctx.arc(x, y, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }, [isGolden]);

  // Animation driver
  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !pegMap || !path) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    const layout = getLayout(w, h);
    const { pegX, pegY, binX, binY, colGap } = layout;
    const st = stateRef.current;

    const STEPS_PER_ROW = reducedMotion ? 1 : 18;
    const PAUSE_STEPS = reducedMotion ? 0 : 4;

    st.step++;

    if (st.row < 0) {
      // Initialise — start ball above first peg
      const startX = pegX(0, 0) + (dropColumn - Math.floor(rows / 2)) * colGap;
      st.ballX = startX;
      st.ballY = layout.topPad - 25;
      st.row = 0;
      st.pos = 0;
      st.step = 0;
    }

    if (st.done) {
      drawBoard(ctx, w, h, st.pulsingBin);
      drawBall(ctx, st.ballX, st.ballY);
      return;
    }

    if (st.row < rows) {
      const decision = path[st.row];
      const pegIdx = Math.min(st.pos, st.row);
      const px = pegX(st.row, pegIdx);
      const py = pegY(st.row);

      // Target = next row's peg position or bin
      let nextX: number;
      let nextY: number;
      if (st.row + 1 < rows) {
        const nextPos = decision === "R" ? st.pos + 1 : st.pos;
        const nextPegIdx = Math.min(nextPos, st.row + 1);
        nextX = pegX(st.row + 1, nextPegIdx);
        nextY = pegY(st.row + 1);
      } else {
        const finalPos = decision === "R" ? st.pos + 1 : st.pos;
        nextX = binX(finalPos);
        nextY = binY();
      }

      // Arc: go via peg then to next
      const t = st.step / STEPS_PER_ROW;
      const arcT = Math.min(t, 1);
      // Bounce arc above peg
      const arcH = 12;
      st.ballX = lerp(px + (decision === "L" ? -8 : 8), nextX, arcT);
      st.ballY = lerp(py - 2, nextY, arcT) - Math.sin(arcT * Math.PI) * arcH;

      drawBoard(ctx, w, h);
      drawBall(ctx, st.ballX, st.ballY);

      if (st.step >= STEPS_PER_ROW) {
        onPegTick?.();
        if (decision === "R") st.pos++;
        st.row++;
        st.step = 0;

        // Pause briefly at peg
        if (st.row < rows && !reducedMotion) {
          for (let p = 0; p < PAUSE_STEPS; p++) {
            drawBoard(ctx, w, h);
            drawBall(ctx, st.ballX, st.ballY);
          }
        }

        if (st.row >= rows) {
          // Landed
          st.done = true;
          st.pulsingBin = st.pos;
          drawBoard(ctx, w, h, st.pulsingBin);
          drawBall(ctx, st.ballX, binY());
          onAnimationComplete?.(st.pos);
          return;
        }
      }
    }

    animRef.current = requestAnimationFrame(animate);
  }, [pegMap, path, dropColumn, rows, reducedMotion, drawBoard, drawBall, getLayout, onPegTick, onAnimationComplete]);

  // Start animation when path arrives
  useEffect(() => {
    if (!isAnimating || !path || !pegMap) return;
    if (animRef.current) cancelAnimationFrame(animRef.current);
    stateRef.current = { ballX: 0, ballY: 0, targetX: 0, targetY: 0, row: -1, step: 0, pos: 0, done: false, pulsingBin: -1 };
    animRef.current = requestAnimationFrame(animate);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [isAnimating, path, pegMap, animate]);

  // Idle board draw
  useEffect(() => {
    if (isAnimating) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawBoard(ctx, canvas.width, canvas.height);
  }, [isAnimating, drawBoard, pegMap, dropColumn, showDebug]);

  // Resize observer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const size = Math.min(parent.clientWidth, 520);
      canvas.width = size;
      canvas.height = size + 60;
      const ctx = canvas.getContext("2d");
      if (ctx) drawBoard(ctx, canvas.width, canvas.height);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement!);
    return () => ro.disconnect();
  }, [drawBoard]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full rounded-lg"
      style={{ display: "block", cursor: "default" }}
      aria-label="Plinko game board"
      role="img"
    />
  );
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}
