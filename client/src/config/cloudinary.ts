/**
 * Cloudinary Configuration
 * Supports two accounts (Account A and Account B) with fallback logic
 */

const cloudNameA = import.meta.env.VITE_CLOUDINARY_A_CLOUD_NAME;
const uploadPresetA = import.meta.env.VITE_CLOUDINARY_A_UPLOAD_PRESET;

const cloudNameB = import.meta.env.VITE_CLOUDINARY_B_CLOUD_NAME;
const uploadPresetB = import.meta.env.VITE_CLOUDINARY_B_UPLOAD_PRESET;

const legacyCloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const legacyUploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

const primaryCloudName = cloudNameA || legacyCloudName;
const primaryUploadPreset = uploadPresetA || legacyUploadPreset;

export const CLOUDINARY_A = {
  cloudName: primaryCloudName,
  uploadPreset: primaryUploadPreset,
};

export const CLOUDINARY_B = {
  cloudName: cloudNameB,
  uploadPreset: uploadPresetB,
};

export const getUploadUrl = (cloudName: string) =>
  `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;

export const cloudinaryConfig = {
  cloudName: primaryCloudName,
  uploadPreset: primaryUploadPreset,
  uploadEndpoint: `https://api.cloudinary.com/v1_1/${primaryCloudName}/upload`,
  hasFallback: !!(cloudNameB && uploadPresetB),
  fallback: {
    cloudName: cloudNameB,
    uploadPreset: uploadPresetB,
    uploadEndpoint: `https://api.cloudinary.com/v1_1/${cloudNameB}/upload`,
  },
};
