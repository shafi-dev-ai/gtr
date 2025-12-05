import React, { useState, useEffect, useMemo } from 'react';
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
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { storageService } from '../../services/storage';
import { eventsService } from '../../services/events';
import dataManager, { RequestPriority } from '../../services/dataManager';
import { supabase } from '../../services/supabase';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { EventImage, EventWithCreator } from '../../types/event.types';
import {
  CITY_SUGGESTIONS_US,
  getCountries,
  getStatesByCountry,
  formatLocation,
  Country,
  State,
} from '../../utils/locationData';

const MAX_PHOTOS = 12;
const MAX_PHOTO_SIZE = 10 * 1024 * 1024; // 10MB

const EVENT_TYPES = ['Track Day', 'Meetup', 'Cars & Coffee', 'Rally', 'Showcase', 'Virtual'];

interface LocalPhoto {
  id: string;
  uri: string;
  type: string;
}

interface SelectionOption {
  label: string;
  value: string;
}

interface CreateEventRouteParams {
  eventToEdit?: EventWithCreator | null;
}

const SelectionModal: React.FC<{
  visible: boolean;
  title: string;
  options: SelectionOption[];
  onSelect: (option: SelectionOption) => void;
  onClose: () => void;
}> = ({ visible, title, options, onSelect, onClose }) => (
  <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <View style={styles.modalBackdrop}>
      <View style={styles.modalContent}>
        <Text style={styles.modalTitle}>{title}</Text>
        <ScrollView
          style={styles.modalList}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {options.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={styles.modalOption}
              onPress={() => {
                onSelect(option);
                onClose();
              }}
            >
              <Text style={styles.modalOptionText}>{option.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <TouchableOpacity onPress={onClose} style={styles.modalCloseButton} activeOpacity={0.8}>
          <Text style={styles.modalCloseText}>Close</Text>
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
);

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

const extractVenueFromLocation = (fullLocation: string, regionString?: string | null) => {
  if (!fullLocation) return '';
  if (!regionString || regionString === 'Location not specified') return fullLocation.trim();

  const normalizedFull = fullLocation.trim();
  const normalizedRegion = regionString.trim();
  const lowerFull = normalizedFull.toLowerCase();
  const lowerRegion = normalizedRegion.toLowerCase();

  if (lowerFull.endsWith(lowerRegion)) {
    const venue = normalizedFull
      .slice(0, normalizedFull.length - normalizedRegion.length)
      .replace(/,\s*$/, '');
    return venue.trim();
  }

  return normalizedFull;
};

export const CreateEventScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const routeParams = route?.params as CreateEventRouteParams | undefined;
  const editingEvent = routeParams?.eventToEdit || null;
  const isEditing = !!editingEvent;
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventType, setEventType] = useState(EVENT_TYPES[0]);
  const [location, setLocation] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(getCountries()[0] || null);
  const [selectedState, setSelectedState] = useState<State | null>(null);
  const [city, setCity] = useState('');
  const [countryModalVisible, setCountryModalVisible] = useState(false);
  const [stateModalVisible, setStateModalVisible] = useState(false);
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date(Date.now() + 60 * 60 * 1000));
  const [maxAttendees, setMaxAttendees] = useState('50');
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);
  const [existingPhotos, setExistingPhotos] = useState<EventImage[]>([]);
  const [removedExistingPhotos, setRemovedExistingPhotos] = useState<EventImage[]>([]);
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

  useEffect(() => {
    if (!editingEvent) {
      setExistingPhotos([]);
      setRemovedExistingPhotos([]);
      return;
    }

    setTitle(editingEvent.title || '');
    setDescription(editingEvent.description || '');
    setEventType(editingEvent.event_type || EVENT_TYPES[0]);
    const hasRegionParts = !!(editingEvent.city || editingEvent.state || editingEvent.country);
    const regionString = hasRegionParts
      ? formatLocation({
          city: editingEvent.city || undefined,
          state: editingEvent.state || undefined,
          country: editingEvent.country || undefined,
        })
      : null;
    const venueOnly = hasRegionParts
      ? extractVenueFromLocation(editingEvent.location || '', regionString)
      : editingEvent.location || '';
    setLocation(venueOnly);
    const countries = getCountries();
    const country =
      editingEvent.country ? countries.find((c) => c.code === editingEvent.country) || null : countries[0] || null;
    setSelectedCountry(country);
    const state =
      country && editingEvent.state
        ? getStatesByCountry(country.code).find((s) => s.code === editingEvent.state) || null
        : null;
    setSelectedState(state);
    setCity(editingEvent.city || '');
    setStartDate(editingEvent.start_date ? new Date(editingEvent.start_date) : new Date());
    setEndDate(editingEvent.end_date ? new Date(editingEvent.end_date) : new Date());
    setMaxAttendees(editingEvent.max_attendees ? String(editingEvent.max_attendees) : '50');
    const orderedImages = (editingEvent.event_images || [])
      .slice()
      .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
    setExistingPhotos(orderedImages);
    setRemovedExistingPhotos([]);
    setPhotos([]);
  }, [editingEvent]);

  const totalPhotoCount = existingPhotos.length + photos.length;
  const availableStates = useMemo(() => {
    if (!selectedCountry) return [];
    return getStatesByCountry(selectedCountry.code);
  }, [selectedCountry]);

  const stateOptions: SelectionOption[] = useMemo(
    () => availableStates.map((state) => ({ label: state.name, value: state.code })),
    [availableStates]
  );

  const countryOptions: SelectionOption[] = useMemo(
    () => getCountries().map((country) => ({ label: country.name, value: country.code })),
    []
  );

  const filteredCitySuggestions = useMemo(() => {
    if (!selectedState) return [];
    return CITY_SUGGESTIONS_US.filter((suggestion) => suggestion.state === selectedState.code).slice(0, 6);
  }, [selectedState]);

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
    if (totalPhotoCount >= MAX_PHOTOS) {
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
      if (totalPhotoCount >= MAX_PHOTOS) {
        Alert.alert('Photo limit reached', `You can upload up to ${MAX_PHOTOS} photos.`);
        return;
      }
      const hasPermission = await storageService.requestImagePickerPermission();
      if (!hasPermission) {
        Alert.alert('Permission required', 'Please grant media access to add photos.');
        return;
      }
      const remainingSlots = MAX_PHOTOS - totalPhotoCount;
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: remainingSlots,
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.length) return;
      const newPhotos = result.assets.slice(0, remainingSlots).map((asset) => ({
        id: `${Date.now()}-${asset.assetId || Math.random()}`,
        uri: asset.uri,
        type: asset.type || 'image/jpeg',
      }));
      setPhotos((prev) => {
        const allowed = MAX_PHOTOS - existingPhotos.length;
        const combined = [...prev, ...newPhotos];
        return combined.slice(0, allowed);
      });
    } catch (error) {
      console.error('handlePickPhoto error', error);
      Alert.alert('Unable to select photos', 'Please try again.');
    }
  };

  const handleTakePhoto = async () => {
    try {
      if (totalPhotoCount >= MAX_PHOTOS) {
        Alert.alert('Photo limit reached', `You can upload up to ${MAX_PHOTOS} photos.`);
        return;
      }
      const result = await storageService.takePhotoWithCamera();
      if (!result) return;
      setPhotos((prev) => {
        const allowed = MAX_PHOTOS - existingPhotos.length;
        const updated = [...prev, { id: `${Date.now()}`, uri: result.uri, type: result.type }];
        return updated.slice(0, allowed);
      });
    } catch (error) {
      console.error('handleTakePhoto error', error);
      Alert.alert('Unable to take photo', 'Please try again.');
    }
  };

  const handleRemovePhoto = (photoId: string) => {
    setPhotos((prev) => prev.filter((photo) => photo.id !== photoId));
  };

  const handleRemoveExistingPhoto = (photoId: string) => {
    setExistingPhotos((prev) => {
      const photoToRemove = prev.find((photo) => photo.id === photoId);
      if (!photoToRemove) {
        return prev;
      }
      setRemovedExistingPhotos((current) => {
        if (current.some((item) => item.id === photoId)) {
          return current;
        }
        return [...current, photoToRemove];
      });
      return prev.filter((photo) => photo.id !== photoId);
    });
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

  const uploadEventPhotos = async (
    eventId: string,
    orderOffset: number = 0,
    hasExistingPhotos: boolean = false
  ) => {
    if (!user || photos.length === 0) return;
    for (let i = 0; i < photos.length; i++) {
      const { fileData } = await prepareImageForUpload(photos[i].uri);
      const filePath = `${user.id}/events/${eventId}/${Date.now()}-${i}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('event-images')
        .upload(filePath, fileData, { contentType: 'image/jpeg', upsert: false });
      if (uploadError) throw uploadError;
      const {
        data: { publicUrl },
      } = supabase.storage.from('event-images').getPublicUrl(filePath);
      const { error: insertError } = await supabase.from('event_images').insert({
        event_id: eventId,
        image_url: publicUrl,
        storage_path: filePath,
        is_primary: !hasExistingPhotos && i === 0,
        display_order: orderOffset + i,
      });
      if (insertError) throw insertError;
    }
  };

  const deleteRemovedEventPhotos = async () => {
    if (!removedExistingPhotos.length) {
      return;
    }
    const paths = removedExistingPhotos
      .map((photo) => photo.storage_path)
      .filter((path): path is string => !!path);
    if (paths.length) {
      const { error: storageError } = await supabase.storage.from('event-images').remove(paths);
      if (storageError) {
        throw storageError;
      }
    }
    const ids = removedExistingPhotos.map((photo) => photo.id);
    const { error: deleteError } = await supabase.from('event_images').delete().in('id', ids);
    if (deleteError) {
      throw deleteError;
    }
  };

  const validateForm = (): string | null => {
    if (!title.trim()) return 'Please provide an event title.';
    if (!eventType.trim()) return 'Select an event type.';
    if (!location.trim()) return 'Enter the venue or location name.';
    if (!selectedCountry) return 'Select a country.';
    if (!selectedState) return 'Select a state or region.';
    if (!city.trim()) return 'Enter a city.';
    if (!startDate) return 'Enter the event start date/time.';
    if (!endDate) return 'Enter the event end date/time.';
    if (endDate <= startDate) return 'End date must be after the start date.';
    if (!maxAttendees.trim() || Number(maxAttendees) <= 0) return 'Enter a valid attendee count.';
    if (totalPhotoCount === 0) return 'Add at least one photo.';
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
      const regionString = formatLocation({
        city: city.trim() || undefined,
        state: selectedState?.code || undefined,
        country: selectedCountry?.code || undefined,
      });
      const locationDetail = location.trim();
      const normalizedRegion = regionString.trim().toLowerCase();
      const normalizedLocationDetail = locationDetail.toLowerCase();
      const alreadyHasRegion = normalizedLocationDetail.endsWith(normalizedRegion);
      const fullLocation = regionString
        ? locationDetail
          ? alreadyHasRegion
            ? locationDetail
            : `${locationDetail}, ${regionString}`
          : regionString
        : locationDetail;
      const maxAttendeeNumber = maxAttendees ? Number(maxAttendees) : undefined;
      const payload = {
        title: title.trim(),
        description: description.trim() || undefined,
        event_type: eventType,
        location: fullLocation,
        country: selectedCountry?.code,
        state: selectedState?.code,
        city: city.trim(),
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        max_attendees: maxAttendeeNumber,
      };
      if (isEditing && editingEvent) {
        await eventsService.updateEvent(editingEvent.id, payload);
        if (removedExistingPhotos.length) {
          await deleteRemovedEventPhotos();
          setRemovedExistingPhotos([]);
        }
        const hasRemainingExisting = existingPhotos.length > 0;
        const nextDisplayOrder = hasRemainingExisting
          ? Math.max(...existingPhotos.map((photo) => photo.display_order ?? 0)) + 1
          : 0;
        await uploadEventPhotos(editingEvent.id, nextDisplayOrder, hasRemainingExisting);
        invalidateEventCaches();
        await refreshEventData();
        Alert.alert('Event updated', 'Your changes are live.', [
          { text: 'Done', onPress: () => navigation.goBack() },
        ]);
      } else {
        const createdEvent = await eventsService.createEvent(payload);
        await uploadEventPhotos(createdEvent.id, 0, false);
        invalidateEventCaches();
        await refreshEventData();
        Alert.alert('Event created', 'Your event is now live!', [
          { text: 'Great', onPress: () => navigation.goBack() },
        ]);
      }
    } catch (error: any) {
      console.error('Event creation failed', error);
      Alert.alert('Unable to create event', error?.message || 'Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderPhotoGrid = () => {
    if (totalPhotoCount === 0) {
      return (
        <TouchableOpacity style={styles.photoPlaceholder} onPress={showPhotoActionSheet} activeOpacity={0.8}>
          <Ionicons name="add" size={34} color="#C7CAD7" />
          <Text style={styles.photoPlaceholderText}>Add photos</Text>
          <Text style={styles.photoHint}>Up to {MAX_PHOTOS} images. First photo is the cover.</Text>
        </TouchableOpacity>
      );
    }
    const orderedExisting = existingPhotos
      .slice()
      .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
    const hasPrimaryFlag = orderedExisting.some((photo) => photo.is_primary);
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoRow}>
        {orderedExisting.map((photo, index) => (
          <View key={`existing-${photo.id}`} style={styles.photoItem}>
            <Image source={{ uri: photo.image_url }} style={styles.photoImage} contentFit="cover" />
            {(photo.is_primary || (!hasPrimaryFlag && index === 0)) && <Text style={styles.coverBadge}>Cover</Text>}
            <TouchableOpacity style={styles.removePhotoButton} onPress={() => handleRemoveExistingPhoto(photo.id)}>
              <Ionicons name="close" size={16} color="#181920" />
            </TouchableOpacity>
          </View>
        ))}
        {photos.map((photo, index) => (
          <View key={photo.id} style={styles.photoItem}>
            <Image source={{ uri: photo.uri }} style={styles.photoImage} contentFit="cover" />
            {!orderedExisting.length && index === 0 && <Text style={styles.coverBadge}>Cover</Text>}
            <TouchableOpacity style={styles.removePhotoButton} onPress={() => handleRemovePhoto(photo.id)}>
              <Ionicons name="close" size={16} color="#181920" />
            </TouchableOpacity>
          </View>
        ))}
        {totalPhotoCount < MAX_PHOTOS && (
          <TouchableOpacity style={styles.photoPlaceholderSmall} onPress={showPhotoActionSheet} activeOpacity={0.8}>
            <Ionicons name="add" size={32} color="#C7CAD7" />
          </TouchableOpacity>
        )}
      </ScrollView>
    );
  };

  const invalidateEventCaches = () => {
    dataManager.invalidateCache(/^home:events/);
    dataManager.invalidateCache(/^explore:events/);
    dataManager.invalidateCache(/^events:upcoming/);
    if (user?.id) {
      dataManager.invalidateCache(new RegExp(`^user:events:${user.id}`));
      dataManager.invalidateCache(new RegExp(`^events:user:${user.id}`));
    } else {
      dataManager.invalidateCache(/^user:events/);
    }
  };

  const refreshEventData = async () => {
    const tasks: Promise<any>[] = [];
    tasks.push(
      dataManager.fetch(
        'home:events:upcoming:5',
        () => eventsService.getUpcomingEvents(5),
        { skipCache: true, priority: RequestPriority.HIGH }
      )
    );
    tasks.push(
      dataManager.fetch(
        'explore:events:20',
        () => eventsService.getAllEvents(20),
        { skipCache: true, priority: RequestPriority.HIGH }
      )
    );
    if (user?.id) {
      tasks.push(
        dataManager.fetch(
          `user:events:${user.id}`,
          () => eventsService.getUserEvents(user.id),
          { skipCache: true, priority: RequestPriority.HIGH }
        )
      );
    }
    await Promise.allSettled(tasks);
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
          <Text style={styles.headerTitle}>{isEditing ? 'Edit Event' : 'Create Event'}</Text>
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
          <Text style={styles.label}>Venue / Location Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Laguna Seca Raceway"
            placeholderTextColor="#808080"
            value={location}
            onChangeText={setLocation}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Country</Text>
          <TouchableOpacity
            style={styles.selectInput}
            onPress={() => setCountryModalVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.selectInputText}>
              {selectedCountry ? selectedCountry.name : 'Select country'}
            </Text>
            <Ionicons name="chevron-down" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>State / Region</Text>
          <TouchableOpacity
            style={styles.selectInput}
            onPress={() => {
              if (!selectedCountry) {
                Alert.alert('Select country first');
                return;
              }
              setStateModalVisible(true);
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.selectInputText}>
              {selectedState ? selectedState.name : 'Select state/region'}
            </Text>
            <Ionicons name="chevron-down" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>City</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter city"
            placeholderTextColor="#808080"
            value={city}
            onChangeText={setCity}
          />
          {filteredCitySuggestions.length > 0 && (
            <View style={[styles.chipRow, styles.citySuggestions]}>
              {filteredCitySuggestions.map((suggestion) => (
                <TouchableOpacity
                  key={`${suggestion.state}-${suggestion.name}`}
                  style={styles.chip}
                  onPress={() => setCity(suggestion.name)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.chipText}>{suggestion.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
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
          <Text style={styles.label}>Description  (optional)</Text>
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
          <Text style={styles.subLabel}>{totalPhotoCount}/{MAX_PHOTOS}</Text>
          </View>
          {renderPhotoGrid()}
          {totalPhotoCount === 0 && (
            <Text style={styles.fieldError}>Please select at least one photo.</Text>
          )}
          {totalPhotoCount > 0 && (
            <Text style={styles.helperText}>The first image becomes the event cover.</Text>
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
          <Text style={styles.publishButtonText}>
            {isSubmitting ? (isEditing ? 'Updating...' : 'Publishing...') : isEditing ? 'Update Event' : 'Publish Event'}
          </Text>
        </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
      {isSubmitting && (
        <View style={styles.blockingOverlay} pointerEvents="auto">
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={styles.blockingText}>{isEditing ? 'Updating event...' : 'Publishing event...'}</Text>
        </View>
      )}
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
      <SelectionModal
        visible={countryModalVisible}
        title="Select Country"
        options={countryOptions}
        onSelect={(option) => {
          const country = getCountries().find((c) => c.code === option.value) || null;
          setSelectedCountry(country);
          setSelectedState(null);
        }}
        onClose={() => setCountryModalVisible(false)}
      />
      <SelectionModal
        visible={stateModalVisible}
        title="Select State / Region"
        options={stateOptions}
        onSelect={(option) => {
          const state = availableStates.find((s) => s.code === option.value) || null;
          setSelectedState(state || null);
        }}
        onClose={() => setStateModalVisible(false)}
      />
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
  selectInput: {
    backgroundColor: '#1F222A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A2D3A',
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectInputText: {
    color: '#FFFFFF',
    fontSize: 15,
  },
  citySuggestions: {
    marginTop: 12,
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1A1D26',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
    paddingBottom: 24,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  modalList: {
    paddingHorizontal: 20,
  },
  modalOption: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#262938',
  },
  modalOptionText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  modalCloseButton: {
    marginTop: 16,
    marginHorizontal: 20,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseText: {
    color: '#181920',
    fontWeight: '600',
    fontSize: 15,
  },
  blockingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(19,20,28,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  blockingText: {
    marginTop: 12,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
  },
});
