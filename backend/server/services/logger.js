import { prisma } from '../database/prisma.js';
import log from '../utils/console-logger.js';

/**
 * Create a log entry in the database
 * @param {Object} logData - Log data
 * @param {string} logData.userId - ID of the user performing the action
 * @param {string} logData.eventType - Type of event (CREATE, UPDATE, DELETE, LOGIN, LOGOUT)
 * @param {string} logData.entity - Entity being affected (User, Role, Client, Invoice, etc.)
 * @param {string} logData.description - Description of the event
 * @param {string} logData.status - Status of the event (SUCCESS, FAILURE, WARNING)
 * @param {string} logData.ipAddress - IP address from which the action was performed (optional)
 */
export async function createLog({ userId, eventType, entity, description, status = 'SUCCESS', ipAddress = null }) {
  try {
    await prisma.log.create({
      data: {
        userId: userId.toString(),
        eventType,
        entity,
        description,
        status,
        ipAddress,
      },
    });
  } catch (error) {
    // Don't throw error to avoid breaking the main operation
    log.error('Error creating log:', error);
  }
}

/**
 * Log user login
 */
export async function logLogin(userId, email, success = true) {
  await createLog({
    userId: userId?.toString() || 'unknown',
    eventType: 'LOGIN',
    entity: 'Auth',
    description: success
      ? `User ${email} logged in successfully`
      : `Failed login attempt for ${email}`,
    status: success ? 'SUCCESS' : 'FAILURE',
  });
}

/**
 * Log user logout
 */
export async function logLogout(userId, email) {
  await createLog({
    userId: userId.toString(),
    eventType: 'LOGOUT',
    entity: 'Auth',
    description: `User ${email} logged out`,
    status: 'SUCCESS',
  });
}

/**
 * Log user creation
 */
export async function logUserCreate(performedByUserId, newUserEmail) {
  await createLog({
    userId: performedByUserId.toString(),
    eventType: 'CREATE',
    entity: 'User',
    description: `Created new user: ${newUserEmail}`,
    status: 'SUCCESS',
  });
}

/**
 * Log user update
 */
export async function logUserUpdate(performedByUserId, updatedUserEmail, changes = null) {
  await createLog({
    userId: performedByUserId.toString(),
    eventType: 'UPDATE',
    entity: 'User',
    description: changes
      ? `User ${updatedUserEmail}: ${changes}`
      : `Updated user: ${updatedUserEmail}`,
    status: 'SUCCESS',
  });
}

/**
 * Log user deletion
 */
export async function logUserDelete(performedByUserId, deletedUserEmail) {
  await createLog({
    userId: performedByUserId.toString(),
    eventType: 'DELETE',
    entity: 'User',
    description: `Deleted user: ${deletedUserEmail}`,
    status: 'SUCCESS',
  });
}

/**
 * Log invoice creation
 */
export async function logInvoiceCreate(performedByUserId, invoiceNumber, clientName, ipAddress = null) {
  await createLog({
    userId: performedByUserId.toString(),
    eventType: 'CREATE',
    entity: 'Invoice',
    description: `Created invoice ${invoiceNumber} for client: ${clientName}`,
    status: 'SUCCESS',
    ipAddress,
  });
}

/**
 * Log invoice update
 */
export async function logInvoiceUpdate(performedByUserId, invoiceNumber, changes) {
  await createLog({
    userId: performedByUserId.toString(),
    eventType: 'UPDATE',
    entity: 'Invoice',
    description: `Updated invoice ${invoiceNumber}: ${changes}`,
    status: 'SUCCESS',
  });
}

/**
 * Log invoice deletion
 */
export async function logInvoiceDelete(performedByUserId, invoiceNumber) {
  await createLog({
    userId: performedByUserId.toString(),
    eventType: 'DELETE',
    entity: 'Invoice',
    description: `Deleted invoice ${invoiceNumber}`,
    status: 'SUCCESS',
  });
}

/**
 * Log client creation
 */
export async function logClientCreate(performedByUserId, clientName) {
  await createLog({
    userId: performedByUserId.toString(),
    eventType: 'CREATE',
    entity: 'Client',
    description: `Created new client: ${clientName}`,
    status: 'SUCCESS',
  });
}

/**
 * Log client update
 */
export async function logClientUpdate(performedByUserId, clientName, changes = null) {
  await createLog({
    userId: performedByUserId.toString(),
    eventType: 'UPDATE',
    entity: 'Client',
    description: changes
      ? `Client ${clientName}: ${changes}`
      : `Updated client: ${clientName}`,
    status: 'SUCCESS',
  });
}

/**
 * Log client deletion
 */
export async function logClientDelete(performedByUserId, clientName) {
  await createLog({
    userId: performedByUserId.toString(),
    eventType: 'DELETE',
    entity: 'Client',
    description: `Deleted client: ${clientName}`,
    status: 'SUCCESS',
  });
}

/**
 * Log role creation
 */
export async function logRoleCreate(performedByUserId, roleName) {
  await createLog({
    userId: performedByUserId.toString(),
    eventType: 'CREATE',
    entity: 'Role',
    description: `Created new role: ${roleName}`,
    status: 'SUCCESS',
  });
}

/**
 * Log role update
 */
export async function logRoleUpdate(performedByUserId, roleName, changes) {
  await createLog({
    userId: performedByUserId.toString(),
    eventType: 'UPDATE',
    entity: 'Role',
    description: `Updated role ${roleName}: ${changes}`,
    status: 'SUCCESS',
  });
}

/**
 * Log role deletion
 */
export async function logRoleDelete(performedByUserId, roleName) {
  await createLog({
    userId: performedByUserId.toString(),
    eventType: 'DELETE',
    entity: 'Role',
    description: `Deleted role: ${roleName}`,
    status: 'SUCCESS',
  });
}

/**
 * Log announcement creation
 */
export async function logAnnouncementCreate(performedByUserId, title, recipientCount) {
  await createLog({
    userId: performedByUserId.toString(),
    eventType: 'CREATE',
    entity: 'Announcement',
    description: `Created announcement "${title}" for ${recipientCount} client(s)`,
    status: 'SUCCESS',
  });
}

/**
 * Log announcement deletion
 */
export async function logAnnouncementDelete(performedByUserId, title) {
  await createLog({
    userId: performedByUserId.toString(),
    eventType: 'DELETE',
    entity: 'Announcement',
    description: `Deleted announcement "${title}"`,
    status: 'SUCCESS',
  });
}

/**
 * Log carousel image save
 */
export async function logCarouselSave(performedByUserId, imageCount, clientId) {
  await createLog({
    userId: performedByUserId.toString(),
    eventType: 'CREATE',
    entity: 'Carousel',
    description: `Saved ${imageCount} carousel image(s)${clientId ? ` for client ${clientId}` : ' (global)'}`,
    status: 'SUCCESS',
  });
}

/**
 * Log carousel image deletion
 */
export async function logCarouselDelete(performedByUserId, imageId) {
  await createLog({
    userId: performedByUserId.toString(),
    eventType: 'DELETE',
    entity: 'Carousel',
    description: `Deleted carousel image (ID: ${imageId})`,
    status: 'SUCCESS',
  });
}

/**
 * Log profile update
 */
export async function logProfileUpdate(userId, email, changes = null) {
  await createLog({
    userId: userId.toString(),
    eventType: 'UPDATE',
    entity: 'Profile',
    description: changes
      ? `User ${email} updated profile: ${changes}`
      : `User ${email} updated profile`,
    status: 'SUCCESS',
  });
}

/**
 * Log password change (from profile)
 */
export async function logPasswordChange(userId, email, success = true) {
  await createLog({
    userId: userId.toString(),
    eventType: 'UPDATE',
    entity: 'Profile',
    description: success
      ? `User ${email} changed password`
      : `User ${email} failed password change attempt`,
    status: success ? 'SUCCESS' : 'FAILURE',
  });
}

/**
 * Log password reset (via forgot-password flow)
 */
export async function logPasswordReset(userId, email) {
  await createLog({
    userId: userId.toString(),
    eventType: 'UPDATE',
    entity: 'Auth',
    description: `User ${email} reset password via recovery code`,
    status: 'SUCCESS',
  });
}

/**
 * Log avatar upload
 */
export async function logAvatarUpload(userId, email) {
  await createLog({
    userId: userId.toString(),
    eventType: 'UPDATE',
    entity: 'Profile',
    description: `User ${email} uploaded profile photo`,
    status: 'SUCCESS',
  });
}

/**
 * Log avatar deletion
 */
export async function logAvatarDelete(userId, email) {
  await createLog({
    userId: userId.toString(),
    eventType: 'UPDATE',
    entity: 'Profile',
    description: `User ${email} removed profile photo`,
    status: 'SUCCESS',
  });
}
