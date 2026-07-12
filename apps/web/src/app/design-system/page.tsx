import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BatteryCharging,
  Check,
  Database,
  MapPinned,
  Radio,
  Route,
  ShieldCheck,
  Truck,
  Zap,
} from "lucide-react";

const COLORS = [
  ["Carbon", "#07090C", "Canvas / chrome"],
  ["Gunmetal", "#121820", "Raised surface"],
  ["Armor", "#202A34", "Interactive surface"],
  ["Electric", "#42A5D9", "Action / selected"],
  ["Signal", "#6FD49A", "Verified / ready"],
  ["Amber", "#F0B84B", "Attention / gap"],
  ["Alert", "#E4675B", "Failure / stop"],
  ["Signal White", "#F3F7FA", "Primary content"],
] as const;

const ICONS = [Route, Truck, BatteryCharging, MapPinned, Database, Radio];

export default function DesignSystemPage() {
  return (
    <div className="fv-system-page">
      <header className="fv-system-hero">
        <span className="fv-command-kicker">FLEETVOLT ENTERPRISE SYSTEM / V1.0</span>
        <div>
          <h1>Electric Command System</h1>
          <span className="fv-system-version">STATUS / CONTROLLED ALPHA</span>
        </div>
        <p>
          A high-trust operating language for freight electrification: industrial,
          legible, data-first, and unmistakably FleetVolt.
        </p>
      </header>

      <section className="fv-system-section">
        <div className="fv-system-section-title"><span>01</span><h2>Foundation</h2></div>
        <div className="fv-system-color-grid">
          {COLORS.map(([name, hex, use]) => (
            <article key={name} className="fv-system-swatch">
              <i style={{ background: hex }} />
              <strong>{name}</strong><code>{hex}</code><span>{use}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="fv-system-section fv-system-two-col">
        <div>
          <div className="fv-system-section-title"><span>02</span><h2>Type architecture</h2></div>
          <div className="fv-system-type-stack">
            <div><span>ARCLINE / DISPLAY</span><strong>Own the transition.</strong></div>
            <div><span>ARCLINE / OPERATING COPY</span><p>Road-level intelligence for electric freight operations.</p></div>
            <div className="fv-system-mono"><span>JETBRAINS MONO / TELEMETRY</span><code>SOC 64% / 112.4 MI / ROUTE VERIFIED</code></div>
          </div>
        </div>
        <div>
          <div className="fv-system-section-title"><span>03</span><h2>Icon language</h2></div>
          <div className="fv-system-icon-grid">
            {ICONS.map((Icon, index) => <span key={index}><Icon size={22} /></span>)}
          </div>
          <p className="fv-system-note">Lucide outline icons, 1.75–2px stroke. Icons label objects or actions; they never decorate empty space.</p>
        </div>
      </section>

      <section className="fv-system-section">
        <div className="fv-system-section-title"><span>04</span><h2>Core controls</h2></div>
        <div className="fv-system-control-grid">
          <div className="fv-system-demo-card">
            <span className="fv-command-kicker">BUTTONS</span>
            <div className="fv-system-button-row">
              <button className="fv-command-button">Calculate route <Zap size={15} /></button>
              <button className="fv-command-button fv-command-button--secondary">Save scenario</button>
              <button className="fv-command-button" disabled>Processing</button>
            </div>
          </div>
          <div className="fv-system-demo-card">
            <span className="fv-command-kicker">STATUS</span>
            <div className="fv-system-button-row">
              <span className="fv-command-status fv-command-status--ok"><Check size={13} /> Verified</span>
              <span className="fv-command-status fv-command-status--warn"><AlertTriangle size={13} /> Attention</span>
              <span className="fv-command-status"><Activity size={13} /> Modeling</span>
            </div>
          </div>
          <div className="fv-system-demo-card">
            <span className="fv-command-kicker">INPUT</span>
            <label className="fv-command-field"><span>ORIGIN</span><input defaultValue="Port of Long Beach" /></label>
          </div>
        </div>
      </section>

      <section className="fv-system-section">
        <div className="fv-system-section-title"><span>05</span><h2>Decision surfaces</h2></div>
        <div className="fv-system-decision-grid">
          <article className="fv-command-panel">
            <div className="fv-command-panel-head"><span>ROUTE VERDICT</span><ShieldCheck size={18} /></div>
            <strong className="fv-command-metric">CONDITIONAL</strong>
            <p>One infrastructure gap requires a mobile or fixed charging intervention.</p>
            <div className="fv-command-rule" />
            <span className="fv-command-link">View evidence <ArrowUpRight size={13} /></span>
          </article>
          <article className="fv-command-panel fv-command-panel--electric">
            <div className="fv-command-panel-head"><span>ENERGY WINDOW</span><BatteryCharging size={18} /></div>
            <strong className="fv-command-metric">48–72%</strong>
            <p>Optimal intervention window at the Shafter dwell location.</p>
            <div className="fv-command-rule" />
            <span className="fv-command-link">Open route <ArrowUpRight size={13} /></span>
          </article>
        </div>
      </section>

      <footer className="fv-system-footer">
        <span><ShieldCheck size={14} /> WCAG AA MINIMUM / REDUCED MOTION SUPPORTED</span>
        <span>OWNER / FLEETVOLT PRODUCT</span>
      </footer>
    </div>
  );
}
