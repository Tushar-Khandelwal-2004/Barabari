import { OpenAI } from "langchain/llms/openai";
import { PromptTemplate } from "langchain/prompts";
import { LLMChain } from "langchain/chains";
import express from "express";
import dotenv from "dotenv";
import multer from "multer";
import path from "path";
import fs from "fs";
import pdf from "pdf-parse";
import bodyParser from "body-parser";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, file.fieldname + "-" + Date.now() + path.extname(file.originalname));
  },
});

if (!fs.existsSync("uploads/")) {
  fs.mkdirSync("uploads/");
}

const upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    const filetypes = /pdf|doc|docx|txt/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Error: Only PDF, Word, and text files are allowed!"));
    }
  },
});

const initLLM = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set in environment variables");
  }
  
  return new OpenAI({
    openAIApiKey: apiKey,
    modelName: "gpt-4", 
    temperature: 0.7,
  });
};
async function parsePDF(filePath: string): Promise<string> {
  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdf(dataBuffer);
  return data.text;
}
function readTextFile(filePath: string): string {
  return fs.readFileSync(filePath, "utf8");
}
async function extractTextFromFile(filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();
  
  if (ext === ".pdf") {
    return await parsePDF(filePath);
  } else if (ext === ".txt") {
    return readTextFile(filePath);
  } else if (ext === ".doc" || ext === ".docx") {
    throw new Error("Word document parsing not implemented in this example");
  } else {
    throw new Error(`Unsupported file type: ${ext}`);
  }
}

const analyzeResumePrompt = PromptTemplate.fromTemplate(`
You are an expert technical interviewer. Analyze this resume and identify the key skills, experience, 
and domain knowledge of the candidate:

RESUME:
{resumeText}

Based on the resume analysis, generate 10 technical interview questions that would help assess 
the candidate's expertise in their field. Focus on their core skills and domain knowledge.
The questions should be challenging but fair, and should help evaluate both their technical 
abilities and problem-solving skills.

For each question, include:
1. The question itself
2. What skill or knowledge area you're testing
3. What would constitute a good answer

Format the output as a JSON array of question objects with the following structure:
[
  {
    "question": "The interview question",
    "skill_tested": "The specific skill or knowledge being tested",
    "good_answer_criteria": "What would constitute a good answer"
  }
]
`);

app.post("/generate-questions", upload.single("resume"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const resumeText = await extractTextFromFile(req.file.path);
    
    const llm = initLLM();
    const chain = new LLMChain({
      llm,
      prompt: analyzeResumePrompt,
    });

    const result = await chain.call({
      resumeText,
    });

    let questions;
    try {
      questions = JSON.parse(result.text);
    } catch (error) {
      return res.json({ 
        raw_result: result.text,
        error: "Failed to parse result as JSON. Please check the format."
      });
    }

    return res.json({ questions });
  } catch (error) {
    console.error("Error generating questions:", error);
    return res.status(500).json({ error: error.message });
  } finally {
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
  }
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});