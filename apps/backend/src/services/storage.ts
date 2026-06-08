import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { r2Client, BUCKET } from '../lib/r2';
import { randomUUID } from 'crypto';
import path from 'path';

/**
 * Generates a safe and unique R2 object key for a uploaded file.
 */
export const generateFileKey = (profileId: string, filename: string): string => {
  const safe = path.basename(filename).replace(/[^a-zA-Z0-9.\-_]/g, '_');
  return `documents/${profileId}/${randomUUID()}/${safe}`;
};

/**
 * Generates a presigned URL to PUT (upload) a file directly to R2.
 * Valid for 5 minutes (300 seconds).
 */
export const getPresignedUploadUrl = async (
  fileKey: string,
  contentType: string
): Promise<string> => {
  const cmd = new PutObjectCommand({
    Bucket: BUCKET,
    Key: fileKey,
    ContentType: contentType,
  });
  return getSignedUrl(r2Client, cmd, { expiresIn: 300 });
};

/**
 * Uploads a buffer directly to R2 from the server (used for generated artifacts
 * like compiled PDF exports, which are produced server-side rather than uploaded
 * by the client).
 */
export const uploadBuffer = async (
  fileKey: string,
  body: Uint8Array | Buffer,
  contentType: string
): Promise<void> => {
  await r2Client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: fileKey,
      Body: body,
      ContentType: contentType,
    })
  );
};

/**
 * Generates a presigned URL to GET (download) a file directly from R2.
 * Valid for 1 hour (3600 seconds).
 */
export const getPresignedDownloadUrl = async (fileKey: string): Promise<string> => {
  const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: fileKey });
  return getSignedUrl(r2Client, cmd, { expiresIn: 3600 });
};

/**
 * Deletes a file from the R2 bucket.
 */
export const deleteFile = async (fileKey: string): Promise<void> => {
  await r2Client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: fileKey }));
};

/**
 * Verifies if a file exists in the R2 bucket.
 */
export const fileExists = async (fileKey: string): Promise<boolean> => {
  try {
    await r2Client.send(new HeadObjectCommand({ Bucket: BUCKET, Key: fileKey }));
    return true;
  } catch {
    return false;
  }
};
