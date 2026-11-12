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
  switchCamera,
  setSpeaker
} from '../services/callService';
import { logCallMessageInChat } from '../services/chatService';
import { native } from '../native';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

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
  // "Calling…" / "Ringing…" while the connection is being set up.
  const [callPhase, setCallPhase] = useState('');

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
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

  // Listen for global incoming call signals from Firestore
  useEffect(() => {
    if (!currentUser?.uid) return;
    const unsub = subscribeIncomingCalls(currentUser.uid, (call) => {
      if (call) {
        if (!activeCallState || activeCallState.callId !== call.id) {
          setIncomingCall(call);
          playRingtone('incoming');

          try {
            if (typeof window !== 'undefined' && 'vibrate' in navigator) {
              navigator.vibrate([300, 150, 300, 150, 450]);
            }
          } catch (e) {}

          // Only the native notification is used in the APK. A second generic
          // notification here made two notifications appear for one call.
          native.showIncomingCall(call.callerName, call.callerAvatar || '', call.type === 'video' ? 'video' : 'voice', call.id);
        }
      } else {
        setIncomingCall(prev => {
          if (prev) {
            stopRingtone();
            native.dismissIncomingCall();
          }
          return null;
        });
      }
    });
    return () => {
      unsub();
    };
  }, [currentUser?.uid, activeCallState?.callId]);

  // Handle native notification button actions (Accept / Decline while app was backgrounded or cold-started)
  useEffect(() => {
    const handleNativeCallAction = async () => {
      const pending = native.getPendingCallAction();
      if (!pending || !pending.callId) return;

      const { action, callId, name, type } = pending;

      if (action === 'decline') {
        stopRingtone();
        await rejectCall(callId);
        setIncomingCall(null);
        native.dismissIncomingCall();
        return;
      }

      if (action === 'accept') {
        stopRingtone();
        try {
          const snap = await getDoc(doc(db, 'calls', callId));
          if (!snap.exists() || snap.data()?.status === 'ended' || snap.data()?.status === 'rejected') {
            native.dismissIncomingCall();
            alert('Call has already ended');
            return;
          }

          const callData = { id: callId, ...snap.data() } as CallData;
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

          await acceptIncomingCall(
            callData,
            (remStream) => setRemoteStream(remStream),
            (status) => {
              if (status === 'ended' || status === 'rejected') {
                handleEndActiveCall();
              } else if (status === 'calling') {
                setCallPhase('Calling…');
              } else if (status === 'accepted') {
                setCallPhase('');
              }
            }
          );
        } catch (e) {
          console.warn('[Call] Failed connecting from native call action:', e);
          native.dismissIncomingCall();
        }
      }
    };

    const w = window as any;
    w.onNativeCallAction = handleNativeCallAction;
    w.onNativeHangup = () => {
      handleEndActiveCall();
    };

    if (currentUser?.uid) {
      handleNativeCallAction();
    }
  }, [currentUser?.uid]);

  // Flash PC browser document title when incoming call arrives
  useEffect(() => {
    if (!incomingCall) return;
    const originalTitle = document.title;
    let toggle = false;
    const interval = setInterval(() => {
      document.title = toggle 
        ? `📞 (1) Incoming Call from ${incomingCall.callerName}...` 
        : `⚡ Ennvo - Ringing...`;
      toggle = !toggle;
    }, 900);

    return () => {
      clearInterval(interval);
      document.title = originalTitle;
    };
  }, [incomingCall]);

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

  // Speaker/earpiece is decided by the call type: video is hands-free, a voice
  // call starts on the earpiece (and holds the screen against the ear).
  useEffect(() => {
    if (!activeCallState) return;
    const speaker = activeCallState.type === 'video';
    setIsSpeakerOn(speaker);
    setSpeaker(speaker);
  }, [activeCallState?.callId, activeCallState?.type]);

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

  // Attach remote stream to the hidden audio element. Audio is always played
  // here so it keeps working for voice calls, minimized video and camera-off.
  useEffect(() => {
    const audio = remoteAudioRef.current;
    if (!audio) return;
    if (remoteStream && remoteStream.getTracks().length > 0) {
      if (audio.srcObject !== remoteStream) audio.srcObject = remoteStream;
      audio.play().catch(() => console.log('Remote audio playback initiated:', audio.srcObject));
    } else {
      audio.srcObject = null;
    }
  }, [remoteStream, activeCallState?.status]);

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
    native.dismissIncomingCall();
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
          } else if (status === 'calling') {
            setCallPhase('Calling…');
          } else if (status === 'accepted') {
            setCallPhase('');
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
    native.dismissIncomingCall();
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
    native.dismissIncomingCall();
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
      // bridge.setSpeaker already updates the native audio route and proximity.
      setSpeaker(next);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.volume = next ? 1.0 : 0.2;
      }
      return next;
    });
  };

  const [isInPipMode, setIsInPipMode] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const w = window as any;
      w.onPipChanged = (inPip: boolean) => {
        setIsInPipMode(!!inPip);
      };
    }
  }, []);

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

  if (isInPipMode && activeCallState) {
    return (
      <div className="fixed inset-0 z-[9999] bg-black flex items-center justify-center pointer-events-none">
        {remoteStream && (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
        )}
      </div>
    );
  }

  return (
    <>
      {/* 1. Full-Screen Fresh White & Sky Blue Incoming Call Page */}
      <AnimatePresence>
        {incomingCall && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[360] bg-gradient-to-b from-sky-100 via-sky-50 to-white dark:from-[#061726] dark:via-[#09223a] dark:to-[#040f1a] text-slate-900 dark:text-white flex flex-col justify-between p-6 pt-10 pb-14 font-sans select-none overflow-hidden"
          >
            {/* Top Bar - Minimal */}
            <div className="flex items-center justify-between w-full z-10 px-2">
              <span className="text-xs font-semibold text-sky-600 dark:text-sky-300 tracking-wide uppercase">
                {incomingCall.type === 'video' ? 'Incoming Video Call' : 'Incoming Audio Call'}
              </span>
            </div>

            {/* Center Profile Picture & Name */}
            <div className="flex flex-col items-center text-center space-y-4 z-10 my-auto">
              <div className="w-36 h-36 sm:w-44 sm:h-44 rounded-full overflow-hidden border-4 border-white dark:border-slate-800 shadow-2xl bg-slate-200 dark:bg-slate-900 ring-4 ring-sky-400/40">
                <img 
                  src={incomingCall.callerAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(incomingCall.callerName)}&background=random`} 
                  className="w-full h-full object-cover"
                  alt={incomingCall.callerName}
                />
              </div>

              <div className="space-y-1 max-w-xs">
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight truncate">
                  {incomingCall.callerName}
                </h2>
                <p className="text-sm font-semibold text-sky-600 dark:text-sky-300">
                  Ringing...
                </p>
              </div>
            </div>

            {/* Bottom Action Buttons */}
            <div className="w-full max-w-xs mx-auto flex items-center justify-around z-10">
              {/* Decline */}
              <div className="flex flex-col items-center space-y-1.5">
                <button 
                  onClick={handleRejectIncoming}
                  className="w-16 h-16 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-600/30 transition-all cursor-pointer border border-rose-400/30"
                  title="Decline Call"
                >
                  <PhoneOff className="w-7 h-7" />
                </button>
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Decline</span>
              </div>

              {/* Accept */}
              <div className="flex flex-col items-center space-y-1.5">
                <button 
                  onClick={handleAcceptIncoming}
                  className="w-16 h-16 rounded-full bg-gradient-to-tr from-emerald-500 to-sky-400 hover:from-emerald-400 hover:to-sky-300 text-white flex items-center justify-center shadow-lg shadow-sky-500/30 transition-all cursor-pointer border border-white/50"
                  title="Accept Call"
                >
                  <Phone className="w-7 h-7" />
                </button>
                <span className="text-xs font-bold text-sky-600 dark:text-sky-300">Accept</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. Active Call Clean White & Sky Blue Screen */}
      <AnimatePresence>
        {activeCallState && (
          <>
            {/* The audio of every call is routed through this element. The
                remote <video> stays muted so audio never plays twice. */}
            <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

            {/* Collapsed Pill Mode */}
            {isMinimized && isHiddenPill ? (
              <div
                onClick={() => setIsHiddenPill(false)}
                className="fixed bottom-24 right-4 z-[280] bg-white dark:bg-[#0b243d] text-slate-900 dark:text-white px-4 py-2.5 rounded-full shadow-2xl border border-sky-300 dark:border-sky-400/40 flex items-center space-x-3 cursor-pointer select-none"
              >
                <div className="relative">
                  <img
                    src={activeCallState.otherAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(activeCallState.otherName)}&background=random`}
                    className="w-8.5 h-8.5 rounded-full object-cover border-2 border-white ring-2 ring-sky-400/40"
                    alt={activeCallState.otherName}
                  />
                  <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-emerald-400 border-2 border-slate-900 rounded-full" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold max-w-[95px] truncate">{activeCallState.otherName}</span>
                  <span className="text-[10.5px] text-sky-600 dark:text-sky-300 font-mono font-bold">
                    {callPhase || formatDuration(callDuration)}
                  </span>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setIsHiddenPill(false); }}
                  className="p-1.5 bg-sky-500 rounded-full text-white cursor-pointer border-0"
                  title="Expand Call"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className={`fixed ${
                  isMinimized 
                    ? miniSize === 'tiny'
                      ? 'bottom-20 right-4 w-36 h-48 z-[270] rounded-3xl overflow-hidden shadow-2xl border-2 border-sky-400/50 bg-white dark:bg-[#081b2e] select-none'
                      : 'bottom-20 right-4 w-44 h-64 z-[270] rounded-3xl overflow-hidden shadow-2xl border-2 border-sky-400/50 bg-white dark:bg-[#081b2e] select-none' 
                    : 'inset-0 z-[270] bg-gradient-to-b from-sky-100 via-sky-50 to-white dark:from-[#061726] dark:via-[#09223a] dark:to-[#040f1a] text-slate-900 dark:text-white flex flex-col select-none transform-gpu'
                }`}
              >
                {/* Top Bar - Clean Minimize Button */}
                {!isMinimized ? (
                  <div className="pt-10 sm:pt-6 pb-2 px-6 flex items-center justify-between z-20">
                    <span className="text-xs font-semibold text-sky-600 dark:text-sky-300 uppercase tracking-wider">
                      {activeCallState.type === 'video' ? 'Video Call' : 'Audio Call'}
                    </span>
                    <button 
                      onClick={() => { setIsMinimized(true); setIsHiddenPill(false); }}
                      className="p-2.5 bg-sky-200/60 dark:bg-white/10 hover:bg-sky-300/60 dark:hover:bg-white/20 rounded-full text-slate-800 dark:text-white cursor-pointer transition-all shadow-xs border border-sky-300/50 dark:border-white/20"
                      title="Minimize Call"
                    >
                      <Minimize2 className="w-4.5 h-4.5" />
                    </button>
                  </div>
                ) : (
                  <div className="absolute top-2 left-2 right-2 flex items-center justify-between z-30">
                    <button 
                      onClick={() => setIsHiddenPill(true)}
                      className="p-1.5 bg-black/60 text-white rounded-full cursor-pointer"
                    >
                      <Minimize2 className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={() => setIsMinimized(false)}
                      className="p-1.5 bg-black/60 text-white rounded-full cursor-pointer"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Video / Audio Center Stage */}
                <div className="flex-1 relative flex items-center justify-center overflow-hidden">
                  {/* Remote Video Stream */}
                  {activeCallState.type === 'video' && (
                    <video 
                      ref={remoteVideoRef} 
                      autoPlay 
                      playsInline 
                      muted
                      controls={false}
                      className={remoteStream ? "absolute inset-0 w-full h-full object-cover z-0 transform-gpu" : "hidden pointer-events-none"}
                    />
                  )}

                  {/* Audio Call Profile Picture & Status */}
                  {(activeCallState.type === 'audio' || isVideoOff || !remoteStream) && (
                    <div className="flex flex-col items-center justify-center space-y-4 p-6 text-center z-10 my-auto">
                      <div className="w-36 h-36 sm:w-44 sm:h-44 rounded-full overflow-hidden border-4 border-white dark:border-slate-800 shadow-2xl relative z-10 bg-slate-200 dark:bg-slate-900 ring-4 ring-sky-400/40">
                        <img 
                          src={activeCallState.otherAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(activeCallState.otherName || 'User')}&background=random`} 
                          className="w-full h-full object-cover"
                          alt={activeCallState.otherName}
                        />
                      </div>

                      <div className="space-y-1">
                        <h3 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">{activeCallState.otherName}</h3>
                        <p className="text-sm font-mono font-bold text-sky-600 dark:text-sky-300">
                          {activeCallState.status === 'ringing' 
                            ? (activeCallState.isCaller ? 'Calling...' : 'Ringing...') 
                            : formatDuration(callDuration)}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Local Video PiP */}
                  {activeCallState.type === 'video' && !isMinimized && (
                    <div className="absolute bottom-24 right-4 w-28 h-40 sm:w-34 sm:h-48 rounded-2xl overflow-hidden border-2 border-white shadow-xl bg-slate-900 z-30 group ring-2 ring-sky-400/40">
                      <video 
                        ref={localVideoRef} 
                        autoPlay 
                        muted 
                        playsInline 
                        className={`w-full h-full object-cover ${isMirrored ? "-scale-x-100" : "scale-x-100"}`}
                      />

                      <div className="absolute top-1.5 left-1.5 right-1.5 flex items-center justify-between z-10">
                        <span className="bg-black/60 text-[9.5px] text-white font-bold px-1.5 py-0.5 rounded-full border border-white/20">
                          Me
                        </span>
                        <button
                          type="button"
                          onClick={() => switchCamera()}
                          className="p-1 bg-black/60 hover:bg-black/80 text-white rounded-full border border-white/20 transition-all cursor-pointer"
                          title="Switch Camera"
                        >
                          <SwitchCamera className="w-3 h-3" />
                        </button>
                      </div>

                      {isVideoOff && (
                        <div className="absolute inset-0 bg-slate-900 flex flex-col items-center justify-center text-slate-400 space-y-1">
                          <VideoOff className="w-5 h-5 text-slate-500" />
                          <span className="text-[10px] font-medium">Off</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Bottom Control Dock: Clean Mute, Speaker, End Call */}
                {!isMinimized && (
                  <div className="pb-10 pt-4 px-6 flex items-center justify-center space-x-6 z-20">
                    {/* Mute Button */}
                    <div className="flex flex-col items-center space-y-1">
                      <button 
                        onClick={toggleMute}
                        className={`w-14 h-14 rounded-full flex items-center justify-center transition-all  cursor-pointer shadow-md ${
                          isMuted 
                            ? 'bg-rose-500 text-white shadow-rose-500/30 border border-rose-400' 
                            : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white border border-sky-200 dark:border-slate-700'
                        }`}
                        title={isMuted ? 'Unmute' : 'Mute'}
                      >
                        {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                      </button>
                      <span className="text-[11px] text-slate-700 dark:text-slate-300 font-semibold">{isMuted ? 'Muted' : 'Mute'}</span>
                    </div>

                    {/* Speaker Button */}
                    <div className="flex flex-col items-center space-y-1">
                      <button 
                        onClick={toggleSpeaker}
                        className={`w-14 h-14 rounded-full flex items-center justify-center transition-all  cursor-pointer shadow-md ${
                          !isSpeakerOn 
                            ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-300 dark:border-slate-700' 
                            : 'bg-sky-500 text-white shadow-sky-500/30 border border-sky-400'
                        }`}
                        title={isSpeakerOn ? 'Speaker' : 'Earpiece'}
                      >
                        {!isSpeakerOn ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
                      </button>
                      <span className="text-[11px] text-slate-700 dark:text-slate-300 font-semibold">{isSpeakerOn ? 'Speaker' : 'Earpiece'}</span>
                    </div>

                    {/* Camera Switch (for Video Call) */}
                    {activeCallState.type === 'video' && (
                      <div className="flex flex-col items-center space-y-1">
                        <button 
                          onClick={() => switchCamera()}
                          className="w-14 h-14 rounded-full bg-white dark:bg-slate-800 text-slate-800 dark:text-white flex items-center justify-center transition-all cursor-pointer border border-sky-200 dark:border-slate-700 shadow-md"
                          title="Switch Camera"
                        >
                          <SwitchCamera className="w-6 h-6" />
                        </button>
                        <span className="text-[11px] text-slate-700 dark:text-slate-300 font-semibold">Flip</span>
                      </div>
                    )}

                    {/* Video Toggle (for Video Call) */}
                    {activeCallState.type === 'video' && (
                      <div className="flex flex-col items-center space-y-1">
                        <button 
                          onClick={toggleVideo}
                          className={`w-14 h-14 rounded-full flex items-center justify-center transition-all  cursor-pointer shadow-md ${
                            isVideoOff 
                              ? 'bg-rose-500 text-white shadow-rose-500/30 border border-rose-400' 
                              : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white border border-sky-200 dark:border-slate-700'
                          }`}
                          title={isVideoOff ? 'Cam On' : 'Cam Off'}
                        >
                          {isVideoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
                        </button>
                        <span className="text-[11px] text-slate-700 dark:text-slate-300 font-semibold">{isVideoOff ? 'Cam Off' : 'Camera'}</span>
                      </div>
                    )}

                    {/* End Call Button */}
                    <div className="flex flex-col items-center space-y-1">
                      <button 
                        onClick={handleEndActiveCall}
                        className="w-14 h-14 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center transition-all cursor-pointer shadow-lg shadow-rose-600/30 border border-rose-400"
                        title="End Call"
                      >
                        <PhoneOff className="w-6 h-6" />
                      </button>
                      <span className="text-[11px] text-slate-700 dark:text-slate-300 font-bold">End</span>
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
