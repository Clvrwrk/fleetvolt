"use client";

import { useEffect, useState } from "react";

type CelebrationOverlayProps = {
  active: boolean;
  fleetName: string;
  onDone?: () => void;
};

/** Lightweight confetti + balloons — no extra dependency. */
export function CelebrationOverlay({
  active,
  fleetName,
  onDone,
}: CelebrationOverlayProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!active) {
      setShow(false);
      return;
    }
    setShow(true);
    const t = window.setTimeout(() => {
      setShow(false);
      onDone?.();
    }, 4200);
    return () => window.clearTimeout(t);
  }, [active, onDone]);

  if (!show) return null;

  const confetti = Array.from({ length: 48 }, (_, i) => i);
  const balloons = Array.from({ length: 10 }, (_, i) => i);
  const colors = [
    "#c0392b",
    "#4c8fb8",
    "#3f9b6b",
    "#d4a017",
    "#e8e4dc",
    "#8e44ad",
  ];

  return (
    <div
      data-testid="fleet-celebration"
      className="pointer-events-none fixed inset-0 z-[80] overflow-hidden"
      aria-live="polite"
    >
      <style>{`
        @keyframes fv-confetti-fall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0.85; }
        }
        @keyframes fv-balloon-rise {
          0% { transform: translateY(0) scale(1); opacity: 0; }
          10% { opacity: 1; }
          100% { transform: translateY(-110vh) scale(1.05); opacity: 0.9; }
        }
        .fv-confetti-piece {
          position: absolute;
          top: -12px;
          animation-name: fv-confetti-fall;
          animation-timing-function: linear;
          animation-fill-mode: forwards;
        }
        .fv-balloon-piece {
          position: absolute;
          bottom: -40px;
          width: 28px;
          height: 36px;
          border-radius: 50% 50% 50% 50% / 45% 45% 55% 55%;
          box-shadow: inset -4px -6px 0 rgba(0, 0, 0, 0.12);
          animation: fv-balloon-rise 3.8s ease-out forwards;
        }
        .fv-balloon-piece::after {
          content: "";
          position: absolute;
          left: 50%;
          top: 100%;
          width: 1px;
          height: 28px;
          background: rgba(0, 0, 0, 0.25);
          transform: translateX(-50%);
        }
      `}</style>

      <div className="absolute inset-x-0 top-1/3 z-10 flex flex-col items-center px-4 text-center">
        <div className="rounded-2xl border border-black/10 bg-white/95 px-6 py-5 shadow-xl backdrop-blur">
          <p className="text-[11px] font-mono uppercase tracking-[0.16em] text-[var(--fv-steel)]">
            Fleet created
          </p>
          <p className="mt-1 text-xl font-bold text-[var(--fv-graphite)]">
            Congratulations!
          </p>
          <p className="mt-1 text-sm text-[var(--fv-text-muted)]">
            <span className="font-semibold text-[var(--fv-graphite)]">
              {fleetName}
            </span>{" "}
            was added to My Fleets.
          </p>
        </div>
      </div>

      {confetti.map((i) => (
        <span
          key={`c-${i}`}
          className="fv-confetti-piece"
          style={{
            left: `${(i * 17) % 100}%`,
            width: 8 + (i % 5),
            height: 10 + (i % 4),
            background: colors[i % colors.length],
            animationDelay: `${(i % 12) * 0.08}s`,
            animationDuration: `${2.4 + (i % 5) * 0.25}s`,
            borderRadius: i % 2 === 0 ? 2 : "50%",
          }}
        />
      ))}

      {balloons.map((i) => (
        <span
          key={`b-${i}`}
          className="fv-balloon-piece"
          style={{
            left: `${8 + i * 9}%`,
            animationDelay: `${i * 0.12}s`,
            background: colors[i % colors.length],
          }}
        />
      ))}
    </div>
  );
}
