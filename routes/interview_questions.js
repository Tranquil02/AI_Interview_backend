const express = require("express");
const { Groq } = require("groq-sdk");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const router = express.Router();

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Initialize Groq
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

/**
 * Route to generate and save interview questions
 */
router.post("/generate-questions", async (req, res) => {
  try {
    const { skills, experience, questionType, company, position, user_id } =
      req.body;

    if (!questionType || !company || !position) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const prompt = `This is ${questionType} interview Generate 4 questions to evaluate a candidate's skills in ${skills} with ${experience} years of experience,for applying in ${company} at the position of ${position}. Do not provide any introduction or explanations. Only provide the 4 questions. Avoid asking questions for make a program.`;

    // Generate questions using Groq API
    const response = await groq.chat.completions.create({
      messages: [
        { role: "system", content: "You are an expert interviewer" },
        { role: "user", content: prompt },
      ],
      model: "llama-3.3-70b-versatile",
      max_tokens: 200,
      temperature: 0.7,
    });

    // Format the questions
    const questions = response.choices[0]?.message?.content
      ?.split("\n")
      .map((q) => q.trim())
      .filter((q) => q)
      .map((q) => q.replace(/^\d+\.\s*/, ""));

    if (!questions || questions.length === 0) {
      return res.status(500).json({ error: "Failed to generate questions." });
    }

    // const{data:user}=await supabase.auth.getUser();
    //Store in Supabase
    const { data, error } = await supabase
      .from("mock_interview")
      .insert([
        {
          user_id: user_id,
          interview_type: questionType,
          questions: questions,
          company_applied: company,
          position_applied: position,
          status: "ongoing",
        },
      ])
       // Ensure the ID is returned

    if (error) throw error;

    res.json({
      questions,
      message: "Questions saved successfully!",
      id: data?.[0]?.id,
    });
  } catch (error) {
    console.error("Error generating or saving questions:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * Route to retrieve saved interview questions
 */
router.get("/get-questions", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("interview_questions")
      .select("*");

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error("Error fetching questions:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;
