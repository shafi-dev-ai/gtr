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

interface ResetPasswordScreenProps {
  navigation?: any;
  route?: any;
}

export const ResetPasswordScreen: React.FC<ResetPasswordScreenProps> = React.memo(({ navigation, route }) => {
  const email = route?.params?.email || '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleResetPassword = useCallback(async () => {
    setPasswordError(null);
    setConfirmPasswordError(null);
    setError(null);

    let hasError = false;

    if (!password.trim()) {
      setPasswordError('Password is required');
      hasError = true;
    } else if (password.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      hasError = true;
    }

    if (!confirmPassword.trim()) {
      setConfirmPasswordError('Please confirm your password');
      hasError = true;
    } else if (password !== confirmPassword) {
      setConfirmPasswordError('Passwords do not match');
      hasError = true;
    }

    if (hasError) {
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await authService.updatePassword(password);

      if (updateError) {
        setError('Unable to update password. Please try again.');
        setLoading(false);
        return;
      }

      // Sign out after password update
      await authService.signOut();
      
      // Navigate to login with success message
      navigation?.navigate('Login', { passwordReset: true });
    } catch (err: any) {
      setError('Unable to update password. Please try again.');
      setLoading(false);
    }
  }, [password, confirmPassword, navigation]);

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
          <View style={styles.iconContainer}>
            <Ionicons name="lock-closed-outline" size={64} color="#DC143C" />
          </View>

          <Text style={styles.heading}>Reset Password</Text>
          <Text style={styles.subtitle}>
            Enter your new password below
          </Text>

          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>New Password</Text>
              <View style={[styles.inputWrapper, passwordError && styles.inputWrapperError]}>
                <Ionicons name="lock-closed-outline" size={24} color="#808080" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="New password"
                  placeholderTextColor="#808080"
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (passwordError) setPasswordError(null);
                    if (error) setError(null);
                  }}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loading}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeIcon}
                >
                  <Ionicons
                    name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                    size={24}
                    color="#808080"
                  />
                </TouchableOpacity>
              </View>
              {passwordError && <Text style={styles.fieldError}>{passwordError}</Text>}
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Confirm Password</Text>
              <View style={[styles.inputWrapper, confirmPasswordError && styles.inputWrapperError]}>
                <Ionicons name="lock-closed-outline" size={24} color="#808080" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Confirm password"
                  placeholderTextColor="#808080"
                  value={confirmPassword}
                  onChangeText={(text) => {
                    setConfirmPassword(text);
                    if (confirmPasswordError) setConfirmPasswordError(null);
                    if (error) setError(null);
                  }}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loading}
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={styles.eyeIcon}
                >
                  <Ionicons
                    name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'}
                    size={24}
                    color="#808080"
                  />
                </TouchableOpacity>
              </View>
              {confirmPasswordError && <Text style={styles.fieldError}>{confirmPasswordError}</Text>}
            </View>

            {error && (
              <Text style={styles.errorText}>{error}</Text>
            )}

            <TouchableOpacity
              style={[styles.resetButton, loading && styles.resetButtonDisabled]}
              onPress={handleResetPassword}
              disabled={loading}
            >
              <Text style={styles.resetButtonText}>
                {loading ? 'Updating...' : 'Update Password'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
});

ResetPasswordScreen.displayName = 'ResetPasswordScreen';

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
    paddingTop: 80,
    paddingBottom: 40,
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
  },
  form: {
    marginTop: 16,
  },
  inputContainer: {
    marginBottom: 20,
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
  eyeIcon: {
    padding: 4,
  },
  fieldError: {
    fontSize: 12,
    fontFamily: 'Rubik',
    fontWeight: '400',
    color: '#FF0000',
    marginTop: 4,
  },
  errorText: {
    fontSize: 14,
    fontFamily: 'Rubik',
    fontWeight: '400',
    color: '#FF0000',
    textAlign: 'center',
    marginBottom: 16,
  },
  resetButton: {
    backgroundColor: '#DC143C',
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  resetButtonDisabled: {
    opacity: 0.6,
  },
  resetButtonText: {
    fontSize: 16,
    fontFamily: 'Rubik',
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

