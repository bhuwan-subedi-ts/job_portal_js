const express = require("express");
const app = express();
const PORT = 5000;
const pool = require("./db");

const authRoutes = require("./routes/auth");
app.use(express.json());
app.use("/api/auth", authRoutes);

app.get("/api/test", (req, res) => {
  res.json({
    message: "Server is working!",
    timestamp: new Date().toISOString(),
  });
});
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

app.get("/api/users", async (req, res) => {
  try {
    const users = await getUsers();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
});
app.get("/api/jobs", async (req, res) => {
  try {
    const jobs = await getJobs();
    res.json(jobs);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch jobs" });
  }
});

async function getUsers() {
  try {
    const result = await pool.query("SELECT * FROM users");
    return result.rows;
  } catch (error) {
    console.error("Error fetching users:", error);
    throw error;
  }
}

async function getJobs() {
  try {
    const result = await pool.query("SELECT * FROM jobs");
    return result.rows;
  } catch (error) {
    console.error("Error fetching jobs:", error);
    throw error;
  }
}

async function createJob(jobData) {
  try {
    const result = await pool.query(
      `INSERT INTO jobs (title, description, company, location, salary_range, posted_by) 
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        jobData.title,
        jobData.description,
        jobData.company,
        jobData.location,
        jobData.salary_range,
        jobData.posted_by,
      ]
    );
    return result.rows[0];
  } catch (error) {
    console.error("Error creating job:", error);
    throw error;
  }
}
async function createJobApplication(applicationData) {
  try {
    const result = await pool.query(
      `INSERT INTO job_applications (job_id, applicant_id, 
      cover_letter, status, applied_at) 
      VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [
        applicationData.job_id,
        applicationData.applicant_id,
        applicationData.cover_letter,
        applicationData.status,
        applicationData.applied_at,
      ]
    );
    return result.rows[0];
  } catch (error) {
    console.error("Error creating job application:", error);
    throw error;
  }
}

app.post("/api/createjob", async (req, res) => {
  console.log("Creating job:", req.body);
  try {
    const { title, description, company, location, salary_range, posted_by } =
      req.body;
    const newJob = await createJob({
      title,
      description,
      company,
      location,
      salary_range,
      posted_by,
    });
    res.status(201).json(newJob);
  } catch (error) {
    console.error("Error in /api/createjob:", error);
    res.status(500).json({ error: "Failed to create job" });
  }
});
