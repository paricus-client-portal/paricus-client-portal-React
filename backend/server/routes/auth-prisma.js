import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { prisma } from '../database/prisma.js';
import { authenticateToken } from '../middleware/auth-prisma.js';

import { authValidation, sanitizeInput } from '../middleware/validation.js';
import { logLogin, logLogout, logProfileUpdate, logPasswordChange, logPasswordReset, logAvatarUpload, logAvatarDelete } from '../services/logger.js';
import config from '../config/environment.js';
import log from '../utils/console-logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Avatar upload config
const AVATAR_DIR = path.join(__dirname, '../uploads/avatars');
if (!fs.existsSync(AVATAR_DIR)) {
  fs.mkdirSync(AVATAR_DIR, { recursive: true });
}

const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, AVATAR_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `avatar-${req.user.id}-${Date.now()}${ext}`);
  },
});

const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpeg|png|gif|webp)$/.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed (JPG, PNG, GIF, WEBP).'));
    }
  },
});

// Login endpoint
router.post('/login', 
  sanitizeInput(['email']), 
  authValidation.login, 
  async (req, res) => {
  try {

    const { email, password } = req.body;

    // Get user with role and permissions using Prisma
    const user = await prisma.user.findUnique({
      where: { 
        email: email,
        isActive: true
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            kbPrefix: true
          }
        },
        role: {
          include: {
            rolePermissions: {
              include: {
                permission: {
                  select: {
                    permissionName: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!user) {
      log.debug('Login failed: user not found');
      // Log failed login attempt
      await logLogin(null, email, false);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);

    if (!isValidPassword) {
      log.debug('Login failed: invalid password');
      // Log failed login attempt
      await logLogin(user.id, email, false);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    log.debug('Login successful');

    // Update last login (disabled temporarily due to SQLite timeout issues)
    // await prisma.user.update({
    //   where: { id: user.id },
    //   data: { lastLogin: new Date() }
    // });

    // Extract permissions
    const permissions = user.role?.rolePermissions.map(rp => rp.permission.permissionName) || [];

    // Generate JWT token with all necessary user data
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        clientId: user.clientId,
        roleId: user.roleId,
        permissions
      },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn }
    );

    // Log successful login
    await logLogin(user.id, email, true);

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        clientId: user.clientId,
        clientName: user.client?.name || null,
        kbPrefix: user.client?.kbPrefix || null,
        roleId: user.roleId,
        roleName: user.role?.roleName,
        permissions: permissions,
        avatarUrl: user.avatarUrl || null,
      }
    });
  } catch (error) {
    log.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Forgot password endpoint
router.post('/forgot-password', 
  sanitizeInput(['email']), 
  authValidation.forgotPassword, 
  async (req, res) => {
  try {

    const { email } = req.body;

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { 
        email: email,
        isActive: true
      },
      select: {
        id: true,
        email: true,
        firstName: true
      }
    });
    
    if (!user) {
      // Don't reveal if email exists or not for security
      return res.json({ message: 'If the email exists, a password reset link has been sent.' });
    }

    // Generate reset code (6 alphanumeric characters) — expires in 15 minutes
    const resetCode = crypto.randomBytes(4).toString('hex').toUpperCase();
    const resetCodeExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Log code to console (temporary — until email service is deployed)
    log.debug('Password reset code generated');

    // Save reset code to database
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: resetCode,
        passwordResetExpires: resetCodeExpires
      }
    });

    res.json({ message: 'If the email exists, a password reset code has been sent.' });
  } catch (error) {
    log.error('Forgot password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Verify reset code endpoint
router.post('/verify-code',
  authValidation.verifyCode,
  async (req, res) => {
  try {
    const { code } = req.body;

    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: code.toUpperCase(),
        passwordResetExpires: { gt: new Date() },
        isActive: true
      },
      select: { id: true }
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset code' });
    }

    res.json({ valid: true });
  } catch (error) {
    log.error('Verify code error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reset password endpoint
router.post('/reset-password',
  authValidation.resetPassword,
  async (req, res) => {
  try {
    const { token, password } = req.body;

    // Find user with valid reset token (token = 6-char code)
    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: token.toUpperCase(),
        passwordResetExpires: { gt: new Date() },
        isActive: true
      }
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset code' });
    }

    // Hash new password with configurable rounds
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Update password and clear reset token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: passwordHash,
        passwordResetToken: null,
        passwordResetExpires: null,
        updatedAt: new Date()
      }
    });

    await logPasswordReset(user.id, user.email);

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    log.error('Reset password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    res.json({
      user: {
        id: req.user.id,
        email: req.user.email,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        clientId: req.user.clientId,
        clientName: req.user.clientName,
        roleId: req.user.roleId,
        roleName: req.user.roleName,
        permissions: req.user.permissions || []
      }
    });
  } catch (error) {
    log.error('Profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Upload avatar image
router.post('/avatar', authenticateToken, avatarUpload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    // Delete old avatar file if exists
    const currentUser = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (currentUser?.avatarUrl) {
      const oldFile = currentUser.avatarUrl.replace('/api/auth/avatar/', '');
      const oldPath = path.join(AVATAR_DIR, oldFile);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    const avatarUrl = `/api/auth/avatar/${req.file.filename}`;
    await prisma.user.update({
      where: { id: req.user.id },
      data: { avatarUrl },
    });

    await logAvatarUpload(req.user.id, req.user.email);

    res.json({ success: true, avatarUrl });
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: 'Error uploading avatar' });
  }
});

// Serve avatar file
router.get('/avatar/:filename', (req, res) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(AVATAR_DIR, filename);
  if (!filePath.startsWith(AVATAR_DIR) || !fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Avatar not found' });
  }
  res.sendFile(filePath);
});

// Delete avatar
router.delete('/avatar', authenticateToken, async (req, res) => {
  try {
    const currentUser = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (currentUser?.avatarUrl) {
      const oldFile = currentUser.avatarUrl.replace('/api/auth/avatar/', '');
      const oldPath = path.join(AVATAR_DIR, oldFile);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
    await prisma.user.update({
      where: { id: req.user.id },
      data: { avatarUrl: null },
    });

    await logAvatarDelete(req.user.id, req.user.email);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting avatar' });
  }
});

// Update profile (name)
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { first_name, last_name } = req.body;

    const updateData = {};
    if (first_name !== undefined) updateData.firstName = first_name;
    if (last_name !== undefined) updateData.lastName = last_name;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: updateData,
      select: { id: true, email: true, firstName: true, lastName: true, avatarUrl: true },
    });

    const changes = Object.keys(updateData).join(', ');
    await logProfileUpdate(req.user.id, req.user.email, changes);

    res.json({ message: 'Profile updated successfully', user });
  } catch (error) {
    log.error('Profile update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Change password (authenticated user)
router.put('/profile/password', authenticateToken, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Current and new password are required' });
    }

    if (new_password.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }

    // Verify current password
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const isValid = await bcrypt.compare(current_password, user.passwordHash);

    if (!isValid) {
      await logPasswordChange(req.user.id, req.user.email, false);
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash and save new password
    const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    const passwordHash = await bcrypt.hash(new_password, saltRounds);

    await prisma.user.update({
      where: { id: req.user.id },
      data: { passwordHash, updatedAt: new Date() },
    });

    await logPasswordChange(req.user.id, req.user.email, true);

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    log.error('Password change error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Logout endpoint (client-side token removal)
router.post('/logout', authenticateToken, async (req, res) => {
  // Log logout
  await logLogout(req.user.id, req.user.email);

  res.json({ message: 'Logged out successfully' });
});

export default router;