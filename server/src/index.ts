import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { OpenAI } from 'openai';
import { TTSService } from './services/tts.service';

dotenv.config();

// Validate environment variables
if (!process.env.OPENAI_API_KEY) {
  console.error('OPENAI_API_KEY is not set in environment variables');
  process.exit(1);
}

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const ttsService = new TTSService(process.env.OPENAI_API_KEY);

// Memory for last 3 instructions per user
const userInstructions = new Map<string, string[]>();

// Log connection events
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('analyze-drawing', async (imageData: string) => {
    console.log('Received drawing analysis request from client:', socket.id);
    
    try {
      if (!imageData) {
        throw new Error('No image data received');
      }

      // Remove the data URL prefix to get the base64 image data
      const base64Image = imageData.replace(/^data:image\/\w+;base64,/, '');
      console.log('Image data processed, length:', base64Image.length);
      
      // Get last 3 instructions for this user
      const prevInstructions = userInstructions.get(socket.id) || [];
      
      // Add previous instructions to the system prompt for context
      const prevText = prevInstructions.length > 0 ? ` Предыдущие инструкции: ${prevInstructions.join(' | ')}.` : '';
      
      console.log('Sending request to OpenAI Vision API...');
      const prompt = `Ты — искусственный интеллект, помогающий рисовать. Проанализируй изображение и скажи, что нарисовать дальше и где именно на рисунке. Не предлагай улучшения и не давай советов — только конкретное указание, что и где нарисовать.${prevText} Не повторяй предыдущие инструкции. Ответь строго на русском языке, очень кратко, ровно 1-2 предложения.`;
      const messages = [
        {
          role: 'system',
          content: prompt
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Вот фото моего рисунка. Скажи, что нарисовать дальше и где.' },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
          ]
        }
      ];
      const response = await openai.chat.completions.create({
        model: "gpt-4-turbo",
        messages,
        max_tokens: 50
      });

      console.log('Received response from OpenAI Vision API');
      const feedback = response.choices[0].message.content;
      
      if (!feedback) {
        throw new Error('No feedback received from OpenAI');
      }

      // Update memory for this user
      const updatedInstructions = [...prevInstructions, feedback].slice(-3);
      userInstructions.set(socket.id, updatedInstructions);

      console.log('Converting feedback to speech...');
      const audioBuffer = await ttsService.textToSpeech(feedback);
      const audioBase64 = audioBuffer.toString('base64');
      console.log('Speech conversion completed');

      // Send both text and audio feedback
      const feedbackData = {
        text: feedback,
        audio: `data:audio/mp3;base64,${audioBase64}`
      };
      
      console.log('Sending feedback to client:', socket.id);
      socket.emit('drawing-feedback', feedbackData);
      console.log('Feedback sent successfully');
    } catch (error) {
      console.error('Error in drawing analysis:', error);
      let errorMessage = 'Failed to analyze drawing';
      let errorDetails = 'Unknown error';

      if (error instanceof Error) {
        errorMessage = error.message;
        if (error.message.includes('model')) {
          errorDetails = 'The AI model is currently unavailable. Please try again later.';
        } else if (error.message.includes('API')) {
          errorDetails = 'There was an issue connecting to the AI service. Please check your internet connection.';
        }
      }

      socket.emit('error', {
        message: errorMessage,
        details: errorDetails
      });
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    userInstructions.delete(socket.id);
  });

  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('OpenAI API Key status:', process.env.OPENAI_API_KEY ? 'Configured' : 'Not configured');
}); 