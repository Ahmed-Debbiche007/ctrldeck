import { Pause, Music } from 'lucide-react';
import type { MediaState } from '../types';

interface MediaPlayPauseButtonProps {
  media: MediaState;
  isExecuting: boolean;
  onClick: () => void;
}

export function MediaPlayPauseButton({ media, isExecuting, onClick }: MediaPlayPauseButtonProps) {
  const isPaused = media.status === 'Paused';
  const isStopped = media.status === 'Stopped' || media.status === '' || !media.title;
  const hasArtwork = media.thumbnail && media.thumbnail.length > 0;

  // Default color when no media is playing
  const defaultColor = '#8b5cf6';

  return (
    <button
      onClick={onClick}
      className={`w-full aspect-square rounded-2xl overflow-hidden relative transition-all duration-200 ${
        isExecuting ? 'scale-95' : 'hover:scale-105'
      }`}
      style={{
        boxShadow: isExecuting
          ? `0 0 40px ${defaultColor}66, inset 0 0 30px ${defaultColor}33`
          : `0 0 20px ${defaultColor}22`,
      }}
    >
      {/* Background - Album Art or Default */}
      {hasArtwork ? (
        <img
          src={`data:image/jpeg;base64,${media.thumbnail}`}
          alt="Album Art"
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            background: `linear-gradient(135deg, ${defaultColor}44, ${defaultColor}22)`,
            border: `2px solid ${defaultColor}`,
          }}
        >
          <Music size={40} color={defaultColor} className="opacity-50" />
        </div>
      )}

      {/* Gradient overlay for text readability */}
      <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent" />

      {/* Paused Overlay */}
      {isPaused && !isStopped && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
          <div className="bg-black/60 rounded-full p-3">
            <Pause size={32} className="text-white" />
          </div>
        </div>
      )}

      {/* Stopped/No Media State */}
      {isStopped && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-2">
          <Music size={28} className="text-gray-400 mb-1" />
          <span className="text-xs text-gray-400">No media</span>
        </div>
      )}

      {/* Text Content - Title & Artist */}
      {!isStopped && (
        <div className="absolute bottom-0 left-0 right-0 p-2">
          <div className="text-white text-xs font-medium truncate leading-tight">
            {media.title || 'Unknown'}
          </div>
          <div className="text-gray-300 text-[10px] truncate leading-tight">
            {media.artist || 'Unknown Artist'}
          </div>
        </div>
      )}

      {/* Playing indicator */}
      {media.status === 'Playing' && (
        <div className="absolute top-2 right-2">
          <div className="flex items-center gap-0.5">
            <div className="w-0.75 h-3 bg-green-400 rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
            <div className="w-0.75 h-4 bg-green-400 rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
            <div className="w-0.75 h-2 bg-green-400 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      )}
    </button>
  );
}
