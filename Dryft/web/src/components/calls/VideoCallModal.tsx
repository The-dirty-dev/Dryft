'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { X, Mic, MicOff, Video, VideoOff, Phone, RotateCcw } from 'lucide-react';
import { webRTCService, CallState } from '@/lib/webrtc';
import { callSignalingService } from '@/lib/callSignaling';

interface VideoCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  matchId: string;
  userId: string;
  userName: string;
  userPhoto?: string;
  isIncoming: boolean;
  videoEnabled: boolean;
  callId: string;
}

export function VideoCallModal({
  isOpen,
  onClose,
  matchId,
  userId,
  userName,
  userPhoto,
  isIncoming,
  videoEnabled,
  callId,
}: VideoCallModalProps) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [callState, setCallState] = useState<CallState>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(!videoEnabled);
  const [remoteMuted, setRemoteMuted] = useState(false);
  const [remoteVideoOff, setRemoteVideoOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const callStartTime = useRef<number | null>(null);
  const durationInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    webRTCService.setHandlers({
      onLocalStream: (stream) => {
        setLocalStream(stream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      },
      onRemoteStream: (stream) => {
        setRemoteStream(stream);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = stream;
        }
      },
      onCallStateChange: (state) => {
        setCallState(state);
        if (state === 'connected' && !callStartTime.current) {
          callStartTime.current = Date.now();
          startDurationTimer();
        }
        if (state === 'ended') {
          handleCallEnded();
        }
      },
      onError: (error) => {
        console.error('[VideoCall] Error:', error);
        handleCallEnded();
      },
    });

    callSignalingService.setHandlers({
      onOffer: async (id, sdp) => {
        if (id === callId) {
          await webRTCService.setRemoteDescription(sdp);
          const answer = await webRTCService.createAnswer();
          callSignalingService.sendAnswer(userId, answer);
        }
      },
      onAnswer: async (id, sdp) => {
        if (id === callId) {
          await webRTCService.setRemoteDescription(sdp);
        }
      },
      onIceCandidate: async (id, candidate) => {
        if (id === callId) {
          await webRTCService.addIceCandidate(candidate);
        }
      },
      onCallEnded: (id) => {
        if (id === callId) {
          handleCallEnded();
        }
      },
      onRemoteMute: (id, muted) => {
        if (id === callId) {
          setRemoteMuted(muted);
        }
      },
      onRemoteVideoOff: (id, videoOff) => {
        if (id === callId) {
          setRemoteVideoOff(videoOff);
        }
      },
    });

    webRTCService.onIceCandidate = (candidate) => {
      callSignalingService.sendIceCandidate(userId, candidate);
    };

    initializeCall();

    return () => {
      cleanup();
    };
  }, [isOpen]);

  const initializeCall = async () => {
    try {
      await webRTCService.startLocalStream(videoEnabled);
      await webRTCService.createPeerConnection();

      if (isIncoming) {
        callSignalingService.acceptCall(callId, userId);
        setCallState('connecting');
      } else {
        const offer = await webRTCService.createOffer();
        callSignalingService.sendOffer(userId, offer);
      }
    } catch (error) {
      console.error('[VideoCall] Failed to initialize:', error);
      handleCallEnded();
    }
  };

  const startDurationTimer = () => {
    durationInterval.current = setInterval(() => {
      if (callStartTime.current) {
        setCallDuration(Math.floor((Date.now() - callStartTime.current) / 1000));
      }
    }, 1000);
  };

  const handleCallEnded = () => {
    cleanup();
    onClose();
  };

  const cleanup = () => {
    if (durationInterval.current) {
      clearInterval(durationInterval.current);
    }
    webRTCService.cleanup();
    callStartTime.current = null;
    setCallDuration(0);
  };

  const handleEndCall = useCallback(() => {
    callSignalingService.endCall(userId);
    webRTCService.endCall();
    handleCallEnded();
  }, [userId]);

  const handleToggleMute = useCallback(() => {
    const muted = webRTCService.toggleMute();
    setIsMuted(muted);
    callSignalingService.sendMuteStatus(userId, muted);
  }, [userId]);

  const handleToggleVideo = useCallback(() => {
    const videoOff = webRTCService.toggleVideo();
    setIsVideoOff(videoOff);
    callSignalingService.sendVideoStatus(userId, videoOff);
  }, [userId]);

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getCallStatusText = (): string => {
    switch (callState) {
      case 'calling':
        return 'Calling...';
      case 'ringing':
        return 'Ringing...';
      case 'connecting':
        return 'Connecting...';
      case 'connected':
        return formatDuration(callDuration);
      default:
        return '';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* Remote Video (Full Screen) */}
      {remoteStream && !remoteVideoOff ? (
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full bg-gray-900 flex flex-col items-center justify-center">
          {userPhoto ? (
            <img
              src={userPhoto}
              alt={userName}
              className="w-32 h-32 rounded-full object-cover mb-4"
            />
          ) : (
            <div className="w-32 h-32 rounded-full bg-gray-700 flex items-center justify-center mb-4">
              <span className="text-4xl text-gray-400">
                {userName.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <h2 className="text-xl text-white font-semibold">{userName}</h2>
          {remoteVideoOff && (
            <p className="text-gray-400 mt-2">Camera is off</p>
          )}
        </div>
      )}

      {/* Local Video (PiP) */}
      {localStream && !isVideoOff && (
        <div className="absolute top-20 right-4 w-32 h-44 rounded-lg overflow-hidden shadow-lg bg-gray-800">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover scale-x-[-1]"
          />
        </div>
      )}

      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/50 to-transparent">
        <div className="flex items-center justify-between">
          <button
            onClick={handleCallEnded}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
          >
            <X className="w-6 h-6 text-white" />
          </button>

          <div className="text-center">
            <p className="text-white font-medium">{userName}</p>
            <p className="text-white/70 text-sm">{getCallStatusText()}</p>
          </div>

          <div className="flex items-center gap-2">
            {remoteMuted && (
              <div className="bg-white/20 p-1 rounded-full">
                <MicOff className="w-4 h-4 text-white" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/50 to-transparent">
        <div className="flex items-center justify-center gap-6">
          <button
            onClick={handleToggleMute}
            className={`p-4 rounded-full transition-colors ${
              isMuted ? 'bg-red-500' : 'bg-white/20 hover:bg-white/30'
            }`}
          >
            {isMuted ? (
              <MicOff className="w-6 h-6 text-white" />
            ) : (
              <Mic className="w-6 h-6 text-white" />
            )}
          </button>

          <button
            onClick={handleToggleVideo}
            className={`p-4 rounded-full transition-colors ${
              isVideoOff ? 'bg-red-500' : 'bg-white/20 hover:bg-white/30'
            }`}
          >
            {isVideoOff ? (
              <VideoOff className="w-6 h-6 text-white" />
            ) : (
              <Video className="w-6 h-6 text-white" />
            )}
          </button>

          <button
            onClick={handleEndCall}
            className="p-4 rounded-full bg-red-500 hover:bg-red-600 transition-colors"
          >
            <Phone className="w-6 h-6 text-white rotate-[135deg]" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default VideoCallModal;
