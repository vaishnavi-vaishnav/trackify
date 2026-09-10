const express = require("express");

const router = express.Router();

router.get("/", (req, res) => {
    res.json({
  "status": "OK",
  "server": "Trackify",
  "uptime": "Running"
});
});

module.exports = router;
