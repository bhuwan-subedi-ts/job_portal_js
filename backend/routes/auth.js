const express = require("express");
const pool = require("../db");

const {
  hashPassword,
  comparePassword,
  generateToken,
  isValidEmail,
  isValidPassword,
  generateRandomToken,
} = require("../utils/auth");

const { sendVerificationEmail, sendWelcomeEmail } = require("../emailservice");
const router = express.Router();

router.post("/register", async (req, res) => {
  try {
    const { name, email, password, user_type } = req.body;

    console.log("Registration attempt:", { name, email, password, user_type });

    if (!name || !email || !password || !user_type) {
      return res.status(400).json({
        success: false,
        message: "Name, email, password, and user type are required",
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address",
      });
    }

    if (!isValidPassword(password)) {
      return res.status(400).json({
        success: false,
        message:
          "Password must be at least 6 characters with letters and numbers",
      });
    }

    if (user_type !== "admin" && user_type !== "job_seeker") {
      return res.status(400).json({
        success: false,
        message: "Invalid user type",
      });
    }

    const existingUserQuery = "SELECT id FROM users WHERE email = $1";
    const existingUser = await pool.query(existingUserQuery, [
      email.toLowerCase(),
    ]);

    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: "User with this email already exists",
      });
    }

    const passwordHash = await hashPassword(password);
    console.log("Password hashed successfully");

    const verificationToken = generateRandomToken();
    console.log("Verification token generated:", verificationToken);

    const insertUserQuery = `
            INSERT INTO users (full_name, email, 
            password_hash,password,user_type,email_verified,verification_token) 
            VALUES ($1, $2, $3, $4, $5, $6, $7) 
            RETURNING id, full_name, email, created_at, user_type
        `;

    const result = await pool.query(insertUserQuery, [
      name.trim(),
      email.toLowerCase().trim(),
      passwordHash,
      passwordHash,
      user_type.trim(),
      false,
      verificationToken,
    ]);

    const newUser = result.rows[0];
    console.log("User created:", newUser.id); // Debug log

    try {
      await sendVerificationEmail(email, verificationToken, name);
      console.log("Verification email sent successfully");
    } catch (emailError) {
      console.error("Email sending failed:", emailError);
    }
    // ===== SUCCESS RESPONSE =====

    res.status(201).json({
      success: true,
      message: `Registration successful! 
      Please check your email and click the verification 
      link to activate your account.`,
      user: {
        id: newUser.id,
        name: newUser.full_name,
        email: newUser.email,
        createdAt: newUser.created_at,
        userType: newUser.user_type,
        emailVerified: false,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);

    // Handle specific database errors
    if (error.code === "23505") {
      // Unique violation
      return res.status(400).json({
        success: false,
        message: "User with this email already exists",
      });
    }

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log("Login attempt:", { email }); // Debug log

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    // ===== FIND USER =====

    const findUserQuery = `
            SELECT id, name, email, password_hash, created_at 
            FROM users 
            WHERE email = $1
        `;

    const result = await pool.query(findUserQuery, [email.toLowerCase()]);

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const user = result.rows[0];
    console.log("User found:", user.id); // Debug log

    // ===== VERIFY PASSWORD =====

    const isPasswordValid = await comparePassword(password, user.password_hash);

    if (!isPasswordValid) {
      console.log("Invalid password for user:", user.id); // Debug log
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    console.log("Password verified for user:", user.id); // Debug log

    const token = generateToken(user.id, user.user_type);
    console.log("Token generated for user:", user.id); // Debug log

    res.json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.created_at,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

router.get("/test", (req, res) => {
  res.json({
    success: true,
    message: "Auth routes are working!",
    timestamp: new Date().toISOString(),
  });
});

router.get("/verify-email", async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Verification token is required",
      });
    }

    // ===== FIND USER WITH TOKEN =====
    const result = await pool.query(
      `
            SELECT id, full_name, email, email_verified 
            FROM users 
            WHERE verification_token = $1
        `,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired verification token",
      });
    }

    const user = result.rows[0];

    // Check if already verified
    if (user.email_verified) {
      return res.json({
        success: true,
        message: "Email is already verified",
      });
    }

    // ===== VERIFY EMAIL =====
    await pool.query(
      `
            UPDATE users 
            SET email_verified = true, 
                verification_token = null
            WHERE id = $1
        `,
      [user.id]
    );

    console.log("Email verified for user:", user.id);

    // ===== SEND WELCOME EMAIL =====
    try {
      await sendWelcomeEmail(user.email, user.full_name);
    } catch (emailError) {
      console.error("Welcome email failed:", emailError);
      // Don't fail verification if welcome email fails
    }

    res.json({
      success: true,
      message: "Email verified successfully! Your account is now active.",
      user: {
        id: user.id,
        name: user.full_name,
        email: user.email,
        emailVerified: true,
      },
    });
  } catch (error) {
    console.error("Email verification error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

module.exports = router;
