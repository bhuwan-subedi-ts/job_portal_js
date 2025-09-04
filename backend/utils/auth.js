const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const hashPassword = async (password) => {
  try {
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
  } catch (error) {
    throw new Error("Error hashing password");
  }
};

const comparePassword = async (password, hashedPassword) => {
  try {
    return await bcrypt.compare(password, hashedPassword);
  } catch (error) {
    throw new Error("Error comparing passwords");
  }
};

const generateToken = (userId, userType) => {
  try {
    return jwt.sign({ userId, userType }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    });
  } catch (error) {
    throw new Error("Error generating token");
  }
};

const isValidEmail = (email) => {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
};

const isValidPassword = (password) => {
  const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&_-]{6,}$/;
  return passwordRegex.test(password);
};
const generateRandomToken = () => {
  return crypto.randomBytes(32).toString("hex");
};

const generateExpiringToken = () => {
  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 3600000); // 1 hour from now
  return { token, expires };
};

module.exports = {
  hashPassword,
  comparePassword,
  generateToken,
  isValidEmail,
  isValidPassword,
  generateRandomToken,
  generateExpiringToken,
};
