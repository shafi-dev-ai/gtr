import React, { useState, useCallback } from 'react';
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

interface ForgotPasswordScreenProps {
  navigation?: any;
}

export const ForgotPasswordScreen: React.FC<ForgotPasswordScreenProps> = React.memo(({ navigation }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSendResetLink = useCallback(async () => {
    setEmailError(null);
    setSuccess(false);

    if (!email.trim()) {
      setEmailError('Email address is required');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError('Please enter a valid email address');
      return;
    }

    setLoading(true);

    try {
      const { error } = await authService.resetPasswordForEmail(email);

      if (error) {
        // Generic error message for security
        setEmailError('Unable to send reset link. Please try again.');
        setLoading(false);
        return;
      }

      setSuccess(true);
      setLoading(false);
    } catch (err: any) {
      setEmailError('Unable to send reset link. Please try again.');
      setLoading(false);
    }
  }, [email]);

  const handleBackToLogin = useCallback(() => {
    navigation?.navigate('Login');
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
          <TouchableOpacity style={styles.backButton} onPress={handleBackToLogin}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.iconContainer}>
            <Ionicons name="lock-closed-outline" size={64} color="#DC143C" />
          </View>

          <Text style={styles.heading}>Forgot Password</Text>
          <Text style={styles.subtitle}>
            Enter your email address and we'll send you a link to reset your password. You can
            always request another link if the first one expires or you can't find it.
          </Text>

          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>E-mail Address</Text>
              <View style={[styles.inputWrapper, emailError && styles.inputWrapperError]}>
                <Ionicons name="mail-outline" size={24} color="#808080" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Email address"
                  placeholderTextColor="#808080"
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    if (emailError) setEmailError(null);
                    if (success) setSuccess(false);
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loading}
                />
              </View>
              {emailError && <Text style={styles.fieldError}>{emailError}</Text>}
              {success && (
                <Text style={styles.successText}>
                  Reset link sent! Please check your email.
                </Text>
              )}
            </View>

            <TouchableOpacity
              style={[styles.sendButton, loading && styles.sendButtonDisabled]}
              onPress={handleSendResetLink}
              disabled={loading}
            >
              <Text style={styles.sendButtonText}>
                {loading ? 'Sending...' : 'Send Reset Link'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
});

ForgotPasswordScreen.displayName = 'ForgotPasswordScreen';

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
  },
  backButton: {
    marginBottom: 32,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  heading: {
    fontSize: 24,
    fontFamily: 'Rubik',
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Rubik',
    fontWeight: '400',
    color: '#FFFFFF',
    marginBottom: 32,
    textAlign: 'center',
    opacity: 0.9,
    lineHeight: 24,
  },
  form: {
    marginTop: 16,
  },
  inputContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontFamily: 'Rubik',
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F222A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333333',
    paddingHorizontal: 16,
  },
  inputWrapperError: {
    borderColor: '#FF0000',
    borderWidth: 1,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Rubik',
    fontWeight: '400',
    color: '#FFFFFF',
    paddingVertical: 16,
  },
  fieldError: {
    fontSize: 12,
    fontFamily: 'Rubik',
    fontWeight: '400',
    color: '#FF0000',
    marginTop: 4,
  },
  successText: {
    fontSize: 14,
    fontFamily: 'Rubik',
    fontWeight: '400',
    color: '#00FF00',
    marginTop: 4,
  },
  sendButton: {
    backgroundColor: '#DC143C',
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  sendButtonText: {
    fontSize: 16,
    fontFamily: 'Rubik',
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

