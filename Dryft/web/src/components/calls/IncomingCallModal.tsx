'use client';

import { useEffect, useRef } from 'react';
import { Phone, PhoneOff, Video } from 'lucide-react';
import { callSignalingService, IncomingCall } from '@/lib/callSignaling';

interface IncomingCallModalProps {
  call: IncomingCall;
  onAccept: () => void;
  onDecline: () => void;
}

export function IncomingCallModal({ call, onAccept, onDecline }: IncomingCallModalProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Play ringtone
    audioRef.current = new Audio('/sounds/ringtone.mp3');
    audioRef.current.loop = true;
    audioRef.current.play().catch(console.log);

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const handleAccept = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    onAccept();
  };

  const handleDecline = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    callSignalingService.rejectCall(call.callId, call.callerId, 'declined');
    onDecline();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-gray-900 rounded-2xl p-8 max-w-sm w-full mx-4 text-center animate-in zoom-in-95 duration-200">
        {/* Pulsing Avatar */}
        <div className="relative inline-block mb-6">
          <div className="absolute inset-0 rounded-full bg-green-500/30 animate-ping" />
          {call.callerPhoto ? (
            <img
              src={call.callerPhoto}
              alt={call.callerName}
              className="relative w-24 h-24 rounded-full object-cover border-4 border-green-500"
            />
          ) : (
            <div className="relative w-24 h-24 rounded-full bg-gray-700 flex items-center justify-center border-4 border-green-500">
              <span className="text-3xl text-gray-400">
                {call.callerName.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </div>

        {/* Caller Info */}
        <h2 className="text-xl font-semibold text-white mb-1">{call.callerName}</h2>
        <p className="text-gray-400 mb-8 flex items-center justify-center gap-2">
          {call.videoEnabled ? (
            <>
              <Video className="w-4 h-4" />
              Incoming Video Call
            </>
          ) : (
            <>
              <Phone className="w-4 h-4" />
              Incoming Voice Call
            </>
          )}
        </p>

        {/* Action Buttons */}
        <div className="flex justify-center gap-8">
          <button
            onClick={handleDecline}
            className="flex flex-col items-center gap-2 group"
          >
            <div className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center shadow-lg shadow-red-500/30 group-hover:bg-red-600 transition-colors">
              <PhoneOff className="w-7 h-7 text-white" />
            </div>
            <span className="text-sm text-gray-400">Decline</span>
          </button>

          <button
            onClick={handleAccept}
            className="flex flex-col items-center gap-2 group"
          >
            <div className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center shadow-lg shadow-green-500/30 group-hover:bg-green-600 transition-colors">
              <Phone className="w-7 h-7 text-white" />
            </div>
            <span className="text-sm text-gray-400">Accept</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default IncomingCallModal;
