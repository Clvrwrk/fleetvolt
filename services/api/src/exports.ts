import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { pool } from "./db.js";
import { renderExportHtml } from "./export-template.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BASE64_BYTES = 5 * 1024 * 1024;

interface PdfExportBody {
  job_id: string;
  map_snapshot_base64?: string | null;
}

interface SimulationRunRow {
  id: string;
  status: string;
  outputs?: Record<string, unknown> | null;
  inputs_hash?: string | null;
  physics_version?: string | null;
  charger_version?: string | null;
  inputs?: Record<string, unknown> | null;
}

export interface DbPool {
  query(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[] }>;
}

export interface ExportsDeps {
  pool: DbPool;
  renderPdf: (html: string) => Promise<Buffer>;
}

async function defaultRenderPdf(html: string): Promise<Buffer> {
  const puppeteer = await import("puppeteer");
  const browser = await puppeteer.default.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "16mm", bottom: "16mm", left: "12mm", right: "12mm" },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

const defaultDeps: ExportsDeps = {
  pool,
  renderPdf: defaultRenderPdf,
};

function mapSnapshotToDataUrl(base64: string | null | undefined): string | null {
  if (!base64) {
    return null;
  }
  if (base64.startsWith("data:")) {
    return base64;
  }
  return `data:image/png;base64,${base64}`;
}

export function createExportsHandlers(deps: ExportsDeps = defaultDeps) {
  async function postPdfExport(
    request: FastifyRequest<{ Body: PdfExportBody }>,
    reply: FastifyReply,
  ) {
    const { job_id: jobId, map_snapshot_base64: mapSnapshot } = request.body;

    if (!UUID_RE.test(jobId)) {
      return reply.status(400).send({
        error: "invalid_job_id",
        message: "job_id must be a valid UUID",
      });
    }

    if (mapSnapshot && Buffer.byteLength(mapSnapshot, "utf8") > MAX_BASE64_BYTES) {
      return reply.status(413).send({
        error: "payload_too_large",
        message: "map_snapshot_base64 exceeds 5MB limit",
      });
    }

    const result = await deps.pool.query(
      `SELECT id, status, outputs, inputs_hash, physics_version, charger_version, inputs
       FROM simulation_runs
       WHERE id = $1`,
      [jobId],
    );

    if (!result.rows[0]) {
      return reply.status(404).send({
        error: "not_found",
        message: "Simulation run not found",
      });
    }

    const row = result.rows[0] as SimulationRunRow;

    if (row.status !== "COMPLETE" || !row.outputs) {
      return reply.status(409).send({
        error: "job_not_complete",
        message: "Simulation must be COMPLETE before PDF export",
      });
    }

    const exportTimestamp = new Date().toISOString();
    const html = renderExportHtml(
      row,
      mapSnapshotToDataUrl(mapSnapshot),
      exportTimestamp,
    );
    const pdfBuffer = await deps.renderPdf(html);

    return reply
      .header("Content-Type", "application/pdf")
      .header(
        "Content-Disposition",
        `attachment; filename="fleetvolt-${(row.inputs_hash ?? row.id).slice(0, 8)}.pdf"`,
      )
      .send(pdfBuffer);
  }

  return { postPdfExport };
}

export function registerExportRoutes(
  app: FastifyInstance,
  deps?: ExportsDeps,
) {
  const { postPdfExport } = createExportsHandlers(deps);
  app.post("/v1/exports/pdf", postPdfExport);
}
