"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { cn } from "@/lib/utils";

type BlueprintGridProps = {
  /** Grid line opacity, restrained per UI-SPEC (0.15–0.25). Default 0.2. */
  intensity?: number;
  /** Drift speed multiplier (very slow by default). */
  speed?: number;
  /** Grid cell size in CSS px. Default 40 (4px multiple). */
  cellSize?: number;
  /** Force the zero-JS CSS fallback (also used under prefers-reduced-motion). */
  static?: boolean;
  className?: string;
};

/**
 * BlueprintGrid — faint LIGHT technical grid that sits BEHIND the TechnicalFrame.
 *
 * D-08 / Pitfall #9: renders OFF the GL canvas. A second WebGL context would fight
 * the map's WebGL2 canvas and risk context loss — so this is a single 2D <canvas>
 * (never Three.js / WebGL) with a slow GSAP-driven drift, plus a zero-JS
 * repeating-linear-gradient fallback for prefers-reduced-motion / `static`.
 *
 * pointer-events:none, z-index:0. Colors: #EFEFF5 background wash + #8A8A93 lines.
 * DPR capped at 2; animation pauses on tab-hidden (visibilitychange) to save battery.
 */
export function BlueprintGrid({
  intensity = 0.2,
  speed = 1,
  cellSize = 40,
  static: isStatic = false,
  className,
}: BlueprintGridProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const prefersReducedMotion =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const useCanvas = !isStatic && !prefersReducedMotion;

  useGSAP(
    () => {
      const canvas = canvasRef.current;
      if (!canvas || !useCanvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dpr = Math.min(
        typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
        2,
      );

      const state = { offset: 0 };
      let cssWidth = 0;
      let cssHeight = 0;

      const resize = () => {
        const parent = canvas.parentElement;
        if (!parent) return;
        cssWidth = parent.clientWidth;
        cssHeight = parent.clientHeight;
        canvas.width = Math.max(1, Math.floor(cssWidth * dpr));
        canvas.height = Math.max(1, Math.floor(cssHeight * dpr));
        canvas.style.width = `${cssWidth}px`;
        canvas.style.height = `${cssHeight}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      };

      const draw = () => {
        if (cssWidth === 0 || cssHeight === 0) return;
        ctx.clearRect(0, 0, cssWidth, cssHeight);

        // faint light background wash (#EFEFF5)
        ctx.fillStyle = "#EFEFF5";
        ctx.globalAlpha = intensity * 0.5;
        ctx.fillRect(0, 0, cssWidth, cssHeight);

        // 0.5px cool-gray technical lines (#8A8A93)
        ctx.globalAlpha = intensity;
        ctx.strokeStyle = "#8A8A93";
        ctx.lineWidth = 0.5;
        ctx.beginPath();

        const off = state.offset % cellSize;
        for (let x = -cellSize + off; x <= cssWidth + cellSize; x += cellSize) {
          ctx.moveTo(Math.round(x) + 0.25, 0);
          ctx.lineTo(Math.round(x) + 0.25, cssHeight);
        }
        for (let y = -cellSize + off; y <= cssHeight + cellSize; y += cellSize) {
          ctx.moveTo(0, Math.round(y) + 0.25);
          ctx.lineTo(cssWidth, Math.round(y) + 0.25);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
      };

      resize();
      draw();

      // Blueprint grid drift motion token: linear, very slow, infinite (07-UI-SPEC § Motion).
      const tween = gsap.to(state, {
        offset: cellSize,
        duration: 24 / Math.max(0.001, speed),
        ease: "none",
        repeat: -1,
        onUpdate: draw,
      });

      const onVisibility = () => {
        if (document.hidden) {
          tween.pause();
        } else {
          tween.resume();
        }
      };

      const onResize = () => {
        resize();
        draw();
      };

      document.addEventListener("visibilitychange", onVisibility);
      window.addEventListener("resize", onResize);

      return () => {
        document.removeEventListener("visibilitychange", onVisibility);
        window.removeEventListener("resize", onResize);
        tween.kill();
      };
    },
    { dependencies: [intensity, speed, cellSize, useCanvas] },
  );

  // Static / reduced-motion fallback: zero-JS repeating-linear-gradient grid.
  if (!useCanvas) {
    return (
      <div
        aria-hidden
        className={cn("pointer-events-none absolute inset-0 z-0", className)}
        style={{
          backgroundColor: "#EFEFF5",
          backgroundImage: `repeating-linear-gradient(0deg, rgba(138,138,147,${intensity}) 0, rgba(138,138,147,${intensity}) 0.5px, transparent 0.5px, transparent ${cellSize}px), repeating-linear-gradient(90deg, rgba(138,138,147,${intensity}) 0, rgba(138,138,147,${intensity}) 0.5px, transparent 0.5px, transparent ${cellSize}px)`,
        }}
        data-testid="blueprint-grid"
        data-mode="static"
      />
    );
  }

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 z-0", className)}
      data-testid="blueprint-grid"
      data-mode="canvas"
    />
  );
}
