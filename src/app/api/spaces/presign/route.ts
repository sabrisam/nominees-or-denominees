import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEFAULT_BUCKET = "nod-media";
const MAX_SINGLE_PUT_BYTES = 5 * 1024 * 1024 * 1024;
const ALLOWED_FOLDERS = new Set(["videos", "miniatures"]);

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variable manquante: ${name}`);
  }
  return value;
}

function getRegion(endpoint: string, bucket: string) {
  if (process.env.SPACES_REGION) return process.env.SPACES_REGION;

  try {
    const host = new URL(endpoint).hostname;
    const [firstLabel] = host.split(".");
    if (host.includes("digitaloceanspaces.com") && firstLabel && firstLabel !== bucket) {
      return firstLabel;
    }
  } catch {
    return "us-east-1";
  }

  return "us-east-1";
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
      size?: unknown;
      folder?: unknown;
    };

    const fileName = typeof body.fileName === "string" ? body.fileName : "media";
    const contentType = typeof body.contentType === "string" ? body.contentType : "application/octet-stream";
    const size = typeof body.size === "number" && Number.isFinite(body.size) ? body.size : 0;
    const folder = typeof body.folder === "string" ? body.folder : "";

    if (!ALLOWED_FOLDERS.has(folder)) {
      return NextResponse.json({ ok: false, error: "Dossier média invalide." }, { status: 400 });
    }

    if (size <= 0 || size > MAX_SINGLE_PUT_BYTES) {
      return NextResponse.json({ ok: false, error: "Taille de fichier invalide pour l'envoi direct." }, { status: 400 });
    }

    if (!contentType.startsWith("video/") && !contentType.startsWith("image/")) {
      return NextResponse.json({ ok: false, error: "Type de média refusé." }, { status: 400 });
    }

    const endpoint = getRequiredEnv("NEXT_PUBLIC_SPACES_ENDPOINT");
    const accessKeyId = getRequiredEnv("SPACES_KEY");
    const secretAccessKey = getRequiredEnv("SPACES_SECRET");
    const bucket = process.env.SPACES_BUCKET || DEFAULT_BUCKET;
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
