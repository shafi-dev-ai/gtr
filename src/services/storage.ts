import { supabase } from './supabase';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';

const AVATAR_BUCKET = 'avatars';
const MAX_AVATAR_SIZE = 2 * 1024 * 1024; // 2MB
const AVATAR_SIZE = 400; // 400x400px

class StorageService {
  /**
   * Request image picker permissions
   */
  async requestImagePickerPermission(): Promise<boolean> {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    return status === 'granted';
  }

  /**
   * Request camera permissions
   */
  async requestCameraPermission(): Promise<boolean> {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    return status === 'granted';
  }

  /**
   * Pick image from library
   */
  async pickImageFromLibrary(): Promise<{ uri: string; type: string } | null> {
    const hasPermission = await this.requestImagePickerPermission();
    if (!hasPermission) {
      throw new Error('Permission to access media library is required');
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) {
      return null;
    }

    const asset = result.assets[0];
    // Detect image type from URI or use default
    const uri = asset.uri;
    const type = this.detectImageType(uri, asset.type);

    return { uri, type };
  }

  /**
   * Take photo with camera
   */
  async takePhotoWithCamera(): Promise<{ uri: string; type: string } | null> {
    const hasPermission = await this.requestCameraPermission();
    if (!hasPermission) {
      throw new Error('Permission to access camera is required');
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) {
      return null;
    }

    const asset = result.assets[0];
    // Camera photos are typically JPEG, but detect from URI to be safe
    const uri = asset.uri;
    const type = this.detectImageType(uri, asset.type);

    return { uri, type };
  }

  /**
   * Detect image MIME type from URI or provided type
   */
  private detectImageType(uri: string, providedType?: string): string {
    // If type is provided by ImagePicker, use it
    if (providedType && providedType.startsWith('image/')) {
      return providedType;
    }

    // Detect from file extension
    const extension = uri.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'webp':
        return 'image/webp';
      case 'gif':
        return 'image/gif';
      case 'heic':
      case 'heif':
        return 'image/heic';
      default:
        // Default to JPEG if unknown
        return 'image/jpeg';
    }
  }

  /**
   * Get file extension from MIME type
   */
  private getFileExtension(mimeType: string): string {
    switch (mimeType) {
      case 'image/jpeg':
        return 'jpg';
      case 'image/png':
        return 'png';
      case 'image/webp':
        return 'webp';
      case 'image/gif':
        return 'gif';
      case 'image/heic':
      case 'image/heif':
        return 'heic';
      default:
        return 'jpg';
    }
  }

  /**
   * Compress and resize image for avatar
   */
  async compressAndResizeAvatar(imageUri: string): Promise<string> {
    const manipulatedImage = await manipulateAsync(
      imageUri,
      [
        { resize: { width: AVATAR_SIZE, height: AVATAR_SIZE } },
      ],
      {
        compress: 0.8,
        format: SaveFormat.JPEG,
      }
    );

    return manipulatedImage.uri;
  }

  /**
   * Upload avatar image to Supabase Storage
   */
  async uploadAvatar(imageUri: string, imageType: string = 'image/jpeg'): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Compress and resize image (always outputs JPEG for consistency)
    const processedUri = await this.compressAndResizeAvatar(imageUri);

    // Read file info to check size
    const fileInfo = await FileSystem.getInfoAsync(processedUri);
    if (fileInfo.exists && fileInfo.size && fileInfo.size > MAX_AVATAR_SIZE) {
      throw new Error('Image is too large. Maximum size is 2MB.');
    }

    // Read file as base64 (React Native compatible)
    const base64 = await FileSystem.readAsStringAsync(processedUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Convert base64 to ArrayBuffer (React Native compatible)
    // Using a proper base64 decoder
    const base64Decode = (base64String: string): Uint8Array => {
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
        bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
        bytes[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
      }
      
      return bytes;
    };

    const fileData = base64Decode(base64);

    // Generate unique filename with correct extension based on image type
    // Note: compressAndResizeAvatar always outputs JPEG, so we use image/jpeg
    // But we keep the original type for reference
    const fileExt = this.getFileExtension(imageType);
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;
    const filePath = fileName;

    // Delete old avatar if exists
    try {
      const { data: existingFiles } = await supabase.storage
        .from(AVATAR_BUCKET)
        .list(user.id);

      if (existingFiles && existingFiles.length > 0) {
        const filesToDelete = existingFiles.map(file => `${user.id}/${file.name}`);
        await supabase.storage
          .from(AVATAR_BUCKET)
          .remove(filesToDelete);
      }
    } catch (error) {
      // Ignore errors when deleting old avatar (might not exist)
      console.log('No old avatar to delete:', error);
    }

    // Upload new avatar
    // Supabase Storage accepts ArrayBuffer, Blob, File, FormData, or Uint8Array
    // Note: compressAndResizeAvatar always outputs JPEG format, so we use image/jpeg
    // But we accept any image type as input and convert it
    // File path format: {user_id}/timestamp.jpg (must match RLS policy)
    console.log('Uploading avatar to path:', filePath);
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(filePath, fileData, {
        contentType: 'image/jpeg', // Always JPEG after compression
        upsert: true,
      });

    if (uploadError) {
      console.error('Upload error details:', {
        message: uploadError.message,
        error: uploadError,
        filePath,
        userId: user.id,
      });
      throw uploadError;
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(filePath);

    return publicUrl;
  }

  /**
   * Upload avatar with image picker (complete flow)
   */
  async uploadAvatarFromLibrary(): Promise<string | null> {
    try {
      const imageData = await this.pickImageFromLibrary();
      if (!imageData) return null;

      const publicUrl = await this.uploadAvatar(imageData.uri, imageData.type);
      return publicUrl;
    } catch (error) {
      console.error('Error uploading avatar from library:', error);
      throw error;
    }
  }

  /**
   * Upload avatar with camera (complete flow)
   */
  async uploadAvatarFromCamera(): Promise<string | null> {
    try {
      const imageData = await this.takePhotoWithCamera();
      if (!imageData) return null;

      const publicUrl = await this.uploadAvatar(imageData.uri, imageData.type);
      return publicUrl;
    } catch (error) {
      console.error('Error uploading avatar from camera:', error);
      throw error;
    }
  }

  /**
   * Delete avatar from storage
   */
  async deleteAvatar(): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    try {
      const { data: files } = await supabase.storage
        .from(AVATAR_BUCKET)
        .list(user.id);

      if (files && files.length > 0) {
        const filesToDelete = files.map(file => `${user.id}/${file.name}`);
        const { error } = await supabase.storage
          .from(AVATAR_BUCKET)
          .remove(filesToDelete);

        if (error) throw error;
      }
    } catch (error) {
      console.error('Error deleting avatar:', error);
      throw error;
    }
  }
}

export const storageService = new StorageService();

