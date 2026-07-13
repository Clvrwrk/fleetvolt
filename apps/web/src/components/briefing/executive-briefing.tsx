"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BatteryCharging,
  Download,
  Gauge,
  MapPinned,
  ShieldCheck,
  Target,
  Truck,
  Zap,
} from "lucide-react";
import { ALPHA_AUTH_BYPASS } from "@/lib/alpha-auth";
import { FLEETVOLT_REPORT_STANDARD_VERSION } from "../../../report-standard/fleetvolt-route-report-v1";

const carrierTargets = [
  ["1", "HarborLink Transport", "Drayage", "94", "36 units"],
  ["2", "Pacific Intermodal", "Port / warehouse", "91", "51 units"],
  ["3", "Golden State Cartage", "Regional", "88", "28 units"],
  ["4", "Central Valley Freight", "Reefer", "86", "44 units"],
  ["5", "Seaport Logistics", "Drayage", "82", "31 units"],
  ["6", "Kern Linehaul", "Regional", "79", "22 units"],
  ["7", "WestGate Carriers", "Port / rail", "76", "39 units"],
  ["8", "BlueLine Distribution", "Retail", "73", "27 units"],
  ["9", "Valley Cold Chain", "Reefer", "70", "18 units"],
  ["10", "Southland Dedicated", "Contract", "68", "24 units"],
] as const;

function ReportRoute() {
  return (
    <svg className="fv-brief-route" viewBox="0 0 760 310" role="img" aria-label="Modeled POLB to Shafter route rendering">
      <defs>
        <linearGradient id="briefEnergy" x1="0" x2="1">
          <stop offset="0" stopColor="#58b6e9" />
          <stop offset=".58" stopColor="#58b6e9" />
          <stop offset=".76" stopColor="#f0b84b" />
          <stop offset="1" stopColor="#6fd49a" />
        </linearGradient>
        <filter id="briefGlow"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      <g className="fv-brief-map-ghost">
        <path d="M50 270 151 251 235 195 307 215 379 153 446 168 524 112 604 99 703 38" />
        <path d="M126 290 165 226 205 156 271 108 345 70 420 35" />
        <path d="M264 278 342 243 424 225 513 180 622 159 724 126" />
      </g>
      <path className="fv-brief-route-glow" d="M50 270C137 252 159 219 235 195s109 3 144-42 98-2 145-41 118-22 179-74" />
      <path className="fv-brief-route-main" d="M50 270C137 252 159 219 235 195s109 3 144-42 98-2 145-41 118-22 179-74" />
      <g className="fv-brief-route-node" transform="translate(50 270)"><circle r="11"/><text x="18" y="4">POLB · 100% SOC</text></g>
      <g className="fv-brief-route-node fv-brief-route-node--gap" transform="translate(524 112)"><circle r="14"/><text x="-35" y="-27">MOBILE CHARGE WINDOW</text><text x="-5" y="35">31% SOC</text></g>
      <g className="fv-brief-route-node" transform="translate(703 38)"><circle r="11"/><text x="-108" y="4">SHAFTER · 51% SOC</text></g>
      <g className="fv-brief-grade"><path d="M257 224 309 191 357 199"/><text x="274" y="181">TEJON GRADE LOAD</text></g>
    </svg>
  );
}

function EnergyChart() {
  return (
    <svg className="fv-brief-chart" viewBox="0 0 620 230" role="img" aria-label="Modeled state of charge across the route">
      <g className="fv-brief-chart-grid">
        {[30, 70, 110, 150, 190].map((y) => <line key={y} x1="42" x2="600" y1={y} y2={y} />)}
        {[42, 154, 266, 378, 490, 600].map((x) => <line key={x} x1={x} x2={x} y1="20" y2="194" />)}
      </g>
      <path className="fv-brief-chart-fill" d="M42 31C112 40 154 56 210 74s93 39 142 62 81 40 126 23 73-28 122-46V194H42Z" />
      <path className="fv-brief-chart-line" d="M42 31C112 40 154 56 210 74s93 39 142 62 81 40 126 23 73-28 122-46" />
      <line className="fv-brief-chart-floor" x1="42" x2="600" y1="166" y2="166" />
      <text x="48" y="22">100%</text><text x="560" y="119">51%</text><text x="378" y="181">20% OPERATING FLOOR</text>
      <text x="42" y="218">POLB</text><text x="274" y="218">TEJON</text><text x="548" y="218">SHAFTER</text>
    </svg>
  );
}

export function ExecutiveBriefing() {
  const printReport = () => window.print();

  return (
    <main id="main-content" tabIndex={-1} className="fv-brief-shell">
      <header className="fv-brief-toolbar no-print">
        <Link href="/" className="fv-brief-back"><ArrowLeft size={15} /> Home</Link>
        <Image src="/fleetvolt-logo-horizontal-light.svg" alt="FleetVolt" width={240} height={54} className="fv-brief-logo" priority />
        <div className="fv-brief-toolbar-actions">
          <Link href={ALPHA_AUTH_BYPASS ? "/caas" : "/role-select"} className="fv-brief-secondary">
            {ALPHA_AUTH_BYPASS ? "Enter Alpha" : "Sign in"}
          </Link>
          <button type="button" onClick={printReport} className="fv-brief-download"><Download size={15} /> Print / Save PDF</button>
        </div>
      </header>

      <article
        className="fv-brief-document"
        data-report-standard={`fleetvolt-route-report-v${FLEETVOLT_REPORT_STANDARD_VERSION}`}
      >
        <div
          className="fv-brief-demo-banner"
          role="status"
          style={{
            padding: "0.875rem 1.125rem",
            color: "#080b0f",
            background: "#f0b84b",
            textAlign: "center",
            fontFamily: "var(--font-mono)",
            fontSize: "var(--fv-type-floor)",
            fontWeight: 900,
            letterSpacing: ".12em",
          }}
        >
          DEMO / MODELED — SYNTHETIC TARGETS — NOT FOR CAPITAL COMMITMENT
        </div>
        <div className="fv-brief-coverline">
          <span>FLEETVOLT EXECUTIVE BRIEFING / EF–01</span>
          <span>DECISION COPY · 12 JUL 2026</span>
        </div>

        <section className="fv-brief-hero">
          <div>
            <span className="fv-brief-kicker">ENERGY FORWARD · COMMERCIAL TRIAL</span>
            <h1>POLB → SHAFTER<br /><em>CLASS 8 CORRIDOR</em></h1>
            <p>A board-ready investment case for mobile charging, fleet conversion, and carrier acquisition.</p>
          </div>
          <div className="fv-brief-verdict">
            <span>EXECUTIVE VERDICT</span>
            <strong>PROCEED</strong>
            <p>Stage 1.0 MW mobile capacity near the Tejon energy window, validate trailer access, and convert the first three anchor fleets.</p>
          </div>
        </section>

        <section className="fv-brief-metrics">
          <div><Gauge /><span>ROUTE</span><strong>152 mi</strong><small>road-traced</small></div>
          <div><Zap /><span>ENERGY</span><strong>382 kWh</strong><small>2.51 kWh/mi</small></div>
          <div><BatteryCharging /><span>ARRIVAL SOC</span><strong>51%</strong><small>modeled</small></div>
          <div><Truck /><span>FLEET TARGET</span><strong>60 trucks</strong><small>trial scenario</small></div>
          <div><Target /><span>PRIME TARGETS</span><strong>10</strong><small>mock ranked</small></div>
        </section>

        <section className="fv-brief-section fv-brief-route-section">
          <div className="fv-brief-section-head">
            <div><span>01 / CORRIDOR INTELLIGENCE</span><h2>Where the route creates the commercial opening</h2></div>
            <span className="fv-brief-tag">ROUTE RENDER · DEMO MODEL</span>
          </div>
          <div className="fv-brief-route-wrap"><ReportRoute /></div>
          <div className="fv-brief-route-notes">
            <div><MapPinned /><strong>Candidate deployment zone</strong><span>Existing freight dwell near the steepest energy-demand segment.</span></div>
            <div><BatteryCharging /><strong>Optimum charge window</strong><span>Modeled arrival between 20–40% SoC preserves productive charging power.</span></div>
            <div><ShieldCheck /><strong>Decision gate</strong><span>Trailer circulation, utility interconnect, and parcel rights still require validation.</span></div>
          </div>
        </section>

        <section className="fv-brief-two-col">
          <div className="fv-brief-section">
            <div className="fv-brief-section-head"><div><span>02 / ENERGY ENVELOPE</span><h2>Battery state across the duty cycle</h2></div></div>
            <EnergyChart />
            <p className="fv-brief-caption">Modeled demonstration profile. Final report recalculates with selected tractor, payload, weather, driver policy, and validated route geometry.</p>
          </div>
          <div className="fv-brief-section">
            <div className="fv-brief-section-head"><div><span>03 / ECONOMIC CASE</span><h2>Diesel displacement at trial scale</h2></div></div>
            <table className="fv-brief-economics" aria-label="Modeled trial economics"><tbody>
              <tr><th scope="row">Annual route miles</th><td>2.19M</td><td>60 trucks · modeled</td></tr>
              <tr><th scope="row">Diesel displaced</th><td>365K gal</td><td>at 6.0 mpg</td></tr>
              <tr><th scope="row">Electricity demand</th><td>5.50 GWh</td><td>route energy</td></tr>
              <tr><th scope="row">Annual energy delta</th><td className="positive">$1.42M</td><td>illustrative</td></tr>
              <tr><th scope="row">CO₂e avoided</th><td>3,720 t</td><td>method pending</td></tr>
            </tbody></table>
            <div className="fv-brief-gap-callout"><Zap /><div><span>INFRASTRUCTURE GAP</span><strong>1.0 MW mobile bridge recommended</strong><p>Bridge demand until a verified trailer-through permanent site clears interconnection and construction.</p></div></div>
          </div>
        </section>

        <section className="fv-brief-section">
          <div className="fv-brief-section-head">
            <div><span>04 / GO-TO-MARKET</span><h2>Top 10 carrier targets using this corridor</h2></div>
            <span className="fv-brief-tag fv-brief-tag--mock">MOCK DATA · DEMO ONLY</span>
          </div>
          <div className="fv-brief-carrier-table-wrap" role="region" aria-label="Top ten modeled carrier targets" tabIndex={0}>
            <table className="fv-brief-carriers" aria-label="Top ten modeled carrier targets">
              <thead><tr><th scope="col">Rank</th><th scope="col">Carrier</th><th scope="col">Fit</th><th scope="col">Score</th><th scope="col">Addressable fleet</th><th scope="col">Action</th></tr></thead>
              <tbody>{carrierTargets.map(([rank,name,fit,score,fleet]) => (
                <tr key={rank}><td>{rank.padStart(2,"0")}</td><td><strong>{name}</strong><small>Synthetic demo company</small></td><td>{fit}</td><td><span className="fv-brief-score">{score}</span></td><td>{fleet}</td><td>Executive briefing → validation call</td></tr>
              ))}</tbody>
            </table>
          </div>
          <p className="fv-brief-caption">Names, scores, and fleet counts are synthetic placeholders for Monday. Production rankings require verified FMCSA/carrier, lane-use, equipment, and decision-maker data.</p>
        </section>

        <section className="fv-brief-close">
          <div><span>THE MONEY PLAY</span><h2>Turn this corridor into a paid decision.</h2><p>Generate the verified report, validate the three highest-value sites, and put the carrier target list into motion.</p></div>
          <Link href="/workbench?mode=caas_gap_map" className="fv-brief-close-cta no-print">Open the FleetVolt workbench <ArrowRight size={17} /></Link>
        </section>

        <footer className="fv-brief-doc-footer">
          <span>FLEETVOLT · EV FREIGHT INTELLIGENCE</span>
          <span>DEMO / MODELED / NOT FOR CAPITAL COMMITMENT</span>
          <span>POWERED BY CLEVERWORK · ZERO EMISSION ADVISORS</span>
        </footer>
      </article>
    </main>
  );
}
