export interface RubricItem {
    category: string;
    criteria: string;
    description: string;
    weight: number;
}

export interface FeedbackResult {
    overall: {
        score: number;
        summary: string;
    };
    categories: {
        [category: string]: {
            score: number;
            feedback: string;
            strengths: string[];
            areasForImprovement: string[];
        }
    };
    transcription?: string;
}
