import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { OpenAI } from 'openai';
import axios from 'axios';

dotenv.config();

console.log('Environment variables loaded:');
console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'Configured' : 'Not configured');
console.log('GOOGLE_API_KEY:', process.env.GOOGLE_API_KEY ? 'Configured' : 'Not configured');
console.log('GOOGLE_CSE_ID:', process.env.GOOGLE_CSE_ID ? 'Configured' : 'Not configured');

// Validate environment variables
const requiredEnvVars = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
  GOOGLE_CSE_ID: process.env.GOOGLE_CSE_ID
};

const missingEnvVars = Object.entries(requiredEnvVars)
  .filter(([_, value]) => !value)
  .map(([key]) => key);

if (missingEnvVars.length > 0) {
  console.error('Missing required environment variables:', missingEnvVars.join(', '));
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

// Memory for last 3 instructions per user
const userInstructions = new Map<string, string[]>();

// Replace TTSService usage with direct function
const ttsTextToSpeech = async (text: string, openai: any) => {
  try {
    const response = await openai.audio.speech.create({
      model: "tts-1",
      voice: "alloy",
      input: text,
    });
    const buffer = Buffer.from(await response.arrayBuffer());
    return buffer;
  } catch (error) {
    console.error('Error in text-to-speech conversion:', error);
    throw new Error('Failed to convert text to speech');
  }
};

// Add Google Custom Search integration
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const GOOGLE_CSE_ID = process.env.GOOGLE_CSE_ID;
const GOOGLE_SEARCH_ENDPOINT = 'https://www.googleapis.com/customsearch/v1';

// Add test endpoint for search
app.get('/test-search', async (req, res) => {
  try {
    const testQuery = 'cat drawing';
    console.log('Testing search with query:', testQuery);
    const images = await searchImages(testQuery);
    res.json({ success: true, images });
  } catch (error) {
    console.error('Test search error:', error);
    res.status(500).json({ success: false, error: 'Search test failed' });
  }
});

async function searchImages(query: string, count = 3): Promise<string[]> {
  if (!GOOGLE_API_KEY || !GOOGLE_CSE_ID) {
    console.error('Google Search API credentials missing:', {
      hasKey: !!GOOGLE_API_KEY,
      hasCseId: !!GOOGLE_CSE_ID
    });
    return [];
  }
  try {
    console.log('Searching Google Images with query:', query);
    const response = await axios.get(GOOGLE_SEARCH_ENDPOINT, {
      params: {
        key: GOOGLE_API_KEY,
        cx: GOOGLE_CSE_ID,
        searchType: 'image',
        q: query,
        num: count
      }
    });
    console.log('Google Search API response:', {
      status: response.status,
      itemsCount: response.data.items?.length || 0
    });
    const images = (response.data.items || []).map((item: any) => item.link).slice(0, count);
    console.log('Found images:', images);
    return images;
  } catch (e: any) {
    console.error('Google image search error:', {
      message: e.message,
      response: e.response?.data,
      status: e.response?.status
    });
    return [];
  }
}

// Add at the top:
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

async function openaiVisionRequest(messages: any, max_tokens = 50) {
  try {
    const response = await axios.post(OPENAI_API_URL, {
      model: 'gpt-4-turbo',
      messages,
      max_tokens
    }, {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    return response.data;
  } catch (e: any) {
    console.error('OpenAI Vision API error:', e.response?.data || e);
    throw new Error('Failed to get vision response');
  }
}

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
      // Feedback request
      const feedbackResponse = await openaiVisionRequest(messages, 50);
      const feedback = feedbackResponse.choices[0].message.content;
      if (!feedback) {
        throw new Error('No feedback received from OpenAI');
      }

      // Update memory for this user
      const updatedInstructions = [...prevInstructions, feedback].slice(-3);
      userInstructions.set(socket.id, updatedInstructions);

      console.log('Converting feedback to speech...');
      const audioBuffer = await ttsTextToSpeech(feedback, openai);
      const audioBase64 = audioBuffer.toString('base64');
      console.log('Speech conversion completed');

      // Keyword extraction
      const keywordPrompt = `На основе этого рисунка, дай только одно ключевое слово или короткую фразу (1-3 слова) на английском, чтобы найти референс-изображения для улучшения этого рисунка.`;
      const keywordMessages = [
        { role: 'system', content: keywordPrompt },
        messages[1]
      ];
      const keywordResponse = await openaiVisionRequest(keywordMessages, 10);
      const searchKeyword = keywordResponse.choices[0].message.content?.trim() || '';
      const imageUrls = searchKeyword ? await searchImages(searchKeyword) : [];

      // Send both text, audio feedback, and images
      const feedbackData = {
        text: feedback,
        audio: `data:audio/mp3;base64,${audioBase64}`,
        images: imageUrls
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

const PORT = 3001;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('OpenAI API Key status:', process.env.OPENAI_API_KEY ? 'Configured' : 'Not configured');
  console.log('Google API Key status:', process.env.GOOGLE_API_KEY ? 'Configured' : 'Not configured');
  console.log('Google CSE ID status:', process.env.GOOGLE_CSE_ID ? 'Configured' : 'Not configured');
}); 
