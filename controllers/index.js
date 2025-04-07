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
      width: 794, // 210mm at 96 DPI
      height: 1123, // 297mm at 96 DPI
      deviceScaleFactor: 2,
    });

    await page.setContent(htmlContent, { waitUntil: "networkidle0" });

    const pdfBuffer = await page.pdf({
      width: "794px", // Same as your A4_WIDTH at 96 DPI
      height: "1123px", // Same as your A4_HEIGHT at 96 DPI
      printBackground: true,
      margin: {
        top: "0px",
        bottom: "0px",
        left: "0px",
        right: "0px",
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
