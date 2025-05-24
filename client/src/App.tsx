import { useState, useRef, useEffect } from 'react';
import Webcam from 'react-webcam';
import { io, Socket } from 'socket.io-client';
import { ConnectionStatus } from './components/ConnectionStatus';
import './App.css';

interface Feedback {
  text: string;
  audio: string;
}

interface Error {
  message: string;
  details?: string;
}

function App() {
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [countdown, setCountdown] = useState(15);
  const [isMuted, setIsMuted] = useState(false);
  const webcamRef = useRef<Webcam>(null);
  const socketRef = useRef<Socket | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const intervalRef = useRef<number | null>(null);

  // Convert base64 to blob URL
  const base64ToBlobUrl = (base64: string) => {
    try {
      const byteString = atob(base64.split(',')[1]);
      const mimeString = base64.split(',')[0].split(':')[1].split(';')[0];
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      
      const blob = new Blob([ab], { type: mimeString });
      return URL.createObjectURL(blob);
    } catch (error) {
      console.error('Error converting base64 to blob:', error);
      return null;
    }
  };

  useEffect(() => {
    console.log('Initializing socket connection...');
    socketRef.current = io('http://localhost:3000');

    socketRef.current.on('connect', () => {
      console.log('Connected to server');
      setError(null);
    });

    socketRef.current.on('drawing-feedback', (newFeedback: Feedback) => {
      console.log('Received feedback:', newFeedback);
      setFeedback(newFeedback);
      setIsAnalyzing(false);
      setError(null);

      // Auto play audio feedback
      if (audioRef.current && !isMuted && newFeedback.audio) {
        try {
          const audioUrl = base64ToBlobUrl(newFeedback.audio);
          if (audioUrl) {
            audioRef.current.src = audioUrl;
            audioRef.current.play().catch(error => {
              console.error('Error playing audio:', error);
              setError({
                message: 'Failed to play audio feedback',
                details: error.message
              });
            });
          }
        } catch (error) {
          console.error('Error processing audio:', error);
          setError({
            message: 'Failed to process audio feedback',
            details: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
    });

    socketRef.current.on('error', (error: Error) => {
      console.error('Server error:', error);
      setError(error);
      setIsAnalyzing(false);
    });

    socketRef.current.on('connect_error', (error) => {
      console.error('Connection error:', error);
      setError({
        message: 'Failed to connect to server',
        details: error.message
      });
      setIsAnalyzing(false);
    });

    // Start auto-analysis
    startAutoAnalysis();

    return () => {
      console.log('Cleaning up socket connection...');
      socketRef.current?.disconnect();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const startAutoAnalysis = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    intervalRef.current = window.setInterval(() => {
      captureImage();
    }, 15000);
  };

  const captureImage = () => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc && socketRef.current) {
        console.log('Capturing image...');
        setIsAnalyzing(true);
        setError(null);
        socketRef.current.emit('analyze-drawing', imageSrc);
      } else {
        console.error('Failed to capture image or socket not connected');
        setError({
          message: 'Failed to capture image',
          details: 'Please check your camera and connection'
        });
      }
    }
  };

  useEffect(() => {
    // Countdown timer
    if (isAnalyzing) {
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 15;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [isAnalyzing]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 py-8 px-4 animate-gradient">
      <ConnectionStatus socket={socketRef.current} />
      
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-8 text-white bg-white/10 backdrop-blur-lg py-6 rounded-2xl shadow-2xl animate-float">
          Suretshi AI Drawing Assistant
        </h1>
        
        {error && (
          <div className="mb-4 p-4 bg-red-100/90 backdrop-blur-sm border border-red-400 text-red-700 rounded-2xl shadow-lg animate-shake">
            <p className="font-bold">Error: {error.message}</p>
            {error.details && <p className="text-sm">{error.details}</p>}
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Camera Section - Left Side */}
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-6 transform hover:scale-[1.02] transition-all duration-500 animate-float-slow">
            <div className="relative">
              <Webcam
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                className="w-full rounded-xl shadow-lg"
                videoConstraints={{
                  facingMode: "environment"
                }}
              />
              {isAnalyzing && (
                <div className="absolute top-4 right-4 bg-black/50 text-white px-4 py-2 rounded-full text-sm backdrop-blur-sm animate-pulse">
                  Analyzing in {countdown}s
                </div>
              )}
            </div>
            <div className="mt-4 flex items-center justify-between">
              <button
                onClick={() => setIsMuted(!isMuted)}
                className={`px-6 py-2 rounded-full text-white font-semibold transform hover:scale-105 transition-all duration-300 ${
                  isMuted 
                    ? 'bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/50' 
                    : 'bg-green-500 hover:bg-green-600 shadow-lg shadow-green-500/50'
                }`}
              >
                {isMuted ? 'Unmute' : 'Mute'}
              </button>
              <div className="text-sm text-white/90">
                Auto-analyzing every 15 seconds
              </div>
            </div>
          </div>

          {/* Feedback Section - Right Side */}
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-6 transform hover:scale-[1.02] transition-all duration-500 animate-float-slow">
            <h2 className="text-2xl font-semibold mb-4 text-white">Feedback</h2>
            {feedback ? (
              <div className="space-y-4">
                <p className="text-lg text-white bg-white/10 p-6 rounded-xl backdrop-blur-sm animate-fade-in">
                  {feedback.text}
                </p>
                <audio ref={audioRef} style={{ display: 'none' }} />
              </div>
            ) : (
              <p className="text-white/70 italic animate-pulse">
                Analyzing your drawing...
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
