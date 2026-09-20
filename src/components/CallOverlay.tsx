import React, { useState, useEffect, useRef } from 'react';
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, Volume2, VolumeX, Minimize2, Maximize2, Shield, RefreshCw, SwitchCamera } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAppStore } from '../store';
import { 
  CallData, 
  subscribeIncomingCalls, 
  subscribeCallStreams,
  acceptIncomingCall, 
  rejectCall, 
  endCall, 
  playRingtone, 
  stopRingtone, 
  cleanupMedia,
  setAudioMuted,
  setVideoDisabled,
  switchCamera
} from '../services/callService';
import { logCallMessageInChat } from '../services/chatService';

export const CallOverlay = () => {
  const currentUser = useAppStore(state => state.currentUser);
  const activeCallState = useAppStore(state => state.activeCallState);
  const setActiveCallState = useAppStore(state => state.setActiveCallState);

  const [incomingCall, setIncomingCall] = useState<CallData | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMirrored, setIsMirrored] = useState(true);
  const [callDuration, setCallDuration] = useState(0);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const timerIntervalRef = useRef<any>(null);
  const durationRef = useRef<number>(0);

  // Keep durationRef in sync for logging call duration
  useEffect(() => {
    durationRef.current = callDuration;
  }, [callDuration]);

  // Subscribe to live WebRTC MediaStreams
  useEffect(() => {
    const unsub = subscribeCallStreams((local, remote) => {
      setLocalStream(local);
      setRemoteStream(remote);
    });
    return () => unsub();
  }, []);

  // Listen for global incoming call signals
  useEffect(() => {
    if (!currentUser?.uid) return;
    const unsub = subscribeIncomingCalls(currentUser.uid, (call) => {
      if (call) {
        if (!activeCallState || activeCallState.callId !== call.id) {
          setIncomingCall(call);
          playRingtone(true);
        }
      } else {
        setIncomingCall(prev => {
          if (prev) {
            stopRingtone();
          }
          return null;
        });
      }
    });
    return () => {
      unsub();
    };
  }, [currentUser?.uid, activeCallState?.callId]);

  // Handle active call duration timer
  useEffect(() => {
    if (activeCallState?.status === 'accepted') {
      timerIntervalRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      setCallDuration(0);
      durationRef.current = 0;
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [activeCallState?.status]);

  // Attach local stream to local video tag
  useEffect(() => {
    if (localVideoRef.current) {
      if (localStream && localStream.getTracks().length > 0) {
        localVideoRef.current.srcObject = localStream;
        localVideoRef.current.play().catch(e => console.log('Local video play catch:', e));
      } else {
        localVideoRef.current.srcObject = null;
      }
    }
  }, [localStream, isMinimized, activeCallState?.status, activeCallState?.type]);

  // Attach remote stream to remote video tag
  useEffect(() => {
    if (remoteVideoRef.current) {
      if (remoteStream && remoteStream.getTracks().length > 0) {
        remoteVideoRef.current.srcObject = remoteStream;
        remoteVideoRef.current.play().catch(e => console.log('Remote stream playback initiated:', e));
      } else {
        remoteVideoRef.current.srcObject = null;
      }
    }
  }, [remoteStream, isMinimized, activeCallState?.status, activeCallState?.type]);

  const handleAcceptIncoming = async () => {
    if (!incomingCall || !currentUser) return;
    stopRingtone();
    const callData = incomingCall;
    setIncomingCall(null);

    setActiveCallState({
      callId: callData.id,
      otherUid: callData.callerId,
      otherName: callData.callerName,
      otherAvatar: callData.callerAvatar,
      type: callData.type,
      status: 'accepted',
      isCaller: false
    });

    try {
      await acceptIncomingCall(
        callData,
        (remStream) => setRemoteStream(remStream),
        (status) => {
          if (status === 'ended' || status === 'rejected') {
            handleEndActiveCall();
          }
        }
      );
    } catch (err) {
      console.error("Failed to accept call:", err);
      handleEndActiveCall();
    }
  };

  const handleRejectIncoming = async () => {
    if (!incomingCall || !currentUser) return;
    stopRingtone();
    const callData = incomingCall;
    await rejectCall(callData.id);
    setIncomingCall(null);

    // Log declined call in chat
    logCallMessageInChat(
      { uid: callData.callerId, name: callData.callerName, avatar: callData.callerAvatar },
      { uid: currentUser.uid, name: currentUser.name || 'User', avatar: currentUser.avatar || '' },
      callData.type,
      'rejected',
      0
    );
  };

  const handleEndActiveCall = async () => {
    if (activeCallState && currentUser) {
      if (activeCallState.callId) {
        await endCall(activeCallState.callId);
      }
      
      // Log call duration message in chat
      if ((activeCallState.status === 'accepted' || activeCallState.status === 'ringing') && activeCallState.otherUid) {
        logCallMessageInChat(
          { uid: currentUser.uid, name: currentUser.name || 'User', avatar: currentUser.avatar || '' },
          { uid: activeCallState.otherUid, name: activeCallState.otherName, avatar: activeCallState.otherAvatar },
          activeCallState.type,
          activeCallState.status === 'accepted' ? 'ended' : 'missed',
          durationRef.current
        );
      }
    }
    stopRingtone();
    cleanupMedia();
    setLocalStream(null);
    setRemoteStream(null);
    setActiveCallState(null);
    setIsMinimized(false);
  };

  const toggleMute = () => {
    setIsMuted(prev => setAudioMuted(!prev));
  };

  const toggleSpeaker = () => {
    setIsSpeakerOn(prev => {
      const next = !prev;
      if (remoteVideoRef.current) {
        remoteVideoRef.current.volume = next ? 1.0 : 0.2;
      }
      return next;
    });
  };

  const toggleVideo = () => {
    setIsVideoOff(prev => setVideoDisabled(!prev));
  };

  const formatDuration = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  const [isHiddenPill, setIsHiddenPill] = useState(false);
  const [miniSize, setMiniSize] = useState<'small' | 'tiny'>('small');

  return (
    <>
      {/* 1. Incoming Call Notification Overlay - Soft Clean Ultra-Fast UI */}
      <AnimatePresence>
        {incomingCall && (
          <motion.div 
            initial={{ y: -80, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -80, opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', damping: 30, stiffness: 350 }}
            className="fixed top-[calc(1.5rem+env(safe-area-inset-top))] left-4 right-4 md:left-auto md:right-6 md:w-[360px] z-[300] bg-white/98 border border-purple-100 p-4 rounded-3xl shadow-2xl flex flex-col space-y-3 transform-gpu will-change-transform"
          >
            <div className="flex items-center space-x-3.5">
              <img 
                src={incomingCall.callerAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(incomingCall.callerName)}&background=random`} 
                className="w-13 h-13 rounded-full object-cover border-2 border-purple-200/80 shadow-sm shrink-0"
                alt="Caller Avatar"
              />
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-gray-900 text-sm truncate">{incomingCall.callerName}</h4>
                <p className="text-xs text-purple-600 font-normal flex items-center space-x-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500 inline-block animate-pulse" />
                  <span>Incoming {incomingCall.type === 'video' ? 'Video' : 'Audio'} Call...</span>
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2.5 pt-1">
              <button 
                onClick={handleRejectIncoming}
                className="flex-1 py-2.5 bg-rose-50 hover:bg-rose-100 active:scale-98 text-rose-600 font-medium text-xs rounded-2xl flex items-center justify-center space-x-1.5 transition-all border border-rose-100 cursor-pointer"
              >
                <PhoneOff className="w-4 h-4" />
                <span>Decline</span>
              </button>
              <button 
                onClick={handleAcceptIncoming}
                className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 active:scale-98 text-white font-medium text-xs rounded-2xl flex items-center justify-center space-x-1.5 transition-all shadow-md shadow-purple-600/20 cursor-pointer"
              >
                <Phone className="w-4 h-4" />
                <span>Accept</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. Active Call Floating / Fullscreen Overlay */}
      <AnimatePresence>
        {activeCallState && (
          <>
            {/* Hidden Collapsed Pill Mode (Floating Draggable Audio Pill) */}
            {isMinimized && isHiddenPill ? (
              <motion.div
                drag
                dragMomentum={false}
                dragElastic={0.05}
                whileDrag={{ scale: 1.05 }}
                className="fixed bottom-24 right-4 z-[280] bg-gray-900/95 text-white backdrop-blur-xl px-3.5 py-2.5 rounded-full shadow-2xl border border-purple-400/50 flex items-center space-x-3 cursor-grab active:cursor-grabbing touch-none select-none"
              >
                <div className="relative" onClick={() => { setIsHiddenPill(false); }}>
                  <img
                    src={activeCallState.otherAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(activeCallState.otherName)}&background=random`}
                    className="w-8 h-8 rounded-full object-cover border border-purple-300/40"
                    alt={activeCallState.otherName}
                  />
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 border-2 border-gray-900 rounded-full animate-pulse" />
                </div>
                <div onClick={() => { setIsHiddenPill(false); }} className="flex flex-col cursor-pointer">
                  <span className="text-xs font-semibold max-w-[90px] truncate">{activeCallState.otherName}</span>
                  <span className="text-[10px] text-purple-300 font-mono">{formatDuration(callDuration)}</span>
                </div>
                <button
                  onClick={() => setIsHiddenPill(false)}
                  className="p-1.5 bg-purple-600/80 hover:bg-purple-600 rounded-full text-white active:scale-90 transition-all cursor-pointer"
                  title="Expand Call"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            ) : (
              <motion.div 
                drag={isMinimized}
                dragMomentum={false}
                dragElastic={0.05}
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className={`fixed ${
                  isMinimized 
                    ? miniSize === 'tiny'
                      ? 'bottom-20 right-4 w-36 h-48 z-[270] rounded-3xl overflow-hidden shadow-2xl border-2 border-purple-400/60 bg-gray-950 cursor-grab active:cursor-grabbing touch-none select-none'
                      : 'bottom-20 right-4 w-44 h-64 z-[270] rounded-3xl overflow-hidden shadow-2xl border-2 border-purple-400/60 bg-gray-950 cursor-grab active:cursor-grabbing touch-none select-none' 
                    : 'inset-0 z-[270] bg-gradient-to-b from-purple-950 via-slate-950 to-gray-950 text-white flex flex-col select-none'
                }`}
              >
                {/* Header Controls Bar */}
                {!isMinimized ? (
                  <div className="pt-[calc(2.5rem+env(safe-area-inset-top))] pb-3 px-6 md:pt-8 flex items-center justify-between z-20">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-purple-200 font-medium tracking-wide">
                        {activeCallState.type === 'video' ? 'Video Call' : 'Audio Call'}
                      </span>
                    </div>
                    <button 
                      onClick={() => { setIsMinimized(true); setIsHiddenPill(false); }}
                      className="p-2.5 bg-white/10 hover:bg-white/20 active:scale-95 rounded-full backdrop-blur-md transition-all border border-white/10 text-white cursor-pointer"
                      title="Minimize Call"
                    >
                      <Minimize2 className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="absolute top-2 left-2 right-2 flex items-center justify-between z-30 pointer-events-auto">
                    {/* Hide to Pill Button */}
                    <button 
                      onClick={(e) => { e.stopPropagation(); setIsHiddenPill(true); }}
                      className="p-1.5 bg-black/70 hover:bg-black/90 rounded-full text-white backdrop-blur-sm border border-white/20 cursor-pointer active:scale-90"
                      title="Hide/Minimize to Bubble"
                    >
                      <Minimize2 className="w-3.5 h-3.5" />
                    </button>
                    <div className="flex items-center space-x-1">
                      {/* Resize Mini Window Button */}
                      <button 
                        onClick={(e) => { e.stopPropagation(); setMiniSize(prev => prev === 'small' ? 'tiny' : 'small'); }}
                        className="p-1.5 bg-black/70 hover:bg-black/90 rounded-full text-white backdrop-blur-sm border border-white/20 cursor-pointer active:scale-90"
                        title="Change Mini Size"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                      {/* Expand Button */}
                      <button 
                        onClick={(e) => { e.stopPropagation(); setIsMinimized(false); }}
                        className="p-1.5 bg-black/70 hover:bg-black/90 rounded-full text-white backdrop-blur-sm border border-white/20 cursor-pointer active:scale-90"
                        title="Maximize Call"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Video Streams & Audio Display */}
                <div className="flex-1 relative flex items-center justify-center overflow-hidden">
                  {/* Remote Stream Video - FULL SCREEN FIT without inversion */}
                  {activeCallState.type === 'video' && (
                    <video 
                      ref={remoteVideoRef} 
                      autoPlay 
                      playsInline 
                      controls={false}
                      poster="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E"
                      className={!isVideoOff && remoteStream ? "absolute inset-0 w-full h-full object-cover z-0 transform-gpu" : "hidden pointer-events-none"}
                    />
                  )}

                  {/* Audio Call Display */}
                  {(activeCallState.type === 'audio' || isVideoOff) && (
                    <div className="flex flex-col items-center justify-center space-y-5 p-6 text-center z-10 my-auto">
                      <div className="relative flex items-center justify-center">
                        <div className="absolute w-44 h-44 rounded-full border-2 border-purple-400/30 scale-105 animate-pulse pointer-events-none transform-gpu" />
                        <div className="w-28 h-28 md:w-36 md:h-36 rounded-full overflow-hidden border-4 border-white/20 shadow-2xl relative z-10 bg-purple-900/60">
                          <img 
                            src={activeCallState.otherAvatar || `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${encodeURIComponent(activeCallState.otherName || 'User')}&backgroundColor=f1f5f9`} 
                            className="w-full h-full object-cover"
                            alt={activeCallState.otherName}
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <h3 className="text-2xl md:text-3xl font-semibold text-white tracking-tight">{activeCallState.otherName}</h3>
                        <p className="text-sm text-purple-200/90 font-mono tracking-wide">
                          {activeCallState.status === 'ringing' 
                            ? (activeCallState.isCaller ? 'Calling...' : 'Ringing...') 
                            : formatDuration(callDuration)}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Local Video Picture-in-Picture */}
                  {activeCallState.type === 'video' && !isMinimized && (
                    <motion.div 
                      drag
                      dragSnapToOrigin={false}
                      dragElastic={0.05}
                      dragMomentum={false}
                      whileDrag={{ scale: 1.05, cursor: 'grabbing' }}
                      className="absolute bottom-28 right-4 w-32 h-44 md:w-38 md:h-52 rounded-2xl overflow-hidden border-2 border-purple-400/40 shadow-2xl bg-black/90 z-30 cursor-grab touch-none group"
                    >
                      <video 
                        ref={localVideoRef} 
                        autoPlay 
                        muted 
                        playsInline 
                        poster="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E"
                        className={`w-full h-full object-cover transition-opacity duration-300 ${localStream ? 'opacity-100' : 'opacity-0'} ${isMirrored ? "transform -scale-x-100" : "transform scale-x-100"}`}
                      />

                      {/* Camera Controls */}
                      <div className="absolute top-2 left-2 right-2 flex items-center justify-between z-10">
                        <span className="bg-black/60 text-[10px] text-white/90 font-medium px-2 py-0.5 rounded-full backdrop-blur-md border border-white/20">
                          Me
                        </span>
                        <div className="flex items-center space-x-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              switchCamera();
                            }}
                            className="p-1 bg-black/60 hover:bg-black/80 active:scale-90 text-white rounded-full backdrop-blur-md border border-white/20 transition-all cursor-pointer"
                            title="Switch Camera"
                          >
                            <SwitchCamera className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsMirrored(prev => !prev);
                            }}
                            className="p-1 bg-black/60 hover:bg-black/80 active:scale-90 text-white rounded-full backdrop-blur-md border border-white/20 transition-all cursor-pointer"
                            title="Flip Camera"
                          >
                            <RefreshCw className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {isVideoOff && (
                        <div className="absolute inset-0 bg-gray-900 flex flex-col items-center justify-center text-gray-400 space-y-1">
                          <VideoOff className="w-6 h-6 text-gray-500" />
                          <span className="text-[10px] font-medium">Off</span>
                        </div>
                      )}
                    </motion.div>
                  )}
                </div>

                {/* Controls Bar - Soft 2D Oversized Action Buttons */}
                {!isMinimized && (
                  <div className="pb-[calc(2.5rem+env(safe-area-inset-bottom))] pt-6 px-6 flex items-center justify-center space-x-6 z-20 mb-4">
                    {/* Mute Button */}
                    <div className="flex flex-col items-center space-y-2">
                      <button 
                        onClick={toggleMute}
                        className={`w-16 h-16 md:w-18 md:h-18 rounded-full flex items-center justify-center transition-all active:scale-95 shadow-md cursor-pointer ${
                          isMuted 
                            ? 'bg-rose-500 text-white shadow-rose-500/30' 
                            : 'bg-white/20 text-white hover:bg-white/30 border border-white/25 backdrop-blur-md'
                        }`}
                      >
                        {isMuted ? <MicOff className="w-7 h-7" /> : <Mic className="w-7 h-7" />}
                      </button>
                      <span className="text-[12px] text-white/80 font-medium">{isMuted ? 'Muted' : 'Mute'}</span>
                    </div>

                    {/* Speaker Button */}
                    {activeCallState.type === 'audio' && (
                      <div className="flex flex-col items-center space-y-2">
                        <button 
                          onClick={toggleSpeaker}
                          className={`w-16 h-16 md:w-18 md:h-18 rounded-full flex items-center justify-center transition-all active:scale-95 shadow-md cursor-pointer ${
                            !isSpeakerOn 
                              ? 'bg-gray-800/90 text-gray-400 border border-gray-700' 
                              : 'bg-white/20 text-white hover:bg-white/30 border border-white/25 backdrop-blur-md'
                          }`}
                        >
                          {!isSpeakerOn ? <VolumeX className="w-7 h-7" /> : <Volume2 className="w-7 h-7" />}
                        </button>
                        <span className="text-[12px] text-white/80 font-medium">{isSpeakerOn ? 'Speaker' : 'Earpiece'}</span>
                      </div>
                    )}

                    {/* Video Button */}
                    {activeCallState.type === 'video' && (
                      <div className="flex flex-col items-center space-y-2">
                        <button 
                          onClick={toggleVideo}
                          className={`w-16 h-16 md:w-18 md:h-18 rounded-full flex items-center justify-center transition-all active:scale-95 shadow-md cursor-pointer ${
                            isVideoOff 
                              ? 'bg-rose-500 text-white shadow-rose-500/30' 
                              : 'bg-white/20 text-white hover:bg-white/30 border border-white/25 backdrop-blur-md'
                          }`}
                        >
                          {isVideoOff ? <VideoOff className="w-7 h-7" /> : <Video className="w-7 h-7" />}
                        </button>
                        <span className="text-[12px] text-white/80 font-medium">{isVideoOff ? 'Cam Off' : 'Camera'}</span>
                      </div>
                    )}

                    {/* End Call Button */}
                    <div className="flex flex-col items-center space-y-2">
                      <button 
                        onClick={handleEndActiveCall}
                        className="w-20 h-20 bg-rose-600 hover:bg-rose-700 active:scale-90 text-white rounded-full flex items-center justify-center transition-all shadow-lg shadow-rose-600/40 cursor-pointer"
                      >
                        <PhoneOff className="w-9 h-9" />
                      </button>
                      <span className="text-[12px] text-rose-300 font-medium">End Call</span>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </>
        )}
      </AnimatePresence>
    </>
  );
};
