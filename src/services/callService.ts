/**
 * Ennvo High-Performance WebRTC Video & Voice Call Service
 * Integrated with Native Android Bridge, Trickle ICE, Dynamic Reconnection & Bandwidth Control.
 *
 * Latency rules used everywhere in this file:
 *  - the ring/push is sent before media is acquired, so the other phone starts
 *    ringing while the camera/mic is still warming up;
 *  - answering overlaps the Firestore round-trip with getUserMedia;
 *  - every call owns exactly one native CallService start (with its callId);
 *  - both peers can restart ICE without dropping the call.
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
import { notifyUser } from './pushGateway';
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
  status: 'ringing' | 'calling' | 'accepted' | 'rejected' | 'ended' | 'reconnecting';
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
let nativeCallAnnounced = false;

// Active Firestore listeners. They are detached in cleanupMedia so a finished
// call can never keep a snapshot stream (or a retry loop) alive.
let callDocUnsub: Unsubscribe | null = null;
let candidatesUnsub: Unsubscribe | null = null;
let answeringRestart = false;
let lastAppliedAnswerSdp = '';
let lastAppliedOfferSdp = '';

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

const STUN_SERVERS: RTCIceServer[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] },
  { urls: ['stun:global.stun.twilio.com:3478'] },
  { urls: ['stun:stun.services.mozilla.com'] },
];

/**
 * Calls between two phones on mobile data only worked when both peers happened
 * to be reachable directly. Behind carrier NAT (most 4G/5G networks) the ICE
 * negotiation never completes, so the call "rings" but there is no audio.
 * A TURN relay fixes that. Set VITE_TURN_URL / VITE_TURN_USERNAME /
 * VITE_TURN_CREDENTIAL to your own relay, otherwise the public Open Relay
 * fallback below is used.
 */
const turnServers = (): RTCIceServer[] => {
  const env = (import.meta as any)?.env || {};
  const url = env.VITE_TURN_URL as string | undefined;
  const username = env.VITE_TURN_USERNAME as string | undefined;
  const credential = env.VITE_TURN_CREDENTIAL as string | undefined;

  if (url) {
    const urls = url.split(',').map((u) => u.trim()).filter(Boolean);
    return [{ urls, username, credential }];
  }

  return [
    {
      urls: [
        'turn:openrelay.metered.ca:80',
        'turn:openrelay.metered.ca:443',
        'turns:openrelay.metered.ca:443?transport=tcp',
      ],
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ];
};

const getEffectiveIceServers = (): RTCIceServer[] => {
  const config = getCachedAppConfig();
  if (config?.rtc?.iceServers && config.rtc.iceServers.length > 0) {
    return config.rtc.iceServers;
  }
  return [...STUN_SERVERS, ...turnServers()];
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

const stopStream = (stream: MediaStream | null) => {
  if (!stream) return;
  try {
    stream.getTracks().forEach(track => {
      try { track.stop(); } catch (e) {}
    });
  } catch (e) {}
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

const detachCallListeners = () => {
  try { callDocUnsub?.(); } catch (e) {}
  try { candidatesUnsub?.(); } catch (e) {}
  callDocUnsub = null;
  candidatesUnsub = null;
  answeringRestart = false;
  lastAppliedAnswerSdp = '';
  lastAppliedOfferSdp = '';
  nativeCallAnnounced = false;
};

export const cleanupMedia = () => {
  stopRingtone();
  detachCallListeners();
  bridge.endCall();
  bridge.dismissIncomingCall();
  bridge.setPip(false, 0, 0);

  stopStream(localStream);
  localStream = null;
  if (peerConnection) {
    try {
      peerConnection.ontrack = null;
      peerConnection.onicecandidate = null;
      peerConnection.oniceconnectionstatechange = null;
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

/** Latest call document. Accept can start before the caller wrote the offer. */
const readCall = async (callId: string): Promise<any | null> => {
  try {
    const snap = await getDoc(doc(db, 'calls', callId));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  } catch (e) {
    return null;
  }
};

const waitForOffer = (callId: string, seed: any, timeoutMs = 9000): Promise<any> => {
  if (seed?.sdp) return Promise.resolve(seed);
  return new Promise((resolve, reject) => {
    let finished = false;
    let unsub: Unsubscribe | null = null;
    const finish = (fn: () => void) => {
      if (finished) return;
      finished = true;
      try { unsub?.(); } catch (e) {}
      fn();
    };
    unsub = onSnapshot(doc(db, 'calls', callId), (snap) => {
      const data = snap.data();
      if (!data) return;
      if (data.offer?.sdp) finish(() => resolve(data.offer));
      else if (data.status === 'ended' || data.status === 'rejected') finish(() => reject(new Error('Call ended')));
    }, () => {});
    setTimeout(() => finish(() => reject(new Error('Timed out waiting for the call offer'))), timeoutMs);
  });
};

const createPeer = (
  type: 'audio' | 'video',
  onRemoteStream: (stream: MediaStream) => void
): RTCPeerConnection => {
  const pc = new RTCPeerConnection({
    iceServers: getEffectiveIceServers(),
    iceCandidatePoolSize: 4,
    bundlePolicy: 'max-bundle',
  } as RTCConfiguration);

  remoteStream = new MediaStream();
  pc.ontrack = (event) => {
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

  // A WebRTC connection needs a tiny nudge on some Android WebViews before the
  // remote audio is actually routed to the earpiece/speaker.
  if (type === 'audio') {
    try { bridge.setSpeaker(false); } catch (e) {}
  }

  return pc;
};

const addLocalTracks = (pc: RTCPeerConnection) => {
  if (!localStream) return;
  localStream.getTracks().forEach(track => {
    pc.addTrack(track, localStream!);
  });
  tuneSenderParameters(pc);
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

  // Only cancel the native notification when a call we were actually showing
  // disappeared. An empty first snapshot must never dismiss the FCM
  // notification that arrived a moment before Firestore caught up.
  let hadRinging = false;

  return onSnapshot(q, (snapshot) => {
    const now = Date.now();
    const ringingCalls = snapshot.docs
      .map(d => ({ id: d.id, ...d.data() } as CallData))
      .filter(c => c.status === 'ringing' && !handledCallIds.has(c.id) && (now - (c.createdAt || 0)) < 35000)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    if (ringingCalls.length > 0) {
      const topCall = ringingCalls[0];
      hadRinging = true;

      // FCM already creates the notification when the app is closed. This path
      // covers the app being alive but backgrounded; the native id is the same,
      // so this replaces (never duplicates) the push notification.
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

    if (hadRinging) {
      hadRinging = false;
      bridge.dismissIncomingCall();
      callback(null);
    }
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
  onCallStatusChange: (status: 'ringing' | 'calling' | 'accepted' | 'rejected' | 'ended' | 'reconnecting') => void
): Promise<{ callId: string; stream: MediaStream }> => {
  cleanupMedia();
  currentCallType = type;
  activeCallPartnerName = receiver.name || 'Ennvo Call';

  playOutgoingRingtone();

  // 1. Ring first, acquire media second. The receiver starts vibrating while
  //    getUserMedia is still opening the camera on this phone.
  const mediaPromise = getMediaStreamWithFallback(type);

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

  // Data-only, high priority: wakes the other phone even when it is closed.
  notifyUser({
    targetUserId: receiver.uid,
    type: 'call',
    name: caller.name || 'Caller',
    avatar: caller.avatar || '',
    callType: type,
    callId,
  });

  localStream = await mediaPromise;
  notifyStreamChanges();

  if (!activeCallId || activeCallId !== callId) {
    // The call was cancelled while the camera/mic was still opening.
    stopStream(localStream);
    localStream = null;
    throw new Error('Call cancelled');
  }

  const pc = createPeer(type, onRemoteStream);
  peerConnection = pc;
  addLocalTracks(pc);

  // 2. Trickle ICE from the first gathered candidate.
  const callerCandidatesCol = collection(db, 'calls', callId, 'callerCandidates');
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      addDoc(callerCandidatesCol, event.candidate.toJSON()).catch(() => {});
    }
  };

  // Reconnection: the caller restarts ICE and writes a fresh offer.
  pc.oniceconnectionstatechange = async () => {
    const state = pc.iceConnectionState;
    if (state === 'disconnected' || state === 'failed') {
      if (reconnectAttempts < 3 && activeCallId === callId) {
        reconnectAttempts++;
        onCallStatusChange('reconnecting');
        try {
          const restartOffer = await pc.createOffer({ iceRestart: true });
          if (restartOffer && pc.signalingState !== 'closed') {
            const munged = {
              type: restartOffer.type,
              sdp: setOpusBandwidthAndFec(restartOffer.sdp || '')
            };
            await pc.setLocalDescription(munged);
            await updateDoc(doc(db, 'calls', callId), { offer: munged });
          }
        } catch (e) {
          console.warn('[CallService] ICE restart failed:', e);
        }
      } else if (activeCallId === callId) {
        endCall(callId);
      }
    } else if (state === 'checking' && !isCallConnected) {
      // The connection is being set up. The call screen shows "Calling".
      onCallStatusChange('calling');
    } else if ((state === 'connected' || state === 'completed') && !isCallConnected) {
      reconnectAttempts = 0;
      isCallConnected = true;
      onCallStatusChange('accepted');
    }
  };

  // 3. Offer with Opus FEC & bitrate tuning.
  const rawOffer = await pc.createOffer();
  const mungedOffer = {
    type: rawOffer.type,
    sdp: setOpusBandwidthAndFec(rawOffer.sdp || '')
  };
  await pc.setLocalDescription(mungedOffer);
  await updateDoc(callDocRef, { offer: mungedOffer });

  // 4. Answer + status stream. Applies the first answer and any later
  //    renegotiation answer produced by an ICE restart on the receiver.
  callDocUnsub = onSnapshot(callDocRef, async (snapshot) => {
    const data = snapshot.data();
    if (!data) return;

    if (data.status === 'rejected' || data.status === 'ended') {
      stopRingtone();
      onCallStatusChange(data.status);
      cleanupMedia();
      return;
    }

    const answerSdp = data.answer?.sdp;
    if (data.status === 'accepted' && answerSdp && answerSdp !== lastAppliedAnswerSdp) {
      lastAppliedAnswerSdp = answerSdp;
      try {
        if (pc.signalingState === 'have-local-offer' || (!pc.currentRemoteDescription && answerSdp)) {
          await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
        } else if (pc.currentRemoteDescription && pc.currentRemoteDescription.sdp !== answerSdp) {
          await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
        }
      } catch (e) {
        console.warn('[CallService] setRemoteDescription(answer) failed:', e);
      }

      stopRingtone();
      isCallConnected = true;
      if (!nativeCallAnnounced) {
        nativeCallAnnounced = true;
        bridge.startCall(receiver.name || 'Ennvo Call', type === 'video', callId);
        bridge.setPip(true, 9, 16);
      }
      onCallStatusChange('accepted');

      // Drain candidates that arrived before the answer.
      while (iceCandidateQueue.length > 0) {
        const cand = iceCandidateQueue.shift();
        if (cand) {
          pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
        }
      }

      if (!candidatesUnsub) {
        const receiverCandidatesCol = collection(db, 'calls', callId, 'receiverCandidates');
        candidatesUnsub = onSnapshot(receiverCandidatesCol, (candSnapshot) => {
          candSnapshot.docChanges().forEach(change => {
            if (change.type === 'added') {
              const candData = change.doc.data();
              if (pc.remoteDescription) {
                pc.addIceCandidate(new RTCIceCandidate(candData)).catch(() => {});
              } else {
                iceCandidateQueue.push(candData);
              }
            }
          });
        });
      }
    }
  });

  return { callId, stream: localStream };
};

/**
 * Accept Incoming Call.
 *
 * The Firestore fetch and the camera/microphone open in parallel, so Accept
 * connects about as fast as the hardware can start the tracks.
 */
export const acceptIncomingCall = async (
  call: CallData,
  onRemoteStream: (stream: MediaStream) => void,
  onCallStatusChange: (status: 'ringing' | 'calling' | 'accepted' | 'rejected' | 'ended' | 'reconnecting') => void
): Promise<{ stream: MediaStream }> => {
  cleanupMedia();
  stopRingtone();
  bridge.dismissIncomingCall();

  const callId = call.id;
  currentCallType = call.type === 'video' ? 'video' : 'audio';
  activeCallId = callId;
  activeCallPartnerName = call.callerName || 'Ennvo Call';

  // Overlap: camera/mic + latest call document (which holds the SDP offer).
  const mediaPromise = getMediaStreamWithFallback(currentCallType);
  const latest = await readCall(callId);
  if (latest && (latest.status === 'ended' || latest.status === 'rejected')) {
    stopStream(await mediaPromise.catch(() => null));
    throw new Error('Call has already ended');
  }

  // Native call service + audio mode first: the user hears/sees the call
  // screen immediately while the SDP handshake finishes.
  if (!nativeCallAnnounced) {
    nativeCallAnnounced = true;
    bridge.startCall(latest?.callerName || call.callerName || 'Ennvo Call', currentCallType === 'video', callId);
  }

  let offer = latest?.offer || call.offer;
  if (!offer?.sdp) {
    offer = await waitForOffer(callId, offer);
  }

  localStream = await mediaPromise;
  notifyStreamChanges();

  if (activeCallId !== callId) {
    stopStream(localStream);
    localStream = null;
    throw new Error('Call cancelled');
  }

  const pc = createPeer(currentCallType, onRemoteStream);
  peerConnection = pc;
  addLocalTracks(pc);

  // Caller candidates can arrive before the offer: queue them, don't drop them.
  const callerCandidatesCol = collection(db, 'calls', callId, 'callerCandidates');
  candidatesUnsub = onSnapshot(callerCandidatesCol, (candSnapshot) => {
    candSnapshot.docChanges().forEach(change => {
      if (change.type === 'added') {
        const candData = change.doc.data();
        if (pc.remoteDescription) {
          pc.addIceCandidate(new RTCIceCandidate(candData)).catch(() => {});
        } else {
          iceCandidateQueue.push(candData);
        }
      }
    });
  });

  await pc.setRemoteDescription(new RTCSessionDescription(offer));
  lastAppliedOfferSdp = offer.sdp;

  const receiverCandidatesCol = collection(db, 'calls', callId, 'receiverCandidates');
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      addDoc(receiverCandidatesCol, event.candidate.toJSON()).catch(() => {});
    }
  };

  const rawAnswer = await pc.createAnswer();
  const mungedAnswer = {
    type: rawAnswer.type,
    sdp: setOpusBandwidthAndFec(rawAnswer.sdp || '')
  };
  await pc.setLocalDescription(mungedAnswer);

  const callDocRef = doc(db, 'calls', callId);
  await updateDoc(callDocRef, {
    answer: mungedAnswer,
    status: 'accepted'
  });

  // Flush candidates collected while the offer/answer handshake was running.
  while (iceCandidateQueue.length > 0) {
    const cand = iceCandidateQueue.shift();
    if (cand && pc.remoteDescription) {
      pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
    }
  }

  isCallConnected = true;
  bridge.setPip(true, 9, 16);
  onCallStatusChange('accepted');

  // Receiver-side ICE restart: the caller may write a new offer at any time.
  callDocUnsub = onSnapshot(callDocRef, async (snap) => {
    const data = snap.data();
    if (!data) return;

    if (data.status === 'ended' || data.status === 'rejected') {
      stopRingtone();
      onCallStatusChange(data.status);
      cleanupMedia();
      return;
    }

    const newOffer = data.offer;
    if (
      newOffer?.sdp &&
      newOffer.sdp !== lastAppliedOfferSdp &&
      pc.remoteDescription &&
      !answeringRestart
    ) {
      lastAppliedOfferSdp = newOffer.sdp;
      answeringRestart = true;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(newOffer));
        const restartAnswer = await pc.createAnswer();
        const munged = {
          type: restartAnswer.type,
          sdp: setOpusBandwidthAndFec(restartAnswer.sdp || '')
        };
        await pc.setLocalDescription(munged);
        await updateDoc(callDocRef, { answer: munged });
        reconnectAttempts = 0;
        onCallStatusChange('accepted');
      } catch (e) {
        console.warn('[CallService] Receiver ICE restart failed:', e);
      } finally {
        answeringRestart = false;
      }
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
