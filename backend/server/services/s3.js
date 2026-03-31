import { S3Client, GetObjectCommand, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand, HeadObjectCommand, CopyObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as localStorage from './local-storage.js';
import config from '../config/environment.js';
import log from '../utils/console-logger.js';

// Check if explicit S3 credentials are configured in .env
const hasExplicitCredentials = () => {
  const hasValidAccessKey = config.aws.accessKeyId &&
    !config.aws.accessKeyId.includes('your_') &&
    !config.aws.accessKeyId.includes('optional');

  const hasValidSecretKey = config.aws.secretAccessKey &&
    !config.aws.secretAccessKey.includes('your_') &&
    !config.aws.secretAccessKey.includes('optional');

  return !!(hasValidAccessKey && hasValidSecretKey);
};

const isS3Configured = () => {
  return !!(config.aws.region && config.aws.bucketName);
};

// S3 Configuration - uses explicit credentials or IAM Role (auto-detected by SDK)
let s3Client = null;
if (isS3Configured()) {
  try {
    const clientConfig = { region: config.aws.region };

    if (hasExplicitCredentials()) {
      clientConfig.credentials = {
        accessKeyId: config.aws.accessKeyId,
        secretAccessKey: config.aws.secretAccessKey,
      };
      log.info('✅ S3 client configured with explicit credentials');
    } else {
      log.info('✅ S3 client configured with IAM Role (auto-detected)');
    }

    s3Client = new S3Client(clientConfig);
  } catch (error) {
    log.warn('⚠️  WARNING: Failed to initialize S3 client:', error.message);
  }
} else {
  log.warn('⚠️  WARNING: S3 not configured (missing region or bucket name).');
}

const BUCKET_NAME = config.aws.bucketName || 'paricus-reports';
const TALKDESK_RECORDINGS_BUCKET = process.env.TALKDESK_RECORDINGS_BUCKET || 'talkdesk-recordings-historical';
const URL_EXPIRATION = 300; // 5 minutes in seconds
const AUDIO_URL_EXPIRATION = 3600; // 1 hour for audio files (larger files need more time)

/**
 * Generate a pre-signed URL for downloading a file from S3
 * @param {string} key - S3 object key
 * @param {string} bucket - S3 bucket name (optional, uses default)
 * @returns {Promise<string>} - Pre-signed URL
 */
export async function generateDownloadUrl(key, bucket = BUCKET_NAME) {
  if (!s3Client) {
    throw new Error('S3 client not configured. Please configure AWS credentials in .env');
  }

  try {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const presignedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: URL_EXPIRATION,
    });

    return presignedUrl;
  } catch (error) {
    log.error('Error generating download URL:', error);
    throw new Error('Failed to generate download URL');
  }
}

/**
 * Generate a pre-signed URL for uploading a file to S3
 * @param {string} key - S3 object key
 * @param {string} contentType - File MIME type
 * @param {string} bucket - S3 bucket name (optional, uses default)
 * @returns {Promise<string>} - Pre-signed URL for upload
 */
export async function generateUploadUrl(key, contentType, bucket = BUCKET_NAME) {
  if (!s3Client) {
    throw new Error('S3 client not configured. Please configure AWS credentials in .env');
  }

  try {
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    });

    const presignedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: URL_EXPIRATION,
    });

    return presignedUrl;
  } catch (error) {
    log.error('Error generating upload URL:', error);
    throw new Error('Failed to generate upload URL');
  }
}

/**
 * List all client folders in S3
 * @returns {Promise<Array>} - Array of client folder names
 */
export async function listClientFolders() {
  if (!s3Client) {
    const folders = await localStorage.listLocalClientFolders();
    return folders;
  }

  try {
    const command = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: 'client-access-reports/',
      Delimiter: '/',
    });

    const response = await s3Client.send(command);

    // Extract folder names from CommonPrefixes
    const folders = response.CommonPrefixes?.map(prefix => {
      const folderName = prefix.Prefix.replace('client-access-reports/', '').replace('/', '');
      return folderName;
    }) || [];

    return folders;
  } catch (error) {
    log.error('Error listing client folders:', error);
    return [];
  }
}

/**
 * List reports for a specific client (only from bi-reports folder)
 * @param {string} clientFolderName - Client folder name (e.g., 'im-telecom')
 * @returns {Promise<Array>} - Array of report objects
 */
export async function listClientReports(clientFolderName) {
  if (!s3Client) {
    const prefix = `client-access-reports/${clientFolderName}/bi-reports/`;
    const files = await localStorage.listLocalFiles(prefix);
    return files.filter(f => f.key.endsWith('.pdf')).map(f => ({
      key: f.key,
      name: f.fileName,
      size: f.size,
      lastModified: f.lastModified,
      downloadUrl: null
    }));
  }

  try {
    const command = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: `client-access-reports/${clientFolderName}/bi-reports/`,
    });

    const response = await s3Client.send(command);

    const reports = response.Contents?.filter(obj =>
      obj.Key !== `client-access-reports/${clientFolderName}/bi-reports/` && // Exclude folder itself
      obj.Key.endsWith('.pdf')
    ).map(obj => ({
      key: obj.Key,
      name: obj.Key.split('/').pop(), // Get filename
      size: obj.Size,
      lastModified: obj.LastModified,
      downloadUrl: null // Will be generated when needed
    })) || [];

    return reports;
  } catch (error) {
    log.error('Error listing client reports:', error);
    return [];
  }
}

/**
 * Generate S3 key for a client report (in bi-reports subfolder)
 * @param {string} clientFolderName - Client folder name (e.g., 'im-telecom')
 * @param {string} fileName - Original file name
 * @returns {string} - S3 object key
 */
export function generateClientReportKey(clientFolderName, fileName) {
  // Sanitize filename
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `client-access-reports/${clientFolderName}/bi-reports/${sanitizedFileName}`;
}

/**
 * Generate S3 key for a report (legacy function - keeping for backward compatibility)
 * @param {number} clientId - Client ID
 * @param {string} reportName - Report name
 * @param {string} date - Date string (YYYY-MM-DD)
 * @param {string} extension - File extension (default: pdf)
 * @returns {string} - S3 object key
 */
export function generateReportKey(clientId, reportName, date, extension = 'pdf') {
  // Format: reports/client-{id}/{reportName}-{date}.{extension}
  const sanitizedName = reportName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  return `reports/client-${clientId}/${sanitizedName}-${date}.${extension}`;
}

/**
 * Get S3 bucket name
 * @returns {string} - S3 bucket name
 */
export function getBucketName() {
  return BUCKET_NAME;
}

/**
 * Delete a file from S3
 * @param {string} key - S3 object key
 * @param {string} bucket - S3 bucket name (optional, uses default)
 * @returns {Promise<boolean>} - Success status
 */
export async function deleteS3Object(key, bucket = BUCKET_NAME) {
  if (!s3Client) {
    throw new Error('S3 client not configured. Please configure AWS credentials in .env');
  }

  try {
    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    await s3Client.send(command);
    return true;
  } catch (error) {
    log.error('Error deleting S3 object:', error);
    throw new Error('Failed to delete file from S3');
  }
}

/**
 * List all invoices for a specific client folder
 * @param {string} clientFolderName - Client folder name
 * @returns {Promise<Array>} - Array of invoice objects
 */
export async function listClientInvoices(clientFolderName) {
  if (!s3Client) {
    log.warn('S3 client not configured, returning empty invoices list');
    return [];
  }

  try {
    const prefix = `client-access-reports/${clientFolderName}/invoices/`;

    const command = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: prefix,
    });

    const response = await s3Client.send(command);

    const invoiceObjects = response.Contents?.filter(obj => {
      return obj.Key !== prefix && obj.Key.endsWith('.pdf');
    }) || [];

    // Fetch metadata for each invoice to get payment link
    const invoices = await Promise.all(
      invoiceObjects.map(async (obj) => {
        const metadata = await getS3ObjectMetadata(obj.Key);
        return {
          key: obj.Key,
          fileName: obj.Key.split('/').pop(),
          size: obj.Size,
          lastModified: obj.LastModified,
          folder: clientFolderName,
          paymentLink: metadata.paymentlink || null
        };
      })
    );

    return invoices;
  } catch (error) {
    log.error('Error listing client invoices:', error);
    return [];
  }
}

/**
 * Generate S3 key for an invoice
 * @param {string} clientFolderName - Client folder name
 * @param {string} fileName - File name
 * @returns {string} - S3 object key
 */
export function generateClientInvoiceKey(clientFolderName, fileName) {
  // Sanitize filename
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  const currentYear = new Date().getFullYear();
  return `client-access-reports/${clientFolderName}/invoices/${currentYear}/${sanitizedFileName}`;
}

/**
 * Get S3 object metadata
 * @param {string} key - S3 object key
 * @param {string} bucket - S3 bucket name (optional, uses default)
 * @returns {Promise<Object>} - Object metadata
 */
export async function getS3ObjectMetadata(key, bucket = BUCKET_NAME) {
  if (!s3Client) {
    log.warn('S3 client not configured, returning empty metadata');
    return {};
  }

  try {
    const command = new HeadObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const response = await s3Client.send(command);
    return response.Metadata || {};
  } catch (error) {
    log.error('Error getting S3 object metadata:', error);
    return {};
  }
}

/**
 * Set S3 object metadata (updates metadata by copying object to itself)
 * @param {string} key - S3 object key
 * @param {Object} metadata - Metadata key-value pairs
 * @param {string} bucket - S3 bucket name (optional, uses default)
 * @returns {Promise<boolean>} - Success status
 */
export async function setS3ObjectMetadata(key, metadata, bucket = BUCKET_NAME) {
  if (!s3Client) {
    throw new Error('S3 client not configured. Please configure AWS credentials in .env');
  }

  try {
    const command = new CopyObjectCommand({
      Bucket: bucket,
      CopySource: `${bucket}/${key}`,
      Key: key,
      Metadata: metadata,
      MetadataDirective: 'REPLACE',
    });

    await s3Client.send(command);
    return true;
  } catch (error) {
    log.error('Error setting S3 object metadata:', error);
    throw new Error('Failed to set object metadata');
  }
}

/**
 * Generate a pre-signed URL for downloading an audio recording from Talkdesk bucket
 * @param {string} audioFileName - Audio file name from database
 * @returns {Promise<string>} - Pre-signed URL
 */
export async function generateAudioDownloadUrl(audioFileName) {
  if (!s3Client) {
    throw new Error('S3 client not configured. Please configure AWS credentials in .env');
  }

  try {
    const command = new GetObjectCommand({
      Bucket: TALKDESK_RECORDINGS_BUCKET,
      Key: audioFileName,
    });

    // Use longer expiration for audio files to handle large file downloads
    const presignedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: AUDIO_URL_EXPIRATION,
    });

    return presignedUrl;
  } catch (error) {
    log.error('Error generating audio download URL:', error);
    throw new Error('Failed to generate audio download URL');
  }
}

/**
 * Get Talkdesk recordings bucket name
 * @returns {string} - Talkdesk recordings bucket name
 */
export function getTalkdeskBucketName() {
  return TALKDESK_RECORDINGS_BUCKET;
}

export { s3Client, BUCKET_NAME, TALKDESK_RECORDINGS_BUCKET, isS3Configured };