import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { PHOTO_KEY_STORAGE } from './keys';

const WEB_PHOTO_STORAGE = 'murlan.profilePhoto.v1';
const PHOTO_SIZE = 384;
const PHOTO_QUALITY = 0.55;
const SECURE: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

function photoFile(): File {
  return new File(Paths.document, 'murlan.profile.v1.bin');
}

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function xor(left: Uint8Array, right: Uint8Array): Uint8Array {
  const out = new Uint8Array(left.length);
  for (let i = 0; i < left.length; i += 1) {
    out[i] = (left[i] ?? 0) ^ (right[i] ?? 0);
  }
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return globalThis.btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = globalThis.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function keystream(keyHex: string, nonceHex: string, length: number): Promise<Uint8Array> {
  const out = new Uint8Array(length);
  let offset = 0;
  let counter = 0;
  while (offset < length) {
    const block = hexToBytes(
      await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${keyHex}:${nonceHex}:${counter}`),
    );
    const take = Math.min(block.length, length - offset);
    out.set(block.subarray(0, take), offset);
    offset += take;
    counter += 1;
  }
  return out;
}

async function loadPhotoKey(): Promise<string> {
  let stored: string | null = null;
  try {
    stored = await SecureStore.getItemAsync(PHOTO_KEY_STORAGE, SECURE);
  } catch {
    stored = await AsyncStorage.getItem(PHOTO_KEY_STORAGE);
  }
  if (stored && stored.length >= 32) {
    return stored;
  }
  const key = bytesToHex(await Crypto.getRandomBytesAsync(32));
  try {
    await SecureStore.setItemAsync(PHOTO_KEY_STORAGE, key, SECURE);
  } catch {
    await AsyncStorage.setItem(PHOTO_KEY_STORAGE, key);
  }
  return key;
}

async function compressPhoto(uri: string): Promise<string> {
  const context = ImageManipulator.manipulate(uri, { maxWidth: 1024, maxHeight: 1024 });
  context.resize({ width: PHOTO_SIZE, height: PHOTO_SIZE });
  const image = await context.renderAsync();
  const saved = await image.saveAsync({
    compress: PHOTO_QUALITY,
    format: SaveFormat.JPEG,
    base64: true,
  });
  if (!saved.base64) {
    throw new Error('photo');
  }
  return saved.base64.replace(/\s/g, '');
}

export async function saveProfilePhoto(uri: string): Promise<string> {
  const jpeg = await compressPhoto(uri);
  const plain = base64ToBytes(jpeg);
  const key = await loadPhotoKey();
  const nonce = await Crypto.getRandomBytesAsync(16);
  const nonceHex = bytesToHex(nonce);
  const cipher = xor(plain, await keystream(key, nonceHex, plain.length));
  const packed = new Uint8Array(nonce.length + cipher.length);
  packed.set(nonce, 0);
  packed.set(cipher, nonce.length);
  try {
    if (Platform.OS === 'web') {
      await AsyncStorage.setItem(WEB_PHOTO_STORAGE, bytesToBase64(packed));
    } else {
      const file = photoFile();
      file.create({ overwrite: true });
      await file.write(packed.buffer.slice(packed.byteOffset, packed.byteOffset + packed.byteLength));
    }
  } catch {
    /* still return the compressed photo for this session */
  }
  return `data:image/jpeg;base64,${jpeg}`;
}

async function readPacked(): Promise<Uint8Array | null> {
  if (Platform.OS === 'web') {
    const stored = await AsyncStorage.getItem(WEB_PHOTO_STORAGE);
    return stored ? base64ToBytes(stored) : null;
  }
  const file = photoFile();
  return file.exists ? await file.bytes() : null;
}

export async function loadProfilePhoto(): Promise<string | null> {
  try {
    const packed = await readPacked();
    if (!packed) {
      return null;
    }
    if (packed.length <= 16) {
      return null;
    }
    const nonce = packed.subarray(0, 16);
    const cipher = packed.subarray(16);
    const key = await loadPhotoKey();
    const plain = xor(cipher, await keystream(key, bytesToHex(nonce), cipher.length));
    return `data:image/jpeg;base64,${bytesToBase64(plain)}`;
  } catch {
    return null;
  }
}

export async function clearProfilePhoto(): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      await AsyncStorage.removeItem(WEB_PHOTO_STORAGE);
      return;
    }
    const file = photoFile();
    if (file.exists) {
      file.delete();
    }
  } catch {
    /* already gone */
  }
}
