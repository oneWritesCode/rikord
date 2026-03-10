"use client";

import React, { useState, useRef, useEffect } from "react";
import { get, set } from "idb-keyval";
import { Camera, Square, Video, Trash2, Download } from "lucide-react";

interface RecordedVideo {
  id: string;
  blob: Blob;
  timestamp: number;
}

export default function Home() {
  const [isRecording, setIsRecording] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [videos, setVideos] = useState<RecordedVideo[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Load videos on mount
  useEffect(() => {
    loadVideos();
  }, []);

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
      const newVideo: RecordedVideo = {
        id: Date.now().toString(),
        blob,
        timestamp: Date.now(),
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
      stopCamera();
    }
  };

  const deleteVideo = async (id: string) => {
    const updatedVideos = videos.filter((v) => v.id !== id);
    await saveVideos(updatedVideos);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (stream && !isRecording) {
          startRecording();
        } else if (isRecording) {
          stopRecording();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [stream, isRecording, videos]);

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
              className={`w-full h-full object-cover transform -scale-x-100 ${!stream ? 'hidden' : ''}`}
            />
            
            {!stream && (
              <div className="absolute inset-0 flex flex-col items-center justify-center space-y-2 text-gray-500">
                <Camera size={72} strokeWidth={1} className="opacity-50" />
                <p className="text-lg">Camera is off</p>
              </div>
            )}
            
            {isRecording && (
              <div className="absolute top-6 right-6 flex items-center space-x-2 bg-red-500/20 px-4 py-2 rounded-full border border-red-500/50 backdrop-blur-md">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.8)]" />
                <span className="text-red-500 font-bold text-sm tracking-wider uppercase">Recording</span>
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
              <button
                onClick={stopRecording}
                className="group flex items-center space-x-3 bg-gray-800 hover:bg-gray-700 text-white px-10 py-4 rounded-full font-bold text-lg transition-all shadow-lg border border-gray-700 transform hover:-translate-y-1"
              >
                <Square
                  size={24}
                  className="text-red-500 fill-red-500 group-hover:scale-110 transition-transform"
                />
                <span>Stop Recording</span>
              </button>
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
                    </div>

                    <div className="p-6 flex items-center justify-between bg-gradient-to-b from-gray-900/50 to-gray-900 border-t border-gray-800/50">
                      <div className="space-y-1.5">
                        <p className="font-bold text-gray-200 text-lg">
                          Clip {video.id.slice(-4)}
                        </p>
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
                      <div className="flex space-x-3">
                        <a
                          href={url}
                          download={`rikord-${video.id}.webm`}
                          className="p-2.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-full transition-all hover:scale-110"
                          title="Download"
                        >
                          <Download size={20} />
                        </a>
                        <button
                          onClick={() => deleteVideo(video.id)}
                          className="p-2.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-full transition-all hover:scale-110"
                          title="Delete"
                        >
                          <Trash2 size={20} />
                        </button>
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
