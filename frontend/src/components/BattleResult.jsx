import React, { useRef } from 'react';
import { toBlob } from 'html-to-image';

export default function BattleResult({ data }) {
    const isU1Winner = String(data.winnerUsername).toLowerCase() === String(data.user1.username).toLowerCase();
    const reportRef = useRef(null);

    const handleShare = async () => {
        if (!reportRef.current) return;

        try {
            const blob = await toBlob(reportRef.current, {
                pixelRatio: 2,
                backgroundColor: null,
            });

            if (!blob) throw new Error('Failed to create blob from node');

            const file = new File([blob], 'battle-result.png', { type: 'image/png' });

            if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    title: 'EggScan Battle Result',
                    text: `Check out this epic battle between ${data.user1.username} and ${data.user2.username}!`,
                    files: [file]
                });
            } else {
                // Fallback to download
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'battle-result.png';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }
        } catch (error) {
            console.error('Error sharing image:', error);
        }
    };

    return (
        <div className="space-y-5 mt-10 animate-[pop_0.4s_ease-out]">
            <div ref={reportRef} className="card p-6 bg-gradient-to-br from-[#FFFDF7] to-[#FCE9B8] border-4 border-brown-700 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10"></div>
                <h2 className="font-display font-black text-3xl text-center text-brown-700 mb-6 uppercase tracking-wider">Battle Report</h2>

                <p className="text-brown-700 text-lg leading-relaxed mb-8 italic text-center font-medium bg-white/50 p-4 rounded-xl shadow-inner">
                    "{data.battleReport}"
                </p>

                <div className="flex flex-col sm:flex-row gap-6 items-stretch justify-center relative">
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none hidden sm:flex z-50">
                         <span className="bg-brown-700 text-white font-black font-display p-2 rounded-full shadow-lg border-2 border-white">VS</span>
                    </div>

                    <PlayerCard user={data.user1} isWinner={isU1Winner} />
                    <PlayerCard user={data.user2} isWinner={!isU1Winner} />
                </div>
            </div>

            <div className="flex justify-center mt-4">
                <button
                    onClick={handleShare}
                    className="btn-secondary flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-brown-500 outline-none"
                >
                    <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
                        <polyline points="16 6 12 2 8 6"></polyline>
                        <line x1="12" y1="2" x2="12" y2="15"></line>
                    </svg>
                    Share Battle
                </button>
            </div>
        </div>
    );
}

function PlayerCard({ user, isWinner }) {
    return (
        <div className={`flex-1 rounded-2xl p-4 flex flex-col items-center text-center transition-transform ${isWinner ? 'bg-yolk shadow-lg scale-105 z-10 border-4 border-brown-700' : 'bg-white/60 opacity-80 border-2 border-brown-300'}`}>
            {isWinner && <div className="text-3xl mb-2 animate-bounce"></div>}
            <img src={user.avatarUrl} alt="" className={`w-20 h-20 rounded-full mb-3 shadow-md ${isWinner ? 'border-4 border-white' : 'border-2 border-brown-400 grayscale'}`} />
            <h3 className="font-display font-bold text-xl text-brown-700 truncate w-full">{user.username}</h3>
            <div className="text-brown-600 font-medium my-2 bg-white/50 px-3 py-1 rounded-full">Score: {user.eggScore}</div>
            <div className="mt-auto pt-3 flex gap-2">
                 <span className="text-xl">{user.eggEmoji}</span>
                 <span className="text-xs font-bold text-brown-500 uppercase tracking-wider self-center">{user.eggVerdict}</span>
            </div>
        </div>
    );
}
