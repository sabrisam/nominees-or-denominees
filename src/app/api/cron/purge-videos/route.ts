export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return Response.json({
    ok: true,
    purge: "désactivée",
    message: "Archivage permanent actif: aucune vidéo ni miniature n'est supprimée."
  });
}
