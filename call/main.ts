/**
 * Ennvo lightweight call screen.
 *
 * This page intentionally contains no React, no router and no app shell. It is
 * the only thing CallActivity loads, so accepting a call from the notification
 * shows the call UI in a few hundred milliseconds instead of booting the whole
 * app. The heavy work (WebRTC + Firestore + native CallService) is shared with
 * the main app through src/services/callService.ts.
 */
import './call.css';

import { onAuthStateChanged, onIdTokenChanged } from 'firebase/auth';
import { doc, getDoc, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { auth, db } from '../src/firebase';
import {
  acceptIncomingCall,
  subscribeCallStreams,
  setAudioMuted,
  setVideoDisabled,
  setSpeaker,
  switchCamera,
  endCall,
  rejectCall,
  CallData,
} from '../src/services/callService';

type CallInfo = {
  id: string;
  name: string;
  avatar: string;
  type: 'audio' | 'video';
  action: 'answer' | 'open' | 'decline';
};

const nativeApi = (): any =>
  (typeof window === 'undefined')
    ? null
    : ((window as any).AndroidCallScreen ||
       (window as any).Android ||
       (window as any).AndroidInterface ||
       null);

let A: any = nativeApi();

// The shared native bridge looks for window.Android, so expose the dedicated
// call-screen interface under that name too. callService then works unchanged.
if (A && !(window as any).Android) (window as any).Android = A;

function refreshNative(): any {
  const next = nativeApi();
  if (next) {
    A = next;
    if (!(window as any).Android) (window as any).Android = next;
  }
  return A;
}

const $ = <T extends HTMLElement = HTMLElement>(id: string): T =>
  document.getElementById(id) as T;

const root = $('call');
const backdrop = $<HTMLDivElement>('backdrop');
const avatarEl = $<HTMLImageElement>('avatar');
const avatarFallback = $('avatar-fallback');
const nameEl = $('name');
const statusEl = $('status');
const hintEl = $('hint');
const kindEl = $('kind');
const remoteVideo = $<HTMLVideoElement>('remote');
const localVideo = $<HTMLVideoElement>('local');
const remoteAudio = $<HTMLAudioElement>('remote-audio');
const localWrap = $('local-wrap');
const incomingActions = $('incoming-actions');
const activeActions = $('active-actions');
const cameraAction = $('camera-action');
const returnApp = $<HTMLButtonElement>('return-app');

let info: CallInfo = readInfo();
let callId = info.id;
let callType: 'audio' | 'video' = info.type;
let accepting = false;
let ending = false;
let active = false;
let booted = false;
let startedAt = 0;
let ringingUnsub: Unsubscribe | null = null;
/** True when the call is already running inside MainActivity. */
let callRunningInMain = false;

function readInfo(): CallInfo {
  let raw: any = null;
  try {
    if (A && typeof A.getCallInfo === 'function') {
      raw = JSON.parse(A.getCallInfo() || '{}');
    }
  } catch (e) {}

  if (!raw || !raw.id) {
    try {
      const p = new URLSearchParams(location.search);
      raw = {
        id: p.get('id') || '',
        name: p.get('name') || '',
        type: p.get('type') || 'voice',
        action: p.get('action') || 'open',
        avatar: p.get('avatar') || '',
      };
    } catch (e) {
      raw = {};
    }
  }

  const type = String(raw.type || '').toLowerCase() === 'video' ? 'video' : 'audio';
  const action =
    raw.action === 'answer' || raw.action === 'decline' ? raw.action : 'open';
  return {
    id: String(raw.id || ''),
    name: String(raw.name || 'Ennvo Call'),
    avatar: String(raw.avatar || ''),
    type,
    action,
  };
}

function initial(name: string): string {
  const clean = (name || '').trim();
  return clean ? clean.charAt(0).toUpperCase() : 'E';
}

function paintAvatar(name: string, avatar: string) {
  nameEl.textContent = name || 'Ennvo Call';
  if (avatar && /^https?:/i.test(avatar)) {
    avatarEl.src = avatar;
    avatarEl.hidden = false;
    avatarFallback.hidden = true;
    try {
      backdrop.style.backgroundImage = `url("${avatar.replace(/"/g, '%22')}")`;
    } catch (e) {}
    root.classList.add('has-avatar');
  } else {
    avatarEl.hidden = true;
    avatarFallback.hidden = false;
    avatarFallback.textContent = initial(name);
    backdrop.style.backgroundImage = '';
    root.classList.remove('has-avatar');
  }
}

function paintInfo(next: Partial<CallInfo>) {
  info = { ...info, ...next };
  callId = info.id || callId;
  callType = info.type;
  root.classList.toggle('is-video', callType === 'video');
  paintAvatar(info.name, info.avatar);
  kindEl.textContent =
    info.action === 'answer' || active
      ? callType === 'video'
        ? 'Video call'
        : 'Voice call'
      : callType === 'video'
        ? 'Incoming video call'
        : 'Incoming voice call';
}

function setMode(mode: 'incoming' | 'connecting' | 'active' | 'ended' | 'notice') {
  root.classList.remove('is-incoming', 'is-connecting', 'is-active', 'is-ended', 'is-notice');
  root.classList.add(`is-${mode}`);
  incomingActions.hidden = mode !== 'incoming';
  activeActions.hidden = mode !== 'active';
  if (mode === 'active') {
    active = true;
    startedAt = Date.now();
  }
}

function setHint(text: string | null) {
  if (text) {
    hintEl.textContent = text;
    hintEl.hidden = false;
  } else {
    hintEl.hidden = true;
    hintEl.textContent = '';
  }
}

function onConnected() {
  active = true;
  setMode('active');
  startedAt = startedAt || Date.now();
  kindEl.textContent = callType === 'video' ? 'Video call' : 'Voice call';
  setHint(null);
  if (callType === 'video') {
    localWrap.hidden = false;
    cameraAction.hidden = false;
  } else {
    localWrap.hidden = true;
    cameraAction.hidden = true;
  }
}

function showEnded(text: string) {
  if (ending) return;
  ending = true;
  setMode('ended');
  statusEl.textContent = text;
  setHint(null);
  window.setTimeout(() => finish(), 700);
}

function finish() {
  try {
    const N = refreshNative();
    if (N && typeof N.finishCall === 'function') N.finishCall();
  } catch (e) {}
}

function openApp() {
  try {
    const N = refreshNative();
    // A running call must not be torn down: the call screen only moves to the
    // background, the media and the audio route keep running.
    const keepCall = callRunningInMain || active;
    if (keepCall && N && typeof N.openAppKeepingCall === 'function') {
      N.openAppKeepingCall();
      return;
    }
    if (N && typeof N.openApp === 'function') {
      N.openApp();
      return;
    }
    if (N && typeof N.finishCall === 'function') N.finishCall();
  } catch (e) {
    finish();
  }
}

/**
 * Back returns to the app, exactly like WhatsApp: the call keeps running in
 * the background and the notification stays, so the call is never lost.
 */
function goBackToApp() {
  try {
    const N = refreshNative();
    if (N && typeof N.goBackToApp === 'function') {
      N.goBackToApp();
      return;
    }
    if (N && typeof N.openAppKeepingCall === 'function') {
      N.openAppKeepingCall();
      return;
    }
  } catch (e) {}
}

async function ensurePermissions(): Promise<boolean> {
  const N = refreshNative();
  if (!N || typeof N.hasCallPermissions !== 'function') return true;
  try {
    if (N.hasCallPermissions()) return true;
  } catch (e) {}

  return new Promise<boolean>((resolve) => {
    let done = false;
    (window as any).onCallPermissions = (granted: boolean) => {
      if (done) return;
      done = true;
      resolve(!!granted);
    };
    try {
      if (typeof N.requestCallPermissions === 'function') N.requestCallPermissions();
    } catch (e) {}
    window.setTimeout(() => {
      if (done) return;
      done = true;
      let granted = false;
      try { granted = !!N.hasCallPermissions(); } catch (e) {}
      resolve(granted);
    }, 15000);
  });
}

function waitForUser(timeoutMs: number) {
  if (auth.currentUser) return Promise.resolve(auth.currentUser);
  return new Promise<typeof auth.currentUser>((resolve) => {
    let done = false;
    let unsub: Unsubscribe | null = null;
    const stop = () => {
      if (done) return true;
      done = true;
      try { unsub?.(); } catch (e) {}
      return false;
    };
    unsub = onAuthStateChanged(auth, (user) => {
      if (stop()) return;
      resolve(user);
    });
    window.setTimeout(() => {
      if (stop()) return;
      resolve(auth.currentUser);
    }, timeoutMs);
  });
}

function toCallData(id: string, d: any): CallData {
  return {
    id,
    callerId: d.callerId || '',
    callerName: d.callerName || info.name || 'Ennvo Call',
    callerAvatar: d.callerAvatar || info.avatar || '',
    receiverId: d.receiverId || '',
    receiverName: d.receiverName || '',
    receiverAvatar: d.receiverAvatar || '',
    type: d.type === 'video' ? 'video' : 'audio',
    status: d.status || 'ringing',
    createdAt: typeof d.createdAt === 'number' ? d.createdAt : Date.now(),
    offer: d.offer,
    answer: d.answer,
  };
}

async function loadCallDoc(): Promise<any | null> {
  if (!callId) return null;
  try {
    const snap = await getDoc(doc(db, 'calls', callId));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  } catch (e) {
    return null;
  }
}

function watchRingingCall() {
  if (!callId) return;
  try { ringingUnsub?.(); } catch (e) {}
  ringingUnsub = onSnapshot(doc(db, 'calls', callId), (snap) => {
    const d = snap.data();
    if (!d) return;
    if (d.callerName || d.callerAvatar) {
      paintInfo({
        name: d.callerName || info.name,
        avatar: d.callerAvatar || info.avatar,
        type: d.type === 'video' ? 'video' : 'audio',
      });
    }
    if (!accepting && !active && (d.status === 'ended' || d.status === 'rejected')) {
      showEnded(d.status === 'rejected' ? 'Call declined' : 'Call ended');
    }
  }, () => {});
}

async function startAccept() {
  if (accepting || ending) return;
  accepting = true;

  // Any tap is a user gesture: unlock audio/video playback immediately.
  try { remoteAudio.play().catch(() => {}); } catch (e) {}

  setMode('connecting');
  statusEl.textContent = 'Ringing…';
  setHint(null);

  try {
    // Do not wait for auth before opening the camera: Firestore queues the call
    // document operations while the cached Firebase session is restored.
    const [permissionsOk, latest] = await Promise.all([
      ensurePermissions(),
      loadCallDoc(),
    ]);

    if (!permissionsOk) {
      setHint('Camera/microphone permission is off. Enable it in Android settings for calls.');
    }

    if (latest && (latest.status === 'ended' || latest.status === 'rejected')) {
      showEnded('Call ended');
      accepting = false;
      return;
    }

    const callData = latest
      ? toCallData(callId, latest)
      : toCallData(callId, {
          callerName: info.name,
          callerAvatar: info.avatar,
          type: callType,
          status: 'ringing',
        });

    paintInfo({
      name: callData.callerName,
      avatar: callData.callerAvatar,
      type: callData.type,
    });
    callType = callData.type;

    try { ringingUnsub?.(); } catch (e) {}
    ringingUnsub = null;

    await acceptIncomingCall(
      callData,
      () => {},
      (status) => {
        if (status === 'ended' || status === 'rejected') {
          showEnded(status === 'rejected' ? 'Call declined' : 'Call ended');
        } else if (status === 'reconnecting') {
          statusEl.textContent = 'Reconnecting…';
          setHint('Network changed — keeping the call alive');
        } else if (status === 'calling') {
          // The network is still setting the call up.
          statusEl.textContent = 'Calling…';
        } else if (status === 'accepted') {
          setHint(null);
          onConnected();
        }
      }
    );

    onConnected();
  } catch (e: any) {
    accepting = false;
    const message = String(e?.message || e || '');
    setMode('incoming');
    statusEl.textContent = 'Could not connect';
    setHint(
      /permission|denied/i.test(message)
        ? 'Allow camera/microphone for Ennvo in Android settings, then try again.'
        : /auth|sign/i.test(message)
          ? 'Open Ennvo once to refresh your session, then answer again.'
          : 'Check your connection and try again.'
    );
    // Keep the decline button reachable; replace Accept with a retry on tap.
    const acceptBtn = $<HTMLButtonElement>('accept');
    acceptBtn.onclick = () => startAccept();
  }
}

async function decline() {
  if (ending) return;
  ending = true;
  setMode('ended');
  statusEl.textContent = 'Declined';
  try {
    const N = refreshNative();
    if (N && typeof N.declineCall === 'function') {
      N.declineCall();
    } else {
      await rejectCall(callId);
    }
  } catch (e) {
    try { await rejectCall(callId); } catch (err) {}
  }
  window.setTimeout(() => finish(), 260);
}

async function hangup() {
  if (ending) return;
  ending = true;
  setMode('ended');
  statusEl.textContent = 'Call ended';
  try {
    await endCall(callId);
  } catch (e) {}
  window.setTimeout(() => finish(), 320);
}

function wireUi() {
  $<HTMLButtonElement>('accept').onclick = () => startAccept();
  $<HTMLButtonElement>('decline').onclick = () => decline();
  $<HTMLButtonElement>('end').onclick = () => hangup();
  returnApp.onclick = () => openApp();

  const muteBtn = $<HTMLButtonElement>('mute');
  let muted = false;
  muteBtn.onclick = () => {
    muted = !muted;
    setAudioMuted(muted);
    muteBtn.classList.toggle('is-on', muted);
    muteBtn.querySelector('.icon-mic')?.setAttribute('hidden', muted ? '' : 'false');
    muteBtn.querySelector('.icon-mic-off')?.setAttribute('hidden', muted ? 'false' : '');
    muteBtn.setAttribute('aria-label', muted ? 'Unmute' : 'Mute');
    (muteBtn.parentElement?.querySelector('.label') as HTMLElement).textContent = muted
      ? 'Unmute'
      : 'Mute';
  };

  const speakerBtn = $<HTMLButtonElement>('speaker');
  let speakerOn = callType === 'video';
  const paintSpeaker = () => {
    speakerBtn.classList.toggle('is-on', speakerOn);
    (speakerBtn.parentElement?.querySelector('.label') as HTMLElement).textContent =
      speakerOn ? 'Speaker' : 'Earpiece';
  };
  paintSpeaker();
  speakerBtn.onclick = () => {
    speakerOn = !speakerOn;
    setSpeaker(speakerOn);
    paintSpeaker();
  };

  const cameraBtn = $<HTMLButtonElement>('camera');
  let cameraOff = false;
  cameraBtn.onclick = () => {
    cameraOff = !cameraOff;
    setVideoDisabled(cameraOff);
    cameraBtn.classList.toggle('is-on', cameraOff);
    cameraBtn.querySelector('.icon-cam')?.setAttribute('hidden', cameraOff ? '' : 'false');
    cameraBtn.querySelector('.icon-cam-off')?.setAttribute('hidden', cameraOff ? 'false' : '');
    (cameraBtn.parentElement?.querySelector('.label') as HTMLElement).textContent =
      cameraOff ? 'Cam off' : 'Camera';
  };

  $<HTMLButtonElement>('flip').onclick = () => switchCamera();

  if (callType === 'video') {
    localWrap.hidden = false;
    cameraAction.hidden = false;
  } else {
    localWrap.hidden = true;
    cameraAction.hidden = true;
  }

  subscribeCallStreams((local, remote) => {
    if (local) {
      if (localVideo.srcObject !== local) localVideo.srcObject = local;
      localVideo.play().catch(() => {});
    } else {
      localVideo.srcObject = null;
    }

    if (remote && remote.getTracks().length > 0) {
      if (remoteVideo.srcObject !== remote) remoteVideo.srcObject = remote;
      remoteVideo.play().catch(() => {});
      if (remoteAudio.srcObject !== remote) remoteAudio.srcObject = remote;
      remoteAudio.play().catch(() => {});
      if (active && callType === 'video') root.classList.add('has-remote-video');
    } else {
      remoteVideo.srcObject = null;
      remoteAudio.srcObject = null;
      root.classList.remove('has-remote-video');
    }
  });
}

function tick() {
  if (!startedAt) return;
  const secs = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  const mm = String(Math.floor(secs / 60)).padStart(2, '0');
  const ss = String(secs % 60).padStart(2, '0');
  if (!ending) statusEl.textContent = `${mm}:${ss}`;
}

function watchNativeCallbacks() {
  (window as any).onNativeHangup = () => hangup();
  // Back returns to the app, exactly like WhatsApp: the call keeps running in
  // the background and the notification stays.
  (window as any).onAndroidBack = () => goBackToApp();
  (window as any).onNativeDecline = () => decline();
  (window as any).onCallAccept = () => {
    if (!active && !accepting && !ending) void startAccept();
  };

  const applyIntent = () => {
    const next = readInfo();
    if (!next.id) return false;
    const changed = next.id !== info.id;
    info = next;
    callId = next.id;
    paintInfo(next);

    if (!booted) return true;
    if (info.action === 'answer' && !active && !accepting && !ending) {
      void startAccept();
      return true;
    }
    if (info.action === 'decline' && !ending) {
      void decline();
      return true;
    }
    if (!active && !accepting && !ending && (changed || info.action === 'open')) {
      if (!root.classList.contains('is-incoming') && !root.classList.contains('is-connecting')) {
        setMode('incoming');
        statusEl.textContent =
          info.type === 'video' ? 'Incoming video call…' : 'Incoming voice call…';
      }
      watchRingingCall();
    }
    return true;
  };

  (window as any).onCallIntent = applyIntent;
  (window as any).onCallNativeReady = () => {
    refreshNative();
    if (!booted) {
      void boot();
      return;
    }
    applyIntent();
  };
}

async function boot() {
  if (booted) return;
  booted = true;

  paintInfo(info);
  wireUi();
  watchNativeCallbacks();
  window.setInterval(tick, 500);

  // A legacy notification decline action can still land here when the native
  // token is stale. The tiny page rejects the call through Firestore instead.
  if (info.action === 'decline') {
    void decline();
    return;
  }

  // The full-screen intent opens the ringing screen; the Answer action (and a
  // tap on the call notification's Answer button) auto-accepts immediately.
  if (info.action === 'answer') {
    setMode('connecting');
    statusEl.textContent = 'Ringing…';
    void startAccept();
    return;
  }

  setMode('incoming');
  statusEl.textContent =
    info.type === 'video' ? 'Incoming video call…' : 'Incoming voice call…';

  const user = await waitForUser(3200);
  if (!user && !auth.currentUser) {
    statusEl.textContent = 'Session expired';
    setHint('Open Ennvo once to sign in, then the call will work again.');
    incomingActions.hidden = true;
    returnApp.hidden = false;
    return;
  }

  const latest = await loadCallDoc();
  if (latest) {
    paintInfo({
      name: latest.callerName || info.name,
      avatar: latest.callerAvatar || info.avatar,
      type: latest.type === 'video' ? 'video' : 'audio',
    });
    if (latest.status === 'accepted') {
      // The call is already running in the main app (ongoing notification tap).
      callRunningInMain = true;
      statusEl.textContent = 'Call in progress';
      setHint('You are already in this call.');
      incomingActions.hidden = true;
      returnApp.hidden = false;
      return;
    }
    if (latest.status === 'ended' || latest.status === 'rejected') {
      showEnded(latest.status === 'rejected' ? 'Call declined' : 'Call ended');
      return;
    }
  }

  watchRingingCall();
}

// Keep the native fallback decline fast even if the page takes a moment to boot.
void boot();

// A fresh Firebase ID token lets the native notification Decline action update
// Firestore without booting the main WebView, even after an hour of idling.
try {
  onIdTokenChanged(auth, async (user) => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const N = refreshNative();
      if (N && typeof N.setAuthToken === 'function') N.setAuthToken(user.uid, token);
    } catch (e) {}
  });
} catch (e) {}

// Mark the page as alive for the native side (used to avoid double booting).
try {
  const N = refreshNative();
  if (N && typeof N.appReady === 'function') N.appReady();
} catch (e) {}
