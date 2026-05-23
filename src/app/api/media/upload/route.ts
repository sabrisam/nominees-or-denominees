import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

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
  if (process.env.DO_SPACES_REGION && !isPlaceholder(process.env.DO_SPACES_REGION)) return process.env.DO_SPACES_REGION;

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

export async function POST(request: NextRequest) {
  try {
    const { fileName, fileType, folder } = await request.json();

    if (!fileName || !fileType || !folder || !ALLOWED_FOLDERS.has(folder)) {
      return NextResponse.json({ ok: false, error: "Requête invalide" }, { status: 400 });
    }

    // Pour une sécurité maximale, vérifier l'authentification Supabase.
    // L'agent iOS passera le token dans le header Authorization.
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) {
      return NextResponse.json({ ok: false, error: "Non autorisé" }, { status: 401 });
    }

    const configuredBucket = process.env.DO_SPACES_BUCKET || process.env.SPACES_BUCKET;
    const configuredEndpoint = process.env.DO_SPACES_ENDPOINT || process.env.NEXT_PUBLIC_SPACES_ENDPOINT;
    const configuredRegion = process.env.DO_SPACES_REGION || process.env.SPACES_REGION;
    
    const fallbackRegion = configuredRegion && !isPlaceholder(configuredRegion) ? configuredRegion : DEFAULT_REGION;
    const bucket = configuredBucket && !isPlaceholder(configuredBucket) ? configuredBucket : DEFAULT_BUCKET;
    const endpoint = configuredEndpoint && !isPlaceholder(configuredEndpoint) ? configuredEndpoint : `https://${fallbackRegion}.digitaloceanspaces.com`;
    const accessKeyId = process.env.DO_SPACES_KEY || process.env.SPACES_KEY || "";
    const secretAccessKey = process.env.DO_SPACES_SECRET || process.env.SPACES_SECRET || "";

    if (!accessKeyId || isPlaceholder(accessKeyId)) {
      throw new Error("Variable manquante: DO_SPACES_KEY / SPACES_KEY");
    }
    if (!secretAccessKey || isPlaceholder(secretAccessKey)) {
      throw new Error("Variable manquante: DO_SPACES_SECRET / SPACES_SECRET");
    }
    const region = getRegion(endpoint, bucket);
    
    const key = `${folder}/${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, "0")}/${crypto.randomUUID()}-${fileName.replace(/[^a-zA-Z0-9.-]/g, "_")}`;

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
      ContentType: fileType,
      ACL: "public-read",
    });

    // L'URL signée est valide 10 minutes (600 secondes)
    const presignedUrl = await getSignedUrl(client, command, { expiresIn: 600 });

    const publicUrl = process.env.NEXT_PUBLIC_SPACES_PUBLIC_URL
      ? `${process.env.NEXT_PUBLIC_SPACES_PUBLIC_URL.replace(/\/+$/, "")}/${key}`
      : buildPublicUrl(endpoint, bucket, key);

    return NextResponse.json({ ok: true, key, publicUrl, presignedUrl, provider: "spaces" });
      
  } catch (error) {
    console.error("[PRESIGN_ERROR]", error);
    return NextResponse.json({ ok: false, error: "Erreur lors de la génération de l'URL de dépôt." }, { status: 500 });
  }
}
