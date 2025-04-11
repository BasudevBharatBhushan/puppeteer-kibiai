const puppeteer = require("puppeteer");
const axios = require("axios");
const PDFDocument = require("pdf-lib").PDFDocument;

exports.generatePdfFromHtml = async (req, res) => {
  const { pages, pageSize, reportID, styles } = req.body;

  // Validate input
  if (!pages || !Array.isArray(pages) || pages.length === 0) {
    return res.status(400).json({
      error:
        "Invalid input: Expected 'pages' as a non-empty array of { styles, body } objects",
    });
  }

  // Set default page size
  const validPageSizes = ["letter", "a4", "A4", "Letter"];
  const format = validPageSizes.includes((pageSize || "").toLowerCase())
    ? pageSize
    : "letter";

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

    // Create array to hold individual page PDFs
    const pdfBuffers = [];

    // Process each page
    for (const page of pages) {
      const { body } = page;

      if (typeof body !== "string") {
        await browser.close();
        return res.status(400).json({
          error:
            "Invalid page format: Each page must have 'styles' and 'body' as strings",
        });
      }

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

      const browserPage = await browser.newPage();

      // Enhance quality by setting device scale factor (for CSS rendering)
      await browserPage.setViewport({
        width: 794, // 210mm at 96 DPI
        height: 1123, // 297mm at 96 DPI
        deviceScaleFactor: 2,
      });

      await browserPage.setContent(htmlContent, { waitUntil: "networkidle0" });

      const pdfBuffer = await browserPage.pdf({
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

      // Check if PDF is not blank before adding it
      const isBlankPage = await isBufferBlankPdf(pdfBuffer);
      if (!isBlankPage) {
        pdfBuffers.push(pdfBuffer);
      }

      await browserPage.close();
    }

    await browser.close();

    if (pdfBuffers.length === 0) {
      return res.status(400).json({
        error: "No valid content to generate PDF",
      });
    }

    // Merge all PDFs into one using PDFLib
    const mergedPdfBuffer = await mergePdfs(pdfBuffers);

    // Convert merged PDF buffer to base64
    const base64PDF = Buffer.from(mergedPdfBuffer).toString("base64");

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

// Helper function to merge PDF buffers into a single PDF
async function mergePdfs(pdfBuffers) {
  const mergedPdf = await PDFDocument.create();

  for (const pdfBuffer of pdfBuffers) {
    const pdf = await PDFDocument.load(pdfBuffer);
    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    copiedPages.forEach((page) => {
      mergedPdf.addPage(page);
    });
  }

  return Buffer.from(await mergedPdf.save());
}

// Helper function to detect if a PDF is blank
async function isBufferBlankPdf(pdfBuffer) {
  try {
    const PDFDocument = require("pdf-lib").PDFDocument;
    const pdf = await PDFDocument.load(pdfBuffer);

    // Check if PDF has any content
    if (pdf.getPageCount() === 0) {
      return true;
    }

    // Additional checks could be implemented here to detect blank pages
    // For a more thorough check, you might need to analyze the PDF content more deeply

    // For now, assuming pages with minimal byte size are blank
    // This threshold may need adjustment based on your specific case
    const minContentSize = 1000; // Adjust this threshold as needed
    return pdfBuffer.length < minContentSize;
  } catch (error) {
    console.error("Error checking blank PDF:", error);
    return false; // When in doubt, don't skip the page
  }
}
