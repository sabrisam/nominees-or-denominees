# FICHE TECHNIQUE EXHAUSTIVE DE RÉFÉRENCE — NOD v4.4

## Cartographie Technique et Fonctionnelle Absolue à 360° du Système

---

## 1. ÉTAT DE L'ARCHITECTURE & DES PAGES

### 1.1 Rôle de Routeur d'État et Concentrateur Realtime : `src/app/page.tsx`
Le composant central `src/app/page.tsx` a été restructuré pour abandonner toute logique d'affichage monolithique au profit d'un rôle d'**orchestrateur souverain d'état**, de **gestionnaire de session déterministe** et de **concentrateur d'événements Realtime**.

```
                           src/app/page.tsx (Orchestrateur)
                                          │
       ┌──────────────────┬───────────────┼───────────────┬──────────────────┐
       ▼                  ▼               ▼               ▼                  ▼
  DirectTab             VoteTab       StudioTab      PalmaresTab       PreviewCatalog
(Flux & Urgences)    (Évaluation)    (Création)     (Classements)    (Sandbox Visuelle)
```

#### A. Gestionnaire de Session Déterministe (`initParticipant` & `ensureRoom`)
1. **Initialisation de session Supabase** : Au montage du composant, la fonction `initParticipant()` est déclenchée. Elle appelle `getSupabaseBrowserClient()` et vérifie l'existence d'une session anonyme via `ensureAnonymousSession(client)`.
2. **Création d'identité en cas d'absence** : Si aucune session n'existe, le routeur déclenche `client.auth.signInAnonymously()`. Après succès, la page se recharge pour figer la session dans le client d'exécution.
3. **Résolution déterministe du pseudo et UUID** :
   - Le `voter_id` est extrait de `user.id` (UUID unique généré par Supabase Auth) et sauvegardé dans le localStorage sous la clé `nod_user_device_id`.
   - Le pseudo de l'utilisateur est extrait de `localStorage.getItem("nod_pseudo")`. S'il est vide, le routeur génère automatiquement un pseudonyme déterministe sous la forme `Joueur [ID]` (où `[ID]` représente les 4 premiers caractères de l'identifiant local du dispositif).
4. **Initialisation et persistance de la Room** :
   - Le code du salon de jeu est récupéré via `localStorage.getItem("nod_room_code")` (avec pour valeur de repli `"NOD-CLUB"`).
   - L'appel asynchrone `ensureRoom()` valide ou insère la room en base de données avec une contrainte `ON CONFLICT (code) DO UPDATE` pour récupérer de manière déterministe le `room_id` (UUID Supabase), indispensable pour lier les dossiers créés.

#### B. Concentrateur Realtime WebSocket et Mécanismes de Synchronisation
1. **Souscription au Canal PostgreSQL** : Le routeur établit un canal de communication bidirectionnel via `supabase.channel("nod_room_[ROOM_ID]")` pour écouter en temps réel les mutations de la table `public.nominations` filtrée dynamiquement sur le salon actuel (`filter: "room_id=eq.[ROOM_ID]"`).
2. **Routage des Événements Postgres** :
   - **INSERT** : À l'insertion d'un nouveau dossier par un tiers (où `submitted_by !== participant.id`), le routeur déclenche un avertissement sonore/tactile léger et pousse une notification Toast informative (`"Nouveau dossier à juger."`).
   - **UPDATE / DELETE** : Toute modification de données provoque une mise à jour silencieuse de l'état local via la fonction de synchronisation optimisée `fetchNominations(true)`.
3. **Broadcast de synchronisation interactive** : Le canal écoute également les événements de type `broadcast` (`"nomination"` et `"rating"`) pour propager immédiatement les votes des autres participants sans attendre les cycles de rafraîchissement PostgreSQL.
4. **Double sécurité par Polling** : En cas de défaillance ou de coupure du WebSocket (ex: mise en veille mobile), un intervalle de récupération (`setInterval`) exécute un cycle de synchronisation active toutes les 20 secondes.
5. **Gestion du Stockage Hors-Ligne (Offline Queue)** : Le routeur intègre un mécanisme de résilience locale. Si l'utilisateur soumet une notation alors que la connexion est perdue, le vote est sérialisé sous forme de `PendingRatingPayload` et accumulé dans le stockage persistant (`localStorage.getItem("nod_pending_ratings")`). Un démon interne effectue des tentatives de flush réseau toutes les 30 secondes pour purger la file d'attente dès le retour de la connexion réseau.

---

### 1.2 Inventaire des Modules d'Onglet Isolés (`src/components/tabs/`)

Chaque onglet a été extrait dans un module dédié hautement spécialisé pour réduire le couplage de code et optimiser le rendu React.

| Module d'Onglet | Rôle Fonctionnel Précis | Types de Données Consommés |
| :--- | :--- | :--- |
| **`DirectTab.tsx`** | Flux d'actualités principal de la room. Affiche les dossiers en cours de vote, les nominés validés et les bannières dynamiques d'activité. Intègre le tiroir de triage d'urgence pour inciter les membres à purger les dossiers en attente. | - `feedItems: Nomination[]` (30 max)<br>- `directFilter: DirectFilter` (`all`, `pending`, `qualified`, `elite`, `mine`)<br>- `directFilterCounts: Record<DirectFilter, number>`<br>- `pendingForMe: Nomination[]`<br>- `allNominations: Nomination[]`<br>- `ceremonyCountdown: { days: number, hours: number, mins: number }`<br>- `palmaresRows: PalmaresRow[]`<br>- `activeMemberCount: number` |
| **`VoteTab.tsx`** | Interface immersive de notation d'un dossier. Permet de faire défiler les dossiers en attente de vote par l'utilisateur connecté, d'évaluer sur 5 dimensions, d'appliquer un profil de score rapide, d'ajouter un commentaire de réaction et de soumettre la note. | - `pendingForMe: Nomination[]`<br>- `scoreDraftById: Record<string, DimensionScores>` (Brouillons)<br>- `reviewDraftById: Record<string, string>` (Commentaires)<br>- `voteBusyId: string \| null` (Verrou de transaction)<br>- `shakeId: string \| null` (Animation d'erreur locale)<br>- `ownsNomination: (n: Nomination) => boolean` |
| **`StudioTab.tsx`** | Espace de création et d'édition de dossiers. Gère le glisser-déposer de captures ou vidéos, l'extraction de miniatures de prévisualisation, l'assignation de catégories multiples, la saisie de contexte et la génération de punchline de club via invite IA locale. | - `editingNomination: Nomination \| null` (Mode édition)<br>- `previewUrl: string \| null`<br>- `thumbnailPreviewUrl: string \| null`<br>- `mediaKind: MediaKind \| null` (`video`, `image`)<br>- `isPreparingMedia: boolean` (Compression/Miniature)<br>- `uploadLoading: boolean`<br>- `mediaProgress: number`<br>- `tiktokerName: string`<br>- `cleanCategoryIds: string[]`<br>- `comment: string`<br>- `initialScores: DimensionScores` |
| **`PalmaresTab.tsx`** | Tableau de bord analytique et statistique du club. Fournit un classement dynamique des créateurs par cumul de points, une empreinte émotionnelle globale via graphique SVG Radar, et un diagramme de répartition des catégories sous forme de barre empilée. | - `palmaresRows: PalmaresRow[]` (Tableau de bord agrégé)<br>- `switchTab: (t: Tab) => void`<br>- `reduceMotion: boolean`<br>- `pageTransition: any` |
| **`PreviewCatalog.tsx`** | Sandbox visuelle autonome de revue d'interface (Sandbox OD). Permet aux développeurs d'inspecter et de déboguer localement les états visuels clés du système : grille de dimensions interactive, file vide en conformité totale, et rendu des cartes d'Élite. | - `onClose: () => void` (Sortie de la sandbox)<br>- Gère en interne son propre état réactif de simulation pour les variations de scoring sans affecter la base de données. |

---

## 2. CARTOGRAPHIE COMPLÈTE DES FONCTIONNALITÉS EXTRACTIBLES

### 2.1 Cycle d'Expérience Utilisateur à 360°

```
[Visiteur] ── PWA Silent Loading ──► [Studio] ── Dépôt de Screen/Vidéo (Extraction/WebP) ──► [DB pending]
                                                                                                  │
[Direct] ◄── Seuil (ratings.length >= 2) ◄── [Direct Triage] ◄── Évaluation 5-Axes (VoteTab) ◄────┘
```

#### A. Chargement Silencieux PWA
- **Résilience Mobile** : L'application est configurée pour fonctionner sous forme de PWA avec une zone d'affichage maximisée (`viewport-fit=cover`). Les scripts et fichiers de styles critiques sont servis de manière transparente en tâche de fond.
- **Récupération Transparente** : Lors de l'initialisation, le système vérifie silencieusement l'état du réseau et tente de restaurer la session anonyme sans interrompre l'expérience visuelle brute de l'utilisateur.

#### B. Flux de Soumission via le Studio
1. **Dépôt Média** : L'utilisateur importe un média depuis son appareil (limite stricte de 25 Mo). Le type MIME est analysé et normalisé pour pallier les anomalies d'iOS Photo Library.
2. **Optimisation Automatique Client** :
   - **Images** : Les captures d'écran brutes sont capturées, redimensionnées à un format maximal de 1440x1080 (respectant le ratio d'aspect tout en limitant le poids) puis converties en **WebP** avec un taux de compression de 0.84.
   - **Vidéos** : Le studio instancie silencieusement un élément vidéo hors-écran pour lire les métadonnées et extraire une miniature JPEG (qualité 0.86) capturée à 0.1s de lecture ou dès le décodage du premier flux vidéo stable.
3. **Saisie Éditoriale** : L'utilisateur spécifie le nom du TikToker visé (nettoyé des caractères non autorisés), associe la catégorie adéquate et rédige un court commentaire décrivant le contexte.
4. **Punchline IA (Banter de Club)** : Le studio intègre un utilitaire d'aide à la rédaction exploitant un gabarit de prompt prédéfini (`AI_PROMPT_TEMPLATE`) pour formuler une raillerie urbaine ciblée, directement exploitable pour le banter communautaire.
5. **Transmission Multi-Provider** : Le fichier média optimisé et sa miniature sont envoyés au serveur via la stratégie d'upload hybride avant insertion finale du dossier dans la table `public.nominations` au statut `'pending'`.

#### C. Notation Émotionnelle 5-Axes
- **La Grille Matricielle** : Dans l'onglet **À Voter**, l'utilisateur évalue les dossiers selon 5 axes fondamentaux gradués de 0 à 5 : **Rire** (😂), **Surprise** (🤯), **Gêne** (🤦), **Fierté** (✊), et **Intérêt** (🤔).
- **Notation Assistée** : Des boutons de présélection (presets) permettent d'injecter instantanément des profils types prédéfinis pour accélérer la soumission du vote (ex: "Masterclass" ou "Malaise").

---

### 2.2 Algorithme de Filtrage de l'Onglet "À Voter" (Exclusion des Dossiers)

La sélection des dossiers à afficher pour évaluation dans l'onglet **À Voter** repose sur la variable d'état réactive `pendingForMe`, calculée à chaque mise à jour du flux local de nominations selon trois règles d'exclusion cumulatives et déterministes :

```typescript
const pendingForMe = useMemo(() => {
  if (!participant) return [];
  return nominations.filter((nomination) =>
    // RÈGLE 1 : Le dossier doit être en attente de qualification publique
    nomination.status === "pending" &&
    
    // RÈGLE 2 : L'utilisateur ne peut pas évaluer son propre dossier (Anti-Self-Voting)
    nomination.submitted_by !== participant.id &&
    
    // RÈGLE 3 : L'utilisateur ne doit pas avoir déjà enregistré de vote pour ce dossier
    !nomination.ratings.some((rating) => rating.voter_id === participant.id)
  );
}, [nominations, participant]);
```

1. **Règle 1 : Statut `'pending'` obligatoire** : Un dossier ayant recueilli le nombre requis d'évaluations passe automatiquement au statut `'accepted'` (Nominé) et disparaît de la file de triage active de tous les membres pour basculer dans le flux général validé.
2. **Règle 2 : Anti-Auto-Vote** : Le créateur du dossier (`submitted_by`) est formellement exclu de l'évaluation de son propre screen. Cela évite l'inflation artificielle des scores à la soumission.
3. **Règle 3 : Unicité du vote** : Si une ligne de notation dans la table `ratings` correspond à la paire `(nomination_id, voter_id)` de l'utilisateur connecté, le dossier est masqué instantanément.

---

### 2.3 Rôle et Fonctionnement de la "Sandbox OD" (`PreviewCatalog`)

La sandbox **Open Design Sandbox** intégrée via le module `PreviewCatalog` est un environnement de prévisualisation hermétique servant d'outil d'assurance qualité visuelle et logique en local. Elle s'active via un bouton dédié dans l'en-tête du flux principal.

Ses rôles et simulations intègrent :
1. **Validation en Temps Réel du Scoring** : Elle fournit un curseur interactif lié aux 5 dimensions émotionnelles permettant aux intégrateurs d'observer le résultat exact calculé de la formule de notation selon la catégorie sélectionnée, incluant la démonstration de l'inversion `lowIsStrong`.
2. **Vérification de Conformité Typographique (Zero-Period Policy)** : Elle simule l'état d'absence de dossiers ("FILE VIDE") pour valider visuellement que les messages de statut ne terminent par aucun point final, garantissant le respect strict de la charte de brutalité visuelle.
3. **Revue du Rendu Brutalist Standard** : Permet de tester le gabarit de carte classique avec simulation de flux vidéo fictif, placement des badges et contraintes de débordement de texte.
4. **Banc d'Essai des Effets d'Élite** : Permet de simuler et d'ajuster les performances physiques des **particules dorées actives** (15 émetteurs locaux animés par Framer Motion) montant depuis le bas de la carte, réservées aux dossiers franchissant le seuil critique de points.

---

## 3. FORMULES MATHÉMATIQUES & MOTEUR DE SCORING

### 3.1 Formule de l'Indice d'Impact Émotionnel (0-100)

L'indice d'impact calculé par la fonction `scoreForCategory` dans `src/lib/scoring.ts` évalue l'empreinte sensorielle d'une notation. Contrairement à une simple moyenne arithmétique, elle applique des coefficients de pondération asymétriques selon la typologie du dossier et applique une inversion mathématique sur les dimensions désignées comme contradictoires.

#### Équation Mathématique Formelle

$$\text{Indice d'Impact} = \min\left(100, \max\left(0, \text{round}\left( 20 \times \sum_{d \in D} \text{adjusted}_d \times w_{d,c} \right)\right)\right)$$

Où :
- $D = \{\text{rire, surprise, gene, fierte, interet}\}$ représente l'ensemble des cinq dimensions émotionnelles évaluées.
- $\text{score}_d \in [0, 5] \subset \mathbb{N}$ représente la note brute attribuée à la dimension $d$.
- $\text{adjusted}_d$ représente la note de la dimension après application du filtre d'inversion logique :
  
  $$\text{adjusted}_d = \begin{cases} 
      5 - \text{round}(\text{score}_d) & \text{si } \text{lowIsStrong}_{d,c} \text{ est VRAI} \\ 
      \text{round}(\text{score}_d) & \text{sinon} 
  \end{cases}$$

- $w_{d,c} \in [0, 1] \subset \mathbb{R}$ représente le coefficient de pondération (weight) de la dimension $d$ pour la catégorie $c$, respectant la contrainte de somme unitaire : $\sum_{d \in D} w_{d,c} = 1$.
- Le facteur multiplicateur $20$ projette la note pondérée maximale théorique (qui est de 5) sur une échelle linéaire absolue allant de $0$ à $100$.

---

### 3.2 Matrice Complète des Coefficients de Pondération (Weights)

Voici la répartition exacte des coefficients appliqués par le moteur de calcul pour chacune des 9 catégories officielles :

| Code Catégorie (`id`) | Rire ($w_{\text{rir}}$) | Surprise ($w_{\text{sur}}$) | Gêne ($w_{\text{gên}}$) | Fierté ($w_{\text{fie}}$) | Intérêt ($w_{\text{int}}$) | Inversion Visée (`lowIsStrong`) |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **`le-zin-du-mois`** | 0.18 | 0.18 | 0.12 | 0.32 | 0.20 | Gêne (`gene: true`) |
| **`la-fierte-des-notres`** | 0.10 | 0.14 | 0.22 | 0.34 | 0.20 | Gêne (`gene: true`) |
| **`xptdr`** | 0.46 | 0.20 | 0.18 | 0.04 | 0.12 | Gêne (`gene: true`) |
| **`la-roue-libre`** | 0.30 | 0.34 | 0.14 | 0.04 | 0.18 | Aucun (Neutre) |
| **`la-honte-de-la-oumma`** | 0.07 | 0.10 | 0.55 | 0.25 | 0.03 | **Fierté (`fierte: true`)** |
| **`bon-voyageur`** | 0.12 | 0.28 | 0.10 | 0.14 | 0.36 | Gêne (`gene: true`) |
| **`gros-chef-bandit`** | 0.24 | 0.18 | 0.16 | 0.24 | 0.18 | Gêne (`gene: true`) |
| **`surprise-totale`** | 0.14 | 0.46 | 0.08 | 0.10 | 0.22 | Gêne (`gene: true`) |
| **`lanalyse-pure`** | 0.04 | 0.12 | 0.18 | 0.22 | 0.44 | Gêne (`gene: true`) |

---

### 3.3 Logique et Mécanique de l'Inversion `lowIsStrong`

Le concept de `lowIsStrong` part du principe éditorial que pour certaines thématiques, **la rareté ou la faiblesse d'un sentiment en décuple la valeur**.
- **Exemple de la Gêne sur un Zin ou une Fierté** : Pour qualifier un créateur de "Zin du Mois" ou de "Fierté des Nôtres", la gêne ressentie doit être minimale. Si la gêne est évaluée à $0/5$, sa valeur ajustée devient $5 - 0 = 5/5$, ce qui maximise l'indice d'impact. Si elle vaut $5/5$ (malaise absolu), sa contribution s'effondre à $5 - 5 = 0/5$.
- **Exemple de la Fierté pour "La Honte de la Oumma"** : Dans cette catégorie visant à punir une humiliation publique ou un égarement, la fierté doit être totalement absente. Une fierté notée à $0/5$ par le conseil de vote se traduit mathématiquement par une force maximale de $5/5$ dans le calcul final du score.

```
Note Brute : 0 ── (lowIsStrong activé) ──► Valeur Ajustée : 5 (Maximise l'impact)
Note Brute : 5 ── (lowIsStrong activé) ──► Valeur Ajustée : 0 (Annule la dimension)
```

---

### 3.4 Multiplicateurs Bonus de Points

Une fois l'Indice d'Impact Émotionnel (0-100) déterminé, la fonction `pointsForCategory` applique un facteur multiplicateur multiplicatif selon le niveau de difficulté ou la valeur stratégique de la catégorie sélectionnée pour générer les points définitifs :

$$\text{Points de Notation} = \text{round}(\text{Indice d'Impact} \times \text{Multiplicateur})$$

#### Échelle des Multiplicateurs
- **Multiplicateur x1.5 (Boost Critique 50%)** : Attribué exclusivement à **"La Honte de la Oumma"** (`la-honte-de-la-oumma`). Le malaise communautaire de haut niveau exige une prime de notation majeure pour encourager la recherche de dossiers à fort impact.
- **Multiplicateur x1.2 (Boost Surprise 20%)** : Attribué aux catégories **"Bon Voyageur"** (`bon-voyageur`) et **"Surprise Totale"** (`surprise-totale`). Récompense la découverte d'événements insolites ou d'explorations inattendues.
- **Multiplicateur x1.0 (Neutre)** : Appliqué à toutes les autres catégories classiques (Zin du Mois, Fierté, Xptdr, Roue Libre, Gros Chef Bandit, l'Analyse Pure).

---

### 3.5 Liste des Presets de Note Rapide (`SCORE_PRESETS`)

Cinq configurations de notation rapide sont intégrées dans le composant `ScorePresetRail` pour rationaliser l'évaluation :

1. **`xptdr` (XPTDR - "rire fort")** :
   `{ rire: 5, surprise: 3, gene: 1, fierte: 1, interet: 3 }`
2. **`malaise` (Malaise - "gêne max")** :
   `{ rire: 1, surprise: 2, gene: 5, fierte: 0, interet: 2 }`
3. **`masterclass` (Masterclass - "niveau haut")** :
   `{ rire: 2, surprise: 4, gene: 0, fierte: 5, interet: 4 }`
4. **`choc` (Choc - "surprise")** :
   `{ rire: 2, surprise: 5, gene: 2, fierte: 2, interet: 5 }`
5. **`la-roue-libre` (Roue libre - "chaos")** :
   `{ rire: 4, surprise: 4, gene: 3, fierte: 1, interet: 3 }`

---

### 3.6 Déclencheur Physiques des Effets Visuels (`votBurst`)

À la soumission réussie d'une évaluation, la fonction `voteBurst(points)` évalue l'impact final pour calibrer l'explosion de confettis générée via la librairie `canvas-confetti` :

```typescript
function voteBurst(points: number) {
  const elite = points >= 80;
  const colors = elite
    ? [theme.colors.champagne, theme.colors.champagneSoft, theme.colors.white, theme.colors.void]
    : [theme.colors.champagne, theme.colors.bronze, theme.colors.cream];

  void confetti({
    particleCount: elite ? 118 : 72,
    spread: elite ? 90 : 62,
    startVelocity: elite ? 46 : 34,
    scalar: elite ? 1 : 0.82,
    ticks: 150,
    colors,
    origin: { y: 0.72 },
    disableForReducedMotion: true,
  });
}
```

- **Seuil d'Élite ($\ge 80$ points)** : Déclenche une explosion massive de **118 particules** à large dispersion (90°), vitesse de projection accrue (46) avec une palette luxueuse (or champagne, or clair, blanc pur, noir profond) pour couronner les dossiers d'excellence.
- **Seuil Standard ($< 80$ points)** : Déclenche une salve modérée de **72 particules** à dispersion resserrée (62°), vitesse standard (34) et teintes cuivrées (champagne, bronze, crème).

---

## 4. INFRASTRUCTURE, SÉCURITÉ & CLOUD MATRICE

### 4.1 Synthèse de la Stack Cloud & Services tiers

| Service | Fournisseur / Forfait | Rôle Technique | Limites Clés & Configuration |
| :--- | :--- | :--- | :--- |
| **Supabase** | Hobby (0$) | Base de données relationnelle PostgreSQL, gestion des comptes anonymes, authentification JWT, et flux Realtime WebSocket via réplication logique. | Limite de 500 Mo. Réplication activée sur tables `nominations` et `ratings`. |
| **DigitalOcean Spaces** | S3 object storage (5$/mois) | Stockage primaire et distribution CDN des captures et des fichiers vidéos encodés. | Localisé en zone `nyc3` (New York). Accessible via signature AWS S3 v4. |
| **Vercel** | Hobby (0$) | Hébergement de l'application Next.js 14, exécution des fonctions API sans serveur (API Routes) et orchestration du Cron de purge mensuelle. | Limite d'exécution de 10s par requête sans serveur standard. |
| **GitHub** | Plan Privé (0$) | Dépôt de code source centralisé (`sabrisam/nominees-or-denominees`), protection de branche `main` et intégration continue via webhook. | Déclenchement automatique du déploiement Vercel à chaque push stable. |

---

### 4.2 Stratégie de Stockage Hybride Réglée ("Hybrid Zero-Cost Fallback")

Pour garantir une tolérance absolue aux pannes sans surcoût d'infrastructure, l'utilitaire `uploadMediaFile` dans `src/lib/storage.ts` orchestre un basculement dynamique transparent entre DigitalOcean Spaces et Supabase Storage.

```
                          Fichier importé par l'utilisateur
                                         │
                        ┌────────────────┴────────────────┐
                        ▼                                 ▼
                 [Provider DO Spaces]              [Bucket Supabase 'nod-media']
             Requête POST /api/media/upload        Stockage de secours (Zero-Cost)
             presignedUrl + PUT S3 public-read     Appel direct SDK .upload()
                        │                                 │
                (En cas d'erreur) ────────────────────────┘
```

1. **Tentative DO Spaces (Primaire)** :
   - L'application envoie une requête d'autorisation `POST /api/media/upload` au serveur Next.js en lui passant les détails du fichier.
   - Le serveur valide la session de l'utilisateur anonyme et génère une URL de dépôt pré-signée S3 (`presignedUrl`) pour le bucket `nod-files-storage` en région `nyc3`.
   - Le navigateur convertit le fichier en `ArrayBuffer` (pour contourner le bug des flux de fichiers de WebKit sur les mobiles iOS) et effectue un envoi direct `PUT` avec l'en-tête de lecture publique `"x-amz-acl": "public-read"`.
2. **Basculement Supabase (Secours)** :
   - En cas d'erreur lors de la signature ou du transfert S3 (ex: clés API non définies, quotas DO dépassés, coupures de service), l'utilitaire intercepte l'exception.
   - Il initie instantanément le transfert sur le bucket de secours `"nod-media"` natif de Supabase via le SDK client `supabase.storage.from("nod-media").upload(path, buffer)`.
   - La clé de stockage générée et le format d'insertion en base de données demeurent strictement identiques, évitant tout crash applicatif ou incohérence de schéma en base.

---

### 4.3 Matrice complète des Variables d'Environnement (`.env.local`)

Toutes ces variables doivent être impérativement déclarées dans le fichier de configuration locale pour assurer le fonctionnement nominal du système :

```env
# ─────────────────────────────────────────────────────────────────────────────
# SUPABASE CONFIGURATION (Base de données + Authentification)
# ─────────────────────────────────────────────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=https://[PROJECT_ID].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# ─────────────────────────────────────────────────────────────────────────────
# DIGITALOCEAN SPACES CONFIGURATION (Stockage principal S3-compatible)
# ─────────────────────────────────────────────────────────────────────────────
SPACES_KEY=DO00...
SPACES_SECRET=...
NEXT_PUBLIC_SPACES_ENDPOINT=https://nyc3.digitaloceanspaces.com
SPACES_BUCKET=nod-files-storage
SPACES_REGION=nyc3
NEXT_PUBLIC_SPACES_PUBLIC_URL=https://nod-files-storage.nyc3.digitaloceanspaces.com

# ─────────────────────────────────────────────────────────────────────────────
# SUPABASE STORAGE CONFIGURATION (Stockage secondaire de secours)
# ─────────────────────────────────────────────────────────────────────────────
NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET=nod-media

# ─────────────────────────────────────────────────────────────────────────────
# SYSTEM STAGE METADATA
# ─────────────────────────────────────────────────────────────────────────────
NEXT_PUBLIC_APP_STAGE=development
```

---

### 4.4 Architecture des Tables Database Supabase (`supabase/schema.sql`)

Le schéma de données stocké dans Supabase applique une intégrité référentielle stricte avec verrouillage Row-Level Security (RLS).

```
                      ┌──────────────────────┐
                      │        rooms         │
                      └──────────┬───────────┘
                                 │
                                 ▼ (1:N)
                      ┌──────────────────────┐
                      │     nominations      │◄────────────────┐
                      └──────────┬───────────┘                 │
                                 │                             │ (1:N)
                                 ▼ (1:N)                       │
                      ┌──────────────────────┐      ┌──────────┴──────────┐
                      │       ratings        │      │ monthly_ceremonies  │
                      └──────────────────────┘      └─────────────────────┘
```

#### A. Table `public.rooms` (Les salons de jeu)
Contient les codes uniques permettant de regrouper les évaluations de différentes équipes.
```sql
create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (char_length(code) between 3 and 24),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

#### B. Table `public.nominations` (Les dossiers soumis)
Stocke les dossiers déposés contenant les références des médias et le statut d'acceptation publique.
```sql
create table if not exists public.nominations (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  category_id text not null references public.categories(id),
  category_ids text[] not null default '{}'::text[],
  tiktoker_name text not null check (char_length(tiktoker_name) between 2 and 48),
  media_url text not null,
  video_storage_path text,
  thumbnail_url text,
  thumbnail_storage_path text,
  media_kind text not null default 'image' check (media_kind in ('video', 'image')),
  comment text not null check (char_length(comment) between 3 and 240),
  submitted_by text not null check (char_length(submitted_by) between 8 and 96),
  status public.nomination_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

#### C. Table `public.ratings` (Les évaluations individuelles)
Enregistre les notes détaillées des 5 dimensions attribuées par chaque votant.
```sql
create table if not exists public.ratings (
  id uuid primary key default gen_random_uuid(),
  nomination_id uuid references public.nominations(id) on delete cascade,
  voter_id text not null check (char_length(voter_id) between 8 and 96),
  rating_stars integer check (rating_stars between 0 and 5),
  rating_score numeric(4,2) not null default 0 check (rating_score between 0 and 5),
  rating_points integer not null default 0 check (rating_points between 0 and 100),
  rire_score integer not null default 0 check (rire_score between 0 and 5),
  surprise_score integer not null default 0 check (surprise_score between 0 and 5),
  gene_score integer not null default 0 check (gene_score between 0 and 5),
  fierte_score integer not null default 0 check (fierte_score between 0 and 5),
  interet_score integer not null default 0 check (interet_score between 0 and 5),
  comment text not null default '' check (char_length(comment) between 0 and 180),
  created_at timestamptz not null default now(),
  unique (nomination_id, voter_id) -- Contrainte UNIQUE clé empêchant le double vote
);
```

#### D. Contrainte Critique UNIQUE de Vote
La contrainte `unique (nomination_id, voter_id)` déclarée sur la table `ratings` (et doublée par l'index unique `ratings_nomination_voter_idx`) est le rempart fondamental contre la falsification des résultats.
Elle garantit au niveau transactionnel de PostgreSQL qu'un membre du club (`voter_id`) ne peut déposer **qu'une et une seule ligne d'évaluation** pour un dossier donné (`nomination_id`).
Toute tentative d'insertion ultérieure lèvera une erreur d'intégrité, forçant le moteur Supabase à rediriger la requête vers une mise à jour (`UPDATE`) de la ligne existante, préservant ainsi l'exactitude de la moyenne mathématique globale.

---

## 5. DIRECTIVES, RÈGLES DE CONCEPTION & MOBILE COUVERTURE

### 5.1 Tokens Graphiques et Charte de Typographie (`DESIGN.md`)

Le design de NOD applique une esthétique **Brutaliste-Tabloïde de Luxe** extrêmement typée, reposant sur des contrastes durs, des lignes nettes, des ombres monolithiques et une présence marquée de l'or de luxe champagne.

#### A. Les Tokens Graphiques Imposés
- **Background Principal (`bg-void`)** : Un noir d'encre absolu (`#050505`) servant de fond neutre pour maximiser le contraste des polices dorées et des cartes.
- **Background Structurel des Cartes (`bg-monolith`)** : Un noir mat profond (`#0c0c0c`) appliqué sur tous les panneaux, créant un effet de relief brutalist sans recours à des couleurs claires.
- **Accentuation Luxury Highlight (`text-champagne`, `border-champagne/20`)** : Or champagne classique (`#d4af37`), réservé pour attirer le regard sur les notes élevées, les pillules de catégories et les boutons primaires d'action.
- **Ombrages Brutaux (`shadow-brutal`)** : Une projection d'ombre sans dégradé ni adoucissement : `8px 8px 0px 0px rgba(0, 0, 0, 1)`, donnant aux cartes un aspect découpé et solide.

#### B. Directives de Typographie
- **Typographie Serif (`font-serif` / Georgia)** : Réservée aux titres éditoriaux, aux en-têtes d'actualité, aux scores chiffrés majeurs, et aux noms des TikTokers mis en cause. Apporte une posture de "presse tabloïde à scandale" luxueuse.
- **Typographie Sans-Serif (`font-sans` / SF Pro / Helvetica)** : Utilisée pour les labels techniques, les indicateurs d'état, les boutons de navigation, les petits champs de métadonnées et les descriptions de dossiers pour garantir une lisibilité optimale sur écran mobile.

---

### 5.2 La Politique du Point Final ("Zero-Period Policy")

Afin de préserver le minimalisme brutal de l'interface, les chaînes de texte destinées à être affichées sous forme de **labels autonomes, boutons, indicateurs d'état ou titres indépendants** ne doivent comporter **AUCUN** point final de ponctuation.

#### Exemples de chaînes conformes
- `"FILE VIDE"` (Correct) | `"FILE VIDE."` (INCORRECT - Point terminal rejeté)
- `"AUCUN REC"` (Correct) | `"AUCUN REC."` (INCORRECT - Point terminal rejeté)
- `"VOTE ENREGISTRÉ"` (Correct) | `"VOTE ENREGISTRÉ."` (INCORRECT - Point terminal rejeté)
- `"TRANSMISSION EN COURS"` (Correct) | `"TRANSMISSION EN COURS."` (INCORRECT - Point terminal rejeté)
- `"Sandbox OD"` (Correct) | `"Sandbox OD."` (INCORRECT - Point terminal rejeté)

Les points sont uniquement tolérés à l'intérieur des commentaires rédigés par les utilisateurs sous forme de phrases narratives complètes.

---

### 5.3 Verrous Mobiles de Couverture Mobile (`src/app/globals.css`)

Pour pallier les caprices d'ergonomie propres à iOS Safari et Android Chrome en mode application PWA, NOD injecte plusieurs verrous défensifs directement au cœur de la feuille de styles globale :

#### A. Blocage Strict de l'Auto-Zoom Safari iOS
Pour empêcher iOS d'effectuer un zoom avant intempestif et désagréable lorsque l'utilisateur touche un champ de saisie, les éléments d'interaction textuelle sont verrouillés à une taille minimale absolue de 16 pixels :
```css
input, textarea, select {
  font-size: 16px !important;
  line-height: normal !important;
}
```

#### B. Suppression des Sélections Tactiles et Effets de Surlignement
Pour préserver la sensation d'application native lors des appuis répétés sur les onglets et les boutons, les sélections de textes et les halos bleus de sélection tactiles natifs des navigateurs sont désactivés :
```css
button,
a,
[interactive],
[role="button"],
[role="tab"],
.brutal-card,
.bottom-tabloid {
  -webkit-user-select: none;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}
```

#### C. Lecture Vidéo Inline Forcée
Pour éviter que les clips vidéo TikTok ne s'ouvrent en plein écran natif sur les iPhone, les éléments de lecture vidéo du studio et des cartes sont configurés avec les attributs de lecture en ligne forcée :
```tsx
<video
  playsInline
  webkit-playsinline="true"
  muted
  loop
  preload="metadata"
/>
```

---

### 5.4 Workflow d'Intégration Continue Automatisée (`scripts/watch-push.mjs`)

Pour fluidifier le cycle de développement sans forcer les développeurs à exécuter manuellement des commits à chaque ajustement mineur, NOD v4.4 s'appuie sur le démon réactif `scripts/watch-push.mjs` :

```
             Fichier sauvegardé par le développeur (.tsx, .ts, .css)
                                       │
                                       ▼ (Détection Chokidar)
                             Attente Debounce (800ms)
                                       │
                                       ▼
                             Vérification Git Status
                        (Si modifications réelles détectées)
                                       │
                                 ┌─────┴─────┐
                                 ▼           ▼
                            git add -A    git commit -m "auto: [file] @ [time]"
                                             │
                                             ▼
                                     git push origin main
                                             │
                                             ▼
                                [Auto-Déploiement Vercel]
```

1. **Surveillance Active (Chokidar)** : Le script surveille en permanence la racine du projet, excluant de manière hermétique les répertoires lourds ou volatils (`node_modules`, `.next`, `.git`, `.env*`, `watch-push.mjs`).
2. **Mécanisme de Debounce Élastique (800ms)** : Pour éviter de surcharger les serveurs Git lors de sauvegardes successives rapides, le démon attend une stabilisation d'écriture de 800 millisecondes avant de déclencher l'intégration.
3. **Chaîne de Commits Autorisée** :
   - Il exécute un `git status` pour s'assurer que des changements réels sont en attente.
   - Il procède à un archivage complet via `git add -A`.
   - Il génère automatiquement un commit normalisé horodaté incluant le nom abrégé du fichier responsable (ex: `auto: src/app/page.tsx @ 22:15:30`).
   - Il pousse immédiatement les commits sur la branche de production `main` (`git push origin main`), déclenchant instantanément le cycle de compilation automatique de Vercel.
4. **Charte Graphique de la Console du Démon** : Les logs du démon respectent une palette de couleurs stricte pour une lisibilité souveraine :
   - **GOLD (`\x1b[33m` / 👑)** : Titres de session, en-têtes et avertissements majeurs.
   - **GREEN (`\x1b[32m` / ✅)** : Succès des poussées Git et déploiements validés.
   - **RED (`\x1b[31m` / ❌)** : Erreurs réseau, conflits Git ou rejets d'envoi.
   - **DIM (`\x1b[2m` / ℹ)** : Informations annexes et traces de commandes système secondaires.

---

### 5.5 Historique de Versioning Système

- **v3.0** : Lancement initial de la mécanique de vote et de la room monobloc.
- **v3.4** : Réorientation sémantique complète et introduction du design Tabloïde Dark Gold.
- **v4.0** : Consolidation des jetons (tokens) visuels et intégration globale du framework TailwindCSS.
- **v4.3** : Optimisation finale des images, correction des apostrophes ESLint JSX et stabilisation globale.
- **v4.4 (Version Actuelle)** : Implémentation fonctionnelle complète de la logique `lowIsStrong` dans le moteur de notation `scoreForCategory` (scoring.ts), introduction du module de Sandbox visuelle autonome `PreviewCatalog.tsx`, basculement automatisé de stockage de secours vers le bucket `nod-media` (Supabase), et isolation modulaire complète des onglets de l'application.

---

**Fiche Technique de Référence** : 23 mai 2026  
**Version Système NOD** : v4.4  
**Statut du Document** : SOUVERAIN / PRODUCTION DIRECTE  
