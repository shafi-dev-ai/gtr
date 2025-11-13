# Phone Verification Implementation Guide

## Overview

The backend now supports phone number storage and verification. This guide explains the recommended approach and implementation details.

## ✅ What's Already Set Up

1. **Profiles Table** includes:
   - `phone_number` TEXT - Stores phone number (private)
   - `phone_verified` BOOLEAN - Verification status (default: FALSE)

2. **Auto Profile Creation** (`handle_new_user()` function):
   - Automatically creates profile when user signs up
   - Extracts phone number from signup data if provided
   - Handles OAuth signups (Google, Apple, etc.)
   - Extracts name, email, avatar from OAuth providers

## 📱 Recommended Approach: **Option 2 - Verify in Profiles Section**

### Why Option 2 is Better:
- ✅ **Better UX**: Users can start using the app immediately after email verification
- ✅ **Less friction**: Don't block signup flow with phone verification
- ✅ **Optional verification**: Users can verify phone when they need it (e.g., for listings)
- ✅ **Flexible**: Can make phone verification required for certain features later

### Implementation Flow:

```
1. User signs up → Email verification (Supabase handles this)
2. Profile auto-created with email, name, avatar (from OAuth if applicable)
3. User can use app immediately
4. User goes to Profile Settings → Add/Verify Phone Number
5. Phone verification flow:
   - User enters phone number
   - Send verification code (via SMS)
   - User enters code
   - Update phone_number and set phone_verified = TRUE
```

## 🔐 Phone Number Privacy

**Important**: Phone numbers are private and should only be visible to the user themselves.

### Frontend Implementation:

When displaying profiles, mask phone numbers for other users:

```typescript
// Example: In your profile component
const displayPhone = (profile: Profile, currentUserId: string) => {
  if (profile.id === currentUserId) {
    return profile.phone_number; // Show full number to owner
  }
  return profile.phone_number ? '***-***-****' : null; // Mask for others
};
```

### Database Security:

- RLS policies allow viewing profiles, but frontend should mask `phone_number` for non-owners
- Users can only update their own phone_number
- Consider adding a database function later to mask phone numbers at DB level if needed

## 📋 Implementation Steps

### 1. Frontend: Phone Verification Service

Create `src/services/phoneVerification.ts`:

```typescript
import { supabase } from './supabase';

export const phoneVerificationService = {
  // Send verification code
  async sendVerificationCode(phoneNumber: string) {
    // Use Supabase Auth phone verification
    const { data, error } = await supabase.auth.signInWithOtp({
      phone: phoneNumber,
    });
    return { data, error };
  },

  // Verify code and update profile
  async verifyPhone(phoneNumber: string, code: string) {
    // Verify the code
    const { data: authData, error: authError } = await supabase.auth.verifyOtp({
      phone: phoneNumber,
      token: code,
      type: 'sms',
    });

    if (authError) throw authError;

    // Update profile with verified phone
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not found');

    const { data, error } = await supabase
      .from('profiles')
      .update({
        phone_number: phoneNumber,
        phone_verified: true,
      })
      .eq('id', user.id)
      .select()
      .single();

    return { data, error };
  },

  // Update phone number (requires re-verification)
  async updatePhoneNumber(phoneNumber: string) {
    // Send new verification code
    return this.sendVerificationCode(phoneNumber);
  },
};
```

### 2. Frontend: Phone Verification Screen

Create `src/screens/profile/PhoneVerificationScreen.tsx`:

```typescript
import React, { useState } from 'react';
import { View, TextInput, Button } from 'react-native';
import { phoneVerificationService } from '../../services/phoneVerification';

export const PhoneVerificationScreen = () => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'verify'>('phone');
  const [loading, setLoading] = useState(false);

  const handleSendCode = async () => {
    setLoading(true);
    try {
      await phoneVerificationService.sendVerificationCode(phoneNumber);
      setStep('verify');
    } catch (error) {
      console.error('Error sending code:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    setLoading(true);
    try {
      await phoneVerificationService.verifyPhone(phoneNumber, code);
      // Navigate back or show success
    } catch (error) {
      console.error('Error verifying code:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View>
      {step === 'phone' ? (
        <>
          <TextInput
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            placeholder="Enter phone number"
            keyboardType="phone-pad"
          />
          <Button title="Send Verification Code" onPress={handleSendCode} disabled={loading} />
        </>
      ) : (
        <>
          <TextInput
            value={code}
            onChangeText={setCode}
            placeholder="Enter verification code"
            keyboardType="number-pad"
          />
          <Button title="Verify Code" onPress={handleVerifyCode} disabled={loading} />
        </>
      )}
    </View>
  );
};
```

### 3. Supabase Configuration

In Supabase Dashboard:

1. **Enable Phone Auth**:
   - Go to Authentication → Providers
   - Enable "Phone" provider
   - Configure SMS provider (Twilio, MessageBird, etc.)

2. **Set up SMS Provider**:
   - Add your SMS provider credentials
   - Configure message templates

## 🔄 Alternative: Option 1 (Verify During Signup)

If you prefer to verify phone during signup:

### Flow:
```
1. User enters email → Verify email
2. User enters phone → Send SMS code
3. User enters code → Verify phone
4. Create account → Profile auto-created with verified phone
```

### Implementation:
- Add phone input to signup form
- After email verification, prompt for phone
- Send verification code
- Verify code before completing signup
- Profile will be created with `phone_verified: true`

**Note**: This adds friction to signup but ensures all users have verified phones.

## 📝 OAuth Signup Handling

The `handle_new_user()` function automatically handles OAuth signups:

- **Google**: Extracts name, email, avatar_url, picture
- **Apple**: Extracts name, email
- **GitHub**: Extracts username, name, avatar_url

Phone numbers from OAuth providers are not typically available, so users will need to add/verify phone in the profile section.

## ✅ Summary

**Recommended**: Use **Option 2** (verify in profiles section)
- Better user experience
- Less signup friction
- More flexible
- Phone verification can be required for specific features later

The backend is ready - just implement the frontend phone verification flow using Supabase Auth's phone verification feature.

