import express from 'express';
import multer from 'multer';
import cors from 'cors';
import dotenv from 'dotenv';
import { processAudio, generateFeedback } from './types/audioProcessingService';
import { validateRubrics } from './utils/validators';
import { RubricItem } from './types/rubrics';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, './uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('audio/')) {
            cb(null, true);
        } else {
            cb(new Error('Only audio files are allowed'));
        }
    }
});

app.post('/api/feedback', upload.single('audioFile'), async (req, res) => {
    try {
        if (!req.file) {
            res.status(400).json({ error: 'No audio file uploaded' });
            return;
        }

        const rubrics: RubricItem[] = req.body.rubrics ? JSON.parse(req.body.rubrics) : [];

        if (!validateRubrics(rubrics)) {
            res.status(400).json({ error: 'Invalid rubrics format' });
            return;
        }

        const audioProcessingResult = await processAudio(req.file.path);
        const feedbackReport = await generateFeedback(audioProcessingResult, rubrics);

        res.status(200).json({
            success: true,
            feedback: feedbackReport
        });
    } catch (error) {
        console.error('Error processing feedback request:', error);
        res.status(500).json({
            error: 'Failed to process feedback',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});


app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
