import { useState, useCallback, useEffect } from "react";
import { getSupabaseBrowserClient, localDeviceId } from "@/lib/supabase";
import { parseNomination } from "@/lib/scoring";
import type { Nomination, ToastTone } from "@/types";

export function useNominations({
  roomId,
  participantId,
  showToast
}: {
  roomId: string | null;
  participantId: string | null;
  showToast?: (tone: ToastTone, message: string) => void;
}) {
  const [nominations, setNominations] = useState<Nomination[]>([]);
  const [syncing, setSyncing] = useState(false);

  const fetchNominations = useCallback(
    async (silent = false, forcedRoomId?: string | null) => {
      const activeRoomId = forcedRoomId ?? roomId;
      const supabase = getSupabaseBrowserClient();
      if (!supabase || !activeRoomId) return;

      setSyncing(true);

      try {
        const nominationsResult = await supabase
          .from("nominations")
          .select("id,room_id,category_id,category_ids,tiktoker_name,media_url,video_storage_path,thumbnail_url,thumbnail_storage_path,media_kind,comment,submitted_by,status,created_at,ratings(id,nomination_id,voter_id,rating_stars,rating_score,rating_points,rire_score,surprise_score,gene_score,fierte_score,interet_score,comment,created_at)")
          .eq("room_id", activeRoomId)
          .order("created_at", { ascending: false });

        let data = nominationsResult.data as Record<string, unknown>[] | null;
        let error = nominationsResult.error;

        if (error && /category_ids|rating_score|rating_points|rire_score|surprise_score|gene_score|fierte_score|interet_score/i.test(error.message)) {
          const legacy = await supabase
            .from("nominations")
            .select("id,room_id,category_id,tiktoker_name,media_url,video_storage_path,thumbnail_url,thumbnail_storage_path,media_kind,comment,submitted_by,status,created_at,ratings(id,nomination_id,voter_id,rating_stars,comment,created_at)")
            .eq("room_id", activeRoomId)
            .order("created_at", { ascending: false });
          data = legacy.data as Record<string, unknown>[] | null;
          error = legacy.error;
        }

        if (error) throw error;

        const rawRows = (data ?? []) as Record<string, unknown>[];
        if (silent && rawRows.length === 0) {
          setSyncing(false);
          return;
        }

        const rows = rawRows.map(parseNomination);
        const localExclusions = typeof localStorage !== "undefined"
          ? JSON.parse(localStorage.getItem("nod_voted_nominations") || "[]") as string[]
          : [];
        const filtered = rows.filter(
          (nomination) =>
            !localExclusions.includes(nomination.id) &&
            !nomination.ratings.some((r) => r.voter_id === localDeviceId)
        );
        setNominations(filtered);
      } catch (err) {
        if (!silent && showToast) {
          const message = err instanceof Error ? err.message : "Le direct refuse de répondre.";
          showToast("error", message);
        }
      } finally {
        setSyncing(false);
      }
    },
    [roomId, showToast]
  );

  useEffect(() => {
    if (!participantId || !roomId) return;
    
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    const poll = window.setInterval(() => {
      void fetchNominations(true);
    }, 20000);

    const channel = supabase
      .channel(`nod_room_${roomId}`, { config: { broadcast: { self: false } } })
      .on("postgres_changes", { event: "*", schema: "public", table: "nominations", filter: `room_id=eq.${roomId}` }, (payload) => {
        if (payload.eventType === "INSERT") {
          const submittedBy = String((payload.new as Record<string, unknown>).submitted_by || "");
          if (submittedBy !== participantId && showToast) showToast("info", "Nouveau dossier à juger");
        }
        void fetchNominations(true);
      })
      .on("broadcast", { event: "nomination" }, () => {
        void fetchNominations(true);
      })
      .on("broadcast", { event: "rating" }, () => {
        void fetchNominations(true);
      })
      .subscribe();

    return () => {
      window.clearInterval(poll);
      void supabase.removeChannel(channel);
    };
  }, [fetchNominations, participantId, roomId, showToast]);

  return {
    nominations,
    syncing,
    fetchNominations,
    setNominations
  };
}
