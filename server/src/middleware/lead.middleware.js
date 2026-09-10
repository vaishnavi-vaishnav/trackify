const leadOnly = (req, res, next) => {
  if (req.user.role !== "lead") {
    return res.status(403).json({
      success: false,
      message: "Access denied. Leads only.",
    });
  }
  next();
};

const leadOrAdmin = (req, res, next) => {
  if (req.user.role !== "lead" && req.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Access denied. Leads and admins only.",
    });
  }
  next();
};

module.exports = { leadOnly, leadOrAdmin };
