import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { authService } from '../../services/auth';
import { useResendEmail } from '../../hooks/useResendEmail';

interface VerifyOTPScreenProps {
  navigation?: any;
  route?: any;
}

export const VerifyOTPScreen: React.FC<VerifyOTPScreenProps> = React.memo(({ navigation, route }) => {
  const email = route?.params?.email || '';
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const inputRefs = useRef<(TextInput | null)[]>([]);

  const {
    resendCooldown,
    resendCount,
    isResending,
    error: resendError,
    handleResend,
    remainingResends,
  } = useResendEmail({
    email,
    resendFunction: authService.resetPasswordForEmail,
    storagePrefix: 'password_reset',
  });

  const handleOtpChange = useCallback((value: string, index: number) => {
    if (!/^\d*$/.test(value)) return; // Only allow digits

    const newOtp = [...otp];
    newOtp[index] = value.slice(-1); // Only take last character
    setOtp(newOtp);
    setError(null);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }, [otp]);

  const handleKeyPress = useCallback((e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }, [otp]);

  const handleVerify = useCallback(async () => {
    const otpCode = otp.join('');
    
    if (otpCode.length !== 6) {
      setError('Please enter the complete 6-digit code');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: verifyError } = await authService.verifyOTP(email, otpCode);

      if (verifyError) {
        setError('Invalid code. Please try again.');
        setLoading(false);
        return;
      }

      if (data?.session) {
        // Navigate to reset password screen
        navigation?.navigate('ResetPassword', { email });
      }
    } catch (err: any) {
      setError('Unable to verify code. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [otp, email, navigation]);

  const handleBack = useCallback(() => {
    navigation?.navigate('ForgotPassword');
  }, [navigation]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.iconContainer}>
            <Ionicons name="key-outline" size={64} color="#DC143C" />
          </View>

          <Text style={styles.heading}>Enter Verification Code</Text>
          <Text style={styles.subtitle}>
            We've sent a 6-digit code to
          </Text>
          <Text style={styles.emailText}>{email}</Text>

          <View style={styles.otpContainer}>
            {otp.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => { inputRefs.current[index] = ref; }}
                style={[styles.otpInput, error && styles.otpInputError]}
                value={digit}
                onChangeText={(value) => handleOtpChange(value, index)}
                onKeyPress={(e) => handleKeyPress(e, index)}
                keyboardType="number-pad"
                maxLength={1}
                selectTextOnFocus
                editable={!loading}
              />
            ))}
          </View>

          {(error || resendError) && (
            <Text style={styles.errorText}>{error || resendError}</Text>
          )}

          <TouchableOpacity
            style={[styles.verifyButton, loading && styles.verifyButtonDisabled]}
            onPress={handleVerify}
            disabled={loading || otp.join('').length !== 6}
          >
            <Text style={styles.verifyButtonText}>
              {loading ? 'Verifying...' : 'Verify Code'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.resendButton,
              (resendCooldown > 0 || resendCount >= 3 || isResending) && styles.resendButtonDisabled,
            ]}
            onPress={handleResend}
            disabled={resendCooldown > 0 || resendCount >= 3 || isResending}
          >
            <Text style={styles.resendButtonText}>
              {isResending
                ? 'Sending...'
                : resendCooldown > 0
                ? `Resend Code (${resendCooldown}s)`
                : resendCount >= 3
                ? 'Daily Limit Reached'
                : 'Resend Code'}
            </Text>
          </TouchableOpacity>

          {resendCount > 0 && resendCount < 3 && (
            <Text style={styles.resendCountText}>
              {remainingResends} resend{remainingResends !== 1 ? 's' : ''} remaining today
            </Text>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
});

VerifyOTPScreen.displayName = 'VerifyOTPScreen';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#181920',
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
    alignItems: 'center',
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 32,
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  iconContainer: {
    marginBottom: 32,
  },
  heading: {
    fontSize: 24,
    fontFamily: 'Rubik',
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Rubik',
    fontWeight: '400',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  emailText: {
    fontSize: 16,
    fontFamily: 'Rubik',
    fontWeight: '600',
    color: '#DC143C',
    marginBottom: 40,
    textAlign: 'center',
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  otpInput: {
    width: 48,
    height: 56,
    backgroundColor: '#1F222A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333333',
    fontSize: 24,
    fontFamily: 'Rubik',
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  otpInputError: {
    borderColor: '#FF0000',
    borderWidth: 1,
  },
  errorText: {
    fontSize: 14,
    fontFamily: 'Rubik',
    fontWeight: '400',
    color: '#FF0000',
    textAlign: 'center',
    marginBottom: 16,
  },
  verifyButton: {
    backgroundColor: '#DC143C',
    borderRadius: 12,
    paddingVertical: 18,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 16,
  },
  verifyButtonDisabled: {
    opacity: 0.6,
  },
  verifyButtonText: {
    fontSize: 16,
    fontFamily: 'Rubik',
    fontWeight: '600',
    color: '#FFFFFF',
  },
  resendButton: {
    marginTop: 8,
  },
  resendButtonDisabled: {
    opacity: 0.6,
  },
  resendButtonText: {
    fontSize: 16,
    fontFamily: 'Rubik',
    fontWeight: '400',
    color: '#DC143C',
  },
  resendCountText: {
    fontSize: 14,
    fontFamily: 'Rubik',
    fontWeight: '400',
    color: '#808080',
    marginTop: 16,
  },
});
