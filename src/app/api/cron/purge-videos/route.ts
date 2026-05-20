import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEFAULT_BUCKET = "nod-media";
const PAGE_SIZE = 1000;

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Missing Supabase admin environment variables.");
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

function getPreviousMonthPrefix(now = new Date()) {
  const previousMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const year = previousMonth.getUTCFullYear();
  const month = String(previousMonth.getUTCMonth() + 1).padStart(2, "0");
  return `videos/${year}-${month}`;
}

async function listVideoPaths(client: SupabaseClient, bucket: string, prefix: string) {
  const paths: string[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await client.storage.from(bucket).list(prefix, {
      limit: PAGE_SIZE,
      offset,
      sortBy: { column: "name", order: "asc" }
    });

    if (error) {
      throw error;
    }

    const page = data ?? [];
    for (const item of page) {
      if (item.name && item.id) {
        paths.push(`${prefix}/${item.name}`);
      }
    }

    if (page.length < PAGE_SIZE) {
      break;
    }

    offset += PAGE_SIZE;
  }

  return paths;
}

async function removeInChunks(client: SupabaseClient, bucket: string, paths: string[]) {
  const chunkSize = 100;
  let deleted = 0;

  for (let i = 0; i < paths.length; i += chunkSize) {
    const chunk = paths.slice(i, i + chunkSize);
    const { error } = await client.storage.from(bucket).remove(chunk);
    if (error) {
      throw error;
    }
    deleted += chunk.length;
  }

  return deleted;
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const bucket = process.env.SUPABASE_STORAGE_BUCKET || DEFAULT_BUCKET;
    const prefix = url.searchParams.get("prefix") || getPreviousMonthPrefix();
    const supabase = getAdminClient();

    const paths = await listVideoPaths(supabase, bucket, prefix);
    const deletedFiles = paths.length > 0 ? await removeInChunks(supabase, bucket, paths) : 0;

    const { error: updateError } = await supabase
      .from("nominations")
      .update({
        video_url: null,
        video_storage_path: null
      })
      .like("video_storage_path", `${prefix}/%`);

    if (updateError) {
      throw updateError;
    }

    return Response.json({
      ok: true,
      bucket,
      prefix,
      deletedFiles
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Video purge failed.";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
