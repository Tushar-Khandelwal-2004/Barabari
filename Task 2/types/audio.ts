export interface AudioProcessingResult {
    transcription: string;
    confidence: number;
    duration: number;
    metadata?: {
        [key: string]: any;
    };
}
