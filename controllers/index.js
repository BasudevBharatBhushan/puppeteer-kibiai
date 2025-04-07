const puppeteer = require("puppeteer");

exports.generatePdfFromHtml = async (req, res) => {
  const { styles, body, pageSize } = req.body;

  if (!body || typeof styles !== "string" || typeof body !== "string") {
    return res
      .status(400)
      .json({ error: "Invalid input: Expected { styles, body } as strings" });
  }

  // Set default page size
  const validPageSizes = ["letter", "a4", "A4", "Letter"];
  const format = validPageSizes.includes((pageSize || "").toLowerCase())
    ? pageSize
    : "letter";

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          ${styles}
        </style>
      </head>
      <body>
        ${body}
      </body>
    </html>
  `;

  let browser;

  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--single-process",
      ],
    });

    const page = await browser.newPage();

    // Enhance quality by setting device scale factor (for CSS rendering)
    await page.setViewport({
      width: 1200,
      height: 800,
      deviceScaleFactor: 2, // sharper rendering
    });

    await page.setContent(htmlContent, { waitUntil: "networkidle0" });

    const pdfBuffer = await page.pdf({
      format: format.toUpperCase(), // Puppeteer expects uppercase like 'A4', 'LETTER'
      printBackground: true,
      width: "210mm",
      height: "297mm",
      margin: {
        top: "20mm",
        bottom: "20mm",
        left: "15mm",
        right: "15mm",
      },
    });

    await browser.close();

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": "attachment; filename=report.pdf",
    });

    return res.send(pdfBuffer);
  } catch (error) {
    if (browser) await browser.close();
    console.error("PDF generation error:", error);
    return res
      .status(500)
      .json({ error: "Failed to generate PDF", detail: error.message });
  }
};
