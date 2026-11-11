/**
 * Client side of the Ennvo push gateway.
 *
 * The old code called `/api/native/send-push` on a server that does not exist
 * on the deployment (and resolves to https://localhost inside the APK), so a
 * message sent from the web or from the app never woke the other phone.
 *
 * This always talks to the real deployed gateway (Vercel serverless function)
 * and authenticates with the signed-in user's Firebase ID token.
 */
import { auth } from '../firebase';

const DEFAULT_GATEWAY = 'https://ennvo.vercel.app';
const gatewayBase = (): string => {
  const configured = (import.meta as any)?.env?.VITE_PUSH_API as string | undefined;
  if (configured) return configured.replace(/\/+$/, '');
  // The Android shell serves the app from https://localhost, so a relative URL
  // would never reach the server. Always use the public deployment.
  if (typeof window !== 'undefined' && /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname)) {
    return DEFAULT_GATEWAY;
  }
  if (typeof window !== 'undefined' && window.location.protocol.startsWith('http')) {
    return window.location.origin.includes('vercel.app') ? window.location.origin : DEFAULT_GATEWAY;
  }
  return DEFAULT_GATEWAY;
};

export type PushPayload = {
  targetUserId: string;
  type: 'message' | 'call' | 'activity';
  title?: string;
  body?: string;
  messageType?: string;
  avatar?: string;
  convId?: string;
  name?: string;
  callType?: string;
  callId?: string;
};

/** Fire and forget: push must never slow down sending a message or a call. */
export const notifyUser = (payload: PushPayload): void => {
  (async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;
      const token = await user.getIdToken();
      await fetch(`${gatewayBase()}/api/push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
        keepalive: true,
      });
    } catch (err) {
      console.warn('[push] gateway notice:', err);
    }
  })();
};
