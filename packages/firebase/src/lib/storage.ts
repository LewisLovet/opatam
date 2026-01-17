import {
  getStorage,
  ref,
  uploadBytes,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  listAll,
  type FirebaseStorage,
  type StorageReference,
  type UploadResult,
  type UploadTask,
} from 'firebase/storage';
import { app } from './config';

/**
 * Firebase Storage instance
 */
export const storage: FirebaseStorage = getStorage(app);

/**
 * Storage paths
 */
export const storagePaths = {
  userPhotos: (userId: string) => `users/${userId}/profile`,
  providerPhotos: (providerId: string) => `providers/${providerId}/profile`,
  providerCover: (providerId: string) => `providers/${providerId}/cover`,
  providerPortfolio: (providerId: string) => `providers/${providerId}/portfolio`,
  memberPhotos: (providerId: string, memberId: string) =>
    `providers/${providerId}/members/${memberId}`,
} as const;

/**
 * Upload a file to storage
 */
export async function uploadFile(
  path: string,
  file: Blob | Uint8Array | ArrayBuffer,
  metadata?: { contentType?: string }
): Promise<string> {
  const storageRef = ref(storage, path);
  const result = await uploadBytes(storageRef, file, metadata);
  return getDownloadURL(result.ref);
}

/**
 * Upload a file with progress tracking
 */
export function uploadFileWithProgress(
  path: string,
  file: Blob | Uint8Array | ArrayBuffer,
  metadata?: { contentType?: string }
): UploadTask {
  const storageRef = ref(storage, path);
  return uploadBytesResumable(storageRef, file, metadata);
}

/**
 * Get download URL for a file
 */
export async function getFileURL(path: string): Promise<string> {
  const storageRef = ref(storage, path);
  return getDownloadURL(storageRef);
}

/**
 * Delete a file from storage
 */
export async function deleteFile(path: string): Promise<void> {
  const storageRef = ref(storage, path);
  return deleteObject(storageRef);
}

/**
 * List all files in a directory
 */
export async function listFiles(path: string): Promise<StorageReference[]> {
  const storageRef = ref(storage, path);
  const result = await listAll(storageRef);
  return result.items;
}

// Re-export types
export {
  ref,
  type StorageReference,
  type UploadResult,
  type UploadTask,
};
