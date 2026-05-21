import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEFAULT_BUCKET = "nod-media";
const DEFAULT_REGION = "nyc3";
const ALLOWED_FOLDERS = new Set(["videos", "miniatures"]);

function isPlaceholder(value: string) {
  return /REMPLACER_PAR|YOUR_|your-|placeholder|changeme/i.test(value);
}

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value || isPlaceholder(value)) {
    throw new Error(`Variable manquante: ${name}`);
  }
  return value;
}

function getRegion(endpoint: string, bucket: string) {
  if (process.env.SPACES_REGION && !isPlaceholder(process.env.SPACES_REGION)) return process.env.SPACES_REGION;

  try {
    const host = new URL(endpoint).hostname;
    const [firstLabel] = host.split(".");
    if (host.includes("digitaloceanspaces.com") && firstLabel && firstLabel !== bucket) {
      return firstLabel;
    }
  } catch {
    return DEFAULT_REGION;
  }

  return DEFAULT_REGION;
}

function buildPublicUrl(endpoint: string, bucket: string, key: string) {
  const cleanEndpoint = endpoint.replace(/\/+$/, "");

  try {
    const url = new URL(cleanEndpoint);
    if (url.hostname.startsWith(`${bucket}.`)) {
      return `${cleanEndpoint}/${key}`;
    }
  } catch {
    return `${cleanEndpoint}/${bucket}/${key}`;
  }

  return `${cleanEndpoint}/${bucket}/${key}`;
}

function sanitizeFileName(value: string) {
  const cleaned = value
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 90);

  return cleaned || "media";
}

function monthKey(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      fileName?: unknown;
      contentType?: unknown;
      folder?: unknown;
    };

    const fileName = typeof body.fileName === "string" ? body.fileName : "media";
    const contentType = typeof body.contentType === "string" ? body.contentType : "application/octet-stream";
    const folder = typeof body.folder === "string" ? body.folder : "";

    if (!ALLOWED_FOLDERS.has(folder)) {
      return NextResponse.json({ ok: false, error: "Dossier média invalide." }, { status: 400 });
    }

    if (!contentType.startsWith("video/") && !contentType.startsWith("image/")) {
      return NextResponse.json({ ok: false, error: "Type de média refusé." }, { status: 400 });
    }

    const configuredBucket = process.env.SPACES_BUCKET;
    const configuredEndpoint = process.env.NEXT_PUBLIC_SPACES_ENDPOINT;
    const configuredRegion = process.env.SPACES_REGION;
    const fallbackRegion = configuredRegion && !isPlaceholder(configuredRegion) ? configuredRegion : DEFAULT_REGION;
    const bucket = configuredBucket && !isPlaceholder(configuredBucket) ? configuredBucket : DEFAULT_BUCKET;
    const endpoint = configuredEndpoint && !isPlaceholder(configuredEndpoint) ? configuredEndpoint : `https://${fallbackRegion}.digitaloceanspaces.com`;
    const accessKeyId = getRequiredEnv("SPACES_KEY");
    const secretAccessKey = getRequiredEnv("SPACES_SECRET");
    const region = getRegion(endpoint, bucket);
    const key = `${folder}/${monthKey()}/${crypto.randomUUID()}-${sanitizeFileName(fileName)}`;

    const client = new S3Client({
      region,
      endpoint,
      forcePathStyle: false,
      credentials: {
        accessKeyId,
        secretAccessKey
      }
    });

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType
    });

    const uploadUrl = await getSignedUrl(client, command, { expiresIn: 60 * 5 });
    const publicUrl = process.env.NEXT_PUBLIC_SPACES_PUBLIC_URL
      ? `${process.env.NEXT_PUBLIC_SPACES_PUBLIC_URL.replace(/\/+$/, "")}/${key}`
      : buildPublicUrl(endpoint, bucket, key);

    return NextResponse.json({
      ok: true,
      key,
      publicUrl,
      uploadUrl
    });
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : "Signature d'archive impossible.";
    const message = rawMessage.startsWith("Variable manquante") ? "Archive média non configurée." : rawMessage;
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
