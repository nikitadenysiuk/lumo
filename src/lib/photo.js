// src/lib/photo.js — выбор и сжатие фото для приёма пищи.

import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

async function shrinkToBase64(uri) {
  const out = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1024 } }],
    { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true }
  );
  return out.base64;
}

/**
 * @param {'camera'|'library'} source
 * @returns {Promise<null | {denied:true} | {base64:string}>}
 *   null — пользователь отменил.
 */
export async function pickMealPhotoBase64(source = 'library') {
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return { denied: true };
    const res = await ImagePicker.launchCameraAsync({ quality: 0.6, exif: false });
    if (res.canceled) return null;
    return { base64: await shrinkToBase64(res.assets[0].uri) };
  }
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.6,
    exif: false,
  });
  if (res.canceled) return null;
  return { base64: await shrinkToBase64(res.assets[0].uri) };
}
