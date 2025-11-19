import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Platform,
  KeyboardAvoidingView,
  ActionSheetIOS,
  Modal,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { useNavigation, useRoute } from '@react-navigation/native';
import { storageService } from '../../services/storage';
import { listingsService } from '../../services/listings';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import dataManager from '../../services/dataManager';
import {
  CITY_SUGGESTIONS_US,
  getCountries,
  getStatesByCountry,
  formatLocation,
  Country,
  State,
} from '../../utils/locationData';
import {
  COLOR_PRESETS,
  GTR_MODEL_OPTIONS,
  LISTING_CONDITION_OPTIONS,
} from '../../constants/listingOptions';
import { ListingImage, ListingWithImages } from '../../types/listing.types';

const MAX_PHOTOS = 12;
const MAX_PHOTO_SIZE = 10 * 1024 * 1024; // 10MB

interface LocalPhoto {
  id: string;
  uri: string;
  type: string;
}

interface SelectionOption {
  label: string;
  value: string;
}

interface CreateListingRouteParams {
  listingToEdit?: ListingWithImages | null;
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
        <ScrollView style={styles.modalList}>
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

export const CreateListingScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { user } = useAuth();
  const routeParams = route?.params as CreateListingRouteParams | undefined;
  const editingListing = routeParams?.listingToEdit || null;
  const isEditing = !!editingListing;
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);
  const [existingPhotos, setExistingPhotos] = useState<ListingImage[]>([]);
  const [removedExistingPhotos, setRemovedExistingPhotos] = useState<ListingImage[]>([]);
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [model, setModel] = useState('');
  const [selectedModelKey, setSelectedModelKey] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [mileage, setMileage] = useState('');
  const [condition, setCondition] = useState<string>('Excellent');
  const [transmission, setTransmission] = useState('');
  const [color, setColor] = useState('');
  const [selectedColorName, setSelectedColorName] = useState<string | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(getCountries()[0] || null);
  const [selectedState, setSelectedState] = useState<State | null>(null);
  const [city, setCity] = useState('');
  const [streetAddress, setStreetAddress] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [countryModalVisible, setCountryModalVisible] = useState(false);
  const [stateModalVisible, setStateModalVisible] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const availableStates = useMemo(() => {
    if (!selectedCountry) return [];
    return getStatesByCountry(selectedCountry.code);
  }, [selectedCountry]);

  const stateOptions: SelectionOption[] = availableStates.map((state) => ({
    label: state.name,
    value: state.code,
  }));

  const countryOptions: SelectionOption[] = getCountries().map((country) => ({
    label: country.name,
    value: country.code,
  }));

  const filteredCitySuggestions = useMemo(() => {
    if (!selectedState) return [];
    return CITY_SUGGESTIONS_US.filter((suggestion) => suggestion.state === selectedState.code).slice(0, 6);
  }, [selectedState]);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const totalPhotoCount = existingPhotos.length + photos.length;

  const resetForm = useCallback(() => {
    setPhotos([]);
    setExistingPhotos([]);
    setRemovedExistingPhotos([]);
    setTitle('');
    setPrice('');
    setModel('');
    setSelectedModelKey(null);
    setDescription('');
    setYear(new Date().getFullYear().toString());
    setMileage('');
    setCondition('Excellent');
    setTransmission('');
    setColor('');
    setSelectedColorName(null);
    setSelectedCountry(getCountries()[0] || null);
    setSelectedState(null);
    setCity('');
    setStreetAddress('');
    setZipCode('');
  }, []);

  const populateFormFromListing = useCallback((listing: ListingWithImages) => {
    setTitle(listing.title || '');
    setPrice(listing.price ? String(listing.price) : '');
    setModel(listing.model || '');
    const matchingModel = GTR_MODEL_OPTIONS.find((option) => option.value === listing.model);
    setSelectedModelKey(matchingModel ? matchingModel.value : null);
    setDescription(listing.description || '');
    setYear(listing.year ? String(listing.year) : new Date().getFullYear().toString());
    setMileage(listing.mileage ? String(listing.mileage) : '');
    setCondition(listing.condition || 'Excellent');
    setTransmission(listing.transmission || '');
    setColor(listing.color || '');
    const matchingColor = COLOR_PRESETS.find(
      (preset) => preset.name.toLowerCase() === (listing.color || '').toLowerCase()
    );
    setSelectedColorName(matchingColor ? matchingColor.name : null);
    const countries = getCountries();
    const country = countries.find((c) => c.code === listing.country) || countries[0] || null;
    setSelectedCountry(country);
    const state =
      country && listing.state
        ? getStatesByCountry(country.code).find((s) => s.code === listing.state)
        : null;
    setSelectedState(state || null);
    setCity(listing.city || '');
    setStreetAddress(listing.street_address || '');
    setZipCode(listing.zip_code || '');
    const orderedImages = (listing.listing_images || []).slice().sort(
      (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)
    );
    setExistingPhotos(orderedImages);
    setRemovedExistingPhotos([]);
    setPhotos([]);
  }, []);

  useEffect(() => {
    if (editingListing) {
      populateFormFromListing(editingListing);
    } else {
      resetForm();
    }
  }, [editingListing, populateFormFromListing, resetForm]);

  const showPhotoActionSheet = () => {
    if (totalPhotoCount >= MAX_PHOTOS) {
      Alert.alert('Photo limit reached', `You can upload up to ${MAX_PHOTOS} photos.`);
      return;
    }
    const options = ['Choose from library', 'Take a photo', 'Cancel'];
    const cancelButtonIndex = 2;
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex,
        },
        (index) => {
          if (index === 0) {
            handlePickPhoto();
          } else if (index === 1) {
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
        Alert.alert('Permission required', 'Please grant photo library access to add pictures.');
        return;
      }

      const remainingSlots = MAX_PHOTOS - totalPhotoCount;
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: remainingSlots,
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      const newPhotos = result.assets.map((asset) => ({
        id: `${Date.now()}-${asset.assetId || Math.random()}`,
        uri: asset.uri,
        type: asset.type || 'image/jpeg',
      }));

      setPhotos((prev) => {
        const combined = [...prev, ...newPhotos];
        return combined.slice(0, MAX_PHOTOS - existingPhotos.length);
      });
    } catch (error) {
      console.error(error);
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
      if (result) {
        setPhotos((prev) => {
          if (prev.length + existingPhotos.length >= MAX_PHOTOS) {
            return prev;
          }
          const updated = [...prev, { id: `${Date.now()}`, uri: result.uri, type: result.type }];
          return updated.slice(0, MAX_PHOTOS - existingPhotos.length);
        });
      }
    } catch (error) {
      console.error(error);
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

  const deleteRemovedListingPhotos = async () => {
    if (!removedExistingPhotos.length) {
      return;
    }
    const paths = removedExistingPhotos
      .map((photo) => photo.storage_path)
      .filter((path): path is string => !!path);
    if (paths.length) {
      const { error: storageError } = await supabase.storage.from('listing-images').remove(paths);
      if (storageError) {
        throw storageError;
      }
    }
    const ids = removedExistingPhotos.map((photo) => photo.id);
    const { error: deleteError } = await supabase.from('listing_images').delete().in('id', ids);
    if (deleteError) {
      throw deleteError;
    }
  };

  const validateForm = (): string | null => {
    if (!title.trim()) return 'Please enter a listing title.';
    if (!price.trim() || Number(price) <= 0) return 'Enter a valid price.';
    if (!model.trim()) return 'Select or enter a model.';
    if (!description.trim()) return 'Add a description.';
    const yearNumber = Number(year);
    if (!year.trim() || yearNumber < 1980 || yearNumber > new Date().getFullYear() + 1) return 'Enter a valid year.';
    if (!condition) return 'Select a condition.';
    if (!transmission.trim()) return 'Enter transmission info.';
    if (!color.trim()) return 'Select or enter a color.';
    if (!selectedCountry) return 'Select a country.';
    if (!selectedState) return 'Select a state or region.';
    if (!city.trim()) return 'Enter a city.';
    if (!zipCode.trim()) return 'Enter a zip/postal code.';
    if (totalPhotoCount === 0) return 'Add at least one photo.';
    return null;
  };

  const prepareImageForUpload = async (uri: string) => {
    const manipulated = await manipulateAsync(
      uri,
      [{ resize: { width: 1600 } }],
      { compress: 0.8, format: SaveFormat.JPEG }
    );

    const info = await FileSystem.getInfoAsync(manipulated.uri);
    if (info.exists && info.size && info.size > MAX_PHOTO_SIZE) {
      throw new Error('Each image must be less than 10MB.');
    }

    const base64 = await FileSystem.readAsStringAsync(manipulated.uri, { encoding: FileSystem.EncodingType.Base64 });
    const fileData = base64ToUint8Array(base64);
    return { fileData, uri: manipulated.uri };
  };

  const uploadListingPhotos = async (listingId: string, orderOffset: number = 0) => {
    if (!user || photos.length === 0) return;
    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      const { fileData } = await prepareImageForUpload(photo.uri);
      const filePath = `${user.id}/${listingId}/${Date.now()}-${i}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('listing-images')
        .upload(filePath, fileData, { contentType: 'image/jpeg', upsert: false });
      if (uploadError) {
        throw uploadError;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from('listing-images').getPublicUrl(filePath);

      const { error: insertError } = await supabase.from('listing_images').insert({
        listing_id: listingId,
        image_url: publicUrl,
        storage_path: filePath,
        is_primary: orderOffset === 0 && i === 0,
        display_order: orderOffset + i,
      });
      if (insertError) {
        throw insertError;
      }
    }
  };

  const handlePublish = async () => {
    if (!user) {
      Alert.alert('Sign in required', 'Please sign in to create a listing.');
      return;
    }
    const validationError = validateForm();
    if (validationError) {
      Alert.alert('Missing information', validationError);
      return;
    }

    setIsSubmitting(true);
    try {
      const location = formatLocation({
        street_address: streetAddress || undefined,
        city: city || undefined,
        state: selectedState?.code || undefined,
        country: selectedCountry?.code || undefined,
      });

      const payload = {
        title: title.trim(),
        model: model.trim(),
        year: Number(year),
        price: Number(price),
        mileage: mileage ? Number(mileage) : undefined,
        description: description.trim(),
        condition,
        transmission: transmission.trim(),
        color: color.trim(),
        country: selectedCountry?.code,
        state: selectedState?.code,
        city: city.trim(),
        street_address: streetAddress.trim() || undefined,
        zip_code: zipCode.trim(),
        location,
      };

      if (isEditing && editingListing) {
        await listingsService.updateListing(editingListing.id, payload);
        if (removedExistingPhotos.length) {
          await deleteRemovedListingPhotos();
          setRemovedExistingPhotos([]);
        }
        const nextDisplayOrder = existingPhotos.length
          ? Math.max(...existingPhotos.map((photo) => photo.display_order ?? 0)) + 1
          : 0;
        await uploadListingPhotos(editingListing.id, nextDisplayOrder);

        dataManager.invalidateCache(/^home:listings/);
        dataManager.invalidateCache(/^marketplace:listings/);
        dataManager.invalidateCache(/^user:listings/);
        dataManager.invalidateCache(new RegExp(`^listing:detail:${editingListing.id}`));

        Alert.alert('Listing updated', 'Your changes are live.', [
          {
            text: 'Done',
            onPress: () => navigation.goBack(),
          },
        ]);
      } else {
        const listing = await listingsService.createListing(payload);
        await uploadListingPhotos(listing.id);

        dataManager.invalidateCache(/^home:listings/);
        dataManager.invalidateCache(/^marketplace:listings/);
        dataManager.invalidateCache(/^user:listings/);

        resetForm();
        Alert.alert('Listing published', 'Your listing is live!', [
          {
            text: 'Great',
          },
        ]);
      }
    } catch (error: any) {
      console.error('Failed to save listing', error);
      Alert.alert('Something went wrong', 'We could not save your listing. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderPhotoGrid = () => {
    const orderedExisting = existingPhotos.slice().sort(
      (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)
    );
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.photoRow}
      >
        {orderedExisting.map((photo) => (
          <View key={`existing-${photo.id}`} style={styles.photoItem}>
            <Image source={{ uri: photo.image_url }} style={styles.photoImage} contentFit="cover" />
            <TouchableOpacity
              style={styles.removePhotoButton}
              onPress={() => handleRemoveExistingPhoto(photo.id)}
              activeOpacity={0.8}
            >
              <Ionicons name="close" size={16} color="#181920" />
            </TouchableOpacity>
          </View>
        ))}
        {photos.map((photo) => (
          <View key={photo.id} style={styles.photoItem}>
            <Image source={{ uri: photo.uri }} style={styles.photoImage} contentFit="cover" />
            <TouchableOpacity
              style={styles.removePhotoButton}
              onPress={() => handleRemovePhoto(photo.id)}
              activeOpacity={0.8}
            >
              <Ionicons name="close" size={16} color="#181920" />
            </TouchableOpacity>
          </View>
        ))}
        {totalPhotoCount < MAX_PHOTOS && (
          <TouchableOpacity style={styles.photoPlaceholder} onPress={showPhotoActionSheet} activeOpacity={0.8}>
            <Ionicons name="add" size={36} color="#C7CAD7" />
          </TouchableOpacity>
        )}
      </ScrollView>
    );
  };

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            keyboardVisible ? styles.keyboardPaddingExpanded : styles.keyboardPaddingCollapsed,
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Create Listing</Text>
            <View style={styles.headerPlaceholder} />
          </View>

        <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Photos</Text>
              <Text style={styles.sectionCounter}>{totalPhotoCount}/{MAX_PHOTOS} photos</Text>
            </View>
            <Text style={styles.sectionHelper}>Each photo must be under 10MB.</Text>
            {renderPhotoGrid()}
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Title</Text>
            <TextInput
              style={styles.input}
              placeholder="GT-R headline"
              placeholderTextColor="#808080"
              value={title}
              onChangeText={setTitle}
            />
          </View>

          <View style={styles.row}>
            <View style={styles.rowItem}>
              <Text style={styles.label}>Price</Text>
              <TextInput
                style={styles.input}
                placeholder="USD"
                placeholderTextColor="#808080"
                keyboardType="numeric"
                value={price}
                onChangeText={setPrice}
              />
            </View>
            <View style={styles.rowItem}>
              <Text style={styles.label}>Year</Text>
              <TextInput
                style={styles.input}
                placeholder="2020"
                placeholderTextColor="#808080"
                keyboardType="numeric"
                value={year}
                onChangeText={setYear}
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Model</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
              {GTR_MODEL_OPTIONS.map((option) => {
                const isActive = selectedModelKey === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[styles.chip, isActive && styles.chipActive]}
                    onPress={() => {
                      setSelectedModelKey(option.value);
                      setModel(option.value);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{option.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TextInput
              style={styles.input}
              placeholder="Enter GT-R model"
              placeholderTextColor="#808080"
              value={model}
              onChangeText={(text) => {
                setSelectedModelKey(null);
                setModel(text);
              }}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Tell buyers about upgrades, condition, history..."
              placeholderTextColor="#808080"
              value={description}
              onChangeText={setDescription}
              multiline
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Mileage (KM)</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter mileage"
              placeholderTextColor="#808080"
              keyboardType="numeric"
              value={mileage}
              onChangeText={setMileage}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Condition</Text>
            <View style={styles.chipRow}>
              {LISTING_CONDITION_OPTIONS.map((option) => {
                const isActive = condition === option;
                return (
                  <TouchableOpacity
                    key={option}
                    style={[styles.chip, isActive && styles.chipActive]}
                    onPress={() => setCondition(option)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{option}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Transmission</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., 6-Speed Dual Clutch"
              placeholderTextColor="#808080"
              value={transmission}
              onChangeText={setTransmission}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Color</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
              {COLOR_PRESETS.map((preset) => {
                const isActive = selectedColorName === preset.name;
                return (
                  <TouchableOpacity
                    key={preset.name}
                    style={[styles.colorChip, isActive && styles.colorChipActive]}
                    onPress={() => {
                      setSelectedColorName(preset.name);
                      setColor(preset.name);
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.colorSwatch, { backgroundColor: preset.hex }]} />
                    <Text style={[styles.colorChipText, isActive && styles.colorChipTextActive]}>{preset.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TextInput
              style={styles.input}
              placeholder="Color name"
              placeholderTextColor="#808080"
              value={color}
              onChangeText={(text) => {
                setSelectedColorName(null);
                setColor(text);
              }}
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
              <View style={styles.chipRow}>
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
            <Text style={styles.label}>Street Address</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter street address"
              placeholderTextColor="#808080"
              value={streetAddress}
              onChangeText={setStreetAddress}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Zip Code</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter postal code"
              placeholderTextColor="#808080"
              value={zipCode}
              onChangeText={setZipCode}
              keyboardType="numeric"
            />
          </View>

          <TouchableOpacity
            style={[styles.publishButton, isSubmitting && styles.publishButtonDisabled]}
            onPress={handlePublish}
            activeOpacity={0.85}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#181920" />
            ) : (
              <Ionicons name={isEditing ? 'create-outline' : 'send'} size={18} color="#181920" />
            )}
            <Text style={styles.publishButtonText}>
              {isEditing
                ? isSubmitting
                  ? 'Updating...'
                  : 'Update Listing'
                : isSubmitting
                ? 'Publishing...'
                : 'Publish Listing'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {isSubmitting && (
        <View style={styles.blockingOverlay} pointerEvents="auto">
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={styles.blockingText}>
            {isEditing ? 'Updating listing...' : 'Publishing listing...'}
          </Text>
        </View>
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
          setSelectedState(state);
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 0,
  },
  keyboardPaddingCollapsed: {
    paddingBottom: 12,
  },
  keyboardPaddingExpanded: {
    paddingBottom: Platform.OS === 'ios' ? 350 : 350,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E1F2B',
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
  },
  headerPlaceholder: {
    width: 44,
  },
  section: {
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  sectionCounter: {
    color: '#8086A2',
    fontSize: 13,
  },
  sectionHelper: {
    color: '#9CA0B8',
    fontSize: 13,
    marginTop: 6,
    marginBottom: 12,
  },
  label: {
    color: '#9CA0B8',
    fontSize: 13,
    marginBottom: 8,
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
  textArea: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  photoItem: {
    width: 120,
    height: 120,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  photoImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  },
  removePhotoButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2A2D3A',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#161821',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
    marginTop: 8,
    marginBottom: 3,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 30,
    backgroundColor: '#1F222A',
    borderWidth: 1,
    borderColor: '#2A2D3A',
    marginRight: 8,
    marginBottom: 8,
  },
  chipActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  chipText: {
    color: '#C7CAD7',
    fontSize: 13,
  },
  chipTextActive: {
    color: '#181920',
    fontWeight: '600',
  },
  colorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 30,
    borderWidth: 1,
    borderColor: '#2A2D3A',
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: '#1F222A',
  },
  colorChipActive: {
    borderColor: '#FFFFFF',
    backgroundColor: '#FFFFFF',
  },
  colorSwatch: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 8,
  },
  colorChipText: {
    color: '#C7CAD7',
    fontSize: 13,
  },
  colorChipTextActive: {
    color: '#181920',
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  rowItem: {
    flex: 1,
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
  publishButton: {
    marginTop: 24,
    marginBottom: 16,
    marginHorizontal: 16,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  publishButtonDisabled: {
    opacity: 0.7,
  },
  publishButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#181920',
  },
  blockingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(19,20,28,0.8)',
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
});

export default CreateListingScreen;
