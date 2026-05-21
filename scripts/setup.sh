#!/bin/bash
# NOD — Setup initial complet
# Lance ce script une seule fois après avoir cloné le projet
# Usage : bash scripts/setup.sh

set -e

GOLD='\033[0;33m'
GREEN='\033[0;32m'
NC='\033[0m'
BOLD='\033[1m'

echo -e "\n${GOLD}${BOLD}👑 NOD — Setup initial${NC}"
echo -e "${GOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

# 1. Installer les dépendances
echo -e "${GOLD}1.${NC} Installation des dépendances..."
npm install
echo -e "   ${GREEN}✓ node_modules installé${NC}"

# 2. Vérifier .env.local
if [ ! -f ".env.local" ]; then
  cp .env.example .env.local
  echo -e "   ${GREEN}✓ .env.local créé depuis .env.example${NC}"
  echo -e "   ⚠️  Remplis les clés DO Spaces dans .env.local"
else
  echo -e "   ${GREEN}✓ .env.local existe déjà${NC}"
fi

# 3. Vérifier git remote
REMOTE=$(git remote get-url origin 2>/dev/null || echo "ABSENT")
if [[ "$REMOTE" == *"nominees-or-denominees"* ]]; then
  echo -e "   ${GREEN}✓ GitHub remote: ${REMOTE}${NC}"
else
  echo -e "   ⚠️  Remote GitHub non configuré"
  echo -e "   Lance: git remote add origin https://github.com/sabrisam/nominees-or-denominees.git"
fi

# 4. Vérifier git config
git config user.email > /dev/null 2>&1 || git config --global user.email "sabrisam@github.com"
git config user.name > /dev/null 2>&1 || git config --global user.name "sabrisam"

echo ""
echo -e "${GOLD}${BOLD}Setup complet ! Commandes disponibles :${NC}"
echo -e ""
echo -e "  ${GOLD}npm run dev${NC}          → Serveur local (localhost:3000)"
echo -e "  ${GOLD}npm run watch:push${NC}   → Auto-push chaque modification"
echo -e "  ${GOLD}npm run dev:full${NC}     → Les deux en même temps"
echo -e "  ${GOLD}npm run build${NC}        → Build de production"
echo -e "  ${GOLD}npm run lint${NC}         → Vérification ESLint"
echo -e ""
