# Remove Expo/EAS Migration Playbook

Plan to refactor this app off Expo/EAS while keeping Supabase, Apple (APNs), and Google Play/FCM. Follow the phases in order; each phase has concrete steps and file touchpoints.

## Scope and Decisions
- Target: bare React Native 0.81 with no Expo runtime/EAS.
- Push: native APNs (iOS) and FCM (Android). Supabase Edge Function sends pushes.
- Auth: keep Supabase auth; replace Expo auth helpers with native SDKs.
- Env/config: no `expo-constants`/`app.json` reliance. Use `react-native-config` or a small config module.
- Builds: Xcode/Android Studio (or your CI), not EAS.

## Phase 0: Prep
1. Create a migration branch (keep current Expo build intact).
2. Inventory Expo usage to replace:
   - `expo`, `expo-constants`, `expo-linking`
   - `expo-image-picker`, `expo-file-system`, `expo-image`, `expo-image-manipulator`
   - `expo-notifications`, `expo-status-bar`
3. Gather credentials:
   - Apple: bundle id `com.gtr.marketplace`, APNs key (.p8), provisioning profiles/certs.
   - Google: Play Console, FCM server key, prod `google-services.json`, `GoogleService-Info.plist` (for iOS FCM bridge).
   - Supabase: prod URL and anon key for client; service role key stored server-side.
4. Decide env loader: `react-native-config` (recommended) vs simple JS config file.
5. Decide notification display lib: pure FCM listeners vs FCM + Notifee (if you need channels/badges control on Android).

## Phase 1: Replace Config/Linking
1. Remove `expo-constants` usage:
   - Update `src/services/supabase.ts` to read from your chosen config (`react-native-config` or a constants module).
   - Add `.env` schema for `SUPABASE_URL`, `SUPABASE_ANON_KEY`.
2. Replace `expo-linking`:
   - Use React Native `Linking` for deep links.
   - Update Android `AndroidManifest.xml` intent-filters for `gtr-marketplace://`.
   - Update iOS URL Types in Xcode for `gtr-marketplace`.

## Phase 2: Media and UI Modules
1. Replace `expo-image-picker` with `react-native-image-picker`:
   - Touchpoints: `src/services/storage.ts`, screens importing Expo picker (listings/events/forum/profile).
2. Replace file/image utilities:
   - `expo-file-system` → `react-native-fs`.
   - `expo-image-manipulator` → `react-native-image-resizer` (or similar).
   - `expo-image` → React Native `<Image>` (or `react-native-fast-image` if desired).
3. Replace `expo-status-bar` with `StatusBar` from `react-native`.

## Phase 3: Push Notifications (native)
1. Install native push stack:
   - `@react-native-firebase/app`, `@react-native-firebase/messaging`
   - Optional: Notifee (for richer notification handling).
2. Android:
   - Keep `android/app/google-services.json`; add Firebase Gradle plugins/config.
   - Add notification permission (Android 13+), set up a default channel.
3. iOS:
   - Add push entitlements; include `GoogleService-Info.plist` if using FCM bridge.
   - Upload APNs key to Apple; if using FCM for iOS, upload APNs key there too.
   - Add `Info.plist` strings: camera, photo library, notifications, tracking (if applicable).
4. Update `src/services/pushNotifications.ts`:
   - Remove Expo token logic/projectId checks.
   - Use `messaging().getToken()` for device tokens (FCM/APNs).
   - Keep Supabase registration to `user_device_tokens`.
   - Add tap listeners to navigate into the app on notification press.
5. Supabase Edge Function:
   - Send to FCM (can deliver to iOS if APNs key is in Firebase) or to APNs directly.
   - Store secrets (FCM server key, APNs key) in Supabase secrets.

## Phase 4: Auth/OAuth
1. Replace Expo auth helpers with native SDKs:
   - Google: `@react-native-google-signin/google-signin`
   - Facebook: FB SDK
   - Apple: AppleAuth
2. Wire to Supabase OAuth endpoints; ensure redirect URI `gtr-marketplace://` is registered in native configs.
3. Implement `handleSocialLogin` in `LoginScreen.tsx`/`RegisterScreen.tsx`.

## Phase 5: Build and Tooling
1. Remove EAS commands from `package.json`; add RN CLI scripts (`react-native run-ios`, `run-android`).
2. iOS:
   - Configure signing (profiles/certs) in Xcode.
   - Set bundle id `com.gtr.marketplace`.
   - Verify push entitlements and URL scheme.
3. Android:
   - Configure keystore and Gradle signing configs.
   - Verify package id `com.gtr.marketplace`, deep links, notification channel, permissions.
4. Env injection:
   - For CI or local, load `.env` via `react-native-config` or your config module.

## Phase 6: QA and Cutover
1. Physical device testing (release-like builds):
   - Auth (email + OAuth), push receive/tap, deep links (signup/recovery), media uploads, messaging, listings/events/forum, badge counts.
2. Build release artifacts:
   - iOS: Xcode archive → IPA for TestFlight.
   - Android: release AAB/APK signed with keystore.
3. Store metadata:
   - Privacy policy/ToS URLs, data collection statements (no Expo services), permission justifications.
4. Submit as next app update; users install the new non-Expo build normally.

## Notes and Tips
- Keep the current Expo/EAS version tagged so you can compare behaviors.
- Migrate in small PRs per phase (config, media, push, auth, build) to reduce risk.
- If you keep OTA, choose an alternative (e.g., CodePush); otherwise, all updates go through the stores.
