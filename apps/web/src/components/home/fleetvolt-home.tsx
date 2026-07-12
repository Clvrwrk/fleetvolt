"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, FileChartColumnIncreasing, LockKeyhole, Route, Truck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

const INTRO_STORAGE_KEY = "fleetvolt_intro_seen_v1";

function BoltMark({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 120 120" aria-hidden="true">
      <circle className="fv-ignite-orbit" cx="60" cy="60" r="47" />
      <circle className="fv-ignite-trace" cx="60" cy="60" r="47" />
      <path className="fv-ignite-bolt" d="M67 12 31 66h24l-7 42 41-62H64z" />
    </svg>
  );
}

function Intro({ onComplete }: { onComplete: () => void }) {
  return (
    <div className="fv-ignition" role="dialog" aria-modal="true" aria-label="FleetVolt system startup">
      <button type="button" onClick={onComplete} className="fv-ignition-skip">
        Skip intro
      </button>
      <div className="fv-ignition-grid" aria-hidden="true" />
      <div className="fv-ignition-core">
        <div className="fv-ignition-kicker">Class 8 freight intelligence</div>
        <BoltMark className="fv-ignition-mark" />
        <div className="fv-ignition-wordmark">FLEET<span>VOLT</span></div>
        <div className="fv-ignition-sequence" aria-hidden="true">
          <span>ROUTE LOCK</span>
          <span>ENERGY MODEL</span>
          <span>REVENUE TARGETS</span>
        </div>
        <div className="fv-ignition-bar"><span /></div>
      </div>
    </div>
  );
}

function BriefingInstrument() {
  return (
    <div className="fv-home-instrument" aria-label="FleetVolt Executive Briefing preview">
      <div className="fv-home-instrument-topline">
        <span>EXECUTIVE BRIEF / EF–01</span>
        <span className="fv-live-dot">MONDAY READY</span>
      </div>
      <div className="fv-home-report-grid">
        <div className="fv-home-verdict">
          <span className="fv-home-label">INVESTMENT VERDICT</span>
          <strong>DEPLOY MOBILE POWER</strong>
          <p>POLB → Shafter · Class 8 transition corridor</p>
          <div className="fv-home-verdict-stats">
            <span><b>51%</b> arrival SoC</span>
            <span><b>1.0 MW</b> recommended</span>
            <span><b>10</b> carrier targets</span>
          </div>
        </div>
        <div className="fv-home-route-viz" aria-hidden="true">
          <svg viewBox="0 0 430 180" role="img">
            <defs>
              <linearGradient id="fvRouteGlow" x1="0" x2="1">
                <stop offset="0" stopColor="#42a5d9" stopOpacity=".15" />
                <stop offset=".55" stopColor="#42a5d9" stopOpacity=".95" />
                <stop offset="1" stopColor="#f0b84b" stopOpacity=".8" />
              </linearGradient>
            </defs>
            <path className="fv-home-mapline-muted" d="M18 151C76 130 72 93 142 93s75 48 132 19 79-80 142-72" />
            <path className="fv-home-mapline" d="M18 151C76 130 72 93 142 93s75 48 132 19 79-80 142-72" />
            <circle cx="18" cy="151" r="6" />
            <circle cx="274" cy="112" r="9" className="fv-home-gap-node" />
            <circle cx="416" cy="40" r="6" />
            <text x="18" y="174">POLB</text>
            <text x="250" y="143">MOBILE POWER WINDOW</text>
            <text x="382" y="25">SHAFTER</text>
          </svg>
        </div>
      </div>
      <div className="fv-home-report-footer">
        <span>23 pages</span><span>Route render</span><span>Physics + economics</span><span>Target list</span>
      </div>
    </div>
  );
}

export function FleetVoltHome() {
  const [showIntro, setShowIntro] = useState(false);
  const [ready, setReady] = useState(false);

  const completeIntro = useCallback(() => {
    try {
      window.sessionStorage.setItem(INTRO_STORAGE_KEY, "1");
    } catch {
      // Locked storage only means the intro may replay next navigation.
    }
    setShowIntro(false);
  }, []);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const forceIntro = new URLSearchParams(window.location.search).get("intro") === "1";
    let seen = false;
    try {
      seen = window.sessionStorage.getItem(INTRO_STORAGE_KEY) === "1";
    } catch {
      seen = false;
    }
    const frame = window.requestAnimationFrame(() => {
      setShowIntro(!reducedMotion && (forceIntro || !seen));
      setReady(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!showIntro) return;
    const timer = window.setTimeout(completeIntro, 4300);
    return () => window.clearTimeout(timer);
  }, [completeIntro, showIntro]);

  if (!ready) {
    return <div className="min-h-dvh bg-[#07090c]" aria-hidden="true" />;
  }

  return (
    <>
      {showIntro ? <Intro onComplete={completeIntro} /> : null}
      <main id="main-content" tabIndex={-1} className="fv-home-shell">
        <div className="fv-home-grid" aria-hidden="true" />
        <header className="fv-home-nav">
          <Image
            src="/fleetvolt-logo-horizontal-light.svg"
            alt="FleetVolt"
            width={320}
            height={72}
            priority
            className="fv-home-logo"
          />
          <div className="fv-home-nav-actions">
            <span className="fv-home-system"><i /> SYSTEM ONLINE</span>
            <Link href="/role-select" className="fv-home-signin">
              <LockKeyhole size={14} /> Sign in
            </Link>
          </div>
        </header>

        <section className="fv-home-stage">
          <div className="fv-home-copy">
            <div className="fv-home-eyebrow">FREIGHT ELECTRIFICATION · DECISION INTELLIGENCE</div>
            <h1>KNOW THE ROUTE.<br /><span>OWN THE TRANSITION.</span></h1>
            <p>
              FleetVolt turns a Class 8 corridor into an executive decision—energy,
              infrastructure, economics, and the fleets worth pursuing.
            </p>
            <div className="fv-home-primary-actions">
              <Link href="/briefing" className="fv-home-cta">
                Open Executive Briefing <ArrowRight size={17} />
              </Link>
              <span>Built for Monday&apos;s Energy Forward review</span>
            </div>
          </div>
          <BriefingInstrument />
        </section>

        <section className="fv-home-lanes" aria-label="FleetVolt product lanes">
          <Link href="/briefing" className="fv-home-lane fv-home-lane--active">
            <div className="fv-home-lane-icon"><FileChartColumnIncreasing size={21} /></div>
            <div>
              <span className="fv-home-lane-status">ACTIVE · REVENUE LANE</span>
              <h2>Executive Briefing</h2>
              <p>Download the route investment case.</p>
            </div>
            <ArrowRight className="fv-home-lane-arrow" size={20} />
          </Link>
          <div className="fv-home-lane fv-home-lane--locked" aria-disabled="true">
            <div className="fv-home-lane-icon"><Route size={21} /></div>
            <div>
              <span className="fv-home-lane-status">COMING SOON</span>
              <h2>Fleet Manager</h2>
              <p>Contract routes, energy, and dispatch.</p>
            </div>
            <LockKeyhole className="fv-home-lane-arrow" size={18} />
          </div>
          <div className="fv-home-lane fv-home-lane--locked" aria-disabled="true">
            <div className="fv-home-lane-icon"><Truck size={21} /></div>
            <div>
              <span className="fv-home-lane-status">COMING SOON</span>
              <h2>Driver</h2>
              <p>Day plans, stops, and charge confidence.</p>
            </div>
            <LockKeyhole className="fv-home-lane-arrow" size={18} />
          </div>
        </section>

        <footer className="fv-home-footer">
          <span>FLEETVOLT / EV FREIGHT INTELLIGENCE</span>
          <span>POWERED BY CLEVERWORK · ZERO EMISSION ADVISORS</span>
        </footer>
      </main>
    </>
  );
}
