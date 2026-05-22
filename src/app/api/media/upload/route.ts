import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";

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

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const folder = formData.get("folder") as string | null;

    if (!file || !folder || !ALLOWED_FOLDERS.has(folder)) {
      return NextResponse.json({ ok: false, error: "Requête invalide" }, { status: 400 });
    }

    const providerConfig = process.env.NEXT_PUBLIC_STORAGE_PROVIDER || "supabase";
    
    // We'll trust the auth check via middleware or we can verify the session here.
    // For maximum security in Next.js Serverless Route:
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) {
      return NextResponse.json({ ok: false, error: "Non autorisé" }, { status: 401 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    if (providerConfig === "spaces") {
      const configuredBucket = process.env.SPACES_BUCKET;
      const configuredEndpoint = process.env.NEXT_PUBLIC_SPACES_ENDPOINT;
      const configuredRegion = process.env.SPACES_REGION;
      
      const fallbackRegion = configuredRegion && !isPlaceholder(configuredRegion) ? configuredRegion : DEFAULT_REGION;
      const bucket = configuredBucket && !isPlaceholder(configuredBucket) ? configuredBucket : DEFAULT_BUCKET;
      const endpoint = configuredEndpoint && !isPlaceholder(configuredEndpoint) ? configuredEndpoint : `https://${fallbackRegion}.digitaloceanspaces.com`;
      const accessKeyId = getRequiredEnv("SPACES_KEY");
      const secretAccessKey = getRequiredEnv("SPACES_SECRET");
      const region = getRegion(endpoint, bucket);
      
      const key = `${folder}/${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, "0")}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;

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
        ContentType: file.type,
        Body: buffer
      });

      await client.send(command);

      const publicUrl = process.env.NEXT_PUBLIC_SPACES_PUBLIC_URL
        ? `${process.env.NEXT_PUBLIC_SPACES_PUBLIC_URL.replace(/\/+$/, "")}/${key}`
        : buildPublicUrl(endpoint, bucket, key);

      return NextResponse.json({ ok: true, key, publicUrl, provider: "spaces" });
      
    } else {
      // Supabase path
      const supabaseUrl = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
      const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
      const supabaseStorageBucket = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || "nod-media";

      const supabase = createClient(supabaseUrl, serviceRoleKey);
      
      const key = `${folder}/${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, "0")}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;

      const { error } = await supabase.storage.from(supabaseStorageBucket).upload(key, buffer, {
        contentType: file.type,
        upsert: false
      });

      if (error) {
        throw new Error(error.message);
      }

      const { data: { publicUrl } } = supabase.storage.from(supabaseStorageBucket).getPublicUrl(key);

      return NextResponse.json({ ok: true, key, publicUrl, provider: "supabase" });
    }
  } catch (error) {
    console.error("[UPLOAD_ERROR]", error);
    return NextResponse.json({ ok: false, error: "Erreur lors du dépôt média." }, { status: 500 });
  }
}
