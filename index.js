require("dotenv").config();
const express = require("express");
const cors = require("cors");

// Import Routes
const questionRoutes = require("./routes/interview_questions");
const interviewReviewRoutes = require("./routes/interview_review");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(cors());

// Use Routes
app.use("/api", questionRoutes);
app.use("/api", interviewReviewRoutes);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
