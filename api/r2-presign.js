/**
 * Ennvo media upload helper (Vercel serverless function).
 *
 * It hands out a short lived presigned PUT url for the Cloudflare R2 bucket,
 * so the bytes go straight to the storage edge and the storage credentials
 * never leave the server. The in-app update bundle uses the same path.
 *
 * POST /api/r2-presign  { key, contentType } -> { uploadUrl, publicUrl }
 */
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const BUCKET = process.env.CLOUDFLARE_R2_BUCKET_NAME || 'ennvo-storage';
const PUBLIC_DOMAIN = (
  process.env.CLOUDFLARE_R2_PUBLIC_DOMAIN ||
  'https://pub-320091ef45b945e6a22b05cf96d6b9b9.r2.dev'
).replace(/\/$/, '');

const client = () => {
  const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID;
  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) return null;
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Use POST' });
    return;
  }

  const s3 = client();
  if (!s3) {
    res.status(503).json({ error: 'R2 not configured' });
    return;
  }

  const key = String(req.body?.key || '').replace(/^\/+/, '');
  const contentType = String(req.body?.contentType || 'application/octet-stream');
  const safeKey = /^[A-Za-z0-9_-]+\/[A-Za-z0-9._-]+$/.test(key) && !key.includes('..');

  if (!safeKey) {
    res.status(400).json({ error: 'Invalid upload key' });
    return;
  }
  if (contentType.length > 255) {
    res.status(400).json({ error: 'Invalid content type' });
    return;
  }

  try {
    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: contentType,
    });
    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 900 });
    res.json({ uploadUrl, publicUrl: `${PUBLIC_DOMAIN}/${key}` });
  } catch (error) {
    console.error('R2 presign error:', error);
    res.status(500).json({ error: 'Could not create an upload URL' });
  }
}
