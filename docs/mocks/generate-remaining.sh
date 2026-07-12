#!/usr/bin/env bash
# Generate the remaining hybrid mock screens (blocked 2026-07-13: not_enough_credits).
# Prereq: higgsfield CLI logged in + credits topped up. Run from repo root:
#   bash docs/mocks/generate-remaining.sh
set -euo pipefail
cd "$(dirname "$0")/../.."

gen() { # gen <output-name> <reference-image> <prompt>
  local out="docs/mocks/hybrid/$1"; shift
  local ref="$1"; shift
  echo "── generating $out"
  local url
  url=$(higgsfield generate create gpt_image_2 --image "$ref" --prompt "$1" \
    --aspect_ratio 9:16 --resolution 2k --wait | grep -oE 'https://[^"[:space:]]+' | head -1)
  curl -sL "$url" -o "$out"
  echo "saved $out"
}

gen reports.png docs/mocks/hybrid/ingredients.png "Reports screen 리포트 of a Korean baby-food allergy app, styled as the baby's food passport. KEEP the passport-booklet and rubber-stamp visual language from the reference, BUT on a pale rose app shell: background #FFF8F7 with subtle warm grain, white rounded cards with soft terracotta-tinted shadows, deep terracotta #9E4037 accents. Content top to bottom: screen title 리포트, hero card with the dark FOOD PASSPORT booklet (baby laurel emblem, JIHU) next to summary lines 안심 12 · 관찰 중 1 · 반응 0 and 기록 기간 2024.03 ~ 오늘, a row of small collected ingredient stamps preview, a monthly summary card 5월 관찰 리포트 (새로 안전 확정 3 · 반응 0), coral #FF8B7D pill CTA PDF 내려받기 with download icon, secondary text button 진료 시 공유. 5-tab bottom nav 홈 도감 관찰 리포트(active, coral pill) 프로필. Clean readable Korean typography, premium calm mobile health app, full-screen layout, no device frame."

gen allergy-timeline.png docs/mocks/hybrid/home.png "Same app, same design system as the reference: allergy observation history screen 알레르기 기록. Vertical timeline down the left with a thin terracotta spine and colored event dots, grouped by date labels 오늘 / 어제 / 5월 14일. Event cards: 소고기 테스트 시작 (amber dot, 관찰 1일차), 이상 없음 기록 · 오전 09:30 (green check dot), 발진 기록 · 오후 8:12 with a small rounded photo thumbnail (red dot, soft red card tint), 당근 테스트 완료 → 안전 확정 (green dot with small green stamp mark). Horizontal filter chips at top: 전체 / 소고기 / 당근. Keep the pale rose background #FFF8F7, white rounded cards, coral #FF8B7D accents, deep terracotta #9E4037 text accents, traffic-light dot semantics. 5-tab bottom nav 홈 도감 관찰(active, coral pill) 리포트 프로필. Clean readable Korean typography, calm premium mobile health app, full-screen layout, no device frame."

gen ingredient-detail.png docs/mocks/hybrid/home.png "Same app, same design system as the reference: ingredient detail screen for 달걀노른자 (egg yolk). Large appetizing editorial photo of egg yolk purée in a rounded frame at top with a soft fade into the pale rose background, below it: title 달걀노른자 with green status chip 안전 and a small green ink stamp mark, reassurance line 마지막 테스트에서 이상 반응이 없었어요 in muted text, info rows with small icons: 추천 시기 · 생후 6개월 이후, 흔한 알레르겐 · 주의 필요, a soft red-tinted warning card 교차반응 주의: 달걀흰자 with small alert icon, test history card 테스트 이력 · 2회 · 마지막 2024.05.02 (each row with green check), bottom cautious secondary button 다시 테스트하기 (outlined terracotta, NOT coral filled). Pale rose #FFF8F7 background, white rounded cards with terracotta-tinted shadows, coral #FF8B7D reserved for primary actions only. 5-tab bottom nav 홈 도감(active, coral pill) 관찰 리포트 프로필. Clean readable Korean typography, calm premium mobile health app, full-screen layout, no device frame."

gen onboarding.png docs/mocks/hybrid/home.png "Same app brand as the reference: first-run welcome / login screen. Top two-thirds: warm editorial photograph of baby-food preparation on a wooden table (small purée bowls, fresh vegetables, soft morning light) fading gently into the pale rose background #FFF8F7 at the bottom. Brand wordmark MammaCare in deep terracotta #9E4037, tagline below in Korean: 한 재료씩, 안전하게, 놓치지 않게. Then login buttons stacked with comfortable spacing: 카카오로 시작하기 (Kakao yellow pill with dark text), 네이버로 시작하기 (Naver green pill, white text), Google로 시작하기 (white pill with thin border), text link 이메일로 시작하기 underneath. Single focal point, very generous spacing, calm and premium, no bottom navigation, clean readable Korean typography, full-screen mobile app layout, no device frame."

echo "done — update the coverage table in docs/mocks/README.md"
