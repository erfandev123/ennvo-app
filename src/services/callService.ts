import { 
  collection, 
  addDoc, 
  doc, 
  onSnapshot, 
  updateDoc, 
  setDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebase';

export interface CallData {
  id: string;
  callerId: string;
  callerName: string;
  callerAvatar: string;
  receiverId: string;
  receiverName: string;
  receiverAvatar: string;
  type: 'audio' | 'video';
  status: 'ringing' | 'accepted' | 'rejected' | 'ended';
  createdAt: number;
  offer?: any;
  answer?: any;
}

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302', 'stun:stun3.l.google.com:19302', 'stun:stun4.l.google.com:19302'] },
    { urls: ['stun:global.stun.twilio.com:3478'] },
    { urls: ['stun:stun.services.mozilla.com'] }
  ],
  iceCandidatePoolSize: 10
};

let peerConnection: RTCPeerConnection | null = null;
let localStream: MediaStream | null = null;
let remoteStream: MediaStream | null = null;
let ringtoneAudioCtx: AudioContext | null = null;
let ringtoneInterval: any = null;
let iceCandidateQueue: RTCIceCandidateInit[] = [];
let currentFacingMode: 'user' | 'environment' = 'user';

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

export const switchCamera = async () => {
  if (!localStream) return;
  const videoTrack = localStream.getVideoTracks()[0];
  if (!videoTrack) return;

  currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';

  try {
    const newStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: currentFacingMode }
    });
    const newVideoTrack = newStream.getVideoTracks()[0];
    if (newVideoTrack) {
      if (peerConnection) {
        const sender = peerConnection.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          sender.replaceTrack(newVideoTrack);
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

import { playIncomingRingtone, playOutgoingRingtone, stopCallSounds } from './soundService';

export const playRingtone = (isIncoming: boolean) => {
  if (isIncoming) {
    playIncomingRingtone();
  } else {
    playOutgoingRingtone();
  }
};

const handledCallIds = new Set<string>();

export const markCallHandled = (callId: string) => {
  if (callId) handledCallIds.add(callId);
};

export const stopRingtone = () => {
  stopCallSounds();
};

export const cleanupMedia = () => {
  stopRingtone();
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
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
  notifyStreamChanges();
};

export const subscribeIncomingCalls = (userId: string, callback: (call: CallData | null) => void) => {
  if (!userId) return () => {};
  // Query by receiverId only to avoid needing a Firestore composite index
  const q = query(
    collection(db, 'calls'),
    where('receiverId', '==', userId)
  );

  return onSnapshot(q, (snapshot) => {
    if (!snapshot.empty) {
      const now = Date.now();
      const ringingCalls = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() } as CallData))
        .filter(c => c.status === 'ringing' && !handledCallIds.has(c.id) && (now - (c.createdAt || 0)) < 30000)
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      if (ringingCalls.length > 0) {
        callback(ringingCalls[0]);
        return;
      }
    }
    callback(null);
  }, (err) => {
    console.error('Error listening to incoming calls:', err);
  });
};

// Media Stream Fallback for devices without camera/mic or overconstrained hardware
const createSyntheticAudioStream = (): MediaStream => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return new MediaStream();
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const dst = ctx.createMediaStreamDestination();
    const gain = ctx.createGain();
    gain.gain.value = 0.0001; // Silent tone
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
    console.warn('getUserMedia not supported, using synthetic media stream.');
    return createSyntheticAudioStream();
  }

  // 1. Ideal Constraints
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: type === 'video' ? { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } : false
    });
  } catch (err1) {
    console.warn('Ideal media constraints failed, trying basic constraints...', err1);
  }

  // 2. Basic Video/Audio
  if (type === 'video') {
    try {
      return await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    } catch (err2) {
      console.warn('Basic video constraints failed, trying audio only...', err2);
    }
  }

  // 3. Basic Audio-only
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  } catch (err3) {
    console.warn('Audio constraints failed or device missing, using synthetic fallback...', err3);
  }

  // 4. Synthetic fallback
  return createSyntheticAudioStream();
};

export const initiateCall = async (
  caller: { uid: string; name: string; avatar: string },
  receiver: { uid: string; name: string; avatar: string },
  type: 'audio' | 'video',
  onRemoteStream: (stream: MediaStream) => void,
  onCallStatusChange: (status: 'ringing' | 'accepted' | 'rejected' | 'ended') => void
): Promise<{ callId: string; stream: MediaStream }> => {
  cleanupMedia();
  playRingtone(false);

  // 1. Get Local Stream (with automatic hardware fallback)
  localStream = await getMediaStreamWithFallback(type);
  notifyStreamChanges();

  // 2. Setup RTCPeerConnection
  peerConnection = new RTCPeerConnection(RTC_CONFIG);
  localStream.getTracks().forEach(track => {
    peerConnection?.addTrack(track, localStream!);
  });

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
    const freshStream = new MediaStream(remoteStream.getTracks());
    onRemoteStream(freshStream);
    notifyStreamChanges();
  };

  // 3. Create Call Document in Firestore
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

  // 4. ICE Candidates
  const callerCandidatesCol = collection(db, 'calls', callId, 'callerCandidates');
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      addDoc(callerCandidatesCol, event.candidate.toJSON()).catch(console.error);
    }
  };

  // 5. Create Offer
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  await updateDoc(callDocRef, {
    offer: { type: offer.type, sdp: offer.sdp }
  });

  // 6. Listen for Call status & Answer
  const unsubscribeCall = onSnapshot(callDocRef, async (snapshot) => {
    const data = snapshot.data();
    if (!data) return;

    if (data.status === 'rejected' || data.status === 'ended') {
      stopRingtone();
      onCallStatusChange(data.status);
      cleanupMedia();
      unsubscribeCall();
    } else if (data.status === 'accepted' && data.answer && !peerConnection?.currentRemoteDescription) {
      stopRingtone();
      onCallStatusChange('accepted');
      const rtcAnswer = new RTCSessionDescription(data.answer);
      await peerConnection?.setRemoteDescription(rtcAnswer);

      // Drain any queued ICE candidates
      while (iceCandidateQueue.length > 0) {
        const cand = iceCandidateQueue.shift();
        if (cand && peerConnection) {
          peerConnection.addIceCandidate(new RTCIceCandidate(cand)).catch(console.error);
        }
      }

      // Listen for receiver candidates
      const receiverCandidatesCol = collection(db, 'calls', callId, 'receiverCandidates');
      onSnapshot(receiverCandidatesCol, (candSnapshot) => {
        candSnapshot.docChanges().forEach(change => {
          if (change.type === 'added') {
            const candData = change.doc.data();
            if (peerConnection?.remoteDescription) {
              peerConnection.addIceCandidate(new RTCIceCandidate(candData)).catch(console.error);
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

export const acceptIncomingCall = async (
  call: CallData,
  onRemoteStream: (stream: MediaStream) => void,
  onCallStatusChange: (status: 'ringing' | 'accepted' | 'rejected' | 'ended') => void
): Promise<{ stream: MediaStream }> => {
  cleanupMedia();
  stopRingtone();

  localStream = await getMediaStreamWithFallback(call.type);
  notifyStreamChanges();

  peerConnection = new RTCPeerConnection(RTC_CONFIG);
  localStream.getTracks().forEach(track => {
    peerConnection?.addTrack(track, localStream!);
  });

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
    const freshStream = new MediaStream(remoteStream.getTracks());
    onRemoteStream(freshStream);
    notifyStreamChanges();
  };

  // Set remote offer from caller
  if (call.offer) {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(call.offer));
  }

  // Receiver candidates
  const receiverCandidatesCol = collection(db, 'calls', call.id, 'receiverCandidates');
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      addDoc(receiverCandidatesCol, event.candidate.toJSON()).catch(console.error);
    }
  };

  // Create Answer
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);

  // Update Call Doc status to accepted
  const callDocRef = doc(db, 'calls', call.id);
  await updateDoc(callDocRef, {
    answer: { type: answer.type, sdp: answer.sdp },
    status: 'accepted'
  });

  // Immediately notify local receiver UI that call is accepted to start callDuration timer
  onCallStatusChange('accepted');

  // Listen for caller candidates
  const callerCandidatesCol = collection(db, 'calls', call.id, 'callerCandidates');
  onSnapshot(callerCandidatesCol, (candSnapshot) => {
    candSnapshot.docChanges().forEach(change => {
      if (change.type === 'added') {
        const candData = change.doc.data();
        if (peerConnection?.remoteDescription) {
          peerConnection.addIceCandidate(new RTCIceCandidate(candData)).catch(console.error);
        } else {
          iceCandidateQueue.push(candData);
        }
      }
    });
  });

  // Listen for call ended / status updates
  const unsubscribeCall = onSnapshot(callDocRef, (snapshot) => {
    const data = snapshot.data();
    if (data?.status === 'ended' || data?.status === 'rejected') {
      onCallStatusChange(data.status);
      cleanupMedia();
      unsubscribeCall();
    }
  });

  return { stream: localStream };
};

export const rejectCall = async (callId: string) => {
  markCallHandled(callId);
  stopRingtone();
  try {
    await updateDoc(doc(db, 'calls', callId), { status: 'rejected' });
  } catch (e) {
    console.error(e);
  }
  cleanupMedia();
};

export const endCall = async (callId: string) => {
  markCallHandled(callId);
  stopRingtone();
  try {
    await updateDoc(doc(db, 'calls', callId), { status: 'ended' });
  } catch (e) {
    console.error(e);
  }
  cleanupMedia();
};
