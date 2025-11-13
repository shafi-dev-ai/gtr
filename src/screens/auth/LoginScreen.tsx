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
import { Image } from 'expo-image';
import { useAuth } from '../../context/AuthContext';
import { authService } from '../../services/auth';

interface LoginScreenProps {
  navigation?: any;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const { setIsAuthenticated } = useAuth();

  const handleLogin = async () => {
    // Clear previous errors
    setEmailError(null);
    setPasswordError(null);
    setAuthError(null);

    let hasError = false;

    if (!email.trim()) {
      setEmailError('Email address is required');
      hasError = true;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError('Please enter a valid email address');
      hasError = true;
    }

    if (!password.trim()) {
      setPasswordError('Password is required');
      hasError = true;
    }

    if (hasError) {
      return;
    }

    setLoading(true);

    try {
      const { data, error: authErrorResponse, persistSession } = await authService.signIn({ 
        email, 
        password,
        persistSession: keepSignedIn 
      });

      if (authErrorResponse) {
        // Log error for debugging
        console.log('Login error:', JSON.stringify(authErrorResponse, null, 2));
        console.log('Error name:', authErrorResponse.name);
        console.log('Error message:', authErrorResponse.message);
        console.log('Error status:', authErrorResponse.status);
        console.log('Error code:', authErrorResponse.code);
        
        // Check if error is due to email not verified
        // Supabase returns "Email not confirmed" for unverified emails
        const errorMessage = (authErrorResponse.message || '').toLowerCase();
        const errorStatus = authErrorResponse.status?.toString() || '';
        const errorCode = (authErrorResponse.code || '').toLowerCase();
        
        // Supabase specifically returns "Email not confirmed" for unverified emails
        // However, some configurations return "Invalid login credentials" for security
        // Check for explicit email verification errors
        const isEmailNotConfirmed = 
          errorMessage.includes('email not confirmed') || 
          errorMessage.includes('email_not_confirmed') ||
          errorMessage.includes('email not verified') ||
          errorMessage.includes('unverified') ||
          errorCode === 'email_not_confirmed';
        
        if (isEmailNotConfirmed) {
          // Email not verified - navigate to verification screen
          console.log('Email not confirmed - redirecting to verification');
          setLoading(false);
          navigation?.navigate('EmailVerification', { email });
          return;
        }
        
        // For other errors (wrong password, user doesn't exist, etc.)
        // Show generic error message
        setAuthError('Invalid email or password');
        setLoading(false);
        return;
      }

      // Log the response for debugging
      console.log('Login response data:', JSON.stringify(data, null, 2));
      console.log('User:', data?.user?.email);
      console.log('Email confirmed at:', data?.user?.email_confirmed_at);
      console.log('Session exists:', !!data?.session);

      if (data?.session) {
        // Check if email is verified
        const isEmailVerified = !!data.user?.email_confirmed_at;
        console.log('Email verified status:', isEmailVerified);
        
        if (isEmailVerified) {
          // Email is verified - allow login
          console.log('Email verified - setting authenticated');
          setIsAuthenticated(true);
        } else {
          // Email not verified - navigate to verification screen
          console.log('Email not verified - redirecting to verification');
          setLoading(false);
          navigation?.navigate('EmailVerification', { email });
        }
      } else if (data?.user) {
        // User exists but no session - check if email is verified
        const isEmailVerified = !!data.user?.email_confirmed_at;
        console.log('User exists, no session. Email verified:', isEmailVerified);
        
        if (!isEmailVerified) {
          // Email not verified - navigate to verification screen
          console.log('Email not verified - redirecting to verification');
          setLoading(false);
          navigation?.navigate('EmailVerification', { email });
        } else {
          // Email verified but no session - this shouldn't happen, but handle it
          console.log('Email verified but no session - showing error');
          setAuthError('Unable to sign in. Please try again.');
          setLoading(false);
        }
      } else {
        // No user data - this shouldn't happen if login succeeded
        console.log('No user data in response');
        setAuthError('Unable to sign in. Please try again.');
        setLoading(false);
      }
    } catch (err: any) {
      console.log('Login exception:', err);
      console.log('Exception details:', JSON.stringify(err, null, 2));
      
      // Check if error is related to email verification
      const errorMessage = err?.message?.toLowerCase() || '';
      if (errorMessage.includes('email not confirmed') || 
          errorMessage.includes('email_not_confirmed') ||
          errorMessage.includes('unverified')) {
        setLoading(false);
        navigation?.navigate('EmailVerification', { email });
        return;
      }
      
      // Generic error message - show above login button
      setAuthError('Unable to sign in. Please try again.');
      setLoading(false);
    }
  };

  const handleForgotPassword = useCallback(() => {
    navigation?.navigate('ForgotPassword');
  }, [navigation]);

  const handleSignUp = () => {
    // Navigate to sign up screen
    navigation?.navigate('Register');
  };

  const handleSocialLogin = (provider: 'facebook' | 'google' | 'apple') => {
    // Handle social login
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
      >
        <View style={styles.content}>
          <Text style={styles.heading}>Login</Text>
          <Text style={styles.subtitle}>Welcome back!</Text>

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
                    if (authError) setAuthError(null);
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
              {emailError && <Text style={styles.fieldError}>{emailError}</Text>}
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Password</Text>
              <View style={[styles.inputWrapper, passwordError && styles.inputWrapperError]}>
                <Ionicons name="lock-closed-outline" size={24} color="#808080" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor="#808080"
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (passwordError) setPasswordError(null);
                    if (authError) setAuthError(null);
                  }}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
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

            <View style={styles.optionsRow}>
              <TouchableOpacity
                style={styles.checkboxContainer}
                onPress={() => setKeepSignedIn(!keepSignedIn)}
              >
                <View style={[styles.checkbox, keepSignedIn && styles.checkboxChecked]}>
                  {keepSignedIn && (
                    <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                  )}
                </View>
                <Text style={styles.checkboxLabel}>Keep me signed in</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={handleForgotPassword}>
                <Text style={styles.forgotPassword}>Forgot password</Text>
              </TouchableOpacity>
            </View>

            {authError && (
              <Text style={styles.authErrorText}>{authError}</Text>
            )}

            <TouchableOpacity 
              style={styles.loginButton} 
              onPress={handleLogin} 
              disabled={loading}
            >
              <Text style={styles.loginButtonText}>
                {loading ? 'Logging in...' : 'Login'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleSignUp} style={styles.signUpContainer}>
              <Text style={styles.signUpText}>
                Don't have an account? <Text style={styles.signUpLink}>Create a new one</Text>
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.socialSection}>
            <View style={styles.separator}>
              <View style={styles.separatorLine} />
              <Text style={styles.separatorText}>Or continue with</Text>
              <View style={styles.separatorLine} />
            </View>

            <TouchableOpacity
              style={[styles.socialButton, styles.facebookButton]}
              onPress={() => handleSocialLogin('facebook')}
            >
              <Ionicons name="logo-facebook" size={24} color="#FFFFFF" style={styles.socialIcon} />
              <Text style={styles.facebookButtonText}>Continue with Facebook</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.socialButton, styles.googleButton]}
              onPress={() => handleSocialLogin('google')}
            >
              <Image
                source={require('../../../assets/images/google-icon.png')}
                style={styles.googleIcon}
                contentFit="contain"
              />
              <Text style={styles.googleButtonText}>Continue with Google</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.socialButton, styles.appleButton]}
              onPress={() => handleSocialLogin('apple')}
            >
              <Ionicons name="logo-apple" size={24} color="#FFFFFF" style={styles.socialIcon} />
              <Text style={styles.appleButtonText}>Continue with Apple</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

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
  heading: {
    fontSize: 24,
    fontFamily: 'Rubik',
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Rubik',
    fontWeight: '400',
    color: '#FFFFFF',
    marginBottom: 32,
  },
  form: {
    marginBottom: 32,
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
  fieldError: {
    fontSize: 12,
    fontFamily: 'Rubik',
    fontWeight: '400',
    color: '#FF0000',
    marginTop: 4,
  },
  eyeIcon: {
    padding: 4,
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#333333',
    backgroundColor: '#1F222A',
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#DC143C',
    borderColor: '#DC143C',
  },
  checkboxLabel: {
    fontSize: 16,
    fontFamily: 'Rubik',
    fontWeight: '400',
    color: '#FFFFFF',
  },
  forgotPassword: {
    fontSize: 16,
    fontFamily: 'Rubik',
    fontWeight: '400',
    color: '#FFFFFF',
  },
  authErrorText: {
    fontSize: 14,
    fontFamily: 'Rubik',
    fontWeight: '400',
    color: '#FF0000',
    textAlign: 'center',
    marginTop: 2,
    marginBottom: 8,
  },
  loginButton: {
    backgroundColor: '#383838',
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 1,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    fontSize: 16,
    fontFamily: 'Rubik',
    fontWeight: '600',
    color: '#FFFFFF',
  },
  signUpContainer: {
    marginTop: 16,
    alignItems: 'center',
  },
  signUpText: {
    fontSize: 16,
    fontFamily: 'Rubik',
    fontWeight: '400',
    color: '#FFFFFF',
  },
  signUpLink: {
    fontSize: 16,
    fontFamily: 'Rubik',
    fontWeight: '600',
    color: '#DC143C',
  },
  socialSection: {
    marginTop: 10,
  },
  separator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  separatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#333333',
  },
  separatorText: {
    fontSize: 16,
    fontFamily: 'Rubik',
    fontWeight: '400',
    color: '#808080',
    marginHorizontal: 16,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  socialIcon: {
    marginRight: 12,
  },
  googleIcon: {
    width: 24,
    height: 24,
    marginRight: 12,
  },
  facebookButton: {
    backgroundColor: '#1877F2',
  },
  facebookButtonText: {
    fontSize: 16,
    fontFamily: 'Rubik',
    fontWeight: '600',
    color: '#FFFFFF',
  },
  googleButton: {
    backgroundColor: '#FFFFFF',
  },
  googleButtonText: {
    fontSize: 16,
    fontFamily: 'Rubik',
    fontWeight: '600',
    color: '#000000',
  },
  appleButton: {
    backgroundColor: '#383838',
    borderWidth: 1,
    borderColor: '#333333',
  },
  appleButtonText: {
    fontSize: 16,
    fontFamily: 'Rubik',
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

