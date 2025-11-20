import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Platform,
  ActionSheetIOS,
  ActivityIndicator,
  KeyboardAvoidingView,
  Keyboard,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { storageService } from '../../services/storage';
import { eventsService } from '../../services/events';
import dataManager from '../../services/dataManager';
import { supabase } from '../../services/supabase';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';

const MAX_PHOTOS = 12;
const MAX_PHOTO_SIZE = 10 * 1024 * 1024; // 10MB

const EVENT_TYPES = ['Track Day', 'Meetup', 'Cars & Coffee', 'Rally', 'Showcase', 'Virtual'];

interface LocalPhoto {
  id: string;
  uri: string;
  type: string;
}

const base64ToUint8Array = (base64String: string): Uint8Array => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) {
    lookup[chars.charCodeAt(i)] = i;
  }
  const base64Length = base64String.length;
  let paddingCount = 0;
  if (base64Length > 0 && base64String[base64Length - 1] === '=') {
    paddingCount++;
    if (base64Length > 1 && base64String[base64Length - 2] === '=') {
      paddingCount++;
    }
  }
  const arrayLength = Math.floor((base64Length * 3) / 4) - paddingCount;
  const bytes = new Uint8Array(arrayLength);
  let p = 0;
  for (let i = 0; i < base64Length; i += 4) {
    const encoded1 = lookup[base64String.charCodeAt(i)];
    const encoded2 = lookup[base64String.charCodeAt(i + 1)];
    const encoded3 = lookup[base64String.charCodeAt(i + 2)];
    const encoded4 = lookup[base64String.charCodeAt(i + 3)];

    bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
    if (p < arrayLength) {
      bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
    }
    if (p < arrayLength) {
      bytes[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
    }
  }
  return bytes;
};

export const CreateEventScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventType, setEventType] = useState(EVENT_TYPES[0]);
  const [location, setLocation] = useState('');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date(Date.now() + 60 * 60 * 1000));
  const [maxAttendees, setMaxAttendees] = useState('50');
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [activePicker, setActivePicker] = useState<{ target: 'start' | 'end'; mode: 'date' | 'time' } | null>(null);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const totalPhotos = photos.length;
  const coverPreview = photos[0]?.uri;

  const showDatePicker = (target: 'start' | 'end', mode: 'date' | 'time') => {
    const currentValue = target === 'start' ? startDate : endDate;
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: currentValue,
        mode,
        is24Hour: true,
        onChange: (_, selectedDate) => {
          if (!selectedDate) return;
          const base = new Date(currentValue);
          if (mode === 'time') {
            base.setHours(selectedDate.getHours(), selectedDate.getMinutes(), 0, 0);
          } else {
            base.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
          }
          if (target === 'start') {
            setStartDate(base);
          } else {
            setEndDate(base);
          }
        },
      });
    } else {
      setActivePicker({ target, mode });
      setPickerVisible(true);
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const showPhotoActionSheet = () => {
    if (totalPhotos >= MAX_PHOTOS) {
      Alert.alert('Photo limit reached', `You can upload up to ${MAX_PHOTOS} photos.`);
      return;
    }
    const options = ['Choose from library', 'Take a photo', 'Cancel'];
    const cancelButtonIndex = 2;
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex },
        (selectedIndex) => {
          if (selectedIndex === 0) {
            handlePickPhoto();
          } else if (selectedIndex === 1) {
            handleTakePhoto();
          }
        }
      );
    } else {
      Alert.alert('Add Photo', 'Choose an option', [
        { text: 'Choose from library', onPress: handlePickPhoto },
        { text: 'Take a photo', onPress: handleTakePhoto },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  const handlePickPhoto = async () => {
    try {
      if (totalPhotos >= MAX_PHOTOS) {
        Alert.alert('Photo limit reached', `You can upload up to ${MAX_PHOTOS} photos.`);
        return;
      }
      const hasPermission = await storageService.requestImagePickerPermission();
      if (!hasPermission) {
        Alert.alert('Permission required', 'Please grant media access to add photos.');
        return;
      }
      const remainingSlots = MAX_PHOTOS - totalPhotos;
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: remainingSlots,
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.length) return;
      const newPhotos = result.assets.map((asset) => ({
        id: `${Date.now()}-${asset.assetId || Math.random()}`,
        uri: asset.uri,
        type: asset.type || 'image/jpeg',
      }));
      setPhotos((prev) => [...prev, ...newPhotos].slice(0, MAX_PHOTOS));
    } catch (error) {
      console.error('handlePickPhoto error', error);
      Alert.alert('Unable to select photos', 'Please try again.');
    }
  };

  const handleTakePhoto = async () => {
    try {
      if (totalPhotos >= MAX_PHOTOS) {
        Alert.alert('Photo limit reached', `You can upload up to ${MAX_PHOTOS} photos.`);
        return;
      }
      const result = await storageService.takePhotoWithCamera();
      if (!result) return;
      setPhotos((prev) => [...prev, { id: `${Date.now()}`, uri: result.uri, type: result.type }].slice(0, MAX_PHOTOS));
    } catch (error) {
      console.error('handleTakePhoto error', error);
      Alert.alert('Unable to take photo', 'Please try again.');
    }
  };

  const handleRemovePhoto = (photoId: string) => {
    setPhotos((prev) => prev.filter((photo) => photo.id !== photoId));
  };

  const prepareImageForUpload = async (uri: string) => {
    const manipulated = await manipulateAsync(uri, [{ resize: { width: 1600 } }], {
      compress: 0.8,
      format: SaveFormat.JPEG,
    });
    const info = await FileSystem.getInfoAsync(manipulated.uri);
    if (info.exists && info.size && info.size > MAX_PHOTO_SIZE) {
      throw new Error('Each image must be less than 10MB.');
    }
    const base64 = await FileSystem.readAsStringAsync(manipulated.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const fileData = base64ToUint8Array(base64);
    return { fileData };
  };

  const uploadEventPhotos = async (): Promise<string[]> => {
    if (!user || photos.length === 0) return [];
    const urls: string[] = [];
    for (let i = 0; i < photos.length; i++) {
      const { fileData } = await prepareImageForUpload(photos[i].uri);
      const filePath = `${user.id}/events/${Date.now()}-${i}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('event-images')
        .upload(filePath, fileData, { contentType: 'image/jpeg' });
      if (uploadError) throw uploadError;
      const {
        data: { publicUrl },
      } = supabase.storage.from('event-images').getPublicUrl(filePath);
      urls.push(publicUrl);
    }
    return urls;
  };

  const validateForm = (): string | null => {
    if (!title.trim()) return 'Please provide an event title.';
    if (!eventType.trim()) return 'Select an event type.';
    if (!location.trim()) return 'Enter the event location.';
    if (!startDate) return 'Enter the event start date/time.';
    if (!endDate) return 'Enter the event end date/time.';
    if (endDate <= startDate) return 'End date must be after the start date.';
    if (!maxAttendees.trim() || Number(maxAttendees) <= 0) return 'Enter a valid attendee count.';
    if (!photos.length) return 'Add at least one photo.';
    return null;
  };

  const handlePublish = async () => {
    if (!user) {
      Alert.alert('Sign in required', 'Please sign in to create an event.');
      return;
    }
    const validationError = validateForm();
    if (validationError) {
      Alert.alert('Missing information', validationError);
      return;
    }
    setIsSubmitting(true);
    try {
      const uploadedPhotoUrls = await uploadEventPhotos();
      const payload = {
        title: title.trim(),
        description: description.trim() || undefined,
        event_type: eventType,
        location: location.trim(),
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        max_attendees: Number(maxAttendees),
        cover_image_url: uploadedPhotoUrls[0],
      };
      await eventsService.createEvent(payload);
      dataManager.invalidateCache(/^home:events/);
      dataManager.invalidateCache(/^user:events/);
      Alert.alert('Event created', 'Your event is now live!', [
        { text: 'Great', onPress: () => navigation.goBack() },
      ]);
    } catch (error: any) {
      console.error('Event creation failed', error);
      Alert.alert('Unable to create event', error?.message || 'Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderPhotoGrid = () => {
    if (!photos.length) {
      return (
        <TouchableOpacity style={styles.photoPlaceholder} onPress={showPhotoActionSheet} activeOpacity={0.8}>
          <Ionicons name="add" size={34} color="#C7CAD7" />
          <Text style={styles.photoPlaceholderText}>Add photos</Text>
          <Text style={styles.photoHint}>Up to {MAX_PHOTOS} images. First photo is the cover.</Text>
        </TouchableOpacity>
      );
    }
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoRow}>
        {photos.map((photo, index) => (
          <View key={photo.id} style={styles.photoItem}>
            <Image source={{ uri: photo.uri }} style={styles.photoImage} contentFit="cover" />
            {index === 0 && <Text style={styles.coverBadge}>Cover</Text>}
            <TouchableOpacity style={styles.removePhotoButton} onPress={() => handleRemovePhoto(photo.id)}>
              <Ionicons name="close" size={16} color="#181920" />
            </TouchableOpacity>
          </View>
        ))}
        {photos.length < MAX_PHOTOS && (
          <TouchableOpacity style={styles.photoPlaceholderSmall} onPress={showPhotoActionSheet} activeOpacity={0.8}>
            <Ionicons name="add" size={32} color="#C7CAD7" />
          </TouchableOpacity>
        )}
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.contentContainer,
            keyboardVisible ? styles.keyboardPaddingExpanded : styles.keyboardPaddingCollapsed,
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create Event</Text>
          <View style={styles.headerPlaceholder} />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Event Title</Text>
          <TextInput
            style={styles.input}
            placeholder="GT-R Track Day"
            placeholderTextColor="#808080"
            value={title}
            onChangeText={setTitle}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Event Type</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {EVENT_TYPES.map((type) => {
              const active = eventType === type;
              return (
                <TouchableOpacity
                  key={type}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setEventType(type)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{type}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Location</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Laguna Seca Raceway, CA"
            placeholderTextColor="#808080"
            value={location}
            onChangeText={setLocation}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Start Date</Text>
          <TouchableOpacity
            style={styles.dateInput}
            activeOpacity={0.85}
            onPress={() => showDatePicker('start', 'date')}
          >
            <Text style={styles.dateInputText}>{formatDate(startDate)}</Text>
            <Ionicons name="calendar-outline" size={18} color="#9CA0B8" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.dateInput, styles.timeInput]}
            activeOpacity={0.85}
            onPress={() => showDatePicker('start', 'time')}
          >
            <Text style={styles.dateInputText}>{formatTime(startDate)}</Text>
            <Ionicons name="time-outline" size={18} color="#9CA0B8" />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>End Date</Text>
          <TouchableOpacity
            style={styles.dateInput}
            activeOpacity={0.85}
            onPress={() => showDatePicker('end', 'date')}
          >
            <Text style={styles.dateInputText}>{formatDate(endDate)}</Text>
            <Ionicons name="calendar-outline" size={18} color="#9CA0B8" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.dateInput, styles.timeInput]}
            activeOpacity={0.85}
            onPress={() => showDatePicker('end', 'time')}
          >
            <Text style={styles.dateInputText}>{formatTime(endDate)}</Text>
            <Ionicons name="time-outline" size={18} color="#9CA0B8" />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Maximum Attendees</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., 50"
            placeholderTextColor="#808080"
            keyboardType="numeric"
            value={maxAttendees}
            onChangeText={setMaxAttendees}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Share the schedule, requirements, or anything else attendees should know."
            placeholderTextColor="#808080"
            multiline
            value={description}
            onChangeText={setDescription}
          />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
          <Text style={styles.label}>Photos</Text>
          <Text style={styles.subLabel}>{photos.length}/{MAX_PHOTOS}</Text>
          </View>
          {renderPhotoGrid()}
          {photos.length === 0 && (
            <Text style={styles.fieldError}>Please select at least one photo.</Text>
          )}
          {coverPreview && (
            <Text style={styles.helperText}>Only the first image is used as the event cover.</Text>
          )}
        </View>

        <TouchableOpacity
          style={[styles.publishButton, isSubmitting && styles.publishButtonDisabled]}
          onPress={handlePublish}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#181920" />
          ) : (
            <Ionicons name="send" size={18} color="#181920" />
          )}
          <Text style={styles.publishButtonText}>{isSubmitting ? 'Publishing...' : 'Publish Event'}</Text>
        </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
      {Platform.OS === 'ios' && pickerVisible && activePicker && (
        <Modal transparent animationType="fade">
          <View style={styles.pickerModalBackdrop}>
            <View style={styles.pickerModalContent}>
              <DateTimePicker
                value={activePicker.target === 'start' ? startDate : endDate}
                mode={activePicker.mode}
                display="spinner"
                onChange={(_, date) => {
                  if (!date) return;
                  const targetDate = new Date(activePicker.target === 'start' ? startDate : endDate);
                  if (activePicker.mode === 'date') {
                    targetDate.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
                  } else {
                    targetDate.setHours(date.getHours(), date.getMinutes(), 0, 0);
                  }
                  if (activePicker.target === 'start') {
                    setStartDate(targetDate);
                  } else {
                    setEndDate(targetDate);
                  }
                }}
              />
              <TouchableOpacity
                style={styles.pickerDoneButton}
                onPress={() => {
                  setPickerVisible(false);
                  setActivePicker(null);
                }}
              >
                <Text style={styles.pickerDoneText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#13141C',
  },
  flex: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 32,
  },
  keyboardPaddingCollapsed: {
    paddingBottom: 32,
  },
  keyboardPaddingExpanded: {
    paddingBottom: Platform.OS === 'ios' ? 320 : 280,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E1F2B',
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  headerPlaceholder: {
    width: 44,
  },
  section: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  label: {
    color: '#9CA0B8',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  subLabel: {
    color: '#6E738D',
    fontSize: 12,
  },
  input: {
    backgroundColor: '#1F222A',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#FFFFFF',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#2A2D3A',
  },
  dateInput: {
    backgroundColor: '#1F222A',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#2A2D3A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timeInput: {
    marginTop: 12,
  },
  dateInputText: {
    color: '#FFFFFF',
    fontSize: 15,
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  chipRow: {
    flexDirection: 'row',
    gap: 10,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2A2D3A',
    backgroundColor: '#181A22',
  },
  chipActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  chipText: {
    color: '#9CA0B8',
    fontSize: 13,
    fontWeight: '500',
  },
  chipTextActive: {
    color: '#181A22',
    fontWeight: '600',
  },
  photoPlaceholder: {
    borderWidth: 1,
    borderColor: '#2A2D3A',
    borderStyle: 'dashed',
    borderRadius: 20,
    minHeight: 160,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#181A22',
    padding: 16,
  },
  photoPlaceholderSmall: {
    width: 110,
    height: 110,
    borderRadius: 20,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#2A2D3A',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#181A22',
  },
  photoPlaceholderText: {
    color: '#FFFFFF',
    fontWeight: '600',
    marginTop: 8,
  },
  photoHint: {
    color: '#9CA0B8',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  photoRow: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 6,
  },
  photoItem: {
    width: 140,
    height: 140,
    borderRadius: 18,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#000',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  coverBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    color: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    fontSize: 11,
    fontWeight: '600',
  },
  removePhotoButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  helperText: {
    marginTop: 8,
    color: '#6E738D',
    fontSize: 12,
  },
  fieldError: {
    marginTop: 8,
    color: '#FF6B6B',
    fontSize: 13,
    fontWeight: '500',
  },
  publishButton: {
    marginTop: 24,
    marginHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  publishButtonDisabled: {
    opacity: 0.7,
  },
  publishButtonText: {
    color: '#181A22',
    fontWeight: '600',
    fontSize: 16,
  },
  pickerModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  pickerModalContent: {
    backgroundColor: '#1F222A',
    padding: 16,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  pickerDoneButton: {
    marginTop: 12,
    alignSelf: 'flex-end',
  },
  pickerDoneText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
});
