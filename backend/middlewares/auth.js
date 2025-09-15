const jwt = require("jsonwebtoken");
const pool = require("../db");

const authenticateToken = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access token required",
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from database
    const userResult = await pool.query(
      "SELECT id, full_name, email, email_verified FROM users WHERE id = $1",
      [decoded.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    // Add user to request object
    req.user = userResult.rows[0];
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(403).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};

const requireAdmin = async (req, res, next) => {
  try {
    // First check if user is authenticated
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // Check if user has admin role (you'd need to add role column to users table)
    const adminCheck = await pool.query(
      `
            SELECT user_type FROM users WHERE id = $1 AND user_type = 'admin'
        `,
      [req.userId]
    );

    if (
      adminCheck.rows.length === 0 ||
      adminCheck.rows[0].user_type !== "admin"
    ) {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    next();
  } catch (error) {
    console.error("Admin middleware error:", error);
    res.status(500).json({
      success: false,
      message: "Authorization error occurred",
    });
  }
};
const requireEmailVerified = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  if (!req.user.email_verified) {
    return res.status(403).json({
      success: false,
      message: "Email verification required. Please check your email.",
    });
  }

  next();
};
module.exports = { authenticateToken, requireAdmin, requireEmailVerified };
