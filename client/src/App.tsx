// ... existing code ...
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 py-8 px-4 animate-gradient flex items-center justify-center">
      <div className="w-full max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
        {/* Left: Camera View */}
        <div className="flex flex-col justify-center bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-6 min-h-[400px]">
          <h2 className="text-2xl font-semibold mb-4 text-white text-center">Камера</h2>
          <div className="flex-1 flex items-center justify-center">
            <Webcam
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              className="w-full rounded-xl shadow-lg aspect-video object-cover"
              videoConstraints={{ facingMode: "environment" }}
            />
          </div>
        </div>

        {/* Right: Controls & Feedback */}
        <div className="flex flex-col justify-between bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-6">
          <h1 className="text-3xl md:text-4xl font-bold text-center mb-6 text-white bg-white/10 backdrop-blur-lg py-4 rounded-2xl shadow-xl animate-float">
            Suretshi AI Drawing Assistant
          </h1>

          {error && (
            <div className="mb-4 p-4 bg-red-100/90 backdrop-blur-sm border border-red-400 text-red-700 rounded-2xl shadow-lg animate-shake">
              <p className="font-bold">Error: {error.message}</p>
              {error.details && <p className="text-sm">{error.details}</p>}
            </div>
          )}

          <div className="flex flex-col gap-4 flex-1 justify-center">
            <div className="flex items-center justify-between mb-2">
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
                Авто-анализ каждые 15 секунд
              </div>
            </div>

            <div className="flex items-center justify-between mb-2">
              {isAnalyzing && (
                <div className="bg-black/50 text-white px-4 py-2 rounded-full text-sm backdrop-blur-sm animate-pulse">
                  Анализ через {countdown}с
                </div>
              )}
            </div>

            <div className="flex-1 flex flex-col justify-center">
              <h2 className="text-2xl font-semibold mb-4 text-white">Обратная связь</h2>
              {feedback ? (
                <div className="space-y-4">
                  <p className="text-lg text-white bg-white/10 p-6 rounded-xl backdrop-blur-sm animate-fade-in">
                    {feedback.text}
                  </p>
                  <audio ref={audioRef} style={{ display: 'none' }} />
                </div>
              ) : (
                <p className="text-white/70 italic animate-pulse">
                  Анализ вашего рисунка...
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
// ... existing code ...
