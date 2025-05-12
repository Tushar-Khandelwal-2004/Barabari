import { OpenAI } from 'openai';
import fs from 'fs';
import { AudioProcessingResult } from './audio';
import { RubricItem, FeedbackResult } from './rubrics';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

export async function processAudio(filePath: string): Promise<AudioProcessingResult> {
    try {
        const audioFile = fs.createReadStream(filePath);

        const transcription = await openai.audio.transcriptions.create({
            file: audioFile,
            model: 'whisper-1',
            response_format: 'verbose_json'
        });

        return {
            transcription: transcription.text,
            confidence: transcription.segments?.map(s => s.confidence || 0).reduce((acc, val) => acc + val, 0) /
                (transcription.segments?.length || 1) || 1.0,
            duration: transcription.duration || 0,
            metadata: {
                segments: transcription.segments
            }
        };
    } catch (error) {
        console.error('Error processing audio:', error);
        throw new Error('Failed to process audio file');
    }
}

export async function generateFeedback(
    audioResult: AudioProcessingResult,
    rubrics: RubricItem[]
): Promise<FeedbackResult> {
    try {
        const prompt = createFeedbackPrompt(audioResult, rubrics);

        const completion = await openai.chat.completions.create({
            model: "gpt-4-turbo",
            messages: [
                {
                    role: "system",
                    content: "You are an expert evaluator providing detailed feedback based on audio transcriptions and predefined rubrics. Your feedback should be constructive, specific, and actionable."
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            response_format: { type: "json_object" }
        });

        const feedbackResponse = JSON.parse(completion.choices[0].message.content || '{}');

        return formatFeedbackResponse(feedbackResponse, audioResult);
    } catch (error) {
        console.error('Error generating feedback:', error);
        throw new Error('Failed to generate feedback');
    }
}

function createFeedbackPrompt(audioResult: AudioProcessingResult, rubrics: RubricItem[]): string {
    const { transcription } = audioResult;

    let prompt = `
Please evaluate the following transcription based on the provided rubrics. 
Provide a comprehensive evaluation with specific feedback, strengths, and areas for improvement for each category.

## Transcription:
"${transcription}"

## Rubrics for Evaluation:
`;

    rubrics.forEach(rubric => {
        prompt += `
### ${rubric.category} (Weight: ${rubric.weight}%)
Criteria: ${rubric.criteria}
Description: ${rubric.description}
`;
    });

    prompt += `
Please provide your evaluation in JSON format with the following structure:
{
  "overall": {
    "score": numeric score from 0-100,
    "summary": "brief overall assessment"
  },
  "categories": {
    "[category name]": {
      "score": numeric score from 0-100,
      "feedback": "detailed feedback for this category",
      "strengths": ["strength 1", "strength 2", ...],
      "areasForImprovement": ["area 1", "area 2", ...]
    }
  }
}
`;

    return prompt;
}

function formatFeedbackResponse(
    feedbackResponse: any,
    audioResult: AudioProcessingResult
): FeedbackResult {
    return {
        ...feedbackResponse,
        transcription: audioResult.transcription
    };
}
