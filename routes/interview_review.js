const express = require("express");
const { Groq } = require("groq-sdk");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const router = express.Router();

// Initialize Supabase
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY, // Service role key
  { auth: { persistSession: false } }
);

// Initialize Groq
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

/**
 * Route to generate and save interview questions
 */
router.post("/interview_review/:id", async (req, res) => {
  try {
    const { questions, responses, started_at } = req.body;
    const { id } = req.params;

    // Input validation
    if (
      !Array.isArray(questions) ||
      !Array.isArray(responses) ||
      questions.length !== responses.length
    ) {
      return res.status(400).json({
        error:
          "Invalid input. Questions and responses must be provided as arrays of equal length.",
      });
    }

    // Function to calculate rating as a percentage (0–100%)
    const rateResponse = (responseContent) => {
      const criteria = ["coherent", "relevant", "detailed", "clear"];
      const lowerContent = responseContent.toLowerCase();
      let score = 0;

      criteria.forEach((criterion) => {
        if (lowerContent.includes(criterion)) {
          score++;
        }
      });

      return `${Math.round((score / criteria.length) * 100)}%`;
    };

    // Generate feedback for each response
    const feedbackPromises = questions.map(async (question, index) => {
      const response = responses[index];

      try {
        const chatCompletion = await groq.chat.completions.create({
          messages: [
            {
              role: "system",
              content:
                "You are an expert interviewer. Provide concise one-line feedback on the candidate's response. Then, give guidance on how to approach the question effectively, followed by an example.",
            },
            {
              role: "user",
              content: `Question: "${question}"\nResponse: "${response}"`,
            },
          ],
          model: "llama-3.3-70b-versatile",
          temperature: 0.7,
          max_tokens: 200,
          top_p: 1,
          stream: false,
        });

        // Extract feedback content
        const responseContent =
          chatCompletion.choices[0]?.message?.content ||
          "No feedback available.";
        const lines = responseContent
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line);

        let feedback = lines[0] || "No feedback available.";
        let approach = [];
        let example = "";

        for (let i = 1; i < lines.length; i++) {
          if (lines[i].toLowerCase().includes("example")) {
            example = lines[i];
            break;
          } else {
            approach.push(lines[i]);
          }
        }

        // Generate rating as a percentage (0–100%)
        const rating = rateResponse(responseContent);

        return {
          question,
          response,
          feedback,
          approach: approach.join(" ") || "No approach guidance available.",
          example: example || "No example available.",
          rating,
        };
      } catch (error) {
        console.error(
          "Error generating feedback for question:",
          question,
          error
        );
        return {
          question,
          response,
          feedback: "Error generating feedback.",
          approach: "Error generating approach.",
          example: "Error generating example.",
          rating: "0%",
        };
      }
    });

    const feedbackResults = await Promise.all(feedbackPromises);
    const ratings = feedbackResults.map((item) => item.rating);
    const totalScore = ratings.reduce((sum, rating) => sum + rating, 0); // Sum of all ratings
    const averageScore = totalScore / ratings.length || 0;
    // Calculate duration
    const completedAt = new Date(); // Get current timestamp as a Date object
    const startedAtDate = new Date(started_at); // Ensure it's a Date object
    const durationMs = completedAt.getTime() - startedAtDate.getTime();
    const durationMinutes = Math.round(durationMs / 60000);
    // 1 min = 60000 ms

    // Save to Supabase
    const { data, error } = await supabaseAdmin
      .from("mock_interview")
      .update({
        answers: responses,
        feedback: feedbackResults, // Store as an array of objects
        rating: feedbackResults.map((item) => item.rating),
        status: "completed",
        completed_at: new Date().toISOString(),
        duration: durationMinutes, // Calculate duration
        overall_score: averageScore,
      })
      .eq("id", id)
      .select(); // Fetch updated data

    // Handle Supabase error
    if (error) {
      console.error("Error saving to Supabase:", error);
      return res
        .status(500)
        .json({ error: "Failed to save feedback to database." });
    }

    res.json({ message: "Feedback saved successfully", data });
  } catch (error) {
    console.error("Error in generateFeedback:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;
