import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { profilesService } from '../../services/profiles';
import { Profile, UpdateProfileData } from '../../types/profile.types';

interface AccountSettingsScreenProps {
  navigation?: any;
}

export const AccountSettingsScreen: React.FC<AccountSettingsScreenProps> = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Form fields
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const userProfile = await profilesService.getCurrentUserProfile();
      if (userProfile) {
        setProfile(userProfile);
        setUsername(userProfile.username || '');
        setFullName(userProfile.full_name || '');
        setBio(userProfile.bio || '');
        setLocation(userProfile.location || '');
        setPhoneNumber(userProfile.phone_number || '');
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      Alert.alert('Error', 'Failed to load account information.');
    } finally {
      setLoading(false);
    }
  };

  // Track changes
  useEffect(() => {
    if (profile) {
      const changed =
        username !== (profile.username || '') ||
        fullName !== (profile.full_name || '') ||
        bio !== (profile.bio || '') ||
        location !== (profile.location || '') ||
        phoneNumber !== (profile.phone_number || '');
      setHasChanges(changed);
    }
  }, [username, fullName, bio, location, phoneNumber, profile]);

  const handleSave = async () => {
    if (!profile) return;

    // Validation
    if (username && username.length < 3) {
      Alert.alert('Error', 'Username must be at least 3 characters long.');
      return;
    }

    if (username && !/^[a-zA-Z0-9_]+$/.test(username)) {
      Alert.alert(
        'Error',
        'Username can only contain letters, numbers, and underscores.'
      );
      return;
    }

    try {
      setSaving(true);
      const updates: UpdateProfileData = {};

      if (username !== (profile.username || '')) {
        updates.username = username || null;
      }
      if (fullName !== (profile.full_name || '')) {
        updates.full_name = fullName || null;
      }
      if (bio !== (profile.bio || '')) {
        updates.bio = bio || null;
      }
      if (location !== (profile.location || '')) {
        updates.location = location || null;
      }
      if (phoneNumber !== (profile.phone_number || '')) {
        updates.phone_number = phoneNumber || null;
      }

      if (Object.keys(updates).length === 0) {
        Alert.alert('No Changes', 'No changes to save.');
        return;
      }

      const updatedProfile = await profilesService.updateProfile(updates);
      setProfile(updatedProfile);
      setHasChanges(false);

      Alert.alert('Success', 'Account settings updated successfully.');
    } catch (error: any) {
      console.error('Error saving profile:', error);
      
      // Handle unique constraint violation for username
      if (error.message && error.message.includes('unique') && error.message.includes('username')) {
        Alert.alert(
          'Error',
          'This username is already taken. Please choose a different username.'
        );
      } else {
        Alert.alert(
          'Error',
          error.message || 'Failed to update account settings. Please try again.'
        );
      }
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (hasChanges) {
      Alert.alert(
        'Discard Changes?',
        'You have unsaved changes. Are you sure you want to discard them?',
        [
          { text: 'Keep Editing', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => {
              if (profile) {
                setUsername(profile.username || '');
                setFullName(profile.full_name || '');
                setBio(profile.bio || '');
                setLocation(profile.location || '');
                setPhoneNumber(profile.phone_number || '');
                setHasChanges(false);
              }
              if (navigation.canGoBack()) {
                navigation.goBack();
              }
            },
          },
        ]
      );
    } else {
      if (navigation.canGoBack()) {
        navigation.goBack();
      }
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={styles.loadingText}>Loading account settings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const email = user?.email || profile?.email || 'Not available';
  const phoneVerified = profile?.phone_verified || false;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleCancel}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Account Settings</Text>
        <View style={styles.saveButtonWrapper}>
          <TouchableOpacity
            style={[styles.saveButton, (!hasChanges || saving) && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={!hasChanges || saving}
            activeOpacity={0.7}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={[styles.saveButtonText, (!hasChanges || saving) && styles.saveButtonTextDisabled]}>
                Save
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Profile Picture Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile Picture</Text>
          <View style={styles.avatarSection}>
            {profile?.avatar_url ? (
              <ExpoImage
                source={{ uri: profile.avatar_url }}
                style={styles.avatar}
                contentFit="cover"
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={64} color="#808080" />
              </View>
            )}
            <Text style={styles.avatarHint}>
              Tap your profile picture on the profile screen to change it
            </Text>
          </View>
        </View>

        {/* Personal Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal Information</Text>

          {/* Username */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Username</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="Enter username"
              placeholderTextColor="#808080"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.hint}>
              Username must be unique and contain only letters, numbers, and underscores
            </Text>
          </View>

          {/* Full Name */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Enter your full name"
              placeholderTextColor="#808080"
              autoCapitalize="words"
            />
          </View>

          {/* Bio */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Bio</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={bio}
              onChangeText={setBio}
              placeholder="Tell us about yourself"
              placeholderTextColor="#808080"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              maxLength={500}
            />
            <Text style={styles.hint}>{bio.length}/500 characters</Text>
          </View>

          {/* Location */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Location</Text>
            <TextInput
              style={styles.input}
              value={location}
              onChangeText={setLocation}
              placeholder="City, State"
              placeholderTextColor="#808080"
              autoCapitalize="words"
            />
          </View>
        </View>

        {/* Contact Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Information</Text>

          {/* Email (Read-only) */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <View style={styles.readOnlyInput}>
              <Text style={styles.readOnlyText}>{email}</Text>
              <Ionicons name="lock-closed" size={16} color="#808080" />
            </View>
            <Text style={styles.hint}>
              Email is managed by your authentication provider
            </Text>
          </View>

          {/* Phone Number */}
          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Phone Number</Text>
              {phoneVerified && (
                <View style={styles.verifiedBadge}>
                  <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                  <Text style={styles.verifiedText}>Verified</Text>
                </View>
              )}
            </View>
            <TextInput
              style={styles.input}
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              placeholder="Enter phone number"
              placeholderTextColor="#808080"
              keyboardType="phone-pad"
              autoCapitalize="none"
            />
            {!phoneVerified && phoneNumber && (
              <Text style={styles.hint}>
                Phone verification will be available soon
              </Text>
            )}
          </View>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#181920',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#808080',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2D3A',
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center',
  },
  saveButtonWrapper: {
    minWidth: 80,
    alignItems: 'flex-end',
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  saveButtonTextDisabled: {
    color: '#808080',
  },
  container: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 16,
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2D3A',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 20,
  },
  avatarSection: {
    alignItems: 'center',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#2A2D3A',
    marginBottom: 12,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#1F222A',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333333',
    marginBottom: 12,
  },
  avatarHint: {
    fontSize: 14,
    color: '#808080',
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  verifiedText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#2A2D3A',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#3A3D4A',
  },
  textArea: {
    minHeight: 100,
    paddingTop: 12,
  },
  readOnlyInput: {
    backgroundColor: '#1A1D26',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#2A2D3A',
  },
  readOnlyText: {
    fontSize: 16,
    color: '#808080',
    flex: 1,
  },
  hint: {
    fontSize: 12,
    color: '#808080',
    marginTop: 6,
  },
  bottomSpacer: {
    height: 40,
  },
});
