import Image from "next/image";
import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Trophy, TrendingUp, Award, Activity, CheckCircle, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { BrutalCard } from "../ui/BrutalCard";
import { getCategoryMeta } from "@/lib/scoring";
import type { Nomination, StarDistribution } from "@/types";

interface ProfileDetailModalProps {
  tiktokerName: string;
  onClose: () => void;
  onNominationClick?: (nomination: Nomination) => void;
}

export function ProfileDetailModal({ tiktokerName, onClose, onNominationClick }: ProfileDetailModalProps) {
  const [profile, setProfile] = useState<{ id: string; username: string; avatarUrl: string } | null>(null);
  const [nominations, setNominations] = useState<Nomination[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadProfileData() {
      setIsLoading(true);
      try {
        if (!supabase) return;

        // 1. Resolve primary profile metadata from the tiktokers table
        const { data: tiktokerData } = await supabase
          .from("tiktokers")
          .select("id, username, avatar_url")
          .eq("username", tiktokerName)
          .maybeSingle();

        if (!mounted) return;

        let tiktokerId = tiktokerData?.id || null;
        setProfile({
          id: tiktokerId || "",
          username: tiktokerName,
          avatarUrl: tiktokerData?.avatar_url || "",
        });

        // 2. Fetch all folders (nominations) along with nested ratings for this creator
        let query = supabase
          .from("nominations")
          .select(`
            id,
            room_id,
            category_id,
            category_ids,
            tiktoker_name,
            tiktoker_id,
            media_url,
            video_storage_path,
            thumbnail_url,
            thumbnail_storage_path,
            media_kind,
            comment,
            submitted_by,
            status,
            created_at,
            ratings (
              id,
              nomination_id,
              voter_id,
              rating_stars,
              rating_score,
              rating_points,
              rire_score,
              surprise_score,
              gene_score,
              fierte_score,
              interet_score,
              comment,
              created_at
            )
          `);

        // Filter by tiktoker_id if available, or fall back to tiktoker_name to capture legacy nodes
        if (tiktokerId) {
          query = query.or(`tiktoker_id.eq.${tiktokerId},tiktoker_name.eq.${tiktokerName}`);
        } else {
          query = query.eq("tiktoker_name", tiktokerName);
        }

        const { data: folders, error: foldersError } = await query.order("created_at", { ascending: false });

        if (foldersError) {
          console.error("[NOD ProfileDetailModal] fetch error:", foldersError);
          return;
        }

        if (mounted && folders) {
          // Parse folders properly to match client Nomination types
          const parsed: Nomination[] = (folders as any[]).map((f) => ({
            id: f.id,
            room_id: f.room_id,
            category_id: f.category_id,
            category_ids: f.category_ids || [f.category_id],
            tiktoker_name: f.tiktoker_name,
            tiktoker_id: f.tiktoker_id,
            media_url: f.media_url,
            video_storage_path: f.video_storage_path,
            thumbnail_url: f.thumbnail_url,
            thumbnail_storage_path: f.thumbnail_storage_path,
            media_kind: f.media_kind,
            comment: f.comment,
            submitted_by: f.submitted_by,
            status: f.status,
            created_at: f.created_at,
            ratings: (f.ratings || []).map((r: any) => ({
              id: r.id,
              nomination_id: r.nomination_id,
              voter_id: r.voter_id,
              rating_stars: r.rating_stars,
              rating_score: r.rating_score,
              rating_points: r.rating_points,
              scores: {
                rire: r.rire_score || 0,
                surprise: r.surprise_score || 0,
                gene: r.gene_score || 0,
                fierte: r.fierte_score || 0,
                interet: r.interet_score || 0,
              },
              comment: r.comment || "",
              created_at: r.created_at,
            })),
          }));
          setNominations(parsed);
        }
      } catch (err) {
        console.error("[NOD ProfileDetailModal] load exception:", err);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    void loadProfileData();

    return () => {
      mounted = false;
    };
  }, [tiktokerName]);

  // 3. Dynamic statistical aggregation optimized with strict useMemo hooks
  const metrics = useMemo(() => {
    const totalDossiers = nominations.length;
    const acceptedDossiers = nominations.filter((n) => n.status !== "pending").length;
    const successRate = totalDossiers > 0 ? (acceptedDossiers / totalDossiers) * 100 : 0;
    
    let totalPoints = 0;
    let totalVotes = 0;
    const starDistribution: StarDistribution = [0, 0, 0, 0, 0];
    const categoryCounts: Record<string, number> = {};
    const dimensionTotals = { rire: 0, surprise: 0, gene: 0, fierte: 0, interet: 0 };
    const allComments: Array<{ text: string; voter: string; stars: number; date: string }> = [];

    nominations.forEach((n) => {
      // Record categories count
      n.category_ids.forEach((catId) => {
        categoryCounts[catId] = (categoryCounts[catId] ?? 0) + 1;
      });

      n.ratings.forEach((r) => {
        totalPoints += r.rating_points || 0;
        totalVotes += 1;

        const stars = Math.round(r.rating_score || 0);
        if (stars >= 1 && stars <= 5) {
          starDistribution[stars - 1] += 1;
        }

        dimensionTotals.rire += r.scores?.rire ?? 0;
        dimensionTotals.surprise += r.scores?.surprise ?? 0;
        dimensionTotals.gene += r.scores?.gene ?? 0;
        dimensionTotals.fierte += r.scores?.fierte ?? 0;
        dimensionTotals.interet += r.scores?.interet ?? 0;

        if (r.comment?.trim()) {
          allComments.push({
            text: r.comment.trim(),
            voter: r.voter_id,
            stars: r.rating_stars,
            date: r.created_at,
          });
        }
      });
    });

    const averageRatingVal = totalVotes > 0 ? totalPoints / totalVotes / 20 : 0;
    const averageScore100 = averageRatingVal * 20;

    const dimensionAverages = {
      rire: totalVotes > 0 ? dimensionTotals.rire / totalVotes : 0,
      surprise: totalVotes > 0 ? dimensionTotals.surprise / totalVotes : 0,
      gene: totalVotes > 0 ? dimensionTotals.gene / totalVotes : 0,
      fierte: totalVotes > 0 ? dimensionTotals.fierte / totalVotes : 0,
      interet: totalVotes > 0 ? dimensionTotals.interet / totalVotes : 0,
    };

    const sortedCategories = Object.entries(categoryCounts)
      .filter(([_, count]) => count > 0)
      .map(([id, count]) => ({ id, count }))
      .sort((a, b) => b.count - a.count);

    return {
      totalDossiers,
      acceptedDossiers,
      successRate,
      totalPoints,
      totalVotes,
      averageRatingVal,
      averageScore100,
      dimensionAverages,
      sortedCategories,
      allComments,
    };
  }, [nominations]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 15 }}
          transition={{ type: "spring", stiffness: 380, damping: 28 }}
          className="relative w-full max-w-[28rem] h-[85vh] bg-monolith border border-white/10 rounded-[12px] shadow-2xl overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 z-50 brutal-icon-button bg-black/60 border border-white/20 text-white rounded-full p-1.5 flex items-center justify-center hover:bg-black/80"
            aria-label="Fermer le profil"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Modal Header */}
          <div className="p-4 border-b border-white/5 bg-void flex items-center gap-4">
            <div className="relative h-12 w-12 overflow-hidden rounded-full border border-champagne/50 bg-zinc-950 shrink-0 shadow-inner">
              {profile?.avatarUrl ? (
                <Image
                  src={profile.avatarUrl}
                  alt=""
                  fill
                  sizes="48px"
                  className="object-cover"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-md font-black text-champagne font-mono">
                  {tiktokerName.slice(0, 2).toUpperCase()}
                </span>
              )}
            </div>
            
            <div className="min-w-0">
              <span className="inline-flex items-center gap-1 rounded bg-[#d4af37]/10 border border-[#d4af37]/30 px-1.5 py-0.5 text-[7px] font-black uppercase tracking-widest text-[#d4af37] font-sans">
                Fiche Profil NOD
              </span>
              <h2 className="text-2xl font-serif font-black tracking-tight text-white capitalize leading-tight truncate">
                {tiktokerName}
              </h2>
            </div>
          </div>

          {/* Modal Content Scrollable Area */}
          <div className="flex-1 overflow-y-auto tabloid-scroll p-4 space-y-4">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center h-48 gap-3">
                <div className="h-6 w-6 border-2 border-champagne border-t-transparent rounded-full animate-spin" />
                <span className="text-[10px] font-black uppercase tracking-widest text-champagne font-sans">
                  Chargement des dossiers du conseil
                </span>
              </div>
            ) : (
              <>
                {/* Visual Dashboard Grid */}
                <div className="grid grid-cols-2 gap-2 bg-void/60 p-2 rounded-[8px] border border-white/5">
                  <div className="rounded-[4px] border border-white/5 bg-monolith p-2 text-center">
                    <Award className="mx-auto mb-0.5 h-3.5 w-3.5 text-champagne" />
                    <span className="block text-md font-serif font-black leading-none text-white">
                      {metrics.totalPoints}
                    </span>
                    <span className="mt-0.5 block text-[6.5px] font-black uppercase tracking-wider text-zinc-500 font-sans">
                      POINTS CUMULÉS
                    </span>
                  </div>

                  <div className="rounded-[4px] border border-white/5 bg-monolith p-2 text-center">
                    <TrendingUp className="mx-auto mb-0.5 h-3.5 w-3.5 text-sky" />
                    <span className="block text-md font-serif font-black leading-none text-white">
                      {metrics.averageScore100.toFixed(0)}%
                    </span>
                    <span className="mt-0.5 block text-[6.5px] font-black uppercase tracking-wider text-zinc-500 font-sans">
                      INDICE DE NOTE
                    </span>
                  </div>

                  <div className="rounded-[4px] border border-white/5 bg-monolith p-2 text-center">
                    <Activity className="mx-auto mb-0.5 h-3.5 w-3.5 text-violet" />
                    <span className="block text-md font-serif font-black leading-none text-white">
                      {metrics.totalVotes}
                    </span>
                    <span className="mt-0.5 block text-[6.5px] font-black uppercase tracking-wider text-zinc-500 font-sans">
                      VOTES REÇUS
                    </span>
                  </div>

                  <div className="rounded-[4px] border border-white/5 bg-monolith p-2 text-center">
                    <CheckCircle className="mx-auto mb-0.5 h-3.5 w-3.5 text-emerald-400" />
                    <span className="block text-md font-serif font-black leading-none text-white">
                      {metrics.successRate.toFixed(0)}%
                    </span>
                    <span className="mt-0.5 block text-[6.5px] font-black uppercase tracking-wider text-zinc-500 font-sans">
                      TAUX DE SUCCÈS
                    </span>
                  </div>
                </div>

                {/* Categories */}
                <div className="space-y-1.5">
                  <h3 className="text-[8px] font-black uppercase tracking-[0.16em] text-champagne/80 font-sans">
                    CATÉGORIES NOMINÉES CE MOIS-CI
                  </h3>
                  {metrics.sortedCategories.length === 0 ? (
                    <p className="text-[9px] font-black uppercase tracking-wide text-zinc-600 font-sans italic">
                      Aucune catégorie enregistrée
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {metrics.sortedCategories.map(({ id, count }) => {
                        const meta = getCategoryMeta(id);
                        const CatIcon = meta.icon;
                        return (
                          <div
                            key={id}
                            className="flex items-center justify-between px-2.5 py-1.5 rounded-[4px] border border-white/5 bg-void"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <CatIcon className="h-3 w-3 text-champagneSoft shrink-0" />
                              <span className="text-[9px] font-black uppercase tracking-tight text-white truncate font-sans">
                                {meta.label}
                              </span>
                            </div>
                            <span className="text-[8px] font-mono font-black text-champagne shrink-0">
                              {count} {count > 1 ? "DOSSIERS" : "DOSSIER"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Dimension ratings averages */}
                <div className="space-y-1.5">
                  <h3 className="text-[8px] font-black uppercase tracking-[0.16em] text-champagne/80 font-sans">
                    MOYENNES ÉMOTIONNELLES ACCUMULÉES
                  </h3>
                  <div className="grid grid-cols-5 gap-1.5">
                    {[
                      { emoji: "😂", label: "Rire", val: metrics.dimensionAverages.rire, color: "bg-yellow-400" },
                      { emoji: "🤯", label: "Surprise", val: metrics.dimensionAverages.surprise, color: "bg-sky-400" },
                      { emoji: "🤦", label: "Gêne", val: metrics.dimensionAverages.gene, color: "bg-rose-400" },
                      { emoji: "✊", label: "Fierté", val: metrics.dimensionAverages.fierte, color: "bg-amber-100" },
                      { emoji: "🤔", label: "Intérêt", val: metrics.dimensionAverages.interet, color: "bg-violet-400" },
                    ].map((dim, idx) => (
                      <div key={idx} className="rounded-[4px] border border-white/5 bg-void p-1.5 text-center flex flex-col justify-between">
                        <span className="text-xs">{dim.emoji}</span>
                        <span className="block text-[9.5px] font-serif font-black text-white mt-1">
                          {dim.val.toFixed(1)}★
                        </span>
                        <span className="block text-[6px] font-sans font-black text-zinc-500 uppercase tracking-tight mt-0.5">
                          {dim.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Dossiers list */}
                <div className="space-y-1.5">
                  <h3 className="text-[8px] font-black uppercase tracking-[0.16em] text-champagne/80 font-sans">
                    DOSSIERS DE LA SAISON ({metrics.totalDossiers})
                  </h3>
                  {nominations.length === 0 ? (
                    <p className="text-[9px] font-black uppercase tracking-wide text-zinc-600 font-sans italic">
                      Aucun dossier enregistré
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {nominations.map((n) => {
                        const score = n.ratings.length > 0
                          ? (n.ratings.reduce((acc, curr) => acc + curr.rating_points, 0) / n.ratings.length).toFixed(0)
                          : "0";
                        return (
                          <div key={n.id} className="flex items-center justify-between px-2.5 py-2 rounded-[4px] border border-white/5 bg-void">
                            <div className="min-w-0 pr-2">
                              <p className="text-[10px] font-sans font-medium text-white truncate">
                                &ldquo;{n.comment || "Sans contexte"}&rdquo;
                              </p>
                              <p className="text-[7.5px] font-sans font-black text-zinc-500 uppercase tracking-widest mt-0.5">
                                STATUS: {n.status === "pending" ? "À VOTER" : "NOMINÉ"}
                              </p>
                            </div>
                            <span className="gold-pill text-[8.5px] px-2 py-0.5 shrink-0 bg-champagne/10 border border-champagne/30 text-champagneSoft rounded-[4px]">
                              {score} PTS
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Conseil comments */}
                <div className="space-y-1.5">
                  <h3 className="text-[8px] font-black uppercase tracking-[0.16em] text-champagne/80 font-sans">
                    COMMENTAIRES DU CONSEIL ({metrics.allComments.length})
                  </h3>
                  {metrics.allComments.length === 0 ? (
                    <p className="text-[9px] font-black uppercase tracking-wide text-zinc-600 font-sans italic">
                      Aucun commentaire enregistré
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {metrics.allComments.map((rating, idx) => (
                        <div key={idx} className="rounded-[4px] border border-white/5 bg-void/50 p-2">
                          <p className="text-[9.5px] font-serif font-medium text-zinc-300 italic leading-tight">
                            &ldquo;{rating.text}&rdquo;
                          </p>
                          <div className="flex items-center justify-between mt-1 text-[7px] font-sans font-black uppercase tracking-wider text-zinc-500">
                            <span>VOTANT: @{rating.voter.slice(0, 6).toUpperCase()}</span>
                            <span className="text-champagneSoft">{rating.stars}★</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
