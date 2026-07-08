// PDF export — client-side generation via browser print.
// No Puppeteer, no server-side dependency — Vercel/serverless safe.
//
// Approach: open the rendered HTML in a new window and trigger window.print().
// The user can "Save as PDF" from the browser's print dialog. This produces
// the same visual output as the Phase 4 Puppeteer PDF without any server
// dependency.

/**
 * Generate a PDF client-side by opening the HTML in a new window and
 * triggering the browser's print dialog. The user selects "Save as PDF".
 *
 * @param html - The full HTML document string (from renderExportHtml)
 * @param filename - Suggested filename (used for window title)
 */
export function generatePdf(html: string, filename: string): void {
  if (typeof window === "undefined") {
    throw new Error("generatePdf requires a browser environment");
  }

  const printWindow = window.open("", "_blank", "width=900,height=700");
  if (!printWindow) {
    throw new Error(
      "Pop-up blocked — please allow pop-ups for this site to export PDF",
    );
  }

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();

  // Set the window title so the saved PDF has a meaningful name
  printWindow.document.title = filename;

  // Wait for the new window to finish loading before triggering print
  printWindow.onload = () => {
    printWindow.focus();
    printWindow.print();
  };
}
