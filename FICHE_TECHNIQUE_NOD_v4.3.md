# FICHE TECHNIQUE EXHAUSTIVE — NOD v4.3

## Référence Système Absolue pour Développement

---

## 1. ARCHITECTURE & LOGIQUE DU JEU

### 1.1 Gestion des Sessions Anonymes

**Initialisation**

- Chaque utilisateur obtient une session Supabase anonyme via `signInAnonymously()`
- Stockage persistent en localStorage avec clés :
  - `nod_user_device_id` : UUID du dispositif (reste constant)
  - `nod_pseudo` : Pseudo utilisateur
  - `nod_room_code` : Code de la room actuelle (défaut: "NOD-CLUB")
  - `nod_session_id` : Identifiant de session legacy (déprecié, maintenu pour compatibilité)

**Flux de Session**

```
Chargement page.tsx
  ↓
getSupabaseBrowserClient() créé/cachéisé en browserClient
  ↓
ensureAnonymousSession(client) déclenché au montage
  ↓
Vérification de session existante via client.auth.getSession()
  ↓
Si aucune session : client.auth.signInAnonymously()
  ↓
Récupération user.id comme voter_id (UUID Supabase)
  ↓
localStorage.setItem("nod_user_device_id", user.id)
```

**Récupération de Compte (Recovery)**

- Fonction `exportAccountRecoveryCode()` : retourne `session?.refresh_token ?? null`
- Permet à l'utilisateur de récupérer sa session via le refresh token sauvegardé

### 1.2 Structure de la Room "NOD-CLUB"

**Modèle Supabase**

```sql
CREATE TABLE rooms (
  id UUID PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

**Fonctionnement**

- Chaque room regroupe les nominations et votes d'un groupe
- Code par défaut : "NOD-CLUB"
- Toutes les requêtes sont filtrées par `room_id`
- Permet multi-room en futur (actuellement monoroom en prod)

### 1.3 Cycle de Vie d'un Dossier (Nomination)

**États de Nomination**

```
PENDING      → 0 à 1 rating : "À VOTER" (status='pending')
ACCEPTED     → ≥ MIN_PUBLIC_RATINGS (=2) : "NOMINÉ" (status='accepted')
REJECTED     → Archivé manuellement : "ARCHIVÉ" (status='rejected')
```

**Déclenchement du Changement d'État**

```typescript
// src/lib/scoring.ts
export function statusFromRatings(ratings: Rating[]) {
  if (ratings.length < MIN_PUBLIC_RATINGS) return "pending" as const;
  return "accepted" as const;
}

MIN_PUBLIC_RATINGS = 2; // Seuil : 2 votes pour passer "accepted"
```

**Processus Complet de Soumission**

1. **Studio Tab** : Utilisateur remplit le formulaire
   - Choisit catégorie (category_id, category_ids[])
   - Upload média (vidéo ou image)
   - Extraction miniature (pour vidéos)
   - Rédige commentaire (3-240 caractères)
   - Note initiale via SCORE_PRESETS ou grille manuel (DimensionScoreGrid)

2. **Création Nomination en DB**
   - Insertion en `public.nominations` avec status='pending'
   - Stockage chemin média : `video_storage_path` (DigitalOcean Spaces)
   - Création optionnelle de Rating initial via `makeRatingFromDraft()`

3. **Stockage Média**
   - DigitalOcean Spaces (bucket: `nod-files-storage`, région: `nyc3`)
   - Chemin S3 : `/videos/YYYY-MM/UUID-filename.{mp4|webp}`
   - Miniatures : `/miniatures/YYYY-MM/UUID-thumbnail.webp`
   - Compression WebP automatique pour images

4. **Votes Reçus (VoteTab)**
   - Chaque voteur soumet un rating via `submit_nomination_vote` RPC
   - Structure `Rating` : { rire, surprise, gene, fierte, interet } × 5 chacun
   - Constraint unique en DB : `UNIQUE(nomination_id, voter_id)`

5. **Transition d'État**
   - Après 2e vote : `statusFromRatings()` → retour "accepted"
   - Label change : "À VOTER" → "NOMINÉ"
   - Affichage dans Palmarès et CategoryRaceBoard

**Stockage en localStorage (Offline Support)**

```javascript
// Votes hors connexion
const PENDING_RATINGS_KEY = "nod_pending_ratings";
// Payload : PendingRatingPayload[]
// { nominationId, voterId, scores, comment, createdAt }
```

### 1.4 Réaltime WebSocket (Supabase)

**Canaux Écoutés**

- `RealtimeChannel` sur table `nominations` filtrée par room_id
- Écoute changements : INSERT, UPDATE, DELETE
- Mise à jour UI en temps réel

**Exemple Binding**

```typescript
const channel = client
  .channel('public:nominations')
  .on('postgres_changes',
    { event: '*', schema: 'public', table: 'nominations' },
    (payload) => { setNominations(...) }
  )
  .subscribe();
```

---

## 2. COMPOSANTS MAÎTRES & LIAISONS

### 2.1 Architecture Composants

```
src/app/page.tsx (2531 lignes)
    ├── Layout Principal
    ├── Gestion état tabs (direct|vote|studio|palmares|winners)
    ├── Supabase client + sessions
    └── Réaltime WebSocket

    ├── DirectTab (direct/)
    │   ├── CeremonyBulletin
    │   ├── NominationCard × N
    │   └── Filtrage (all|mine|pending|qualified|elite)
    │
    ├── VoteTab (vote/)
    │   ├── Sélection nomination
    │   ├── DimensionScoreGrid (5×5 grid)
    │   ├── Effets visuels (votBurst, confetti)
    │   └── Submit → RPC submit_nomination_vote
    │
    ├── StudioTab (studio/)
    │   ├── MediaFrame (upload + preview)
    │   ├── Compression images WebP
    │   ├── Extraction thumbnails vidéo
    │   ├── CategorySelector
    │   ├── DimensionScoreGrid
    │   ├── ScorePresetRail
    │   └── BrutalCard (Score initial)
    │
    ├── PalmaresTab (palmares/)
    │   ├── Tri : points/votes/average/successRate
    │   ├── PalmaresRow × N
    │   ├── Détails profil sélectionné
    │   ├── SVG Radar (empreinte émotionnelle)
    │   └── CategoryShare (stacked bar)
    │
    ├── WinnersTab (winners/)
    │   └── Cérémonie monthly_ceremonies (archived)
    │
    └── Système de Toast
        └── { tone: success|error|info, message }

lib/
  ├── tokens.ts (design system centralisé)
  │   └── theme: { colors, shadows, gradients }
  │
  ├── scoring.ts (logique pointage)
  │   ├── scoreForCategory()
  │   ├── pointsForCategory()
  │   ├── statusFromRatings()
  │   └── ratingImpactScore()
  │
  ├── ranking.ts
  │   ├── buildScoreBoard()
  │   ├── buildCategoryRaces()
  │   └── buildRankingMemoryGrid()
  │
  ├── constants.ts
  │   └── APP_VERSION = "4.3"
  │
  └── supabase.ts
      ├── getSupabaseBrowserClient()
      └── ensureAnonymousSession()

constants/
  └── categories.ts
      ├── CATEGORIES[]
      ├── CATEGORY_SCORING{}
      ├── SCORE_PRESETS[]
      ├── RATING_DIMENSIONS[]
      └── MIN_PUBLIC_RATINGS = 2

hooks/
  ├── useNominations() : fetch nominations + réaltime
  ├── usePalmares() : compute rows + tri
  ├── useRoom() : récup room_id localStorage
  └── useVote() : gestion vote en cours

types/
  └── index.ts : Toutes structures TypeScript
```

### 2.2 Flux de Données Inter-Composants

**Données TOP-DOWN (Props)**

```
page.tsx
  → DirectTab { nominations, selectedCategory, filter }
  → VoteTab { nominations, selectedNomination }
  → PalmaresTab { palmares, selectedRow }
  → CategoryRaceBoard { categoryRace, selectedCategory }
```

**Données BOTTOM-UP (Events)**

```
NominationCard [onClick]
  → setSelectedNomination(id)
  → page.tsx setTab('vote')

DimensionScoreGrid [onChange]
  → setScores({ rire, surprise, ... })
  → updateInitialScores()

StudioTab [onUpload]
  → uploadNomination()
  → Supabase INSERT nominations
  → Réaltime trigger → setNominations()
```

**Hooks Partagés**

```
useNominations(roomId, client)
  ↓
fetchNominations() + subscribe(realtime)
  ↓
Retour : { nominations, loading, error }
  ↓
Utilisé par : DirectTab, VoteTab, StudioTab

usePalmares(nominations)
  ↓
buildScoreBoard(nominations)
  ↓
Tri/agrégation par tiktoker_name
  ↓
Retour : { rows: PalmaresRow[] }
  ↓
Utilisé par : PalmaresTab, CategoryRaceBoard
```

---

## 3. SYSTÈME DE POINTAGE MATHÉMATIQUE

### 3.1 Formule Base : Indice d'Impact Émotionnel (0-100)

**Calcul Simple (Sans Weights)**

```typescript
export function scoreForCategory(scores: DimensionScores, categoryId?: string) {
  const sum =
    clampDimension(scores.rire) + // 0-5
    clampDimension(scores.surprise) + // 0-5
    clampDimension(scores.gene) + // 0-5
    clampDimension(scores.fierte) + // 0-5
    clampDimension(scores.interet); // 0-5
  return Math.min(100, Math.max(0, Math.round(sum * 4)));
  // sum ∈ [0, 25] × 4 = [0, 100]
}
```

**Clamping (Contrainte 0-5)**

```typescript
export function clampDimension(value: number) {
  return Math.min(5, Math.max(0, Math.round(value)));
}
```

### 3.2 Coefficients Adaptatifs par Catégorie

**Poids (Weights) Définis par Catégorie**

| Catégorie                | Rire | Surprise | Gêne | Fierté | Intérêt | Spécial                |
| ------------------------ | ---- | -------- | ---- | ------ | ------- | ---------------------- |
| **Le Zin du Mois**       | 0.18 | 0.18     | 0.12 | 0.32   | 0.20    | gêne=lowIsStrong       |
| **La Fierté des Nôtres** | 0.10 | 0.14     | 0.22 | 0.34   | 0.20    | gêne=lowIsStrong       |
| **Xptdr**                | 0.46 | 0.20     | 0.18 | 0.04   | 0.12    | gêne=lowIsStrong       |
| **La Roue Libre**        | 0.30 | 0.34     | 0.14 | 0.04   | 0.18    | —                      |
| **La Honte de la Oumma** | 0.07 | 0.10     | 0.55 | 0.25   | 0.03    | **fierté=lowIsStrong** |
| **Bon Voyageur**         | 0.12 | 0.28     | 0.10 | 0.14   | 0.36    | gêne=lowIsStrong       |
| **Gros Chef Bandit**     | 0.24 | 0.18     | 0.16 | 0.24   | 0.18    | gêne=lowIsStrong       |
| **Surprise Totale**      | 0.14 | 0.46     | 0.08 | 0.10   | 0.22    | gêne=lowIsStrong       |
| **L'Analyse Pure**       | 0.04 | 0.12     | 0.18 | 0.22   | 0.44    | gêne=lowIsStrong       |

**Stockage en Code**

```typescript
// src/constants/categories.ts
export const CATEGORY_SCORING = {
  "la-honte-de-la-oumma": {
    weights: {
      rire: 0.07,
      surprise: 0.1,
      gene: 0.55, // Dimension MAJEURE
      fierte: 0.25,
      interet: 0.03,
    },
    lowIsStrong: { fierte: true }, // ← Inversion logique
  },
  // ...
};
```

### 3.3 Logique `lowIsStrong` (Inversion)

**Concept**

- Certaines dimensions sont mieux **faibles** que fortes
- Exemple : "La Honte de la Oumma" veut une **faible fierté** (humiliation)
- Exemple : "Xptdr" veut peu de **gêne**

**Implémentation (TODO : non implémentée en logique actuelle)**

```typescript
// Pseudo-code : à ajouter dans scoreForCategory() si lowIsStrong[dimension]
if (CATEGORY_SCORING[categoryId]?.lowIsStrong?.gene) {
  adjustedGeneScore = 5 - gene; // Inverse : 0→5, 5→0
}
```

**État Actuel**

- Weights définis mais `lowIsStrong` NON appliqué dans formule
- Ticket possible : implémenter inversion en `pointsForCategory()`

### 3.4 Bonus de Points par Catégorie

```typescript
export function pointsForCategory(scores: DimensionScores, categoryId: string) {
  const rawScore = scoreForCategory(scores, categoryId);

  if (["le-zin-du-mois", ..., "lanalyse-pure"].includes(resolved)) {
    return Math.round(rawScore * 1.0);      // ×1.0 (neutre)
  }
  if (resolved === "la-honte-de-la-oumma") {
    return Math.round(rawScore * 1.5);      // ×1.5 (BOOST 50%)
  }
  if (["bon-voyageur", "surprise-totale"].includes(resolved)) {
    return Math.round(rawScore * 1.2);      // ×1.2 (BOOST 20%)
  }
  return Math.round(rawScore * 1.0);
}
```

**Récapitulatif Multiplicateurs**

- **×1.5** : La Honte de la Oumma (défis = haute valeur)
- **×1.2** : Bon Voyageur, Surprise Totale (surprise = valeur ajoutée)
- **×1.0** : Tous autres (neutre)

### 3.5 Conversion Rating → Points

**Flux Complet**

```
5 Dimensions (rire, surprise, gene, fierte, interet) × 5
              ↓
         scoreForCategory() [0-100 brut]
              ↓
        pointsForCategory() [applique multiplier]
              ↓
      rating_points ∈ [0, 150] (théo max: 100 × 1.5)
              ↓
       Moyen: rating_points / nombre_ratings
              ↓
        Points affichés dans Palmarès
```

### 3.6 Presets de Vote Rapide (SCORE_PRESETS)

```typescript
export const SCORE_PRESETS = [
  {
    id: "xptdr",
    label: "XPTDR",
    hint: "rire fort",
    scores: { rire: 5, surprise: 3, gene: 1, fierte: 1, interet: 3 },
  },
  {
    id: "malaise",
    label: "Malaise",
    hint: "gêne max",
    scores: { rire: 1, surprise: 2, gene: 5, fierte: 0, interet: 2 },
  },
  {
    id: "masterclass",
    label: "Masterclass",
    hint: "niveau haut",
    scores: { rire: 2, surprise: 4, gene: 0, fierte: 5, interet: 4 },
  },
  {
    id: "choc",
    label: "Choc",
    hint: "surprise",
    scores: { rire: 2, surprise: 5, gene: 2, fierte: 2, interet: 5 },
  },
  {
    id: "la-roue-libre",
    label: "Roue libre",
    hint: "chaos",
    scores: { rire: 4, surprise: 4, gene: 3, fierte: 1, interet: 3 },
  },
];
```

**Intégration UI**

- Composant `ScorePresetRail` (StudioTab, DimensionScoreGrid)
- Clique preset → met à jour scores (rire, surprise, gene, fierte, interet)
- Label rapide + visuel pour votes rapides

### 3.7 Valeurs Par Défaut

```typescript
export const DEFAULT_DIMENSION_SCORES: DimensionScores = {
  rire: 3,
  surprise: 3,
  gene: 1,
  fierte: 2,
  interet: 3,
};
// Somme = 12 → rawScore = 12 × 4 = 48/100
```

### 3.8 Effets Visuels Associés au Vote (votBurst)

**Confetti Animation**

```typescript
// VoteTab.tsx sur submit réussi
confetti({
  particleCount: 100,
  spread: 70,
  origin: { y: 0.6 },
  colors: [theme.colors.champagne, theme.colors.yellow, theme.colors.sky],
});
```

**Haptiques Mobiles**

```javascript
const HAPTICS = {
  tap: 10, // Tap simple
  option: 14, // Sélection option
  nav: 16, // Navigation
  media: 18, // Media event
  success: [15, 30, 10], // Success pattern
  remove: [25, 60], // Remove pattern
  error: 100, // Error pattern
};
```

**Utilisation**

```typescript
haptic(HAPTICS.tap); // Clique bouton
haptic(HAPTICS.success); // Vote soumis
haptic(HAPTICS.error); // Erreur réseau
```

---

## 4. INFRASTRUCTURE & CLOUD

### 4.1 Variables d'Environnement Requises

```env
# Supabase (PostgreSQL + Auth)
NEXT_PUBLIC_SUPABASE_URL=https://[PROJECT_ID].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# DigitalOcean Spaces (S3-compatible)
SPACES_KEY=DO00...
SPACES_SECRET=...
NEXT_PUBLIC_SPACES_ENDPOINT=https://nyc3.digitaloceanspaces.com
SPACES_BUCKET=nod-files-storage
NEXT_PUBLIC_SPACES_PUBLIC_URL=https://nod-files-storage.nyc3.digitaloceanspaces.com

# Vercel (optionnel, auto-détecté en prod)
VERCEL_GIT_REPO_ID=...
VERCEL_ENV=production|preview|development
```

### 4.2 Supabase Configuration

**Authentification Anonyme**

- Auth Mode : anon (Supabase Auth)
- Persistance : localStorage
- Auto-refresh token : activé
- Detect session in URL : désactivé

**RLS (Row-Level Security)**

- Politique lecture/écriture filtrée par room_id
- Constraint UNIQUE : (nomination_id, voter_id) sur ratings
- Contraintes CHECK : longueurs textes, valeurs numériques

**Realtime**

- Souscription PostgreSQL LISTEN/NOTIFY
- Filtres : table=nominations, room_id matching
- Reconnexion automatique

### 4.3 DigitalOcean Spaces (S3)

**Bucket Configuration**

- Nom : `nod-files-storage`
- Région : `nyc3` (New York)
- Endpoint : `https://nyc3.digitaloceanspaces.com`
- Public URL racine : `https://nod-files-storage.nyc3.digitaloceanspaces.com`

**Structure Fichiers**

```
nod-files-storage/
  └── videos/
      └── 2026-05/
          └── [UUID]-filename.mp4
  └── miniatures/
      └── 2026-05/
          └── [UUID]-thumbnail.webp
```

**Presigned URLs**

- Endpoint : `/api/spaces/presign`
- Retourne : { key, publicUrl, uploadUrl }
- Validité : 1 heure (configurable)
- ContentType forcé : video/mp4 pour .mov/.mp4

### 4.4 Vercel Deployment

**Configuration**

- Platform : Vercel Hobby (gratuit)
- Build : `next build`
- Start : `next start`
- Serverless Functions : API Routes automatiques

**Cron Jobs**

- Route : `/api/cron/purge-videos`
- Planification : 1er du mois à 00:00 UTC
- Tâche : Archive videos > 30j, purge thumbnails orphans

**Env Secrets**

- Stockées dans Vercel Project Settings
- Auto-injectées en build

### 4.5 GitHub Integration

**Repository**

- Owner : sabrisam
- Repo : nominees-or-denominees
- Branch : main (production)
- Visibility : privé

**Auto-Deploy**

- Trigger : git push origin main
- Webhook : Vercel listens GitHub
- Build + Deploy automatique en < 3 min

### 4.6 Organismes & Forfaits

| Service             | Forfait    | Coût    | Notes                      |
| ------------------- | ---------- | ------- | -------------------------- |
| Supabase            | Hobby      | 0$      | ~500MB, 50k edge functions |
| DigitalOcean Spaces | S3 5GB     | 5$/mois | Crédit 200$ disponible     |
| Vercel              | Hobby      | 0$      | Gratuit, serverless inclus |
| GitHub              | Repo privé | 0$      | Partie GitHub Enterprise   |

---

## 5. WORKFLOW & RÈGLES STRICTES

### 5.1 Build & Validation

**TypeScript Strict Check**

```bash
npx tsc --noEmit
# Avant tout commit, vérifier ZÉRO erreur TypeScript
# Obligatoire avant npm run build
```

**Build Production**

```bash
npm run build
# Next.js 14 compilation
# ESLint validation
# Type checking
# Static optimization
# Output : .next/ optimisé
```

**Lint Règles ESLint**

```
- react/no-unescaped-entities : Apostrophes → `{"'"}` ou `&apos;`
- @next/next/no-img-element : Raw `<img>` → `<Image />`
- @typescript-eslint/no-explicit-any : Bannir `any` type
```

### 5.2 Politique ZERO-PERIOD

**Règle Stricte**

- Aucun point (.) sur labels/buttons/status standalone
- Ex: "AUCUN PROFIL ÉVALUÉ POUR L'INSTANT" ✓
- Ex: "Aucune catégorie enregistrée" ✓
- Ex: "À VOTER." ✗ (point en trop)

**Localisation**

- Tous labels, boutons, statut textes : français obligatoire
- Comments code : français recommandé
- Variables : anglais camelCase

### 5.3 Contraintes Affichage Mobile

**iOS Safari Spécifique**

```css
input, textarea {
  font-size: 16px;  /* Prévient auto-zoom */
}

button, [interactive] {
  -webkit-user-select: none;  /* Empêche sélection texte */
  user-select: none;
}

video {
  webkit-playsinline="true";  /* Lecture en-ligne iOS */
  playsinline;
  muted;
  autoPlay;
}
```

**Viewport Media Queries**

```typescript
// layout.tsx
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
<meta name="theme-color" content="#050505" />
```

### 5.4 Next.js Image Optimization

**Règle**

- Bannir raw `<img>`
- Utiliser `<Image />` de `next/image`
- Paramètres requis : `src`, `alt`, `fill|width/height`, `sizes`

**Exemple Correct**

```tsx
import Image from "next/image";

<Image
  src={avatarUrl}
  alt="Avatar utilisateur"
  fill
  unoptimized
  sizes="32px"
  className="object-cover"
/>;
```

### 5.5 Apostrophes & Caractères Spéciaux

**Échappement JSX**

```tsx
// ✗ Erreur ESLint
<span>L'Analyse Pure</span>

// ✓ Correct — concatenation
<span>L{"'"}Analyse Pure</span>

// ✓ Correct — entity
<span>L&apos;Analyse Pure</span>

// ✓ Correct — template
<span>{`L'Analyse Pure`}</span>
```

### 5.6 Script Auto-Push Vercel

**Fichier**

```bash
scripts/watch-push.mjs
```

**Utilisation**

```bash
npm run watch:push
# Démarre chokidar watcher en arrière-plan
# Sur chaque fichier modifié (sauf node_modules, .git, .next, .env*, *.log)
# Commit automatique : "Auto-commit: [fichier modifié] [timestamp]"
# Push automatique : git push origin main
```

**Couleurs Logs**

```
GOLD (#D4AF37)  : 👑 Titre, headers
GREEN (#39FF14) : ✓ Succès
RED (#a93535)   : ✗ Erreurs
DIM             : ℹ Info

Exemple output:
👑 NOD — Auto-Push Watcher activé
Surveille : /Users/x/Documents/New project
Chaque sauvegarde → commit automatique → git push origin main
```

### 5.7 Versioning Système

**Constante Centrale**

```typescript
// src/lib/constants.ts
export const APP_VERSION = "4.3";
```

**Incrémenter à**

```typescript
// Si modifications architecturales majeures
APP_VERSION = "4.4";
// Dans : src/lib/constants.ts + .github/copilot-instructions.md
```

**Historique**

- v3.0 : Initial game launch
- v3.4 : Semantic rebrand, Dark Gold Tabloid
- v4.0 : Token architecture, Tailwind refactor
- v4.3 : Image optimization, apostrophe fixes, final stabilization

### 5.8 Design System & Tokens

**Fichier Central**

```typescript
// src/lib/tokens.ts
export const theme = {
  colors: {
    void: "#050505", // Noir profond (bg principal)
    monolith: "#0c0c0c", // Noir card
    cream: "#f5f1e8", // Texte crème
    champagne: "#d4af37", // Or champagne (accent)
    champagneSoft: "#f0d889", // Or soft highlight
    // ... 15 autres couleurs
  },
  shadows: {
    brutal: "8px 8px 0px 0px rgba(0, 0, 0, 1)",
    champagneGlow: "0 0 12px rgba(212, 175, 55, 0.25)",
    // ...
  },
  gradients: {
    gold: "linear-gradient(...)",
    // ...
  },
};
```

**Règle d'Utilisation**

- Importer `theme` depuis `@/lib/tokens`
- Aucune valeur hex hardcodée en composants
- Utiliser classes Tailwind : `bg-void`, `text-champagne`, `shadow-brutal`, etc.
- Si couleur manque : l'ajouter d'abord à tokens.ts

### 5.9 Tailwind Config Clean

**Configuration Consolidée**

```typescript
// tailwind.config.ts
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: extend {
    extend: { /* extensions custom */ }
  },
  plugins: []
};

export default config;
```

**Règle**

- Un seul `export default config`
- Importer theme de tokens.ts pour couleurs
- Pas de hex hardcodés dans config
- Pas de blocs dupliqués/conflictuels

### 5.10 Environment & Build Safety

**Étapes Pré-Push (Checklist)**

```
1. npm run lint
   → Vérifier ESLint (apostrophes, <img>, etc.)
2. npx tsc --noEmit
   → Vérifier TypeScript strict
3. npm run build
   → Vérifier production build complet
4. npm run test:e2e (optionnel)
   → Playwright WebKit iPhone tests
5. git push origin main
   → Auto-deploy Vercel
```

**Erreurs Courants & Fixes**

| Erreur                        | Cause            | Fix                           |
| ----------------------------- | ---------------- | ----------------------------- |
| `react/no-unescaped-entities` | Apostrophe brute | `{"'"}` ou `&apos;`           |
| `@next/next/no-img-element`   | Raw `<img>`      | → `<Image />`                 |
| `Type 'any' is not allowed`   | any type         | Spécifier type exact          |
| `Cannot find module`          | Import manquant  | Vérifier chemin @/ paths      |
| Build timeout                 | Trop lourd       | Vérifier dépendances inutiles |

---

## 6. RÉCAPITULATIF FICHIERS CLÉS

| Fichier                                       | Purpose                         | Lines | Critique             |
| --------------------------------------------- | ------------------------------- | ----- | -------------------- |
| src/app/page.tsx                              | Composant principal, état, UI   | 2531  | OUI — Logic hub      |
| src/lib/scoring.ts                            | Calcul points, conversion notes | 200+  | OUI — Math engine    |
| src/lib/tokens.ts                             | Design system centralisé        | 45    | OUI — Styling source |
| src/constants/categories.ts                   | 9 catégories, presets, weights  | 280+  | OUI — Game config    |
| src/lib/supabase.ts                           | Client auth, session            | 45    | OUI — Data layer     |
| src/components/palmares/PalmaresTab.tsx       | Leaderboard UI, tri             | 450+  | OUI — Key feature    |
| src/components/trophies/CategoryRaceBoard.tsx | Category rankings               | 280+  | MOY — Category view  |
| src/components/vote/VoteTab.tsx               | Vote interface, confetti        | 400+  | OUI — Core game      |
| src/components/studio/StudioTab.tsx           | Upload, note initial            | 500+  | OUI — Submission     |
| src/components/ui/BrutalCard.tsx              | Card wrapper design             | 45    | MOY — Reusable UI    |
| src/app/globals.css                           | Tailwind layers, custom classes | 300+  | MOY — Styling extra  |
| tailwind.config.ts                            | Tailwind theme config           | 20    | OUI — Build config   |
| package.json                                  | Dépendances, scripts            | 40    | OUI — Dependencies   |
| supabase/schema.sql                           | BD structure, RLS               | 150+  | OUI — Data schema    |
| .github/copilot-instructions.md               | System rules v4.3               | 50    | OUI — Guidelines     |

---

## 7. DÉPENDANCES PRINCIPALES

```json
{
  "@supabase/supabase-js": "^2.49.4", // Auth + DB + Realtime
  "next": "14.2.35", // Framework React
  "react": "^18.3.1", // UI library
  "react-dom": "^18.3.1", // DOM renderer
  "framer-motion": "^11.18.2", // Animations
  "lucide-react": "^0.468.0", // Icons SVG
  "canvas-confetti": "^1.9.4", // Confetti effects
  "@aws-sdk/client-s3": "^3.1051.0", // S3 client (DO Spaces)
  "tailwindcss": "^3.4.17", // CSS utility framework
  "typescript": "^5.7.3", // Type safety
  "@playwright/test": "^1.60.0" // E2E testing
}
```

---

## 8. API ROUTES & ENDPOINTS

### 8.1 Presigned URLs (Upload)

```
POST /api/spaces/presign
Input: { fileName, mediaKind, month }
Output: { key, publicUrl, uploadUrl }
Auth: Anon (localStorage token)
```

### 8.2 Cron Purge

```
GET /api/cron/purge-videos
Trigger: 1st month, 00:00 UTC (Vercel)
Action: Archive old videos, remove orphans
Auth: Vercel cron secret
```

### 8.3 Session Recovery (TODO)

```
GET /api/auth/session
Input: { recoveryCode }
Output: { user, session }
Auth: Recovery token
```

---

## 9. PERFORMANCE & OPTIMISATIONS

### 9.1 Image Optimization

- Compression WebP automatique
- Responsive sizes metadata
- Lazy loading via `<Image />`
- Thumbnail generation (vidéos)

### 9.2 Code Splitting

- Framer Motion lazy via React.lazy()
- Dynamic imports pour onglets lourds
- Bundle size < 500KB gzipped cible

### 9.3 Rendering Optimization

- `useCallback` sur handlers
- `useMemo` sur calculs lourds (buildScoreBoard)
- Éviter re-render inutile PalmaresTab, VoteTab

### 9.4 Database Queries

- Indexation room_id, nomination_id, voter_id
- Filtrage réaltime via Supabase LISTEN
- Pagination optionnelle sur nominations > 1000

---

## 10. LISTES DE VÉRIFICATION DEVELOPPEMENT

### Avant Push Code

- [ ] `npx tsc --noEmit` — 0 erreurs TypeScript
- [ ] `npm run build` — Build succeeds
- [ ] `npm run lint` — ESLint clean
- [ ] Apostrophes échappées : `{"'"}`
- [ ] Images : `<Image />` (pas raw `<img>`)
- [ ] Labels : ZERO points finaux
- [ ] iOS 16px font-size sur input/textarea
- [ ] localStorage clés : nod\_\* préfixe
- [ ] Supabase RLS filtrage room_id

### Avant Déploiement

- [ ] Variables d'env Vercel actualisées
- [ ] DO Spaces bucket accessible
- [ ] Supabase DB migrations appliquées
- [ ] Gitlens launchpad : 0 PR en attente
- [ ] Version bumped si archi change majeure
- [ ] CLAUDE.md + copilot-instructions.md alignés

---

## 11. CONTACTS & RESSOURCES

**Docs Officielles**

- Supabase : https://supabase.io/docs
- Next.js : https://nextjs.org/docs
- Framer Motion : https://www.framer.com/motion/
- Vercel : https://vercel.com/docs

**Credentials**

- Supabase Org: Ryan Frizelle test
- DO Bucket: nod-files-storage (nyc3)
- GitHub Repo: sabrisam/nominees-or-denominees

---

**Fiche Technique Générée** : 23 mai 2026  
**Version Système** : NOD v4.3  
**Statut** : PRODUCTION STABLE

---
