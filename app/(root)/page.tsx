"use client";

import React, { useState, useRef, useEffect } from "react";
import { get, set } from "idb-keyval";
import {
  Camera,
  Square,
  Video,
  Trash2,
  Download,
  Pause,
  Play,
  Pencil,
  Check,
  X,
} from "lucide-react";

interface RecordedVideo {
  id: string;
  blob: Blob;
  timestamp: number;
  caption: string;
  duration?: number;
}

export default function Home() {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [videos, setVideos] = useState<RecordedVideo[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCaption, setEditCaption] = useState("");
  const [recordingDuration, setRecordingDuration] = useState(0);
  const durationRef = useRef(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Load videos on mount
  useEffect(() => {
    loadVideos();
  }, []);

  // Timer for recording
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording && !isPaused) {
      interval = setInterval(() => {
        setRecordingDuration((prev) => {
          const next = prev + 1;
          durationRef.current = next;
          return next;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording, isPaused]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const loadVideos = async () => {
    try {
      const stored = await get<RecordedVideo[]>("rikord-videos");
      if (stored) {
        setVideos(stored.sort((a, b) => b.timestamp - a.timestamp));
      }
    } catch (error) {
      console.error("Failed to load videos", error);
    }
  };

  const saveVideos = async (newVideos: RecordedVideo[]) => {
    try {
      await set("rikord-videos", newVideos);
      setVideos(newVideos);
    } catch (error) {
      console.error("Failed to save videos", error);
    }
  };

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: true,
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (error) {
      console.error("Error accessing media devices.", error);
      alert("Could not access camera/microphone.");
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const startRecording = () => {
    if (!stream) return;

    setRecordingDuration(0);
    durationRef.current = 0;
    chunksRef.current = [];

    let options = {};
    if (MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")) {
      options = { mimeType: "video/webm;codecs=vp9,opus" };
    } else if (MediaRecorder.isTypeSupported("video/webm")) {
      options = { mimeType: "video/webm" };
    } else if (MediaRecorder.isTypeSupported("video/mp4")) {
      options = { mimeType: "video/mp4" };
    }

    const mediaRecorder = new MediaRecorder(stream, options);

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };

    mediaRecorder.onstop = async () => {
      const finalMimeType = mediaRecorder.mimeType || "video/webm";
      const blob = new Blob(chunksRef.current, { type: finalMimeType });
      const videoId = Date.now().toString();
      const newVideo: RecordedVideo = {
        id: videoId,
        blob,
        timestamp: Date.now(),
        caption: `Clip ${videoId.slice(-4)}`,
        duration: durationRef.current,
      };

      const updatedVideos = [newVideo, ...videos];
      await saveVideos(updatedVideos);
    };

    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start(100);
    setIsRecording(true);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      stopCamera();
    }
  };

  const togglePause = () => {
    if (!mediaRecorderRef.current || !isRecording) return;

    if (isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
    } else {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
    }
  };

  const deleteVideo = async (id: string) => {
    const updatedVideos = videos.filter((v) => v.id !== id);
    await saveVideos(updatedVideos);
  };

  const startEditCaption = (video: RecordedVideo) => {
    setEditingId(video.id);
    setEditCaption(video.caption);
  };

  const saveCaption = async () => {
    if (!editingId) return;
    const updatedVideos = videos.map((v) =>
      v.id === editingId ? { ...v, caption: editCaption } : v,
    );
    await saveVideos(updatedVideos);
    setEditingId(null);
    setEditCaption("");
  };

  const cancelEditCaption = () => {
    setEditingId(null);
    setEditCaption("");
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when editing a caption
      if (editingId) return;

      if (e.key === "Enter") {
        e.preventDefault();
        if (stream && !isRecording) {
          startRecording();
        } else if (isRecording) {
          stopRecording();
        }
      }

      if (e.key === " ") {
        e.preventDefault();
        if (isRecording) {
          togglePause();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [stream, isRecording, isPaused, videos, editingId]);

  return (
    <div className="min-h-screen bg-black text-white p-6 md:p-12">
      <div className="max-w-6xl mx-auto space-y-10">
        <header className="text-center">
          <h1 className="text-6xl font-extrabold tracking-tight bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 bg-clip-text text-transparent">
            Rikord
          </h1>
          <p className="text-gray-400 text-xl font-bold">
            Capture your moments simply and securely.
          </p>
        </header>

        <section className="bg-white/8 rounded-3xl p-2 md:p-4 ">
          <div className="relative aspect-video bg-black rounded-2xl overflow-hidden shadow-inner flex flex-col items-center justify-center">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className={`w-full h-full object-cover transform -scale-x-100 ${!stream ? "hidden" : ""}`}
            />

            {!stream && (
              <div className="absolute inset-0 flex flex-col items-center justify-center space-y-2 text-gray-500">
                <Camera size={72} strokeWidth={1} className="opacity-50" />
                <p className="text-lg">Camera is off</p>
              </div>
            )}

            {isRecording && (
              <div
                className={`absolute top-6 right-6 flex items-center space-x-3 ${isPaused ? "bg-yellow-500/20 border-yellow-500/50" : "bg-red-500/20 border-red-500/50"} px-4 py-2 rounded-full border backdrop-blur-md transition-colors duration-300`}
              >
                <div className="flex items-center space-x-2 border-r border-white/20 pr-3 mr-1">
                  <div
                    className={`w-3 h-3 rounded-full ${isPaused ? "bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.8)]" : "bg-red-500 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.8)]"}`}
                  />
                  <span
                    className={`font-bold text-sm tracking-wider uppercase ${isPaused ? "text-yellow-500" : "text-red-500"}`}
                  >
                    {isPaused ? "Paused" : "Recording"}
                  </span>
                </div>
                <span className="font-mono font-bold text-lg text-white">
                  {formatDuration(recordingDuration)}
                </span>
              </div>
            )}
          </div>

          <div className="mt-8 flex justify-center items-center">
            {!stream ? (
              <button
                onClick={startCamera}
                className="group flex items-center space-x-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white px-8 py-4 rounded-full font-bold text-lg transition-all shadow-[0_0_20px_rgba(147,51,234,0.3)] hover:shadow-[0_0_30px_rgba(147,51,234,0.5)] transform hover:-translate-y-1 cursor-pointer"
              >
                <Video
                  size={24}
                  className="group-hover:scale-110 transition-transform"
                />
                <span>Start Camera</span>
              </button>
            ) : !isRecording ? (
              <div className="flex space-x-6">
                <button
                  onClick={startRecording}
                  className="group flex items-center space-x-3 bg-red-600 hover:bg-red-500 text-white px-10 py-4 rounded-full font-bold text-lg transition-all shadow-[0_0_20px_rgba(220,38,38,0.4)] hover:shadow-[0_0_30px_rgba(220,38,38,0.6)] transform hover:-translate-y-1"
                >
                  <div className="w-4 h-4 bg-white rounded-full group-hover:scale-110 transition-transform" />
                  <span>Record</span>
                </button>
                <button
                  onClick={stopCamera}
                  className="px-8 py-4 rounded-full font-bold text-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-all border border-transparent hover:border-gray-700"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex space-x-4">
                <button
                  onClick={togglePause}
                  className={`group flex items-center space-x-3 ${isPaused ? "bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 shadow-[0_0_20px_rgba(22,163,74,0.3)] hover:shadow-[0_0_30px_rgba(22,163,74,0.5)]" : "bg-gradient-to-r from-yellow-600 to-amber-600 hover:from-yellow-500 hover:to-amber-500 shadow-[0_0_20px_rgba(202,138,4,0.3)] hover:shadow-[0_0_30px_rgba(202,138,4,0.5)]"} text-white px-8 py-4 rounded-full font-bold text-lg transition-all transform hover:-translate-y-1 cursor-pointer`}
                  title="Press Space to toggle"
                >
                  {isPaused ? (
                    <Play
                      size={24}
                      className="group-hover:scale-110 transition-transform"
                    />
                  ) : (
                    <Pause
                      size={24}
                      className="group-hover:scale-110 transition-transform"
                    />
                  )}
                  <span>{isPaused ? "Resume" : "Pause"}</span>
                </button>
                <button
                  onClick={stopRecording}
                  className="group flex items-center space-x-3 bg-gray-800 hover:bg-gray-700 text-white px-8 py-4 rounded-full font-bold text-lg transition-all shadow-lg border border-gray-700 transform hover:-translate-y-1 cursor-pointer"
                >
                  <Square
                    size={24}
                    className="text-red-500 fill-red-500 group-hover:scale-110 transition-transform"
                  />
                  <span>Stop</span>
                </button>
              </div>
            )}
          </div>
        </section>

        <section className="space-y-8 pb-20">
          <div className="flex items-center justify-between border-b border-gray-800 pb-4">
            <h2 className="text-3xl font-bold text-gray-100 flex items-center space-x-3">
              <Video className="text-purple-400" size={28} />
              <span>Your Library</span>
            </h2>
            <div className="bg-gray-800/80 backdrop-blur-sm text-purple-300 px-4 py-1.5 rounded-full text-sm font-bold shadow-inner border border-purple-500/20">
              {videos.length} {videos.length === 1 ? "item" : "items"}
            </div>
          </div>

          {videos.length === 0 ? (
            <div className="text-center py-24 bg-gray-900/30 rounded-3xl border border-gray-800/50 border-dashed">
              <div className="bg-gray-800/50 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
                <Video className="h-10 w-10 text-gray-500" />
              </div>
              <h3 className="text-xl font-bold text-gray-300 mb-2">
                No videos yet
              </h3>
              <p className="text-gray-500 max-w-sm mx-auto">
                Start your camera and hit record to build your library.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {videos.map((video) => {
                const url = URL.createObjectURL(video.blob);
                const date = new Date(video.timestamp);

                return (
                  <div
                    key={video.id}
                    className="group flex flex-col bg-gray-900/80 rounded-3xl overflow-hidden border border-gray-800 shadow-xl hover:border-gray-700 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1"
                  >
                    <div className="aspect-video bg-black relative">
                      <video
                        src={url}
                        controls
                        className="w-full h-full object-cover"
                      />
                      {video.duration !== undefined && (
                        <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg text-xs font-bold border border-white/10">
                          {formatDuration(video.duration)}
                        </div>
                      )}
                    </div>

                    <div className="p-6 flex items-center justify-between bg-gradient-to-b from-gray-900/50 to-gray-900 border-t border-gray-800/50">
                      <div className="w-full space-y-1.5 flex-1 min-w-0">
                        {editingId === video.id ? (
                          <div className="flex items-center w-full">
                            <input
                              type="text"
                              value={editCaption}
                              onChange={(e) => setEditCaption(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveCaption();
                                if (e.key === "Escape") cancelEditCaption();
                              }}
                              autoFocus
                              className="flex-1 border border-purple-500/50 rounded-lg px-3 py-1.5 text-gray-200 text-lg font-bold focus:outline-none ring-none transition-all"
                            />
                            <button
                              onClick={saveCaption}
                              className="p-0.5 mr-1 ml-2 text-green-400 hover:text-green-300 hover:bg-green-500/10 rounded-full transition-all cursor-pointer"
                              title="Save"
                            >
                              <Check size={18} />
                            </button>
                            <button
                              onClick={cancelEditCaption}
                              className="p-0.5 text-gray-400 hover:text-gray-300 hover:bg-gray-700 rounded-full transition-all cursor-pointer"
                              title="Cancel"
                            >
                              <X size={18} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <p className="font-bold text-gray-200 text-lg truncate">
                              {video.caption}
                            </p>
                            <div className="flex">
                              <button
                                onClick={() => startEditCaption(video)}
                                className="p-2.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-full transition-all hover:scale-110 cursor-pointer"
                                title="Edit caption"
                              >
                                <Pencil size={14} />
                              </button>
                              <a
                                href={url}
                                download={`rikord-${video.id}.webm`}
                                className="p-2.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-full transition-all hover:scale-110 cursor-pointer"
                                title="Download"
                              >
                                <Download size={20} />
                              </a>
                              <button
                                onClick={() => deleteVideo(video.id)}
                                className="p-2.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-full transition-all hover:scale-110 cursor-pointer"
                                title="Delete"
                              >
                                <Trash2 size={20} />
                              </button>
                            </div>
                          </div>
                        )}
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {date.toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })}{" "}
                          •{" "}
                          {date.toLocaleTimeString(undefined, {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
