import { useState, useCallback, useEffect } from "react";
import { getSupabaseBrowserClient, ensureAnonymousSession } from "@/lib/supabase";

const DEFAULT_ROOM_CODE = "NOD-CLUB";
const ROOM_CODE_KEY = "nod_room_code";
const PSEUDO_KEY = "nod_pseudo";

function sanitizePseudo(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^\w\sÀ-ÖØ-öø-ÿ_.-]/g, "")
    .slice(0, 24);
}

function sanitizeRoomCode(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .slice(0, 24);
}

export function useRoom() {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState(DEFAULT_ROOM_CODE);
  const [participant, setParticipant] = useState<{ id: string; pseudo: string } | null>(null);
  const [bootingSession, setBootingSession] = useState(true);

  useEffect(() => {
    let mounted = true;
    
    async function initSession() {
      try {
        const client = getSupabaseBrowserClient();
        if (client) {
          const user = await ensureAnonymousSession(client);
          if (user && mounted) {
            const storedPseudo = sanitizePseudo(localStorage.getItem(PSEUDO_KEY) || "");
            const nextPseudo = storedPseudo || `Joueur ${user.id.slice(0, 4).toUpperCase()}`;
            
            if (storedPseudo !== nextPseudo) {
              localStorage.setItem(PSEUDO_KEY, nextPseudo);
            }
            
            setParticipant({ id: user.id, pseudo: nextPseudo });
          }
        }

        if (mounted) {
          const code = sanitizeRoomCode(localStorage.getItem(ROOM_CODE_KEY) || DEFAULT_ROOM_CODE);
          setRoomCode(code);
        }
      } catch (err) {
        console.error("useRoom init failed:", err);
      } finally {
        if (mounted) setBootingSession(false);
      }
    }
    
    void initSession();
    
    return () => {
      mounted = false;
    };
  }, []);

  const ensureRoom = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return null;
    
    const cleanCode = sanitizeRoomCode(roomCode) || DEFAULT_ROOM_CODE;
    localStorage.setItem(ROOM_CODE_KEY, cleanCode);
    setRoomCode(cleanCode);

    const { data, error } = await supabase
      .from("rooms")
      .upsert({ code: cleanCode }, { onConflict: "code" })
      .select("id")
      .single();
      
    if (error) throw error;

    const nextRoomId = typeof data?.id === "string" ? data.id : null;
    if (nextRoomId) setRoomId(nextRoomId);
    return nextRoomId;
  }, [roomCode]);

  return {
    roomId,
    roomCode,
    participant,
    bootingSession,
    ensureRoom,
    setRoomCode
  };
}
