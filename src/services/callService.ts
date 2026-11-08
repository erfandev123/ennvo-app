/**
 * Ennvo High-Performance WebRTC Video & Voice Call Service
 * Integrated with Native Android Bridge, Trickle ICE, Dynamic Reconnection & Bandwidth Control.
 */

import { 
  collection, 
  addDoc, 
  doc, 
  onSnapshot, 
  updateDoc, 
  getDoc,
  query,
  where,
  limit,
  Unsubscribe
} from 'firebase/firestore';
import { db } from '../firebase';
import { bridge } from '../native/bridge';
import { getCachedAppConfig } from './appConfigService';
import { playIncomingRingtone, playOutgoingRingtone, stopCallSounds } from './soundService';

export const playRingtone = (type: 'incoming' | 'outgoing' = 'incoming') => {
  if (type === 'incoming') {
    playIncomingRingtone();
  } else {
    playOutgoingRingtone();
  }
};

export interface CallData {
  id: string;
  callerId: string;
  callerName: string;
  callerAvatar: string;
  receiverId: string;
  receiverName: string;
  receiverAvatar: string;
  type: 'audio' | 'video';
  status: 'ringing' | 'accepted' | 'rejected' | 'ended' | 'reconnecting';
  createdAt: number;
  offer?: any;
  answer?: any;
}

let peerConnection: RTCPeerConnection | null = null;
let localStream: MediaStream | null = null;
let remoteStream: MediaStream | null = null;
let iceCandidateQueue: RTCIceCandidateInit[] = [];
let currentFacingMode: 'user' | 'environment' = 'user';
let activeCallId: string | null = null;
let reconnectAttempts = 0;
let isCallConnected = false;
let currentCallType: 'audio' | 'video' = 'audio';
let activeCallPartnerName = '';

type StreamListener = (local: MediaStream | null, remote: MediaStream | null) => void;
const streamListeners = new Set<StreamListener>();

export const subscribeCallStreams = (listener: StreamListener) => {
  streamListeners.add(listener);
  listener(localStream, remoteStream);
  return () => {
    streamListeners.delete(listener);
  };
};

export const notifyStreamChanges = () => {
  streamListeners.forEach(l => l(localStream, remoteStream));
};

const getEffectiveIceServers = (): RTCIceServer[] => {
  const config = getCachedAppConfig();
  if (config?.rtc?.iceServers && config.rtc.iceServers.length > 0) {
    return config.rtc.iceServers;
  }
  return [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] },
    { urls: ['stun:global.stun.twilio.com:3478'] },
    { urls: ['stun:stun.services.mozilla.com'] }
  ];
};

/**
 * Optimized SDP Munger for Opus Audio & Video bitrates
 */
const setOpusBandwidthAndFec = (sdp: string, maxBitrateKbps: number = 32): string => {
  let lines = sdp.split('\r\n');
  let opusPayload: string | null = null;

  for (const line of lines) {
    const match = line.match(/^a=rtpmap:(\d+)\s+opus\/48000/i);
    if (match) {
      opusPayload = match[1];
      break;
    }
  }

  if (opusPayload) {
    lines = lines.map(line => {
      if (line.startsWith(`a=fmtp:${opusPayload}`)) {
        if (!line.includes('useinbandfec')) {
          line += ';useinbandfec=1;usedtx=1;maxaveragebitrate=' + (maxBitrateKbps * 1000);
        }
      }
      return line;
    });
  }

  return lines.join('\r\n');
};

/**
 * Configure RTCRtpSender parameters for low-end mobile hardware
 */
const tuneSenderParameters = async (pc: RTCPeerConnection) => {
  try {
    const senders = pc.getSenders();
    for (const sender of senders) {
      if (sender.track?.kind === 'video') {
        const params = sender.getParameters();
        if (!params.encodings || params.encodings.length === 0) {
          params.encodings = [{}];
        }
        params.encodings[0].maxBitrate = 600000; // 600 kbps cap
        params.degradationPreference = 'maintain-framerate';
        await sender.setParameters(params);
      }
    }
  } catch (e) {
    console.warn('[CallService] Sender parameter tuning notice:', e);
  }
};

/**
 * Synthetic fallback stream when hardware camera/mic is blocked or unavailable
 */
const createSyntheticAudioStream = (): MediaStream => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return new MediaStream();
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const dst = ctx.createMediaStreamDestination();
    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    osc.connect(gain);
    gain.connect(dst);
    osc.start();
    return dst.stream;
  } catch (e) {
    return new MediaStream();
  }
};

export const getMediaStreamWithFallback = async (type: 'audio' | 'video'): Promise<MediaStream> => {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    return createSyntheticAudioStream();
  }

  // Mobile-optimized constraints for cheap phones (640x480 @ 24fps)
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 48000,
        channelCount: 1, // Mono
      },
      video: type === 'video' ? {
        facingMode: 'user',
        width: { ideal: 640, max: 1280 },
        height: { ideal: 480, max: 720 },
        frameRate: { ideal: 24, max: 24 }
      } : false
    });
  } catch (err1) {
    console.warn('[CallService] Ideal constraints failed, falling back to basic audio/video:', err1);
  }

  if (type === 'video') {
    try {
      return await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    } catch (err2) {
      console.warn('[CallService] Basic video failed, falling back to audio only:', err2);
    }
  }

  try {
    return await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  } catch (err3) {
    return createSyntheticAudioStream();
  }
};

export const switchCamera = async () => {
  if (!localStream) return;
  const videoTrack = localStream.getVideoTracks()[0];
  if (!videoTrack) return;

  currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';

  try {
    const newStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: currentFacingMode, width: { ideal: 640 }, height: { ideal: 480 } }
    });
    const newVideoTrack = newStream.getVideoTracks()[0];
    if (newVideoTrack) {
      if (peerConnection) {
        const sender = peerConnection.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          await sender.replaceTrack(newVideoTrack);
        }
      }
      videoTrack.stop();
      localStream.removeTrack(videoTrack);
      localStream.addTrack(newVideoTrack);
      notifyStreamChanges();
    }
  } catch (err) {
    console.error('Failed to switch camera:', err);
  }
};

export const setAudioMuted = (muted: boolean): boolean => {
  if (localStream) {
    localStream.getAudioTracks().forEach(track => {
      track.enabled = !muted;
    });
  }
  if (peerConnection) {
    peerConnection.getSenders().forEach(sender => {
      if (sender.track && sender.track.kind === 'audio') {
        sender.track.enabled = !muted;
      }
    });
  }
  notifyStreamChanges();
  return muted;
};

export const setVideoDisabled = (disabled: boolean): boolean => {
  if (localStream) {
    localStream.getVideoTracks().forEach(track => {
      track.enabled = !disabled;
    });
  }
  if (peerConnection) {
    peerConnection.getSenders().forEach(sender => {
      if (sender.track && sender.track.kind === 'video') {
        sender.track.enabled = !disabled;
      }
    });
  }
  notifyStreamChanges();
  return disabled;
};

export const setSpeaker = (on: boolean) => {
  bridge.setSpeaker(on);
};

export const stopRingtone = () => {
  stopCallSounds();
};

export const cleanupMedia = () => {
  stopRingtone();
  bridge.endCall();
  bridge.dismissIncomingCall();
  bridge.setPip(false, 0, 0);

  if (localStream) {
    localStream.getTracks().forEach(track => {
      try { track.stop(); } catch (e) {}
    });
    localStream = null;
  }
  if (peerConnection) {
    try {
      peerConnection.close();
    } catch (e) {}
    peerConnection = null;
  }
  remoteStream = null;
  iceCandidateQueue = [];
  activeCallId = null;
  reconnectAttempts = 0;
  isCallConnected = false;
  notifyStreamChanges();
};

const handledCallIds = new Set<string>();
export const markCallHandled = (callId: string) => {
  if (callId) handledCallIds.add(callId);
};

/**
 * Incoming call subscription with background native notifications
 */
export const subscribeIncomingCalls = (userId: string, callback: (call: CallData | null) => void) => {
  if (!userId) return () => {};

  const q = query(
    collection(db, 'calls'),
    where('receiverId', '==', userId),
    limit(5)
  );

  return onSnapshot(q, (snapshot) => {
    if (!snapshot.empty) {
      const now = Date.now();
      const ringingCalls = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() } as CallData))
        .filter(c => c.status === 'ringing' && !handledCallIds.has(c.id) && (now - (c.createdAt || 0)) < 35000)
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      if (ringingCalls.length > 0) {
        const topCall = ringingCalls[0];
        
        // If app is currently minimized/backgrounded, trigger full-screen native incoming call
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
          bridge.showIncomingCall(
            topCall.callerName || 'Ennvo User',
            topCall.callerAvatar || '',
            topCall.type === 'video' ? 'video' : 'voice',
            topCall.id
          );
        }

        callback(topCall);
        return;
      }
    }
    bridge.dismissIncomingCall();
    callback(null);
  }, (err) => console.warn('[CallService] incoming calls error:', err));
};

/**
 * Initiate an Outgoing Call
 */
export const initiateCall = async (
  caller: { uid: string; name: string; avatar: string },
  receiver: { uid: string; name: string; avatar: string },
  type: 'audio' | 'video',
  onRemoteStream: (stream: MediaStream) => void,
  onCallStatusChange: (status: 'ringing' | 'accepted' | 'rejected' | 'ended' | 'reconnecting') => void
): Promise<{ callId: string; stream: MediaStream }> => {
  cleanupMedia();
  currentCallType = type;
  activeCallPartnerName = receiver.name || 'Ennvo Call';

  playOutgoingRingtone();

  // 1. Pre-warm media and connection
  localStream = await getMediaStreamWithFallback(type);
  notifyStreamChanges();

  const rtcConfig: RTCConfiguration = {
    iceServers: getEffectiveIceServers(),
    iceCandidatePoolSize: 4
  };

  peerConnection = new RTCPeerConnection(rtcConfig);
  localStream.getTracks().forEach(track => {
    peerConnection?.addTrack(track, localStream!);
  });

  tuneSenderParameters(peerConnection);

  remoteStream = new MediaStream();
  peerConnection.ontrack = (event) => {
    if (event.streams && event.streams[0]) {
      remoteStream = event.streams[0];
    } else {
      if (!remoteStream) remoteStream = new MediaStream();
      if (event.track && !remoteStream.getTracks().some(t => t.id === event.track.id)) {
        remoteStream.addTrack(event.track);
      }
    }
    onRemoteStream(new MediaStream(remoteStream.getTracks()));
    notifyStreamChanges();
  };

  // Reconnection & ICE State handler
  peerConnection.oniceconnectionstatechange = async () => {
    const state = peerConnection?.iceConnectionState;
    if (state === 'disconnected' || state === 'failed') {
      if (reconnectAttempts < 3 && activeCallId) {
        reconnectAttempts++;
        onCallStatusChange('reconnecting');
        try {
          const restartOffer = await peerConnection?.createOffer({ iceRestart: true });
          if (restartOffer && peerConnection) {
            await peerConnection.setLocalDescription(restartOffer);
            await updateDoc(doc(db, 'calls', activeCallId), {
              offer: { type: restartOffer.type, sdp: setOpusBandwidthAndFec(restartOffer.sdp) }
            });
          }
        } catch (e) {
          console.warn('[CallService] ICE restart failed:', e);
        }
      } else {
        endCall(activeCallId || '');
      }
    } else if (state === 'connected' || state === 'completed') {
      reconnectAttempts = 0;
      onCallStatusChange('accepted');
    }
  };

  // 2. Create Call in Firestore
  const callDocRef = await addDoc(collection(db, 'calls'), {
    callerId: caller.uid,
    callerName: caller.name || 'User',
    callerAvatar: caller.avatar || '',
    receiverId: receiver.uid,
    receiverName: receiver.name || 'User',
    receiverAvatar: receiver.avatar || '',
    type,
    status: 'ringing',
    createdAt: Date.now()
  });

  const callId = callDocRef.id;
  activeCallId = callId;

  // Dispatch High-Priority DATA-ONLY Call Push for native notification (rings even when app is closed)
  fetch('/api/native/send-push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      targetUserId: receiver.uid,
      type: 'call',
      name: caller.name || 'Caller',
      avatar: caller.avatar || '',
      callType: type,
      callId
    })
  }).catch((err) => console.warn('[Call] Failed triggering call push:', err));

  // 3. Batch Trickle ICE Candidates
  const callerCandidatesCol = collection(db, 'calls', callId, 'callerCandidates');
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      addDoc(callerCandidatesCol, event.candidate.toJSON()).catch(() => {});
    }
  };

  // 4. Create Offer with Opus FEC & Bitrate tuning
  const rawOffer = await peerConnection.createOffer();
  const mungedOffer = {
    type: rawOffer.type,
    sdp: setOpusBandwidthAndFec(rawOffer.sdp || '')
  };
  await peerConnection.setLocalDescription(mungedOffer);

  await updateDoc(callDocRef, {
    offer: mungedOffer
  });

  // 5. Listen for answer & status
  let unsubReceiverCandidates: Unsubscribe | null = null;
  const unsubscribeCall = onSnapshot(callDocRef, async (snapshot) => {
    const data = snapshot.data();
    if (!data) return;

    if (data.status === 'rejected' || data.status === 'ended') {
      stopRingtone();
      onCallStatusChange(data.status);
      cleanupMedia();
      unsubscribeCall();
      if (unsubReceiverCandidates) unsubReceiverCandidates();
    } else if (data.status === 'accepted' && data.answer && !peerConnection?.currentRemoteDescription) {
      stopRingtone();
      isCallConnected = true;
      bridge.startCall(receiver.name || 'Ennvo Call', type === 'video');
      bridge.setPip(true, 9, 16);
      onCallStatusChange('accepted');

      const rtcAnswer = new RTCSessionDescription(data.answer);
      await peerConnection?.setRemoteDescription(rtcAnswer);

      // Drain queue
      while (iceCandidateQueue.length > 0) {
        const cand = iceCandidateQueue.shift();
        if (cand && peerConnection) {
          peerConnection.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
        }
      }

      // Listen for receiver candidates
      const receiverCandidatesCol = collection(db, 'calls', callId, 'receiverCandidates');
      unsubReceiverCandidates = onSnapshot(receiverCandidatesCol, (candSnapshot) => {
        candSnapshot.docChanges().forEach(change => {
          if (change.type === 'added') {
            const candData = change.doc.data();
            if (peerConnection?.remoteDescription) {
              peerConnection.addIceCandidate(new RTCIceCandidate(candData)).catch(() => {});
            } else {
              iceCandidateQueue.push(candData);
            }
          }
        });
      });
    }
  });

  return { callId, stream: localStream };
};

/**
 * Accept Incoming Call
 */
export const acceptIncomingCall = async (
  call: CallData,
  onRemoteStream: (stream: MediaStream) => void,
  onCallStatusChange: (status: 'ringing' | 'accepted' | 'rejected' | 'ended' | 'reconnecting') => void
): Promise<{ stream: MediaStream }> => {
  cleanupMedia();
  stopRingtone();
  bridge.dismissIncomingCall();

  currentCallType = call.type;
  activeCallId = call.id;
  activeCallPartnerName = call.callerName || 'Ennvo Call';

  localStream = await getMediaStreamWithFallback(call.type);
  notifyStreamChanges();

  const rtcConfig: RTCConfiguration = {
    iceServers: getEffectiveIceServers(),
    iceCandidatePoolSize: 4
  };

  peerConnection = new RTCPeerConnection(rtcConfig);
  localStream.getTracks().forEach(track => {
    peerConnection?.addTrack(track, localStream!);
  });

  tuneSenderParameters(peerConnection);

  remoteStream = new MediaStream();
  peerConnection.ontrack = (event) => {
    if (event.streams && event.streams[0]) {
      remoteStream = event.streams[0];
    } else {
      if (!remoteStream) remoteStream = new MediaStream();
      if (event.track && !remoteStream.getTracks().some(t => t.id === event.track.id)) {
        remoteStream.addTrack(event.track);
      }
    }
    onRemoteStream(new MediaStream(remoteStream.getTracks()));
    notifyStreamChanges();
  };

  // Listen for caller candidates in parallel immediately
  const callerCandidatesCol = collection(db, 'calls', call.id, 'callerCandidates');
  const unsubCallerCandidates = onSnapshot(callerCandidatesCol, (candSnapshot) => {
    candSnapshot.docChanges().forEach(change => {
      if (change.type === 'added') {
        const candData = change.doc.data();
        if (peerConnection?.remoteDescription) {
          peerConnection.addIceCandidate(new RTCIceCandidate(candData)).catch(() => {});
        } else {
          iceCandidateQueue.push(candData);
        }
      }
    });
  });

  if (call.offer) {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(call.offer));
  } else {
    // Fallback: fetch offer doc if missing
    try {
      const snap = await getDoc(doc(db, 'calls', call.id));
      if (snap.exists() && snap.data()?.offer) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(snap.data()!.offer));
      }
    } catch (e) {}
  }

  const receiverCandidatesCol = collection(db, 'calls', call.id, 'receiverCandidates');
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      addDoc(receiverCandidatesCol, event.candidate.toJSON()).catch(() => {});
    }
  };

  const rawAnswer = await peerConnection.createAnswer();
  const mungedAnswer = {
    type: rawAnswer.type,
    sdp: setOpusBandwidthAndFec(rawAnswer.sdp || '')
  };
  await peerConnection.setLocalDescription(mungedAnswer);

  const callDocRef = doc(db, 'calls', call.id);
  await updateDoc(callDocRef, {
    answer: mungedAnswer,
    status: 'accepted'
  });

  // Flush any queued caller candidates instantly
  while (iceCandidateQueue.length > 0) {
    const cand = iceCandidateQueue.shift();
    if (cand && peerConnection && peerConnection.remoteDescription) {
      peerConnection.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
    }
  }

  isCallConnected = true;
  bridge.startCall(call.callerName || 'Ennvo Call', call.type === 'video');
  bridge.setPip(true, 9, 16);
  onCallStatusChange('accepted');

  const unsubscribeCall = onSnapshot(callDocRef, (snap) => {
    const data = snap.data();
    if (data && (data.status === 'ended' || data.status === 'rejected')) {
      stopRingtone();
      onCallStatusChange(data.status);
      cleanupMedia();
      unsubscribeCall();
      if (unsubCallerCandidates) unsubCallerCandidates();
    }
  });

  return { stream: localStream };
};

export const rejectCall = async (callId: string) => {
  markCallHandled(callId);
  bridge.dismissIncomingCall();
  stopRingtone();
  try {
    await updateDoc(doc(db, 'calls', callId), { status: 'rejected' });
  } catch (e) {}
  cleanupMedia();
};

export const endCall = async (callId: string) => {
  markCallHandled(callId);
  bridge.dismissIncomingCall();
  bridge.endCall();
  stopRingtone();
  try {
    if (callId) {
      await updateDoc(doc(db, 'calls', callId), { status: 'ended' });
    }
  } catch (e) {}
  cleanupMedia();
};

// Wire Native Hangup Callback
if (typeof window !== 'undefined') {
  const w = window as any;
  w.onNativeHangup = () => {
    if (activeCallId) {
      endCall(activeCallId);
    } else {
      cleanupMedia();
    }
  };
}
