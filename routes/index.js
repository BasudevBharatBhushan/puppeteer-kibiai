const express = require("express");
const router = express.Router();
const { generatePdfFromHtml } = require("../controllers/index");

router.post("/generate-pdf", generatePdfFromHtml);

module.exports = router;
