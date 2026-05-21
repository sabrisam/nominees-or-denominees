# NOD — Nominees or Denominees
## Contexte Agent pour Claude Code, Cursor & Antigravity

---

## Stack Technologique

- **Framework :** Next.js 14 (App Router), TypeScript strict
- **Styling :** Tailwind CSS v3 + classes custom dans `globals.css`
- **Animations :** Framer Motion 11
- **Backend :** Supabase (PostgreSQL + Realtime WebSockets)
- **Stockage Médias :** DigitalOcean Spaces (S3-compatible, bucket : `nod-files-storage`, région : `nyc3`)
- **Hébergement :** Vercel (Hobby) avec Serverless Functions + Cron mensuel
- **Repo :** `sabrisam/nominees-or-denominees` (GitHub privé)

---

## Design System (NE JAMAIS MODIFIER)

- **Fond :** `#050505` (noir profond absolu)
- **Accent or :** `#D4AF37` (or champagne)
- **Or soft :** `#F0D889`
- **Texte crème :** `#F5F1E8`
- **Typographie headline :** `Impact, "Arial Narrow"` — font-weight 900, text-transform uppercase
- **Règle absolue :** Ne jamais dégrader la charte Dark Gold premium existante

---

## Les 9 Catégories — Identifiants kebab-case IMMUABLES

Ces identifiants sont verrouillés en base de données. Ne pas les changer.

```
le-zin-du-mois
la-fierte-des-notres
xptdr
la-roue-libre
la-honte-de-la-oumma
bon-voyageur
gros-chef-bandit
surprise-totale
lanalyse-pure
```

---

## Règles Critiques de Production

### Médias iOS Safari
- **Toutes** les balises `<video>` doivent avoir : `playsInline muted autoPlay preload="metadata"` + `webkit-playsinline="true"`
- La route `/api/spaces/presign/route.ts` doit forcer le `ContentType: 'video/mp4'` pour les `.mov`/`.mp4`

### Système de Vote
- **Jamais de INSERT direct** sur `ratings` — utiliser toujours l'UPSERT via le RPC `submit_nomination_vote`
- Contrainte unique en base : `UNIQUE(nomination_id, voter_id)`
- En cas d'échec réseau : stocker dans `localStorage` sous la clé `nod_pending_ratings`

### Haptiques (OBLIGATOIRE sur toutes les actions)
```ts
const HAPTICS = {
  tap: 10,
  option: 14,
  nav: 16,
  media: 18,
  success: [15, 30, 10],
  remove: [25, 60],
  error: 100
}
haptic(HAPTICS.tap); // sur chaque bouton
haptic(HAPTICS.success); // sur soumissions réussies
haptic(HAPTICS.error); // sur erreurs
```

### Modèle de Score (Indice sur 100)
- 5 dimensions : `rire`, `surprise`, `gene`, `fierte`, `interet` (valeurs 0–5)
- Coefficients adaptatifs par catégorie définis dans `CATEGORY_SCORING`
- `scoreForCategory(scores, categoryId)` → retourne un indice 0–100

---

## Structure des Fichiers Clés

```
src/
  app/
    page.tsx          ← Composant principal (2531 lignes) — toute la logique UI
    layout.tsx        ← Métadonnées PWA, viewport, manifest
    globals.css       ← Design system complet (variables CSS, composants)
    api/
      spaces/presign/route.ts  ← Signature S3 pour uploads DO Spaces
      cron/purge-videos/route.ts ← Cron Vercel mensuel (1er du mois)
  lib/
    supabase.ts       ← Client Supabase singleton (browser-safe)
public/
  manifest.webmanifest
  apple-icon.png      ← 180x180 pour iOS
  icon-192.png        ← PWA install
  icon-512.png        ← PWA install
```

---

## Variables d'Environnement Requises

```env
NEXT_PUBLIC_SUPABASE_URL=https://[PROJECT_ID].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SPACES_KEY=DO00...
SPACES_SECRET=...
NEXT_PUBLIC_SPACES_ENDPOINT=https://nyc3.digitaloceanspaces.com
SPACES_BUCKET=nod-files-storage
NEXT_PUBLIC_SPACES_PUBLIC_URL=https://nod-files-storage.nyc3.digitaloceanspaces.com
```

---

## Commandes Utiles

```bash
npm run dev          # Lancer en local
npm run build        # Build de production
npm run lint         # Vérifier les erreurs ESLint
npx tsc --noEmit     # Vérifier les erreurs TypeScript
npm run test:e2e     # Tests Playwright WebKit (iPhone)
git push origin main # Déployer automatiquement sur Vercel
```

---

## Infos Organisation

- **Supabase Org :** Ryan Frizelle test
- **DO Bucket :** `nod-files-storage` (région `nyc3`)
- **GitHub Repo :** `sabrisam/nominees-or-denominees`
- **Forfaits :** Tout gratuit sauf DO Spaces (5$/mois, crédit 200$ disponible)
