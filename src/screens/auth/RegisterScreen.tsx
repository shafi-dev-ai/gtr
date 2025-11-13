import React, { useState } from 'react';
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

interface RegisterScreenProps {
  navigation?: any;
}

export const RegisterScreen: React.FC<RegisterScreenProps> = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(true);
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null);
  const [termsError, setTermsError] = useState<string | null>(null);
  const { setIsAuthenticated } = useAuth();

  const handleSignUp = async () => {
    // Clear previous errors
    setEmailError(null);
    setPhoneError(null);
    setPasswordError(null);
    setConfirmPasswordError(null);
    setTermsError(null);

    let hasError = false;

    if (!email.trim()) {
      setEmailError('Email address is required');
      hasError = true;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError('Please enter a valid email address');
      hasError = true;
    }

    if (!phoneNumber.trim()) {
      setPhoneError('Phone number is required');
      hasError = true;
    } else if (!/^\+1\s?\(?\d{3}\)?\s?-?\d{3}\s?-?\d{4}$/.test(phoneNumber.replace(/\s/g, ''))) {
      setPhoneError('Please enter a valid phone number');
      hasError = true;
    }

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

    if (!agreeToTerms) {
      setTermsError('You must agree to the Terms and Conditions to continue');
      hasError = true;
    }

    if (hasError) {
      return;
    }

    setLoading(true);

    try {
      const { data, error: authError } = await authService.signUp({
        email,
        password,
        phoneNumber: phoneNumber,
      });

      if (authError) {
        // Generic error message for security - don't reveal specific backend errors
        setEmailError('Unable to create account. Please try again.');
        setLoading(false);
        return;
      }

      if (data?.session) {
        setIsAuthenticated(true);
      } else {
        // Email verification required - navigate to verification screen
        setLoading(false);
        navigation?.navigate('EmailVerification', { email });
      }
    } catch (err: any) {
      // Generic error message
      setEmailError('Unable to create account. Please try again.');
      setLoading(false);
    }
  };

  const handleLogin = () => {
    // Navigate back to login screen
    navigation?.navigate('Login');
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
          <Text style={styles.heading}>Register</Text>
          <Text style={styles.subtitle}>Create new account for better service</Text>

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
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
              {emailError && <Text style={styles.fieldError}>{emailError}</Text>}
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Phone Number</Text>
              <View style={[styles.inputWrapper, phoneError && styles.inputWrapperError]}>
                <Ionicons name="call-outline" size={24} color="#808080" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="+1 (555) 123-4567"
                  placeholderTextColor="#808080"
                  value={phoneNumber}
                  onChangeText={(text) => {
                    setPhoneNumber(text);
                    if (phoneError) setPhoneError(null);
                  }}
                  keyboardType="phone-pad"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
              {phoneError && <Text style={styles.fieldError}>{phoneError}</Text>}
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

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Confirm Password</Text>
              <View style={[styles.inputWrapper, confirmPasswordError && styles.inputWrapperError]}>
                <Ionicons name="lock-closed-outline" size={24} color="#808080" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Confirm Password"
                  placeholderTextColor="#808080"
                  value={confirmPassword}
                  onChangeText={(text) => {
                    setConfirmPassword(text);
                    if (confirmPasswordError) setConfirmPasswordError(null);
                  }}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
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

            <View style={styles.termsContainer}>
              <TouchableOpacity
                style={styles.checkboxContainer}
                onPress={() => {
                  setAgreeToTerms(!agreeToTerms);
                  if (termsError) setTermsError(null);
                }}
              >
                <View style={[styles.checkbox, agreeToTerms && styles.checkboxChecked]}>
                  {agreeToTerms && (
                    <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                  )}
                </View>
                <Text style={styles.termsText}>
                  I agree to the Terms and Condition and Privacy
                </Text>
              </TouchableOpacity>
              {termsError && <Text style={styles.fieldError}>{termsError}</Text>}
            </View>

            <TouchableOpacity style={styles.signUpButton} onPress={handleSignUp} disabled={loading}>
              <Text style={styles.signUpButtonText}>{loading ? 'Signing up...' : 'Sign up'}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleLogin} style={styles.loginLinkContainer}>
              <Text style={styles.loginLinkText}>Already have an account ?</Text>
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
  termsContainer: {
    marginBottom: 24,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: '#DC143C',
    borderColor: '#DC143C',
  },
  termsText: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Rubik',
    fontWeight: '400',
    color: '#FFFFFF',
    lineHeight: 22,
  },
  signUpButton: {
    backgroundColor: '#383838',
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    opacity: 1,
  },
  signUpButtonDisabled: {
    opacity: 0.6,
  },
  signUpButtonText: {
    fontSize: 16,
    fontFamily: 'Rubik',
    fontWeight: '600',
    color: '#FFFFFF',
  },
  loginLinkContainer: {
    alignItems: 'center',
  },
  loginLinkText: {
    fontSize: 16,
    fontFamily: 'Rubik',
    fontWeight: '400',
    color: '#FFFFFF',
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

