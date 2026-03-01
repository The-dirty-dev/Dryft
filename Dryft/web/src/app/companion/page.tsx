'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Logo from '@/components/ui/Logo';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useCompanionSession, ChatMessage } from '@/hooks/useCompanionSession';
import { useHaptic } from '@/hooks/useHaptic';

// Haptic pattern presets
const HAPTIC_PATTERNS = [
  { name: 'Touch', icon: '👆', intensity: 0.3, duration: 500 },
  { name: 'Caress', icon: '🤚', intensity: 0.4, duration: 1500 },
  { name: 'Pulse', icon: '💫', intensity: 0.6, duration: 800 },
  { name: 'Throb', icon: '💓', intensity: 0.7, duration: 1200 },
  { name: 'Wave', icon: '🌊', intensity: 0.5, duration: 2000 },
  { name: 'Intense', icon: '🔥', intensity: 0.9, duration: 1000 },
];

const REACTIONS = ['❤️', '🔥', '😘', '🥵', '💋', '🫦'];

export default function CompanionPage() {
  const {
    isConnected,
    isJoining,
    error,
    session,
    vrState,
    chatMessages,
    joinSession,
    leaveSession,
    sendChat,
    sendHaptic,
    setHapticPermission,
  } = useCompanionSession();

  const { isConnected: deviceConnected, localDevices } = useHaptic();

  const [sessionCode, setSessionCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [customIntensity, setCustomIntensity] = useState(0.5);
  const [isHolding, setIsHolding] = useState(false);
  const [receivingHaptic, setReceivingHaptic] = useState(false);
  const [lastHapticIntensity, setLastHapticIntensity] = useState(0);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const hapticTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Listen for haptic from VR (would need WebSocket event handler)
  // For now, track VR state haptic intensity changes
  useEffect(() => {
    if (vrState?.haptic_intensity && vrState.haptic_intensity > 0) {
      setReceivingHaptic(true);
      setLastHapticIntensity(vrState.haptic_intensity);

      // Clear previous timeout
      if (hapticTimeoutRef.current) {
        clearTimeout(hapticTimeoutRef.current);
      }

      // Auto-reset after 2 seconds of no updates
      hapticTimeoutRef.current = setTimeout(() => {
        setReceivingHaptic(false);
        setLastHapticIntensity(0);
      }, 2000);
    }

    return () => {
      if (hapticTimeoutRef.current) {
        clearTimeout(hapticTimeoutRef.current);
      }
    };
  }, [vrState?.haptic_intensity]);

  // Get VR host from session
  const vrHost = session?.participants.find(p => p.device_type === 'vr');

  const handleJoin = async () => {
    if (!sessionCode.trim()) return;
    await joinSession(sessionCode.trim(), displayName.trim() || undefined);
  };

  const handleSendChat = () => {
    if (!chatInput.trim()) return;
    sendChat(chatInput.trim());
    setChatInput('');
  };

  const handlePatternPress = (pattern: typeof HAPTIC_PATTERNS[0]) => {
    if (!vrHost) return;
    sendHaptic(vrHost.user_id, 'vibrate', {
      intensity: pattern.intensity,
      durationMs: pattern.duration,
    });
  };

  const handleCustomVibrateStart = () => {
    if (!vrHost) return;
    setIsHolding(true);
    sendHaptic(vrHost.user_id, 'vibrate', {
      intensity: customIntensity,
      durationMs: 10000, // Long duration, will be stopped on release
    });
  };

  const handleCustomVibrateEnd = () => {
    if (!vrHost) return;
    setIsHolding(false);
    sendHaptic(vrHost.user_id, 'stop');
  };

  const handleReaction = (reaction: string) => {
    sendChat(reaction);
  };

  const grantHapticPermission = () => {
    if (!vrHost) return;
    setHapticPermission(vrHost.user_id, 'always', 1.0);
  };

  // ============================================================================
  // Join Screen
  // ============================================================================

  if (!session) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        {/* Header */}
        <header className="border-b border-border">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <Logo />
            <span className="text-muted">Companion Mode</span>
          </div>
        </header>

        {/* Join Form */}
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-md">
            <div className="bg-surface rounded-2xl p-8 border border-border">
              <h1 className="text-2xl font-bold text-white text-center mb-2">
                Join VR Session
              </h1>
              <p className="text-muted text-center mb-8">
                Enter the 6-digit code shown in VR to connect
              </p>

              {error && (
                <div className="bg-red-500/10 text-red-500 rounded-lg p-3 mb-6 text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-muted mb-2">Session Code</label>
                  <Input
                    type="text"
                    value={sessionCode}
                    onChange={(e) => setSessionCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    className="w-full text-center text-3xl tracking-[0.5em] font-mono"
                    maxLength={6}
                  />
                </div>

                <div>
                  <label className="block text-sm text-muted mb-2">Your Name (optional)</label>
                  <Input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Enter your name"
                    className="w-full"
                  />
                </div>

                <Button
                  onClick={handleJoin}
                  disabled={sessionCode.length !== 6 || isJoining}
                  className="w-full"
                >
                  {isJoining ? (
                    <span className="flex items-center justify-center gap-2">
                      <LoadingSpinner variant="inline" />
                      Joining...
                    </span>
                  ) : (
                    'Join Session'
                  )}
                </Button>
              </div>

              <div className="mt-8 text-center">
                <p className="text-sm text-muted">
                  Don't have a code?{' '}
                  <span className="text-white">
                    Ask your VR partner to create a session
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // Session View
  // ============================================================================

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
              Session: {session.session.session_code}
            </span>
          </div>
          <Button
            onClick={leaveSession}
            variant="ghost"
            className="p-0 text-sm text-muted hover:text-red-500"
          >
            Leave
          </Button>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left: VR Status & Controls */}
        <div className="lg:w-1/2 flex flex-col border-b lg:border-b-0 lg:border-r border-border">
          {/* VR User Status */}
          <div className="p-4 border-b border-border">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-3xl">🥽</span>
                </div>
                {/* Connection indicator */}
                <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-background flex items-center justify-center ${isConnected ? 'bg-green-500' : 'bg-yellow-500'}`}>
                  <span className="text-[10px]">{isConnected ? '✓' : '...'}</span>
                </div>
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-white">
                  {vrHost?.display_name || 'VR User'}
                </h2>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted">
                    {vrState?.current_activity || 'In VR'}
                    {vrState?.current_room && ` - ${vrState.current_room}`}
                  </span>
                </div>
                {vrState?.haptic_device_connected && (
                  <div className="text-xs text-green-500 mt-1 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    Device: {vrState.haptic_device_name || 'Connected'}
                  </div>
                )}
              </div>
            </div>

            {/* Avatar Position Visualization */}
            {vrState?.avatar_position && (
              <div className="mt-4 bg-surface rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted">Avatar Position</span>
                  <span className="text-xs text-white font-mono">
                    ({vrState.avatar_position.x.toFixed(1)}, {vrState.avatar_position.y.toFixed(1)}, {vrState.avatar_position.z.toFixed(1)})
                  </span>
                </div>
                {/* Mini avatar map */}
                <div className="relative w-full h-24 bg-background rounded overflow-hidden">
                  {/* Grid lines */}
                  <div className="absolute inset-0 grid grid-cols-4 grid-rows-4">
                    {[...Array(16)].map((_, i) => (
                      <div key={i} className="border border-border/20" />
                    ))}
                  </div>
                  {/* Avatar dot */}
                  <div
                    className="absolute w-4 h-4 bg-primary rounded-full transform -translate-x-1/2 -translate-y-1/2 shadow-lg shadow-primary/50"
                    style={{
                      left: `${Math.min(100, Math.max(0, 50 + (vrState.avatar_position.x || 0) * 5))}%`,
                      top: `${Math.min(100, Math.max(0, 50 - (vrState.avatar_position.z || 0) * 5))}%`,
                    }}
                  >
                    {/* Direction indicator */}
                    {vrState.avatar_rotation && (
                      <div
                        className="absolute w-0.5 h-3 bg-white rounded-full left-1/2 -translate-x-1/2 origin-bottom"
                        style={{
                          transform: `translateX(-50%) rotate(${vrState.avatar_rotation.y || 0}deg)`,
                        }}
                      />
                    )}
                  </div>
                  {/* Room label */}
                  <div className="absolute bottom-1 right-1 text-[10px] text-muted bg-background/80 px-1 rounded">
                    {vrState.current_room || 'lobby'}
                  </div>
                </div>
              </div>
            )}

            {/* Hand positions indicator */}
            {(vrState?.left_hand_pos || vrState?.right_hand_pos) && (
              <div className="mt-3 flex gap-4">
                {vrState.left_hand_pos && (
                  <div className="flex-1 bg-surface rounded-lg p-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🤚</span>
                      <div>
                        <div className="text-xs text-muted">Left Hand</div>
                        <div className="text-[10px] font-mono text-white">
                          y: {vrState.left_hand_pos.y.toFixed(2)}m
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {vrState.right_hand_pos && (
                  <div className="flex-1 bg-surface rounded-lg p-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">✋</span>
                      <div>
                        <div className="text-xs text-muted">Right Hand</div>
                        <div className="text-[10px] font-mono text-white">
                          y: {vrState.right_hand_pos.y.toFixed(2)}m
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Haptic Intensity Bar */}
          {vrState?.haptic_intensity !== undefined && vrState.haptic_intensity > 0 && (
            <div className="px-4 py-2 bg-primary/5">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted">Intensity</span>
                <div className="flex-1 h-2 bg-background rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-100"
                    style={{ width: `${vrState.haptic_intensity * 100}%` }}
                  />
                </div>
                <span className="text-xs text-white">
                  {Math.round(vrState.haptic_intensity * 100)}%
                </span>
              </div>
            </div>
          )}

          {/* Haptic Controls */}
          <div className="flex-1 p-4 overflow-auto">
            <h3 className="text-sm font-medium text-muted mb-3">Quick Patterns</h3>
            <div className="grid grid-cols-3 gap-2 mb-6">
              {HAPTIC_PATTERNS.map((pattern) => (
                <Button
                  key={pattern.name}
                  onClick={() => handlePatternPress(pattern)}
                  disabled={!vrHost || !vrState?.haptic_device_connected}
                  variant="ghost"
                  className="flex flex-col items-center justify-center p-4 rounded-xl bg-surface border border-border hover:border-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <span className="text-2xl mb-1">{pattern.icon}</span>
                  <span className="text-xs text-muted">{pattern.name}</span>
                </Button>
              ))}
            </div>

            {/* Custom Intensity Control */}
            <h3 className="text-sm font-medium text-muted mb-3">Custom Control</h3>
            <div className="bg-surface rounded-xl border border-border p-4">
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted">Intensity</span>
                  <span className="text-white">{Math.round(customIntensity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={customIntensity * 100}
                  onChange={(e) => setCustomIntensity(Number(e.target.value) / 100)}
                  className="w-full"
                />
              </div>
              <Button
                onMouseDown={handleCustomVibrateStart}
                onMouseUp={handleCustomVibrateEnd}
                onMouseLeave={handleCustomVibrateEnd}
                onTouchStart={handleCustomVibrateStart}
                onTouchEnd={handleCustomVibrateEnd}
                disabled={!vrHost || !vrState?.haptic_device_connected}
                variant="ghost"
                className={`w-full py-6 rounded-xl font-semibold transition-all ${
                  isHolding
                    ? 'bg-primary text-white scale-95'
                    : 'bg-primary/10 text-primary hover:bg-primary/20'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isHolding ? 'Vibrating...' : 'Hold to Vibrate'}
              </Button>
            </div>

            {/* Reactions */}
            <h3 className="text-sm font-medium text-muted mt-6 mb-3">Reactions</h3>
            <div className="flex gap-2">
              {REACTIONS.map((reaction) => (
                <Button
                  key={reaction}
                  onClick={() => handleReaction(reaction)}
                  variant="ghost"
                  className="flex-1 text-2xl py-3 rounded-xl bg-surface border border-border hover:border-primary transition-colors"
                >
                  {reaction}
                </Button>
              ))}
            </div>

            {/* Device Status */}
            {!vrState?.haptic_device_connected && (
              <div className="mt-6 p-4 bg-yellow-500/10 text-yellow-500 rounded-xl text-sm">
                VR user hasn't connected a haptic device yet
              </div>
            )}

            {/* Your Device */}
            <div className="mt-6 p-4 bg-surface rounded-xl border border-border">
              <h4 className="text-sm font-medium text-white mb-2">Your Device</h4>
              {deviceConnected && localDevices.length > 0 ? (
                <div className="flex items-center gap-2 text-sm text-green-500">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  {localDevices[0].name}
                </div>
              ) : (
                <div className="text-sm text-muted">
                  <Link href="/settings/devices" className="text-primary hover:underline">
                    Connect a device
                  </Link>{' '}
                  to receive haptic feedback
                </div>
              )}
              {deviceConnected && (
                <Button
                  onClick={grantHapticPermission}
                  variant="ghost"
                  className="mt-2 p-0 text-xs text-primary hover:underline"
                >
                  Allow VR user to control your device
                </Button>
              )}
            </div>

            {/* Receiving Haptic Indicator */}
            {receivingHaptic && (
              <div className="mt-4 p-4 bg-primary/20 rounded-xl border border-primary animate-pulse">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">💫</span>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-white">Receiving from VR</div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-2 bg-background rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all duration-100"
                          style={{ width: `${lastHapticIntensity * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-white">
                        {Math.round(lastHapticIntensity * 100)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Chat */}
        <div className="lg:w-1/2 flex flex-col min-h-[300px] lg:min-h-0">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="font-medium text-white">Chat</h3>
            <p className="text-xs text-muted">
              {session.participants.length} participant{session.participants.length !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {chatMessages.length === 0 ? (
              <div className="text-center text-muted py-8">
                No messages yet. Say hi!
              </div>
            ) : (
              chatMessages.map((msg) => (
                <ChatBubble key={msg.id} message={msg} />
              ))
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-border">
            <div className="flex gap-2">
              <Input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                placeholder="Type a message..."
                className="flex-1"
              />
              <Button
                onClick={handleSendChat}
                disabled={!chatInput.trim()}
                className="px-6"
              >
                Send
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Chat bubble component
function ChatBubble({ message }: { message: ChatMessage }) {
  const isReaction = REACTIONS.includes(message.content);

  if (isReaction) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-3xl">{message.content}</span>
        <span className="text-xs text-muted">{message.displayName}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <span className="text-xs text-muted mb-1">{message.displayName}</span>
      <div className="bg-surface rounded-xl px-4 py-2 inline-block max-w-[80%]">
        <p className="text-white text-sm">{message.content}</p>
      </div>
    </div>
  );
}
