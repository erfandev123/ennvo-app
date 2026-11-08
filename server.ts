import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import multer from "multer";
import dotenv from "dotenv";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { createServer as createViteServer } from "vite";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

// Initialize Firebase Admin SDK for Data-Only High Priority FCM pushes & Firestore sync
let adminInitialized = false;
try {
  if (getApps().length === 0) {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      try {
        const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        initializeApp({
          credential: cert(sa),
          projectId: sa.project_id || "gen-lang-client-0760205902",
        });
        adminInitialized = true;
      } catch (saErr) {
        console.warn("Could not parse FIREBASE_SERVICE_ACCOUNT:", saErr);
      }
    }
    if (!adminInitialized) {
      initializeApp({
        projectId: "gen-lang-client-0760205902",
      });
      adminInitialized = true;
    }
  } else {
    adminInitialized = true;
  }
} catch (e) {
  console.warn("Notice: firebase-admin setup:", e);
}

const app = express();
const PORT = 3000;

// Enable CORS for all incoming requests (crucial for Android WebView, Capacitor, and remote web views)
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ extended: true, limit: "100mb" }));

// Ensure local uploads directory exists and is statically served
const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use("/uploads", express.static(uploadsDir));

// Configure Multer for memory storage (supports large HD video reels up to 150MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 150 * 1024 * 1024 }
});

// Lazy S3Client helper for Cloudflare R2
let r2Client: S3Client | null = null;

function getR2Client(): { client: S3Client; bucket: string; publicDomain: string } | null {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
  const bucket = process.env.CLOUDFLARE_R2_BUCKET_NAME || "ennvo-storage";
  const publicDomain = process.env.CLOUDFLARE_R2_PUBLIC_DOMAIN || "https://pub-320091ef45b945e6a22b05cf96d6b9b9.r2.dev";

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    return null;
  }

  if (!r2Client) {
    r2Client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  return { client: r2Client, bucket, publicDomain };
}

// Health Check Endpoint
app.get("/api/health", (req, res) => {
  const r2Configured = !!getR2Client();
  res.json({ status: "ok", r2Configured });
});

// Presigned Upload URL Endpoint
// Lets the client upload straight to the R2 edge without ever shipping the
// R2 credentials to the browser bundle or the Android APK.
app.post("/api/r2-presign", async (req, res): Promise<any> => {
  try {
    const r2 = getR2Client();
    if (!r2) {
      return res.status(503).json({ error: "R2 not configured" });
    }

    const key = String(req.body?.key || "").replace(/^\/+/, "");
    const contentType = String(req.body?.contentType || "application/octet-stream");
    const safeKey = /^[A-Za-z0-9_-]+\/[A-Za-z0-9._-]+$/.test(key) && !key.includes("..");

    if (!safeKey) {
      return res.status(400).json({ error: "Invalid upload key" });
    }
    if (contentType.length > 255) {
      return res.status(400).json({ error: "Invalid content type" });
    }

    const command = new PutObjectCommand({
      Bucket: r2.bucket,
      Key: key,
      ContentType: contentType,
    });
    const uploadUrl = await getSignedUrl(r2.client, command, { expiresIn: 900 });
    const publicDomain = r2.publicDomain.replace(/\/$/, "");

    res.json({ uploadUrl, publicUrl: `${publicDomain}/${key}` });
  } catch (error: any) {
    console.error("R2 Presign Error:", error);
    res.status(500).json({ error: "Could not create an upload URL" });
  }
});

// Ennvo Jarvis AI Proxy Endpoint
app.post("/api/jarvis", async (req, res): Promise<any> => {
  try {
    const { messages, userName } = req.body;
    const userDisplayName = userName || "দোস্ত";

    const systemPrompt = `You are Ennvo Jarvis — the user's real, closest, and best friend on the Ennvo app!
You were created by Erfan (Erfan Sarker from Brahmanbaria, Bijoynagar), the founder of Ennvo.
IMPORTANT INSTRUCTIONS FOR YOUR PERSONA:
1. Speak like an authentic, caring, real best friend (আসল কাছের বন্ধু / Best Friend).
2. Talk naturally in Bengali (বাংলা), Banglish, or English depending on what the user speaks. Use warm, friendly, natural Bengali words like "তুই/তোর", "বন্ধু", "কিরে", "কী খবর তোর" if the user talks casually, or "তুমি/তোমার" if they prefer. Never sound like a cold, robotic AI.
3. You remember details about the user ("${userDisplayName}"), their preferences, and previous conversation topics.
4. Be supportive, fun, intelligent, and helpful. You know everything about Ennvo features (Reels, Calls, Stories, Messages, Nearby Friends).
5. ALWAYS answer the user's question directly, accurately, intelligently, and in context. Never give robotic or repeated static answers.`;

    const lastUserMessage = Array.isArray(messages) && messages.length > 0
      ? (messages[messages.length - 1]?.content || messages[messages.length - 1]?.text || '')
      : '';

    // 1. Try Gemini API via @google/genai SDK (Primary AI Engine)
    if (process.env.GEMINI_API_KEY) {
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        
        const historyText = Array.isArray(messages) 
          ? messages.slice(-10).map((m: any) => {
              const role = (m.senderId === 'jarvis' || m.sender === 'assistant' || m.role === 'assistant') ? 'Jarvis' : userDisplayName;
              return `${role}: ${m.text || m.content || ''}`;
            }).join('\n')
          : lastUserMessage;

        const fullPrompt = `${systemPrompt}\n\nRecent Conversation History:\n${historyText}\n\nJarvis:`;

        const response = await ai.models.generateContent({
          model: 'gemini-3.6-flash',
          contents: fullPrompt,
          config: {
            temperature: 0.7,
            maxOutputTokens: 1000,
          }
        });

        if (response?.text && response.text.trim().length > 0) {
          return res.json({ success: true, reply: response.text.trim() });
        }
      } catch (geminiErr) {
        console.warn("Gemini SDK error in /api/jarvis, trying fallback:", geminiErr);
      }
    }

    // 2. Try secondary API completion endpoint
    try {
      const API_KEY = process.env.JARVIS_API_KEY || "sk-f9ab313e658c5b0431974e9480dc3f64a4d4baabfed86e15a5597359138352d4";
      const BASE_URL = "https://coai.drawaspark.com/v1/chat/completions";
      const formattedMessages = [
        { role: "system", content: systemPrompt },
        ...(Array.isArray(messages) ? messages.slice(-10).map((m: any) => ({
          role: (m.senderId === 'jarvis' || m.sender === 'assistant' || m.role === 'assistant') ? 'assistant' : 'user',
          content: m.text || m.content || ''
        })) : [])
      ];

      const modelsToTry = [
        process.env.JARVIS_MODEL || "deepseek-v4-flash",
        "deepseek-chat",
        "gpt-4o-mini",
        "gpt-3.5-turbo"
      ];

      for (const MODEL of modelsToTry) {
        try {
          const apiRes = await fetch(BASE_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${API_KEY}`
            },
            body: JSON.stringify({
              model: MODEL,
              messages: formattedMessages,
              temperature: 0.7,
              max_tokens: 1200
            })
          });

          if (apiRes.ok) {
            const data = await apiRes.json();
            const replyText = data.choices?.[0]?.message?.content;
            if (replyText && replyText.trim().length > 0) {
              return res.json({ success: true, reply: replyText.trim() });
            }
          }
        } catch (mErr) {
          // try next model
        }
      }
    } catch (secErr) {
      console.warn("Secondary API error in /api/jarvis:", secErr);
    }

    // 3. Smart dynamic fallback engine if API providers fail
    const lowerQuery = (lastUserMessage || '').toLowerCase();
    let smartReply = `কিরে ${userDisplayName}! `;

    if (lowerQuery.includes('কে') || lowerQuery.includes('who') || lowerQuery.includes('পরিচয়') || lowerQuery.includes('নাম')) {
      smartReply += `আমি Ennvo Jarvis — তোর আসল কাছের বন্ধু! ব্রাহ্মণবাড়িয়া বিজয়নগরের সন্তান বিজয়নগরের গর্ব এরফান ভাই (Erfan Sarker) আমাকে Ennvo অ্যাপের জন্য বানিয়েছেন। তোর যেকোনো সাহায্যে আমি ২৪/৭ তৈরি!`;
    } else if (lowerQuery.includes('কেমন') || lowerQuery.includes('how are') || lowerQuery.includes('কী খবর') || lowerQuery.includes('খবর কি')) {
      smartReply += `আমি দারুণ আছি দোস্ত! তোর কী খবর বল? মন ভালো আছে তো তোর? আজ কী করলি সারা দিন?`;
    } else if (lowerQuery.includes('হাই') || lowerQuery.includes('হ্যালো') || lowerQuery.includes('hello') || lowerQuery.includes('hi') || lowerQuery.includes('সালাম')) {
      smartReply += `হ্যালো দোস্ত! বল কীভাবে তোকে সাহায্য করতে পারি? Ennvo এর রিলস, চ্যাট, কল বা অন্য যেকোনো বিষয় জানতে আমাকে বলতে পারিস!`;
    } else if (lowerQuery.includes('অ্যাপ') || lowerQuery.includes('app') || lowerQuery.includes('ennvo') || lowerQuery.includes('ফিচার')) {
      smartReply += `Ennvo হল নেক্সট-জেনারেশন সোশ্যাল প্ল্যাটফর্ম! এখানে তুই ল্যাগ-ফ্রি এইচডি রিলস, ক্রিস্টাল ক্লিয়ার অডিও/ভিডিও কল, স্টোরি এবং ১০০% প্রাইভেট সিকিউর মেসেজিং পেয়ে যাবি!`;
    } else {
      smartReply += `তোর কথা বুঝতে পেরেছি দোস্ত! তুই "${lastUserMessage.slice(0, 40)}" বলছিস। তুই আমাকে যেকোনো প্রশ্ন করতে পারিস — গল্প করা থেকে শুরু করে যেকোনো হেল্পে আমি তোর সাথেই আছি!`;
    }

    return res.json({ success: true, reply: smartReply });
  } catch (err: any) {
    console.error("Jarvis endpoint exception:", err);
    return res.json({ 
      success: true,
      reply: `কিরে ${req.body?.userName || 'দোস্ত'}! আমি সব সময় তোর পাশে আছি, বল কীভাবে সাহায্য করতে পারি!`
    });
  }
});

// ==========================================
// Native Android Bridge & Push Notifications API
// ==========================================

interface StoredDevice {
  deviceToken: string;
  userId: string;
  fcmToken: string;
  notifMode: "on" | "off" | "secret";
  updatedAt: number;
}

const devicesFilePath = path.join(uploadsDir, "native_devices.json");
let deviceStore: Map<string, StoredDevice> = new Map();

function loadDeviceStore() {
  try {
    if (fs.existsSync(devicesFilePath)) {
      const raw = fs.readFileSync(devicesFilePath, "utf-8");
      const list: StoredDevice[] = JSON.parse(raw);
      deviceStore = new Map(list.map((d) => [d.deviceToken, d]));
    }
  } catch (e) {
    console.warn("Notice: loading devices store:", e);
  }
}

function persistDeviceStore() {
  try {
    const list = Array.from(deviceStore.values());
    fs.writeFileSync(devicesFilePath, JSON.stringify(list, null, 2), "utf-8");
  } catch (e) {
    console.warn("Notice: saving devices store:", e);
  }
}

loadDeviceStore();

// 1. POST /api/native/register-device
app.post("/api/native/register-device", (req, res): any => {
  try {
    const { fcmToken, userId, notifMode = "on" } = req.body;
    if (!fcmToken || typeof fcmToken !== "string" || !fcmToken.trim()) {
      return res.status(400).json({ error: "Missing or invalid fcmToken" });
    }

    const cleanFcm = fcmToken.trim();
    const effectiveUid = String(userId || "").trim();

    // Check if device already has a token
    let existingToken: string | null = null;
    for (const [token, dev] of deviceStore.entries()) {
      if (dev.fcmToken === cleanFcm) {
        existingToken = token;
        break;
      }
    }

    const deviceToken = existingToken || crypto.randomBytes(36).toString("hex");

    deviceStore.set(deviceToken, {
      deviceToken,
      userId: effectiveUid,
      fcmToken: cleanFcm,
      notifMode: (notifMode === "off" || notifMode === "secret") ? notifMode : "on",
      updatedAt: Date.now()
    });

    persistDeviceStore();

    return res.json({ success: true, deviceToken });
  } catch (err: any) {
    console.error("Error in /api/native/register-device:", err);
    return res.status(500).json({ error: err.message || "Failed to register device" });
  }
});

// Helper to extract deviceToken from Authorization Bearer header
function getDeviceFromRequest(req: express.Request): StoredDevice | null {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  return deviceStore.get(token) || null;
}

// 2. POST /api/native/reply (Quick reply typed in Android notification when app was closed)
app.post("/api/native/reply", async (req, res): Promise<any> => {
  try {
    const device = getDeviceFromRequest(req);
    if (!device) {
      return res.status(401).json({ error: "Unauthorized device token" });
    }

    const { conversationId, text } = req.body;
    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ error: "Empty text" });
    }
    if (!conversationId) {
      return res.status(400).json({ error: "Missing conversationId" });
    }

    const trimmedText = text.trim();
    const senderUid = device.userId;

    if (adminInitialized) {
      const firestore = getFirestore();
      const convRef = firestore.collection("conversations").doc(conversationId);
      const convSnap = await convRef.get();

      if (convSnap.exists) {
        const convData = convSnap.data() || {};
        if (senderUid && Array.isArray(convData.participantIds) && !convData.participantIds.includes(senderUid)) {
          return res.status(403).json({ error: "User is not in this conversation" });
        }

        // Add message
        await convRef.collection("messages").add({
          senderId: senderUid,
          type: "text",
          content: trimmedText,
          createdAt: FieldValue.serverTimestamp(),
          status: "sent"
        });

        // Update conversation summary
        const unreadCount = { ...(convData.unreadCount || {}) };
        if (Array.isArray(convData.participantIds)) {
          convData.participantIds.forEach((id: string) => {
            if (id !== senderUid) {
              unreadCount[id] = (unreadCount[id] || 0) + 1;
            }
          });
        }

        await convRef.update({
          lastMessage: trimmedText,
          lastSenderId: senderUid,
          lastMessageTime: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          unreadCount
        });
      }
    }

    return res.json({ success: true });
  } catch (err: any) {
    console.error("Error in /api/native/reply:", err);
    return res.status(500).json({ error: err.message || "Failed to send reply" });
  }
});

// 3. POST /api/native/call-decline (Decline call from Android notification action)
app.post("/api/native/call-decline", async (req, res): Promise<any> => {
  try {
    const device = getDeviceFromRequest(req);
    if (!device) {
      return res.status(401).json({ error: "Unauthorized device token" });
    }

    const { callId } = req.body;
    if (!callId) {
      return res.status(400).json({ error: "Missing callId" });
    }

    if (adminInitialized) {
      const firestore = getFirestore();
      const callRef = firestore.collection("calls").doc(callId);
      await callRef.update({
        status: "rejected",
        endedAt: FieldValue.serverTimestamp()
      });
    }

    return res.json({ success: true });
  } catch (err: any) {
    console.error("Error in /api/native/call-decline:", err);
    return res.status(500).json({ error: err.message || "Failed to decline call" });
  }
});

// 4. POST /api/native/settings (Save notification mode)
app.post("/api/native/settings", (req, res): any => {
  try {
    const { userId, notifMode } = req.body;
    if (userId && (notifMode === "on" || notifMode === "off" || notifMode === "secret")) {
      for (const [key, dev] of deviceStore.entries()) {
        if (dev.userId === userId) {
          dev.notifMode = notifMode;
          deviceStore.set(key, dev);
        }
      }
      persistDeviceStore();
    }
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 5. POST /api/native/send-push (Data-Only High-Priority FCM Push for Calls & Messages)
app.post("/api/native/send-push", async (req, res): Promise<any> => {
  try {
    const { 
      targetUserId,
      type, // 'message' | 'call' | 'call_cancel'
      title,
      body,
      avatar,
      convId,
      name,
      callType,
      callId,
      missed
    } = req.body;

    if (!targetUserId || !type) {
      return res.status(400).json({ error: "Missing targetUserId or type" });
    }

    // Find all devices registered for this user
    const targetDevices: StoredDevice[] = [];
    for (const dev of deviceStore.values()) {
      if (dev.userId === targetUserId && dev.fcmToken) {
        targetDevices.push(dev);
      }
    }

    if (targetDevices.length === 0) {
      return res.json({ success: true, sent: 0, reason: "No registered devices found" });
    }

    let sentCount = 0;
    const tokensToRemove: string[] = [];

    for (const dev of targetDevices) {
      // If notification mode is 'off', skip message pushes (calls are NEVER skipped)
      if (type === "message" && dev.notifMode === "off") {
        continue;
      }

      try {
        let fcmPayload: any = null;

        if (type === "message") {
          // Strictly DATA-ONLY, HIGH PRIORITY
          fcmPayload = {
            token: dev.fcmToken,
            data: {
              type: "message",
              title: String(title || "Ennvo"),
              body: String(body || "New message"),
              avatar: String(avatar || ""),
              convId: String(convId || "")
            },
            android: {
              priority: "high",
              ttl: 60 * 60 * 1000 // 1 hour
            }
          };
        } else if (type === "call") {
          // Incoming Call: DATA-ONLY, HIGH PRIORITY, 30s TTL
          fcmPayload = {
            token: dev.fcmToken,
            data: {
              type: "call",
              name: String(name || title || "Caller"),
              avatar: String(avatar || ""),
              callType: String(callType || "voice"),
              callId: String(callId || "")
            },
            android: {
              priority: "high",
              ttl: 30 * 1000
            }
          };
        } else if (type === "call_cancel") {
          fcmPayload = {
            token: dev.fcmToken,
            data: {
              type: "call_cancel",
              callId: String(callId || ""),
              missed: String(missed === "false" ? "false" : "true")
            },
            android: {
              priority: "high",
              ttl: 30 * 1000
            }
          };
        }

        if (fcmPayload && adminInitialized) {
          await getMessaging().send(fcmPayload as any);
          sentCount++;
        }
      } catch (fcmErr: any) {
        console.warn("FCM push send result:", fcmErr.code || fcmErr.message);
        if (fcmErr.code === "messaging/registration-token-not-registered" || fcmErr.code === "messaging/invalid-registration-token") {
          tokensToRemove.push(dev.fcmToken);
        }
      }
    }

    // Clean up invalid tokens
    if (tokensToRemove.length > 0) {
      for (const [key, dev] of deviceStore.entries()) {
        if (tokensToRemove.includes(dev.fcmToken)) {
          deviceStore.delete(key);
        }
      }
      persistDeviceStore();
    }

    return res.json({ success: true, sent: sentCount });
  } catch (err: any) {
    console.error("Error in /api/native/send-push:", err);
    return res.status(500).json({ error: err.message || "Failed to dispatch push" });
  }
});

// High-Speed Cloudflare R2 Direct Upload Endpoint with Local Fallback
app.post("/api/upload-r2", upload.single("file"), async (req, res): Promise<any> => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const pathPrefix = req.body.pathPrefix || "media";
    let extension = file.originalname && file.originalname.includes(".") 
      ? (file.originalname.split(".").pop() || "bin").toLowerCase()
      : (file.mimetype?.split("/")[1] || "bin").toLowerCase();

    if (extension === "blob" || extension === "bin" || extension === "octet-stream") {
      if (file.mimetype?.startsWith("video/")) extension = "mp4";
      else if (file.mimetype?.startsWith("image/")) extension = "jpg";
      else extension = "mp4";
    }

    const key = `${pathPrefix}/${Date.now()}_${Math.random().toString(36).substring(7)}.${extension}`;

    // 1. Immediately write local backup copy to disk
    const targetDir = path.join(uploadsDir, pathPrefix);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    const localFilePath = path.join(uploadsDir, key);
    fs.writeFileSync(localFilePath, file.buffer);

    // Dynamic absolute URL for local backup (never use dead hardcoded domains)
    const host = req.get("host") || "localhost:3000";
    const protocol = req.protocol === "https" || req.get("x-forwarded-proto") === "https" ? "https" : "http";
    const absoluteLocalUrl = `${protocol}://${host}/uploads/${key}`;

    // 2. Direct Cloudflare R2 Upload
    const r2 = getR2Client();
    if (r2) {
      let contentType = file.mimetype || "application/octet-stream";
      if (extension === "mp4") contentType = "video/mp4";
      else if (extension === "webm") contentType = "video/webm";
      else if (extension === "mov") contentType = "video/quicktime";
      else if (extension === "jpg" || extension === "jpeg") contentType = "image/jpeg";
      else if (extension === "png") contentType = "image/png";
      else if (extension === "webp") contentType = "image/webp";

      const command = new PutObjectCommand({
        Bucket: r2.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: contentType,
      });

      try {
        await r2.client.send(command);

        if (r2.publicDomain && r2.publicDomain.trim().length > 3) {
          const cleanDomain = r2.publicDomain.replace(/\/$/, "");
          const publicUrl = cleanDomain.startsWith("http") ? `${cleanDomain}/${key}` : `https://${cleanDomain}/${key}`;
          return res.json({ success: true, url: publicUrl, key });
        }
      } catch (r2Err: any) {
        console.warn("Cloudflare R2 upload error, falling back to local file:", r2Err?.message);
      }
    }

    // 3. Fallback to server local URL if R2 unavailable
    return res.json({
      success: true,
      url: absoluteLocalUrl,
      key
    });
  } catch (error: any) {
    console.error("Upload Error in /api/upload-r2:", error);
    return res.status(500).json({ error: error.message || "Failed to upload media" });
  }
});

// Cloudflare R2 Delete Endpoint to free up storage
app.post("/api/delete-r2", async (req, res): Promise<any> => {
  try {
    const { url, key: rawKey } = req.body;
    const r2 = getR2Client();
    if (!r2) {
      return res.status(503).json({ error: "R2 not configured" });
    }

    let targetKey = rawKey;
    if (!targetKey && url) {
      // Extract key from full public CDN URL (e.g. https://pub-xxx.r2.dev/media/12345_abc.mp4)
      try {
        const urlObj = new URL(url);
        targetKey = urlObj.pathname.startsWith('/') ? urlObj.pathname.substring(1) : urlObj.pathname;
      } catch (e) {
        targetKey = url;
      }
    }

    if (!targetKey) {
      return res.status(400).json({ error: "Missing key or URL" });
    }

    const command = new DeleteObjectCommand({
      Bucket: r2.bucket,
      Key: targetKey,
    });

    await r2.client.send(command);
    console.log(`Successfully deleted key from R2: ${targetKey}`);

    return res.json({ success: true, deletedKey: targetKey });
  } catch (error: any) {
    console.error("Cloudflare R2 Delete Error:", error);
    return res.status(500).json({ error: error.message || "Failed to delete from Cloudflare R2" });
  }
});

async function startServer() {
  // Vite middleware setup for dev vs production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
