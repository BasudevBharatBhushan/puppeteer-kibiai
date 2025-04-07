const puppeteer = require("puppeteer");

exports.generatePdfFromHtml = async (req, res) => {
  const { styles, body } = req.body;

  if (!body || typeof styles !== "string" || typeof body !== "string") {
    return res
      .status(400)
      .json({ error: "Invalid input: Expected { styles, body } as strings" });
  }

  const htmlContent =
    "<!DOCTYPE html>" +
    "<html>" +
    "<head>" +
    '<meta charset="UTF-8">' +
    "<style>" +
    styles +
    "</style>" +
    "</head>" +
    "<body>" +
    body +
    "</body>" +
    "</html>";

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

    await page.setContent(htmlContent, { waitUntil: "networkidle0" });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
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
