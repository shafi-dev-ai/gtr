import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { authService } from '../../services/auth';
import { useResendEmail } from '../../hooks/useResendEmail';

interface EmailVerificationScreenProps {
  navigation?: any;
  route?: any;
}

export const EmailVerificationScreen: React.FC<EmailVerificationScreenProps> = ({ navigation, route }) => {
  const { user } = useAuth();
  const email = route?.params?.email || user?.email || '';

  const {
    resendCooldown,
    resendCount,
    isResending,
    error,
    handleResend,
    remainingResends,
  } = useResendEmail({
    email,
    resendFunction: authService.resendVerificationEmail,
    storagePrefix: 'email_verification',
  });

  const handleBackToLogin = () => {
    navigation?.navigate('Login');
  };

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.container}>
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Ionicons name="mail-outline" size={64} color="#DC143C" />
          </View>

          <Text style={styles.heading}>Verify Your Email</Text>
          <Text style={styles.subtitle}>
            We've sent a verification email to
          </Text>
          <Text style={styles.emailText}>{email}</Text>
          <Text style={styles.description}>
            Please check your inbox and click the verification link to activate your account. If you don't see the email, check your spam folder.
          </Text>

          {error && (
            <Text style={styles.errorText}>{error}</Text>
          )}

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
                ? `Resend Email (${resendCooldown}s)`
                : resendCount >= 3
                ? 'Daily Limit Reached'
                : 'Resend Verification Email'}
            </Text>
          </TouchableOpacity>

          {resendCount > 0 && resendCount < 3 && (
            <Text style={styles.resendCountText}>
              {remainingResends} resend{remainingResends !== 1 ? 's' : ''} remaining today
            </Text>
          )}

          <TouchableOpacity style={styles.backButton} onPress={handleBackToLogin}>
            <Text style={styles.backButtonText}>Back to Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#181920',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 40,
    alignItems: 'center',
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
    marginBottom: 24,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    fontFamily: 'Rubik',
    fontWeight: '400',
    color: '#FFFFFF',
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 32,
    opacity: 0.9,
  },
  errorText: {
    fontSize: 14,
    fontFamily: 'Rubik',
    fontWeight: '400',
    color: '#FF0000',
    textAlign: 'center',
    marginBottom: 16,
  },
  resendButton: {
    backgroundColor: '#DC143C',
    borderRadius: 12,
    paddingVertical: 18,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 12,
  },
  resendButtonDisabled: {
    backgroundColor: '#333333',
    opacity: 0.6,
  },
  resendButtonText: {
    fontSize: 16,
    fontFamily: 'Rubik',
    fontWeight: '600',
    color: '#FFFFFF',
  },
  resendCountText: {
    fontSize: 14,
    fontFamily: 'Rubik',
    fontWeight: '400',
    color: '#808080',
    marginBottom: 24,
  },
  backButton: {
    marginTop: 16,
  },
  backButtonText: {
    fontSize: 16,
    fontFamily: 'Rubik',
    fontWeight: '400',
    color: '#DC143C',
  },
});
