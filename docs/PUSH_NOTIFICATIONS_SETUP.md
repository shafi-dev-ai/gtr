# Push Notifications Setup Guide

## ✅ What's Already Done

1. ✅ `expo-notifications` package installed
2. ✅ Push notification service created (`src/services/pushNotifications.ts`)
3. ✅ Device token registration on login
4. ✅ Device token unregistration on logout
5. ✅ Badge count syncing
6. ✅ Notification listeners set up in `App.js`
7. ✅ `app.json` configured for notifications

## 📋 Next Steps

### Step 1: Run Database Migration

Run this SQL script in Supabase SQL Editor:
```bash
docs/add_push_notifications_setup.sql
```

This creates the `user_device_tokens` table to store device tokens.

### Step 2: Rebuild Native Code

Since we added a native module (`expo-notifications`), you need to rebuild:

**For iOS:**
```bash
npm run prebuild:ios
# Then open in Xcode and build
```

**For Android:**
```bash
npm run prebuild:android
# Then build in Android Studio or run: npm run android
```

### Step 3: Set Up Push Notification Service (Backend)

You need a backend service to send push notifications. You have two options:

#### Option A: Supabase Edge Functions (Recommended)
Create a Supabase Edge Function that:
1. Listens to database changes (via webhooks or triggers)
2. Fetches device tokens for the target user
3. Sends push notifications via Expo Push Notification Service

#### Option B: External Service
Use a service like:
- OneSignal
- Firebase Cloud Messaging (FCM)
- Pusher Beams

### Step 4: Configure Expo Push Notification Service

1. **Create Expo account** (if you don't have one):
   ```bash
   npx expo login
   ```

2. **Get your Expo push token**:
   - The app will automatically get device tokens
   - These are Expo push tokens (not native APNs/FCM tokens)
   - Expo handles the conversion

3. **Test push notifications**:
   ```bash
   npx expo push:send --to <EXPO_PUSH_TOKEN> --title "Test" --body "Hello!"
   ```

### Step 5: Production Setup

For production, you'll need:

**iOS:**
- Apple Developer account ($99/year)
- APNs (Apple Push Notification service) certificates
- Configure in `app.json`:
  ```json
  "ios": {
    "config": {
      "usesNonExemptEncryption": false
    }
  }
  ```

**Android:**
- Firebase project
- FCM server key
- Configure in `app.json`:
  ```json
  "android": {
    "googleServicesFile": "./google-services.json"
  }
  ```

## 🔧 How It Works

1. **User logs in** → Device token is registered in `user_device_tokens` table
2. **Notification created** → Database trigger creates notification record
3. **Backend service** → Detects new notification, fetches user's device tokens
4. **Push sent** → Backend sends push via Expo Push Notification Service
5. **App receives** → Notification appears even when app is closed

## 📱 Testing

### Test Device Token Registration:
1. Log in to the app
2. Check Supabase `user_device_tokens` table - you should see your device token

### Test Badge Count:
1. Create a notification (favorite a listing, RSVP to event, etc.)
2. Check app icon badge count updates

### Test Push Notification:
1. Use Expo CLI to send a test notification:
   ```bash
   npx expo push:send --to <YOUR_EXPO_PUSH_TOKEN> --title "Test" --body "Hello World!"
   ```

## 🚨 Important Notes

- **Development**: Push notifications work with Expo Go, but you need a development build for production
- **Permissions**: Users must grant notification permissions (handled automatically)
- **Badge Count**: Updates automatically when unread count changes
- **Navigation**: When user taps notification, app navigates to relevant screen (TODO: implement navigation)

## 📝 TODO

- [ ] Create Supabase Edge Function for sending push notifications
- [ ] Implement navigation when notification is tapped
- [ ] Add notification preferences/settings screen
- [ ] Set up production APNs/FCM credentials
- [ ] Test on physical devices (iOS & Android)

## 🔗 Resources

- [Expo Notifications Docs](https://docs.expo.dev/versions/latest/sdk/notifications/)
- [Expo Push Notification Service](https://docs.expo.dev/push-notifications/push-notifications-setup/)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)

