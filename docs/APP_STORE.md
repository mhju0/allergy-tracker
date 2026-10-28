# App Store submission runbook — 이유식 기록 (Allergy Tracker) 3.0.0

Written for a first submission. Steps marked **(you)** need your Apple login or your iPhone.

## 0. Current state (2026-10-28)

- `app.json`: version 3.0.0, build number in `ios.buildNumber`, Korean as the app's language, home-screen name 이유식 기록, export compliance (`usesNonExemptEncryption: false`).
- The demo fixture is excluded from production builds; there is no network code; the privacy manifest declares no collected data.
- Privacy policy and support pages are live at https://mhju0.github.io/allergy-tracker/privacy/ and https://mhju0.github.io/allergy-tracker/support/ (source in `site/`, served from the `gh-pages` branch root). The privacy policy is also linked in the app under 설정.
- Store screenshots (1320 × 2868): `docs/appstore/screenshots/`.
- App Store Connect app exists (Apple ID 6827961276, SKU allergytracker-ios-001). Section 5 below is already entered: listing copy, categories, age rating, price (free), availability (대한민국만; Mac and Vision Pro off), privacy (data not collected, published).

## 1. Publish the pages after a change to `site/`

```bash
git push origin "$(git subtree split --prefix site origin/main)":refs/heads/gh-pages
curl -sI https://mhju0.github.io/allergy-tracker/privacy/   # expect HTTP 200
```

Serving the `main` branch root instead would put the pages at `/allergy-tracker/site/privacy/`, which does not match the in-app link.

## 2. Build and upload to TestFlight

Builds are archived locally with Xcode, which is signed in to the Apple Developer account (team XGY8UN2NYW) and creates the distribution certificate and profile itself. No Expo account is needed. Run one build at a time.

1. Raise `ios.buildNumber` in `app.json` for every upload after the first (App Store Connect rejects a repeated build number), and commit it.
2. From a clean checkout of `main`:

```bash
npm ci && npm run verify
npx expo prebuild --platform ios --clean
xcodebuild -workspace ios/AllergyTracker.xcworkspace -scheme AllergyTracker \
  -configuration Release -destination 'generic/platform=iOS' \
  -archivePath build/AllergyTracker.xcarchive \
  DEVELOPMENT_TEAM=XGY8UN2NYW CODE_SIGN_STYLE=Automatic -allowProvisioningUpdates archive
xcodebuild -exportArchive -archivePath build/AllergyTracker.xcarchive \
  -exportOptionsPlist ExportOptions.plist -allowProvisioningUpdates
```

`ExportOptions.plist` (keep it outside the repo or in `build/`):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>method</key><string>app-store-connect</string>
  <key>destination</key><string>upload</string>
  <key>teamID</key><string>XGY8UN2NYW</string>
  <key>signingStyle</key><string>automatic</string>
</dict></plist>
```

Xcode's Organizer (Product → Archive → Distribute App → App Store Connect) does the same by hand. After 10–30 minutes the build appears under TestFlight. An email titled "ITMS-90078: Missing Push Notification Entitlement" is expected and harmless: the app uses local notifications only.

## 3. TestFlight on your iPhones **(you)**

Internal testing needs no Apple review. App Store Connect → TestFlight → 내부 테스트 그룹: add yourself; every new build then appears in the TestFlight app on your phones. Check:

1. The home-screen name reads 이유식 기록.
2. Start a food. The notification permission prompt appears, in Korean.
3. A reminder notification arrives at the scheduled time. Test the 이상 없음 button on the notification with the app fully closed, then open the app: that day is recorded.
4. 설정 → 진료용 리포트 만들기: the PDF opens in the share sheet, with the footer line at the bottom.
5. 설정 → 개인정보 처리방침 opens the policy page.
6. Send a test mail to mj.apps.support@gmail.com and confirm it arrives.

## 4. App Review contact **(you)**

Version 3.0.0 page → 앱 심사 정보: contact Min Hyun Ju, mj.apps.support@gmail.com, your phone; sign-in not required; notes below. Type the email yourself and save.

## 5. App Store page values (entered 2026-10-28; kept for reference)

### 앱 정보
- 부제: **한 번에 한 재료, 3일 관찰 기록**
- 카테고리: 기본 **건강 및 피트니스**, 보조 **라이프스타일**
- 콘텐츠 권한: 타사 콘텐츠를 포함하지 않음
- 연령 등급 questionnaire: answer **None / No** to everything except **Medical or Treatment Information: Infrequent** and **Health or Wellness Topics: Yes**. Expected rating 13+, which is fine for a parent's app. **Made for Kids: No.** Do not choose the Kids category; it cannot be undone after approval.
- If App Store Connect asks whether this is a regulated medical device: **No**.

### 가격 및 사용 가능 여부
- 가격: 무료
- 사용 가능 국가: **대한민국만**

### 앱 개인정보 보호
- 개인정보 처리방침 URL: https://mhju0.github.io/allergy-tracker/privacy/
- 데이터 수집: **아니요, 이 앱에서 데이터를 수집하지 않습니다** → 게시

### 버전 3.0.0 페이지
- 스크린샷: upload the files in `docs/appstore/screenshots/` to the 6.9" iPhone slot (App Store Connect scales them for smaller phones).
- 프로모션 텍스트, 설명, 키워드: below.
- 지원 URL: https://mhju0.github.io/allergy-tracker/support/
- 마케팅 URL: leave empty
- 저작권: 2026 Min Hyun Ju
- 빌드: choose the TestFlight build
- 앱 심사 정보: 로그인 필요 해제; contact = your name, mj.apps.support@gmail.com, your phone (+82…); 메모 = the review notes below.
- 버전 출시: 수동 출시 (you press release after approval) or 자동 — your choice.

### Korean law compliance (if prompted)
If App Store Connect shows 비즈니스 → 규정 준수 → 대한민국 법률, fill in the contact details it asks for. Apple shows them on Korean product pages under the 전자상거래법.

## 6. Submit
Press **심사에 추가** → **심사를 위해 제출**. Review usually takes 1–3 days. If Apple sends a question or rejection, paste it into a Claude session in this repo.

## 7. After approval
```bash
git tag -a v3.0.0 -m "App Store release 3.0.0" && git push origin v3.0.0
```

---

## Listing copy (final)

**이름 (30자 이내):** 이유식 기록 - 새 재료 반응 노트
**부제 (30자 이내):** 한 번에 한 재료, 3일 관찰 기록

**프로모션 텍스트 (170자 이내):**
이유식 새 재료를 한 가지씩 시작하고, 3일 동안 하루 한 번 아기의 상태를 기록해요. 모든 기록은 이 기기에만 저장돼요.

**설명:**
이유식에 새 재료를 더할 때, 한 번에 한 가지씩 시작해 며칠 동안 아기의 상태를 지켜보는 보호자를 위한 기록 앱이에요.

• 재료를 고르면 3일 관찰 기록이 시작돼요
• 하루 한 번 ‘이상 없음’을 누르거나, 증상이 있었다면 증상·정도·시각·메모를 남겨요
• 관찰 기간이 끝나면 지켜본 결과대로 기록을 마무리해요
• 120가지 이유식 재료를 기록 상태별로 한눈에 볼 수 있어요
• 캘린더에서 지난 관찰과 반응을 날짜별로 돌아봐요
• 진료 때 보여 줄 수 있도록 기록을 PDF로 정리하고, 전체 기록을 JSON 파일로 내보낼 수 있어요
• 매일 기록할 시간을 알림으로 알려 드려요

회원가입이 없고, 앱은 어떤 서버로도 기록을 보내지 않아요. 내보내기를 직접 선택할 때만 기록이 공유돼요.

이 앱은 보호자의 기록을 돕는 도구예요. 알레르기를 진단하거나 감지하지 않고, 의학적 조언을 하지 않아요. 이유식이나 알레르기가 걱정되면 소아청소년과 의사와 상담하고, 숨쉬기 힘들어하는 등 증상이 심하면 바로 119에 연락해 주세요.

**키워드 (100자 이내, 쉼표, 띄어쓰기 없음):**
알레르기,식품알레르기,아기,육아,첫이유식,초기이유식,일지,두드러기,진료,리포트,유아식,식단,음식,돌아기

(57 characters. If App Store Connect reports the field as too long, it is counting bytes: remove words from the end until it accepts.)

**스크린샷 캡션 (선택):**
1. 오늘의 관찰 — 하루 한 번, 이상 없음 기록
2. 재료 — 120가지 재료를 상태별로
3. 재료 상세 — 관찰 진행과 먹이기 전 참고
4. 반응 기록 — 증상이 있었다면 바로 기록
5. 캘린더 — 날짜별 관찰과 반응
6. 설정 — 진료용 리포트와 개인정보

**앱 심사 메모 (English):**
Korean-language record-keeping app for parents introducing new foods to their baby one at a time. It does not diagnose, detect, or give medical advice. Parents record what they observe and can share a PDF summary with their pediatrician; the app reminds users to consult a pediatrician and to call 119 (Korean emergency number) for severe symptoms.
All data stays on the device (SQLite). No account, no server, no analytics, no network access. Notifications are local daily reminders scheduled on-device (no push).
How to test: 1) Launch and tap 시작하기 on the welcome card. 2) Tap 새 재료 시작하기 and choose any food (e.g. 쌀); a 3-day observation starts. 3) On the home screen tap 오늘 이상 없음 기록하기, or 증상이 있었어요 to log a reaction (selecting 호흡 곤란·쉰 울음소리 shows the 119 guidance). 4) The window is a fixed 3 days, so the final status appears after day 3; the food detail (기록 보기) and the calendar show history. 5) 설정 → 진료용 리포트 만들기 creates a PDF via the share sheet. The disclaimer and the privacy policy link are in 설정.
