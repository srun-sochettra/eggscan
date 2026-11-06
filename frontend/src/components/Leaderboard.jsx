import { useState, useEffect } from 'react';
import { getLeaderboard } from '../api/eggscan';

export default function Leaderboard({ onScan }) {
  const [isOpen, setIsOpen] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchLeaderboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getLeaderboard();
      setLeaderboard(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setError('Failed to load leaderboard. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = () => {
    setIsOpen(true);
    fetchLeaderboard();
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <>
      <button
        onClick={handleOpen}
        className="fixed bottom-4 right-4 bg-white/80 backdrop-blur-sm border-2 border-brown-700 text-brown-700 font-bold py-2 px-4 rounded-full shadow-eggsm hover:bg-white transition-all z-50 font-display focus-visible:ring-2 focus-visible:ring-brown-500 outline-none"
      >
         Hall of Fame
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsOpen(false);
          }}
        >
          <div role="dialog" aria-modal="true" aria-labelledby="leaderboard-title" className="bg-[#FFFDF7] rounded-3xl shadow-xl border-4 border-brown-700 w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh] animate-[pop_0.2s_ease-out]">
            <div className="p-5 border-b-4 border-brown-700 flex justify-between items-center bg-[#FCE9B8]">
              <h2 id="leaderboard-title" className="font-display font-black text-2xl text-brown-700">Hall of Fame</h2>
              <button
                type="button"
                autoFocus
                onClick={() => setIsOpen(false)}
                aria-label="Close leaderboard"
                className="text-brown-700 font-bold text-xl hover:scale-110 transition-transform focus-visible:ring-2 focus-visible:ring-brown-500 outline-none rounded"
              >
                ✕
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1">
              {loading ? (
                <div className="text-center text-brown-500 py-10 font-bold">Loading legends...</div>
              ) : error ? (
                <div className="text-center text-red-500 py-10 font-bold">{error}</div>
              ) : leaderboard.length === 0 ? (
                <div className="text-center text-brown-500 py-10 font-bold">No one has been scanned yet!</div>
              ) : (
                <div className="space-y-3">
                  {leaderboard.map((scan, idx) => (
                    <button
                      key={scan.id || idx}
                      className="w-full text-left flex items-center gap-4 bg-white/60 p-3 rounded-xl border border-brown-200 hover:border-brown-400 cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-brown-500 outline-none"
                      onClick={() => {
                        window.history.pushState({}, '', `/?id=${scan.id}`);
                        window.location.reload();
                      }}
                    >
                      <div className="font-display font-black text-2xl text-brown-300 w-6 text-right">
                        #{idx + 1}
                      </div>
                      <img src={scan.avatarUrl} alt={`${scan.username}'s avatar`} className="w-10 h-10 rounded-full border border-brown-700" />
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-brown-700 truncate">{scan.username}</div>
                        <div className="text-xs text-brown-500 truncate">{scan.vibe}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-display font-black text-lg text-brown-700">{scan.eggScore}</div>
                        <div className="text-xs text-brown-500">{scan.eggVerdict}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
