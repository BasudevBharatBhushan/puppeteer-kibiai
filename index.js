// app.js

require("dotenv").config();
const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const cors = require("cors");

// Routes
const indexRoutes = require("./routes/index");

// Middlewares
// app.use(bodyParser.json());
app.use(express.json({ limit: "2mb" }));

app.use(cookieParser());
// app.use(cors());
app.use(cors({
  origin: "*", // or "*" if you want to allow all temporarily
  credentials: true // if cookies are used
}));

// ✅ This is required to parse JSON request bodies

// My Routes
app.use("/api", indexRoutes);

// Export the function for running the server
module.exports.run = function (port = process.env.PORT || 8000) {
  app.get("/", (req, res) => {
    res.send("Server is running.");
  });

  app.listen(port, () => {
    console.log(`app is running at ${port}`);
  });
};

// If the file is run directly, start the server with the default port
if (require.main === module) {
  module.exports.run();
}
