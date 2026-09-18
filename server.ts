import express from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ extended: true, limit: "100mb" }));

// Ensure local uploads directory exists and is statically served
const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use("/uploads", express.static(uploadsDir));

// Configure Multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit for high quality reels
});

// Lazy S3Client helper for Cloudflare R2
let r2Client: S3Client | null = null;

function getR2Client(): { client: S3Client; bucket: string; publicDomain: string } | null {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || "f45c8ffc24470718062d4b2eab12c2cd";
  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || "b907a6aad2fb1bd63ab552c6e0ea67c0";
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || "8b19ea3cf08bc63917e1fdc9f94c357afe5efc07a1c22353687340b75a4543a7";
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
          model: 'gemini-2.5-flash',
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

// High-Speed Cloudflare R2 Direct Upload Endpoint with Local Fallback
app.post("/api/upload-r2", upload.single("file"), async (req, res): Promise<any> => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const pathPrefix = req.body.pathPrefix || "media";
    const extension = file.originalname ? (file.originalname.split(".").pop() || "bin") : (file.mimetype?.split("/")[1] || "bin");
    const key = `${pathPrefix}/${Date.now()}_${Math.random().toString(36).substring(7)}.${extension}`;

    const r2 = getR2Client();
    if (r2) {
      try {
        const command = new PutObjectCommand({
          Bucket: r2.bucket,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype || "application/octet-stream",
        });

        await r2.client.send(command);

        // Form public CDN URL
        let publicUrl = "";
        if (r2.publicDomain) {
          const cleanDomain = r2.publicDomain.replace(/\/$/, "");
          publicUrl = cleanDomain.startsWith("http") ? `${cleanDomain}/${key}` : `https://${cleanDomain}/${key}`;
        } else {
          publicUrl = `https://${r2.bucket}.${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com/${key}`;
        }

        return res.json({ 
          success: true, 
          url: publicUrl,
          key
        });
      } catch (r2Err: any) {
        console.warn("R2 upload error, falling back to local storage:", r2Err.message);
      }
    }

    // High-speed resilient local storage fallback
    const targetDir = path.join(uploadsDir, pathPrefix);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    const localFilePath = path.join(uploadsDir, key);
    fs.writeFileSync(localFilePath, file.buffer);
    const localUrl = `/uploads/${key}`;

    return res.json({
      success: true,
      url: localUrl,
      key
    });
  } catch (error: any) {
    console.error("Upload Error:", error);
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
