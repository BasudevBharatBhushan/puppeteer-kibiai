const puppeteer = require("puppeteer");
// Make the API call to the OData endpoint
const axios = require("axios");

exports.generatePdfFromHtml = async (req, res) => {
  const { styles, body, pageSize, reportID } = req.body;

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

    // Convert PDF buffer to base64
    const base64PDF = pdfBuffer.toString("base64");

    try {
      const response = await axios({
        method: "post",
        url: "https://kibiz.smtech.cloud/fmi/odata/v4/kIbiAI/DYNAMICREPORTS",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Basic RGV2ZWxvcGVyOmFkbWluYml6",
        },
        data: {
          Js_Report_ID: reportID.toString(),
          Rerports_Base64: base64PDF,
          FileExtension: "pdf",
        },
        timeout: 10000, // 10 seconds timeout as specified in the curl command
      });

      // Extract fmRecordID from the response
      const fmRecordID = response.data.FM_RecordID;

      // Return only the fmRecordID on success
      return res.status(200).json({ fmRecordID, status: "OK" });
    } catch (apiError) {
      console.error("API call error:", apiError);
      return res.status(500).json({
        status: "ERROR",
        error: "Unable to generate PDF1",
        detail: apiError.message,
      });
    }
  } catch (error) {
    if (browser) await browser.close();
    console.error("PDF generation error:", error);
    return res.status(500).json({
      status: "ERROR",
      error: "Unable to generate PDF2",
      detail: error.message,
    });
  }
};
