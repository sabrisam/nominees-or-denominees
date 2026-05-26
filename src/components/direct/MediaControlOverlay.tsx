import React, { useState, useEffect, useRef } from "react";
import { Play, Pause, Volume2, VolumeX } from "lucide-react";

interface MediaControlOverlayProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  isMuted: boolean;
  onMuteToggle: () => void;
}

export function MediaControlOverlay({
  videoRef,
  isMuted,
  onMuteToggle,
}: MediaControlOverlayProps) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Synchronize initial playing state
    setIsPlaying(!video.paused);

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    
    const handleTimeUpdate = () => {
      if (!isDragging) {
        setCurrentTime(video.currentTime);
      }
    };

    const handleDurationChange = () => {
      setDuration(video.duration || 0);
    };

    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("durationchange", handleDurationChange);
    video.addEventListener("loadedmetadata", handleDurationChange);

    // Initial load check if video already metadata loaded
    if (video.duration) {
      setDuration(video.duration);
    }

    return () => {
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("durationchange", handleDurationChange);
      video.removeEventListener("loadedmetadata", handleDurationChange);
    };
  }, [videoRef, isDragging]);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      video.play().catch((err) => console.error("[NOD Media Control] Play error:", err));
    }
  };

  const handleSeekStart = () => {
    setIsDragging(true);
  };

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setCurrentTime(value);
  };

  const handleSeekEnd = (e: React.MouseEvent<HTMLInputElement> | React.TouchEvent<HTMLInputElement>) => {
    setIsDragging(false);
    const video = videoRef.current;
    if (!video) return;
    
    const target = e.currentTarget;
    const value = parseFloat(target.value);
    video.currentTime = value;
    setCurrentTime(value);
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs === Infinity) return "0:00";
    const minutes = Math.floor(secs / 60);
    const seconds = Math.floor(secs % 60);
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  };

  return (
    <div 
      className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-4 flex flex-col gap-2.5 z-40 transition-opacity duration-300 pointer-events-auto"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Seek Timeline Container */}
      <div className="flex items-center gap-3 w-full">
        <span className="text-[10px] font-mono font-black text-champagneSoft shrink-0">
          {formatTime(currentTime)}
        </span>
        
        <div className="relative flex-1 group py-2 cursor-pointer flex items-center">
          <input
            type="range"
            min={0}
            max={duration || 100}
            step="0.05"
            value={currentTime}
            onMouseDown={handleSeekStart}
            onTouchStart={handleSeekStart}
            onChange={handleSeekChange}
            onMouseUp={handleSeekEnd}
            onTouchEnd={handleSeekEnd}
            className="w-full accent-champagne h-1 bg-white/20 rounded-lg appearance-none cursor-pointer outline-none transition group-hover:bg-white/30"
            aria-label="Timeline seek controller"
          />
        </div>

        <span className="text-[10px] font-mono font-black text-zinc-500 shrink-0">
          {formatTime(duration)}
        </span>
      </div>

      {/* Control Buttons Panel */}
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-4">
          {/* Play/Pause Button */}
          <button
            type="button"
            onClick={togglePlay}
            className="text-white hover:text-champagne transition p-1.5 rounded-full hover:bg-white/5 active:scale-95 flex items-center justify-center"
            aria-label={isPlaying ? "Mettre en pause" : "Lancer la lecture"}
          >
            {isPlaying ? (
              <Pause className="h-5 w-5 fill-current" />
            ) : (
              <Play className="h-5 w-5 fill-current" />
            )}
          </button>
        </div>

        {/* Volume/Mute Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onMuteToggle();
          }}
          className="text-white hover:text-champagne transition p-1.5 rounded-full hover:bg-white/5 active:scale-95 flex items-center justify-center"
          aria-label={isMuted ? "Activer le son" : "Couper le son"}
        >
          {isMuted ? (
            <VolumeX className="h-5 w-5 text-champagne" />
          ) : (
            <Volume2 className="h-5 w-5 text-emerald-400" />
          )}
        </button>
      </div>
    </div>
  );
}
