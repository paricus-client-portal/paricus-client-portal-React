import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import jwt from 'jsonwebtoken';
import { authenticateToken } from '../middleware/auth-prisma.js';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import config from '../config/environment.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { prisma } from '../database/prisma.js';
import log from '../utils/console-logger.js';

const router = express.Router();

const STORAGE_MODE = config.storageMode || 'local';
const BUCKET_NAME = config.aws.bucketName || 'paricus-reports';

// Configure S3 client (only if using S3)
let s3Client;
if (STORAGE_MODE === 's3') {
  s3Client = new S3Client({
    region: config.aws.region,
    credentials: {
      accessKeyId: config.aws.accessKeyId,
      secretAccessKey: config.aws.secretAccessKey,
    },
  });
}

// Local storage path
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads', 'tickets');

// Configure multer based on storage mode
const storage = STORAGE_MODE === 'local'
  ? multer.diskStorage({
      destination: async (req, file, cb) => {
        // Handle both ticket attachment routes (/:id/attachments) and detail attachment routes (/:ticketId/details/:detailId/attachments)
        const ticketId = req.params.id || req.params.ticketId;
        const { clientId } = req.user;
        // Convert clientId to string for path.join
        const uploadPath = path.join(UPLOADS_DIR, String(clientId), ticketId);

        try {
          await fs.mkdir(uploadPath, { recursive: true });
          cb(null, uploadPath);
        } catch (error) {
          cb(error);
        }
      },
      filename: (req, file, cb) => {
        const timestamp = Date.now();
        const sanitizedFileName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        cb(null, `${timestamp}-${sanitizedFileName}`);
      },
    })
  : multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit per file
  },
  fileFilter: (req, file, cb) => {
    // Allow images, PDFs, and Office documents
    const allowedMimeTypes = [
      // Images
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      // PDFs
      'application/pdf',
      // Word documents
      'application/msword', // .doc
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      // Excel spreadsheets
      'application/vnd.ms-excel', // .xls
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      // PowerPoint presentations
      'application/vnd.ms-powerpoint', // .ppt
      'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
    ];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only images, PDFs, and Office documents (Word, Excel, PowerPoint) are allowed'), false);
    }
  }
});

/**
 * Helper function to sanitize filename - prevents path traversal attacks
 */
function sanitizeFileName(filename) {
  // Remove path separators and special characters
  return filename
    .replace(/^.*[\\\/]/, '') // Remove directory path
    .replace(/[^a-zA-Z0-9._-]/g, '_') // Replace special chars with underscore
    .substring(0, 255); // Limit length to prevent buffer overflow
}

/**
 * Helper function to add URL to attachment object
 * NOTE: URLs don't include token here - token will be added on client side
 */
function addUrlToAttachment(attachment, ticketId, detailId = null) {
  const urlPath = detailId
    ? `/api/tickets/${ticketId}/details/${detailId}/attachments/${attachment.id}/file`
    : `/api/tickets/${ticketId}/attachments/${attachment.id}/file`;

  return {
    ...attachment,
    url: urlPath,
  };
}

/**
 * Helper function to process ticket and add URLs to all attachments
 */
function processTicketWithUrls(ticket) {
  const processed = {
    ...ticket,
    description: ticket.description ? JSON.parse(ticket.description) : null,
  };

  // Add URLs to ticket attachments
  if (processed.attachments) {
    processed.attachments = processed.attachments.map(att =>
      addUrlToAttachment(att, ticket.id)
    );
  }

  // Add URLs to detail attachments
  if (processed.details) {
    processed.details = processed.details.map(detail => ({
      ...detail,
      attachments: detail.attachments?.map(att =>
        addUrlToAttachment(att, ticket.id, detail.id)
      ) || [],
    }));
  }

  return processed;
}

/**
 * @route   GET /api/tickets
 * @desc    Get all tickets for the authenticated user's client
 * @access  Private
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { clientId, id: userId, permissions } = req.user;
    const { limit, sortBy = 'createdAt', sortOrder = 'desc', clientId: queryClientId, userId: queryUserId } = req.query;

    // Determine user role and build where clause
    const isBPOAdmin = permissions?.includes('admin_clients');
    const isClientAdmin = permissions?.includes('view_invoices') && !isBPOAdmin;

    let whereClause = {};

    if (isBPOAdmin) {
      // BPO Admin: Can see ALL tickets, or filter by clientId/userId if provided
      if (queryUserId) {
        // If userId is provided, simulate viewing as that specific user
        const targetUserId = parseInt(queryUserId, 10);

        // Validate userId is a valid number
        if (isNaN(targetUserId) || targetUserId <= 0) {
          return res.status(400).json({
            error: 'Invalid userId parameter',
            message: 'userId must be a positive integer'
          });
        }

        // First get the target user to check their role
        const targetUser = await prisma.user.findUnique({
          where: { id: targetUserId },
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: { permission: true }
                }
              }
            }
          }
        });

        if (!targetUser) {
          return res.status(404).json({
            error: 'User not found',
            message: `User with ID ${targetUserId} does not exist`
          });
        }

        const targetPermissions = targetUser.role?.rolePermissions?.map(rp => rp.permission?.permissionName).filter(Boolean) || [];
        const isTargetClientAdmin = targetPermissions.includes('view_invoices');

        if (isTargetClientAdmin) {
          // Target user is Client Admin: show all tickets from their client
          whereClause = { clientId: targetUser.clientId };
        } else {
          // Target user is Client User: show only their tickets
          whereClause = {
            clientId: targetUser.clientId,
            OR: [
              { userId: targetUserId },
              { assignedToId: targetUserId },
            ],
          };
        }
      } else if (queryClientId) {
        // Only clientId provided: show all tickets from that client
        whereClause = { clientId: parseInt(queryClientId) };
      } else {
        // No filter: show all tickets
        whereClause = {};
      }
    } else if (isClientAdmin) {
      // Client Admin: Can see all tickets from their client company
      whereClause = { clientId };
    } else {
      // Client User: Can only see tickets assigned to them
      whereClause = {
        clientId,
        OR: [
          { userId }, // Tickets they created
          { assignedToId: userId }, // Tickets assigned to them
        ],
      };
    }

    // Build orderBy object - only allow specific fields for security
    const allowedSortFields = ['createdAt', 'updatedAt', 'subject', 'priority', 'status'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const sortDirection = sortOrder === 'asc' ? 'asc' : 'desc';

    const queryOptions = {
      where: whereClause,
      include: {
        details: {
          orderBy: { timestamp: 'asc' },
          include: {
            attachments: {
              orderBy: { uploadedAt: 'desc' },
            },
          },
        },
        attachments: {
          orderBy: { uploadedAt: 'desc' },
        },
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        department: {
          select: {
            id: true,
            name: true,
            email: true,
            responsibleUser: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              }
            }
          },
        },
      },
      orderBy: { [sortField]: sortDirection },
    };

    // Add limit if provided
    if (limit) {
      const parsedLimit = parseInt(limit);
      if (!isNaN(parsedLimit) && parsedLimit > 0) {
        queryOptions.take = parsedLimit;
      }
    }

    const tickets = await prisma.ticket.findMany(queryOptions);

    // Process tickets: parse description and add URLs to attachments
    const processedTickets = tickets.map(processTicketWithUrls);

    res.json({ data: processedTickets });
  } catch (error) {
    log.error('Error fetching tickets:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   GET /api/tickets/departments
 * @desc    Get list of departments that tickets can be assigned to
 * @access  Private
 */
router.get('/departments', authenticateToken, async (req, res) => {
  try {
    const departments = await prisma.department.findMany({
      where: {
        isActive: true,
      },
      include: {
        responsibleUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          }
        }
      },
      orderBy: {
        name: 'asc',
      }
    });

    // Format response
    const formattedDepartments = departments.map(dept => ({
      id: dept.id,
      name: dept.name,
      email: dept.email,
      description: dept.description,
      responsibleUser: dept.responsibleUser ? {
        id: dept.responsibleUser.id,
        fullName: `${dept.responsibleUser.firstName} ${dept.responsibleUser.lastName}`,
        email: dept.responsibleUser.email,
      } : null,
    }));

    res.json({ data: formattedDepartments });
  } catch (error) {
    log.error('Error fetching departments:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   GET /api/tickets/assignable-users
 * @desc    Get list of users that can be assigned tickets (legacy - kept for backward compatibility)
 * @access  Private
 */
router.get('/assignable-users', authenticateToken, async (req, res) => {
  try {
    const { clientId, permissions } = req.user;

    const isBPOAdmin = permissions?.includes('admin_clients');

    let users;

    if (isBPOAdmin) {
      // BPO Admin: Can assign to anyone in any client
      users = await prisma.user.findMany({
        where: {
          isActive: true,
        },
        include: {
          client: {
            select: {
              id: true,
              name: true,
            }
          },
          role: {
            select: {
              id: true,
              roleName: true,
            }
          }
        },
        orderBy: [
          { clientId: 'asc' },
          { firstName: 'asc' },
        ]
      });
    } else {
      // Client users: Can only assign to users within their own client
      users = await prisma.user.findMany({
        where: {
          clientId: clientId,
          isActive: true,
        },
        include: {
          client: {
            select: {
              id: true,
              name: true,
            }
          },
          role: {
            select: {
              id: true,
              roleName: true,
            }
          }
        },
        orderBy: [
          { firstName: 'asc' },
        ]
      });
    }

    // Format response
    const formattedUsers = users.map(user => ({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: `${user.firstName} ${user.lastName}`,
      clientId: user.clientId,
      clientName: user.client?.name,
      roleId: user.roleId,
      roleName: user.role?.roleName,
    }));

    res.json({ data: formattedUsers });
  } catch (error) {
    log.error('Error fetching assignable users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   GET /api/tickets/change-requests
 * @desc    Get all pending change requests (BPO Admin and Client Admin only)
 * @access  Private
 * @note    This route MUST be defined before /:id to avoid route conflicts
 */
router.get('/change-requests', authenticateToken, async (req, res) => {
  try {
    const { clientId, permissions } = req.user;
    const isBPOAdmin = permissions.includes('admin_users') && permissions.includes('admin_clients');

    let whereClause = {
      status: 'pending'
    };

    // If not BPO Admin, filter by client
    if (!isBPOAdmin) {
      whereClause.ticket = {
        clientId: clientId
      };
    }

    const changeRequests = await prisma.ticketChangeRequest.findMany({
      where: whereClause,
      include: {
        ticket: {
          select: {
            id: true,
            subject: true,
            status: true,
            priority: true,
            assignedToId: true,
            assignedTo: {
              select: {
                id: true,
                firstName: true,
                lastName: true
              }
            },
            client: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        requestedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        requestedAssignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json({
      success: true,
      data: changeRequests
    });
  } catch (error) {
    log.error('Error fetching change requests:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   GET /api/tickets/:id
 * @desc    Get a single ticket by ID
 * @access  Private
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { clientId, id: userId, permissions } = req.user;

    // Determine user role
    const isBPOAdmin = permissions?.includes('admin_clients');
    const isClientAdmin = permissions?.includes('view_invoices') && !isBPOAdmin;

    // Build where clause based on role
    let whereClause = { id };

    if (isBPOAdmin) {
      // BPO Admin: Can see any ticket
      whereClause = { id };
    } else if (isClientAdmin) {
      // Client Admin: Can see tickets from their client company
      whereClause = {
        id,
        clientId,
      };
    } else {
      // Client User: Can only see tickets they created or are assigned to
      whereClause = {
        id,
        clientId,
        OR: [
          { userId },
          { assignedToId: userId },
        ],
      };
    }

    const ticket = await prisma.ticket.findFirst({
      where: whereClause,
      include: {
        details: {
          orderBy: { timestamp: 'asc' },
          include: {
            attachments: {
              orderBy: { uploadedAt: 'desc' },
            },
            createdBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
        attachments: {
          orderBy: { uploadedAt: 'desc' },
        },
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        department: {
          select: {
            id: true,
            name: true,
            email: true,
            responsibleUser: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              }
            }
          },
        },
      },
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found or access denied' });
    }

    // Process ticket: parse description and add URLs to attachments
    const processedTicket = processTicketWithUrls(ticket);

    res.json({ data: processedTicket });
  } catch (error) {
    log.error('Error fetching ticket:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   POST /api/tickets
 * @desc    Create a new ticket
 * @access  Private
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { clientId, id: userId, permissions } = req.user;
    const { subject, priority, assignedToId, departmentId, description, url } = req.body;

    // Validation
    if (!subject || !priority || !description) {
      return res.status(400).json({
        error: 'Subject, priority, and description are required',
      });
    }

    // Validate that at least one of departmentId or assignedToId is provided
    if (!departmentId && !assignedToId) {
      return res.status(400).json({
        error: 'Either department or assigned user must be provided',
      });
    }

    const isBPOAdmin = permissions?.includes('admin_clients');

    // Validate departmentId if provided (preferred method)
    if (departmentId) {
      const department = await prisma.department.findFirst({
        where: {
          id: parseInt(departmentId),
          isActive: true,
        },
      });

      if (!department) {
        return res.status(400).json({
          error: 'Invalid department',
        });
      }
    }

    // Validate assignedToId if provided (legacy method)
    if (assignedToId && !departmentId) {
      // Build where clause based on user role
      const whereClause = {
        id: parseInt(assignedToId),
        isActive: true,
      };

      // If not BPO Admin, restrict to same client
      if (!isBPOAdmin) {
        whereClause.clientId = clientId;
      }

      const assignedUser = await prisma.user.findFirst({
        where: whereClause,
      });

      if (!assignedUser) {
        return res.status(400).json({
          error: isBPOAdmin
            ? 'Invalid assigned user'
            : 'Invalid assigned user or user not from your organization',
        });
      }
    }

    // Create description JSON object
    const descriptionJson = JSON.stringify({
      descriptionData: description,
      attachmentIds: [],
      url: url || null,
    });

    // Create ticket with initial description
    const ticket = await prisma.ticket.create({
      data: {
        clientId,
        userId,
        subject,
        priority,
        departmentId: departmentId ? parseInt(departmentId) : null,
        assignedToId: assignedToId ? parseInt(assignedToId) : null,
        status: 'Open',
        description: descriptionJson,
      },
      include: {
        details: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        department: {
          select: {
            id: true,
            name: true,
            email: true,
            responsibleUser: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              }
            }
          },
        },
      },
    });

    // Parse description JSON for response
    const ticketWithParsedDescription = {
      ...ticket,
      description: JSON.parse(ticket.description),
    };

    res.status(201).json({ data: ticketWithParsedDescription });
  } catch (error) {
    log.error('Error creating ticket:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   PUT /api/tickets/:id
 * @desc    Update a ticket
 * @access  Private
 */
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { clientId, id: userId, permissions } = req.user;
    const { subject, priority, status, assignedToId, departmentId } = req.body;

    // Determine user role
    const isBPOAdmin = permissions?.includes('admin_clients');
    const isClientAdmin = permissions?.includes('view_invoices') && !isBPOAdmin;

    // Build where clause based on role (same logic as GET endpoint)
    let whereClause = { id };

    if (isBPOAdmin) {
      // BPO Admin: Can update any ticket
      whereClause = { id };
    } else if (isClientAdmin) {
      // Client Admin: Can update tickets from their client company
      whereClause = {
        id,
        clientId,
      };
    } else {
      // Client User: Can only update tickets they created or are assigned to
      whereClause = {
        id,
        clientId,
        OR: [
          { userId },
          { assignedToId: userId },
        ],
      };
    }

    // Check if ticket exists and user has access to it
    const existingTicket = await prisma.ticket.findFirst({
      where: whereClause,
    });

    if (!existingTicket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Validate departmentId if provided
    if (departmentId !== undefined && departmentId !== null) {
      const department = await prisma.department.findFirst({
        where: {
          id: parseInt(departmentId),
          isActive: true,
        },
      });

      if (!department) {
        return res.status(400).json({
          error: 'Invalid department',
        });
      }
    }

    // Validate assignedToId if provided (legacy)
    if (assignedToId !== undefined && assignedToId !== null) {
      // Build where clause based on user role
      const assignedUserWhereClause = {
        id: parseInt(assignedToId),
        isActive: true,
      };

      // If not BPO Admin, restrict to same client
      if (!isBPOAdmin) {
        assignedUserWhereClause.clientId = clientId;
      }

      const assignedUser = await prisma.user.findFirst({
        where: assignedUserWhereClause,
      });

      if (!assignedUser) {
        return res.status(400).json({
          error: isBPOAdmin
            ? 'Invalid assigned user'
            : 'Invalid assigned user or user not from your organization',
        });
      }
    }

    // Build update data
    const updateData = {};
    if (subject !== undefined) updateData.subject = subject;
    if (priority !== undefined) updateData.priority = priority;
    if (status !== undefined) updateData.status = status;
    if (departmentId !== undefined) {
      updateData.departmentId = departmentId ? parseInt(departmentId) : null;
    }
    if (assignedToId !== undefined) {
      updateData.assignedToId = assignedToId ? parseInt(assignedToId) : null;
    }

    // Update ticket
    const ticket = await prisma.ticket.update({
      where: { id },
      data: updateData,
      include: {
        details: {
          orderBy: { timestamp: 'asc' },
        },
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        department: {
          select: {
            id: true,
            name: true,
            email: true,
            responsibleUser: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              }
            }
          },
        },
      },
    });

    // Parse description JSON
    const ticketWithParsedDescription = {
      ...ticket,
      description: ticket.description ? JSON.parse(ticket.description) : null,
    };

    res.json({ data: ticketWithParsedDescription });
  } catch (error) {
    log.error('Error updating ticket:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   POST /api/tickets/:id/details
 * @desc    Add a new detail/update to a ticket
 * @access  Private
 */
router.post('/:id/details', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { clientId, id: userId, permissions } = req.user;
    const { detail } = req.body;

    log.debug('Adding ticket detail:', { ticketId: id });

    if (!detail) {
      log.error('❌ Detail validation failed: Detail is required');
      return res.status(400).json({ error: 'Detail is required' });
    }

    // Determine user role
    const isBPOAdmin = permissions?.includes('admin_clients');
    const isClientAdmin = permissions?.includes('view_invoices') && !isBPOAdmin;

    // Build where clause based on role (same logic as GET endpoint)
    let whereClause = { id };

    if (isBPOAdmin) {
      // BPO Admin: Can update any ticket
      whereClause = { id };
    } else if (isClientAdmin) {
      // Client Admin: Can update tickets from their client company
      whereClause = {
        id,
        clientId,
      };
    } else {
      // Client User: Can only update tickets they created or are assigned to
      whereClause = {
        id,
        clientId,
        OR: [
          { userId },
          { assignedToId: userId },
        ],
      };
    }

    // Check if ticket exists and user has access to it
    const existingTicket = await prisma.ticket.findFirst({
      where: whereClause,
    });

    if (!existingTicket) {
      log.error('Ticket not found or access denied:', { ticketId: id });
      return res.status(404).json({ error: 'Ticket not found' });
    }

    log.debug('Ticket found, creating detail...');

    // Add new detail
    const ticketDetail = await prisma.ticketDetail.create({
      data: {
        ticketId: id,
        detailData: detail,
        createdById: req.user.userId,
      },
    });

    log.debug('Detail created:', ticketDetail.id);

    // Get updated ticket with all details
    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        details: {
          orderBy: { timestamp: 'asc' },
          include: {
            attachments: {
              orderBy: { uploadedAt: 'desc' },
            },
            createdBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
        attachments: {
          orderBy: { uploadedAt: 'desc' },
        },
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    // Process ticket: parse description and add URLs to attachments
    const processedTicket = processTicketWithUrls(ticket);

    log.debug('Ticket detail added successfully');
    res.status(201).json({ data: processedTicket });
  } catch (error) {
    log.error('❌ Error adding detail:', error);
    log.debug('Error stack:', error.stack);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   DELETE /api/tickets/:id
 * @desc    Delete a ticket
 * @access  Private (Admin only)
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { clientId, id: userId, permissions } = req.user;

    // Determine user role
    const isBPOAdmin = permissions?.includes('admin_clients');
    const isClientAdmin = permissions?.includes('view_invoices') && !isBPOAdmin;

    // Build where clause based on role (same logic as GET endpoint)
    let whereClause = { id };

    if (isBPOAdmin) {
      // BPO Admin: Can delete any ticket
      whereClause = { id };
    } else if (isClientAdmin) {
      // Client Admin: Can delete tickets from their client company
      whereClause = {
        id,
        clientId,
      };
    } else {
      // Client User: Can only delete tickets they created or are assigned to
      whereClause = {
        id,
        clientId,
        OR: [
          { userId },
          { assignedToId: userId },
        ],
      };
    }

    // Check if ticket exists and user has access to it
    const existingTicket = await prisma.ticket.findFirst({
      where: whereClause,
      include: { attachments: true },
    });

    if (!existingTicket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Delete attachments from storage
    if (existingTicket.attachments.length > 0) {
      await Promise.all(
        existingTicket.attachments.map(async (attachment) => {
          try {
            if (STORAGE_MODE === 's3') {
              const deleteCommand = new DeleteObjectCommand({
                Bucket: attachment.s3Bucket,
                Key: attachment.s3Key,
              });
              await s3Client.send(deleteCommand);
            } else {
              const filePath = path.join(UPLOADS_DIR, attachment.s3Key);
              await fs.unlink(filePath);
            }
          } catch (error) {
            log.error('Error deleting attachment file:', error);
          }
        })
      );
    }

    // Delete ticket (descriptions and attachments will be cascade deleted)
    await prisma.ticket.delete({
      where: { id },
    });

    res.json({ message: 'Ticket deleted successfully' });
  } catch (error) {
    log.error('Error deleting ticket:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   POST /api/tickets/:id/attachments
 * @desc    Upload an image attachment to a ticket
 * @access  Private
 */
router.post('/:id/attachments', authenticateToken, (req, res, next) => {
  log.debug('Starting file upload...');
  upload.single('image')(req, res, (err) => {
    if (err) {
      log.error('❌ Multer error:', err);
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'File size too large. Maximum 10MB allowed.' });
        }
        return res.status(400).json({ error: `Upload error: ${err.message}` });
      }
      return res.status(500).json({ error: 'Internal server error' });
    }
    next();
  });
}, async (req, res) => {
  let localFilePath = null;

  try {
    const { id: ticketId } = req.params;
    const { clientId, id: userId, permissions } = req.user;

    log.debug('Upload attachment request:', { ticketId, hasFile: !!req.file });

    // Validate file first
    if (!req.file) {
      log.error('❌ No file in request');
      return res.status(400).json({ error: 'No image file provided' });
    }

    log.debug('File details:', {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
    });

    // Store local file path for cleanup if needed
    if (STORAGE_MODE === 'local' && req.file.path) {
      localFilePath = req.file.path;
    }

    // Determine user role
    const isBPOAdmin = permissions?.includes('admin_clients');
    const isClientAdmin = permissions?.includes('view_invoices') && !isBPOAdmin;

    // Build where clause based on role (same logic as other endpoints)
    let whereClause = { id: ticketId };

    if (isBPOAdmin) {
      // BPO Admin: Can upload to any ticket
      whereClause = { id: ticketId };
    } else if (isClientAdmin) {
      // Client Admin: Can upload to tickets from their client company
      whereClause = {
        id: ticketId,
        clientId,
      };
    } else {
      // Client User: Can only upload to tickets they created or are assigned to
      whereClause = {
        id: ticketId,
        clientId,
        OR: [
          { userId },
          { assignedToId: userId },
        ],
      };
    }

    // Check if ticket exists and user has access to it
    log.debug('Looking for ticket:', { ticketId });
    const ticket = await prisma.ticket.findFirst({
      where: whereClause,
    });

    if (!ticket) {
      log.error('Ticket not found or access denied:', { ticketId });
      // Clean up uploaded file if ticket doesn't exist
      if (localFilePath) {
        try {
          await fs.unlink(localFilePath);
        } catch (cleanupError) {
          log.error('Error cleaning up file:', cleanupError);
        }
      }
      return res.status(404).json({ error: 'Ticket not found' });
    }

    log.debug('Ticket found, proceeding with attachment save');

    let s3Key, s3Bucket;

    if (STORAGE_MODE === 's3') {
      // Generate S3 key for the image
      const timestamp = Date.now();
      const sanitizedFileName = req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
      s3Key = `tickets/${clientId}/${ticketId}/${timestamp}-${sanitizedFileName}`;
      s3Bucket = BUCKET_NAME;

      // Upload to S3
      const uploadCommand = new PutObjectCommand({
        Bucket: s3Bucket,
        Key: s3Key,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      });

      await s3Client.send(uploadCommand);
    } else {
      // Local storage - file already saved by multer
      // Store relative path from uploads directory
      s3Key = path.relative(UPLOADS_DIR, req.file.path).replace(/\\/g, '/');
      s3Bucket = 'local';
    }

    // Save attachment record in database with retry logic for SQLite
    let attachment;
    let retries = 3;
    let lastError;

    while (retries > 0) {
      try {
        log.debug(`Saving attachment to database (attempt ${4 - retries}/3)...`);
        attachment = await prisma.ticketAttachment.create({
          data: {
            ticketId,
            fileName: req.file.originalname,
            s3Key,
            s3Bucket,
            fileSize: req.file.size,
            mimeType: req.file.mimetype,
          },
        });
        log.debug('Attachment saved to database:', attachment.id);
        break; // Success, exit retry loop
      } catch (dbError) {
        log.error(`❌ Database error (attempt ${4 - retries}/3):`, dbError.message);
        lastError = dbError;
        retries--;

        if (retries > 0) {
          // Wait a bit before retrying (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 100 * (4 - retries)));
        }
      }
    }

    if (!attachment) {
      // Database save failed after retries
      log.error('❌ Failed to save attachment to database after retries:', lastError);

      // Clean up uploaded file
      if (localFilePath) {
        try {
          await fs.unlink(localFilePath);
        } catch (cleanupError) {
          log.error('Error cleaning up file:', cleanupError);
        }
      }

      throw new Error('Failed to save attachment to database. Please try again.');
    }

    log.debug('Attachment upload complete');
    res.status(201).json({ data: attachment });
  } catch (error) {
    log.error('❌ Error uploading attachment:', error);
    log.debug('Error stack:', error.stack);

    // Clean up file on error if in local mode
    if (localFilePath) {
      try {
        await fs.unlink(localFilePath);
      } catch (cleanupError) {
        log.error('Error cleaning up file on error:', cleanupError);
      }
    }

    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   GET /api/tickets/:ticketId/attachments/:attachmentId/url
 * @desc    Get a pre-signed URL to download/view an attachment
 * @access  Private
 */
router.get('/:ticketId/attachments/:attachmentId/url', authenticateToken, async (req, res) => {
  try {
    const { ticketId, attachmentId } = req.params;
    const { clientId } = req.user;

    // Check if ticket exists and belongs to user's client
    const ticket = await prisma.ticket.findFirst({
      where: { id: ticketId, clientId },
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Get attachment
    const attachment = await prisma.ticketAttachment.findFirst({
      where: {
        id: parseInt(attachmentId),
        ticketId,
      },
    });

    if (!attachment) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    let url;

    if (STORAGE_MODE === 's3') {
      // Generate pre-signed URL for S3
      const command = new GetObjectCommand({
        Bucket: attachment.s3Bucket,
        Key: attachment.s3Key,
      });

      url = await getSignedUrl(s3Client, command, { expiresIn: 3600 }); // 1 hour
    } else {
      // For local storage, generate a URL to serve the file
      url = `/api/tickets/${ticketId}/attachments/${attachmentId}/file`;
    }

    res.json({ url });
  } catch (error) {
    log.error('Error generating attachment URL:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Helper function to verify token from query parameter or header
 */
function authenticateTokenFlexible(req, res, next) {
  // Try to get token from query parameter first (for <img> tags)
  let token = req.query.token;

  // If not in query, try Authorization header (for API calls)
  if (!token) {
    const authHeader = req.headers['authorization'];
    token = authHeader && authHeader.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    req.user = {
      userId: decoded.userId,
      clientId: decoded.clientId,
      roleId: decoded.roleId,
      permissions: decoded.permissions || []
    };
    next();
  });
}

/**
 * @route   GET /api/tickets/:ticketId/attachments/:attachmentId/file
 * @desc    Serve local attachment file
 * @access  Private (supports token in query param for <img> tags)
 */
router.get('/:ticketId/attachments/:attachmentId/file', authenticateTokenFlexible, async (req, res) => {
  try {
    const { ticketId, attachmentId } = req.params;
    const { clientId } = req.user;

    // Check if ticket exists and belongs to user's client
    const ticket = await prisma.ticket.findFirst({
      where: { id: ticketId, clientId },
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Get attachment
    const attachment = await prisma.ticketAttachment.findFirst({
      where: {
        id: parseInt(attachmentId),
        ticketId,
      },
    });

    if (!attachment) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    if (attachment.s3Bucket !== 'local') {
      return res.status(400).json({ error: 'This endpoint is only for local files' });
    }

    // Build file path
    const filePath = path.join(UPLOADS_DIR, attachment.s3Key);

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      return res.status(404).json({ error: 'File not found on disk' });
    }

    // Set appropriate headers
    res.setHeader('Content-Type', attachment.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${attachment.fileName}"`);

    // Stream the file
    res.sendFile(filePath);
  } catch (error) {
    log.error('Error serving attachment file:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   DELETE /api/tickets/:ticketId/attachments/:attachmentId
 * @desc    Delete an attachment
 * @access  Private
 */
router.delete('/:ticketId/attachments/:attachmentId', authenticateToken, async (req, res) => {
  try {
    const { ticketId, attachmentId } = req.params;
    const { clientId, id: userId, permissions } = req.user;

    // Determine user role
    const isBPOAdmin = permissions?.includes('admin_clients');
    const isClientAdmin = permissions?.includes('view_invoices') && !isBPOAdmin;

    // Build where clause based on role (same logic as other endpoints)
    let whereClause = { id: ticketId };

    if (isBPOAdmin) {
      // BPO Admin: Can delete attachments from any ticket
      whereClause = { id: ticketId };
    } else if (isClientAdmin) {
      // Client Admin: Can delete attachments from tickets in their client company
      whereClause = {
        id: ticketId,
        clientId,
      };
    } else {
      // Client User: Can only delete attachments from tickets they created or are assigned to
      whereClause = {
        id: ticketId,
        clientId,
        OR: [
          { userId },
          { assignedToId: userId },
        ],
      };
    }

    // Check if ticket exists and user has access to it
    const ticket = await prisma.ticket.findFirst({
      where: whereClause,
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Get attachment
    const attachment = await prisma.ticketAttachment.findFirst({
      where: {
        id: parseInt(attachmentId),
        ticketId,
      },
    });

    if (!attachment) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    // Delete file based on storage mode
    if (STORAGE_MODE === 's3') {
      // Delete from S3
      try {
        const deleteCommand = new DeleteObjectCommand({
          Bucket: attachment.s3Bucket,
          Key: attachment.s3Key,
        });
        await s3Client.send(deleteCommand);
      } catch (error) {
        log.error('Error deleting from S3:', error);
      }
    } else {
      // Delete from local storage
      try {
        const filePath = path.join(UPLOADS_DIR, attachment.s3Key);
        await fs.unlink(filePath);
      } catch (error) {
        log.error('Error deleting local file:', error);
      }
    }

    // Delete from database
    await prisma.ticketAttachment.delete({
      where: { id: parseInt(attachmentId) },
    });

    res.json({ message: 'Attachment deleted successfully' });
  } catch (error) {
    log.error('Error deleting attachment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   POST /api/tickets/:ticketId/details/:detailId/attachments
 * @desc    Upload attachment for a ticket detail
 * @access  Private
 */
router.post('/:ticketId/details/:detailId/attachments', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    const { ticketId, detailId } = req.params;
    const { clientId, id: userId, permissions } = req.user;

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // SECURITY: Validate file size (additional check beyond multer)
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    if (req.file.size > MAX_FILE_SIZE) {
      return res.status(400).json({ error: 'File size exceeds 5MB limit' });
    }

    // Determine user role
    const isBPOAdmin = permissions?.includes('admin_clients');
    const isClientAdmin = permissions?.includes('view_invoices') && !isBPOAdmin;

    // Build where clause based on role (same logic as other endpoints)
    let whereClause = { id: ticketId };

    if (isBPOAdmin) {
      // BPO Admin: Can upload to any ticket
      whereClause = { id: ticketId };
    } else if (isClientAdmin) {
      // Client Admin: Can upload to tickets from their client company
      whereClause = {
        id: ticketId,
        clientId,
      };
    } else {
      // Client User: Can only upload to tickets they created or are assigned to
      whereClause = {
        id: ticketId,
        clientId,
        OR: [
          { userId },
          { assignedToId: userId },
        ],
      };
    }

    // Check if ticket exists and user has access to it
    const ticket = await prisma.ticket.findFirst({
      where: whereClause,
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // SECURITY: Check if detail exists AND belongs to the ticket
    const detail = await prisma.ticketDetail.findFirst({
      where: {
        id: parseInt(detailId),
        ticketId, // CRITICAL: Verify detail belongs to this ticket
      },
    });

    if (!detail) {
      return res.status(404).json({ error: 'Ticket detail not found or does not belong to this ticket' });
    }

    // SECURITY: Sanitize filename to prevent path traversal attacks
    const sanitizedFileName = sanitizeFileName(req.file.originalname);

    let s3Key, s3Bucket;

    if (STORAGE_MODE === 's3') {
      // Upload to S3 - use sanitized filename
      const fileKey = `tickets/${clientId}/${ticketId}/details/${detailId}/${Date.now()}-${sanitizedFileName}`;
      const uploadCommand = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: fileKey,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      });

      await s3Client.send(uploadCommand);

      s3Key = fileKey;
      s3Bucket = BUCKET_NAME;
    } else {
      // Local storage - file already saved by multer
      const relativePath = path.relative(UPLOADS_DIR, req.file.path);

      // SECURITY: Validate path doesn't escape UPLOADS_DIR
      const absolutePath = path.resolve(UPLOADS_DIR, relativePath);
      if (!absolutePath.startsWith(path.resolve(UPLOADS_DIR))) {
        throw new Error('Invalid file path detected');
      }

      s3Key = relativePath.replace(/\\/g, '/');
      s3Bucket = 'local';
    }

    // Create attachment record with sanitized filename
    const attachment = await prisma.ticketDetailAttachment.create({
      data: {
        ticketDetailId: parseInt(detailId),
        fileName: sanitizedFileName, // Use sanitized filename
        s3Key,
        s3Bucket,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
      },
    });

    res.status(201).json({ data: attachment });
  } catch (error) {
    log.error('Error uploading detail attachment:', error);

    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   GET /api/tickets/:ticketId/details/:detailId/attachments/:attachmentId/url
 * @desc    Get a pre-signed URL to download/view a detail attachment
 * @access  Private
 */
router.get('/:ticketId/details/:detailId/attachments/:attachmentId/url', authenticateToken, async (req, res) => {
  try {
    const { ticketId, detailId, attachmentId } = req.params;
    const { clientId } = req.user;

    // Check if ticket exists and belongs to user's client
    const ticket = await prisma.ticket.findFirst({
      where: { id: ticketId, clientId },
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Get attachment
    const attachment = await prisma.ticketDetailAttachment.findFirst({
      where: {
        id: parseInt(attachmentId),
        ticketDetailId: parseInt(detailId),
      },
    });

    if (!attachment) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    let url;

    if (STORAGE_MODE === 's3') {
      // Generate pre-signed URL for S3
      const command = new GetObjectCommand({
        Bucket: attachment.s3Bucket,
        Key: attachment.s3Key,
      });

      url = await getSignedUrl(s3Client, command, { expiresIn: 3600 }); // 1 hour
    } else {
      // For local storage, generate a URL to serve the file
      url = `/api/tickets/${ticketId}/details/${detailId}/attachments/${attachmentId}/file`;
    }

    res.json({ url });
  } catch (error) {
    log.error('Error generating detail attachment URL:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   GET /api/tickets/:ticketId/details/:detailId/attachments/:attachmentId/file
 * @desc    Serve local detail attachment file
 * @access  Private (supports token in query param for <img> tags)
 */
router.get('/:ticketId/details/:detailId/attachments/:attachmentId/file', authenticateTokenFlexible, async (req, res) => {
  try {
    const { ticketId, detailId, attachmentId } = req.params;
    const { clientId } = req.user;

    // Check if ticket exists and belongs to user's client
    const ticket = await prisma.ticket.findFirst({
      where: { id: ticketId, clientId },
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // SECURITY: Verify detail belongs to ticket
    const detail = await prisma.ticketDetail.findFirst({
      where: {
        id: parseInt(detailId),
        ticketId, // Ensure detail belongs to this ticket
      },
    });

    if (!detail) {
      return res.status(404).json({ error: 'Ticket detail not found or does not belong to this ticket' });
    }

    // Get attachment and verify it belongs to the detail
    const attachment = await prisma.ticketDetailAttachment.findFirst({
      where: {
        id: parseInt(attachmentId),
        ticketDetailId: parseInt(detailId),
      },
    });

    if (!attachment) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    if (attachment.s3Bucket !== 'local') {
      return res.status(400).json({ error: 'This endpoint is only for local files' });
    }

    // Build file path
    const filePath = path.join(UPLOADS_DIR, attachment.s3Key);

    // SECURITY: Validate the resolved path is within UPLOADS_DIR
    const resolvedPath = path.resolve(filePath);
    const resolvedUploadsDir = path.resolve(UPLOADS_DIR);
    if (!resolvedPath.startsWith(resolvedUploadsDir)) {
      log.error('Path traversal attempt detected:', { filePath, resolvedPath, resolvedUploadsDir });
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if file exists
    try {
      await fs.access(resolvedPath);
    } catch {
      return res.status(404).json({ error: 'File not found on disk' });
    }

    // SECURITY: Sanitize filename for Content-Disposition header
    const safeFileName = attachment.fileName.replace(/["\r\n]/g, '');

    // Set appropriate headers
    res.setHeader('Content-Type', attachment.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${safeFileName}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff'); // Prevent MIME type sniffing
    res.setHeader('Cache-Control', 'private, max-age=3600'); // Cache for 1 hour

    // Stream the file
    res.sendFile(resolvedPath);
  } catch (error) {
    log.error('Error serving detail attachment file:', error);

    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   DELETE /api/tickets/:ticketId/details/:detailId/attachments/:attachmentId
 * @desc    Delete a detail attachment
 * @access  Private
 */
router.delete('/:ticketId/details/:detailId/attachments/:attachmentId', authenticateToken, async (req, res) => {
  try {
    const { ticketId, detailId, attachmentId } = req.params;
    const { clientId, id: userId, permissions } = req.user;

    // Determine user role
    const isBPOAdmin = permissions?.includes('admin_clients');
    const isClientAdmin = permissions?.includes('view_invoices') && !isBPOAdmin;

    // Build where clause based on role (same logic as other endpoints)
    let whereClause = { id: ticketId };

    if (isBPOAdmin) {
      // BPO Admin: Can delete detail attachments from any ticket
      whereClause = { id: ticketId };
    } else if (isClientAdmin) {
      // Client Admin: Can delete detail attachments from tickets in their client company
      whereClause = {
        id: ticketId,
        clientId,
      };
    } else {
      // Client User: Can only delete detail attachments from tickets they created or are assigned to
      whereClause = {
        id: ticketId,
        clientId,
        OR: [
          { userId },
          { assignedToId: userId },
        ],
      };
    }

    // Check if ticket exists and user has access to it
    const ticket = await prisma.ticket.findFirst({
      where: whereClause,
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Get attachment
    const attachment = await prisma.ticketDetailAttachment.findFirst({
      where: {
        id: parseInt(attachmentId),
        ticketDetailId: parseInt(detailId),
      },
    });

    if (!attachment) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    // Delete file based on storage mode
    if (STORAGE_MODE === 's3') {
      // Delete from S3
      try {
        const deleteCommand = new DeleteObjectCommand({
          Bucket: attachment.s3Bucket,
          Key: attachment.s3Key,
        });
        await s3Client.send(deleteCommand);
      } catch (error) {
        log.error('Error deleting from S3:', error);
      }
    } else {
      // Delete from local storage
      try {
        const filePath = path.join(UPLOADS_DIR, attachment.s3Key);
        await fs.unlink(filePath);
      } catch (error) {
        log.error('Error deleting local file:', error);
      }
    }

    // Delete from database
    await prisma.ticketDetailAttachment.delete({
      where: { id: parseInt(attachmentId) },
    });

    res.json({ message: 'Detail attachment deleted successfully' });
  } catch (error) {
    log.error('Error deleting detail attachment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// TICKET CHANGE REQUESTS ENDPOINTS
// ============================================================================

/**
 * @route   POST /api/tickets/:id/change-request
 * @desc    Create a change request for a ticket (Client users only)
 * @access  Private
 */
router.post('/:id/change-request', authenticateToken, async (req, res) => {
  try {
    const { id: ticketId } = req.params;
    const { id: userId, clientId, permissions } = req.user;
    const { requestedStatus, requestedPriority, requestedAssignedToId, requestedDepartmentId } = req.body;

    // Check if user is BPO Admin or Client Admin - they should use direct update
    const isBPOAdmin = permissions.includes('admin_users') && permissions.includes('admin_clients');

    if (isBPOAdmin) {
      return res.status(400).json({
        error: 'BPO Admins should use direct update instead of change requests'
      });
    }

    // Validate that at least one change is requested
    if (!requestedStatus && !requestedPriority && requestedAssignedToId === undefined && requestedDepartmentId === undefined) {
      return res.status(400).json({
        error: 'At least one change (status, priority, department, or assignedTo) must be requested'
      });
    }

    // Validate requestedDepartmentId if provided
    if (requestedDepartmentId !== undefined && requestedDepartmentId !== null) {
      const department = await prisma.department.findFirst({
        where: {
          id: parseInt(requestedDepartmentId),
          isActive: true,
        },
      });

      if (!department) {
        return res.status(400).json({
          error: 'Invalid department',
        });
      }
    }

    // Fetch the ticket to get current values
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        clientId: true,
        status: true,
        priority: true,
        assignedToId: true,
        departmentId: true
      }
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Verify ticket belongs to user's client
    if (ticket.clientId !== clientId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if there's already a pending change request for this ticket
    const existingRequest = await prisma.ticketChangeRequest.findFirst({
      where: {
        ticketId: ticketId,
        status: 'pending'
      }
    });

    if (existingRequest) {
      return res.status(400).json({
        error: 'There is already a pending change request for this ticket. Please wait for it to be reviewed.'
      });
    }

    // Create the change request
    const changeRequest = await prisma.ticketChangeRequest.create({
      data: {
        ticketId: ticketId,
        requestedById: userId,
        requestedStatus: requestedStatus || null,
        requestedPriority: requestedPriority || null,
        requestedAssignedToId: requestedAssignedToId || null,
        requestedDepartmentId: requestedDepartmentId ? parseInt(requestedDepartmentId) : null,
        currentStatus: ticket.status,
        currentPriority: ticket.priority,
        currentAssignedToId: ticket.assignedToId,
        currentDepartmentId: ticket.departmentId,
        status: 'pending'
      },
      include: {
        ticket: {
          select: {
            id: true,
            subject: true
          }
        },
        requestedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        requestedDepartment: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    res.status(201).json({
      success: true,
      message: 'Change request created successfully',
      data: changeRequest
    });
  } catch (error) {
    log.error('Error creating change request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   PUT /api/tickets/change-requests/:id/approve
 * @desc    Approve a change request and apply changes to the ticket
 * @access  Private (BPO Admin and Client Admin only)
 */
router.put('/change-requests/:id/approve', authenticateToken, async (req, res) => {
  try {
    const { id: changeRequestId } = req.params;
    const { id: userId, clientId, permissions } = req.user;

    const isBPOAdmin = permissions.includes('admin_users') && permissions.includes('admin_clients');

    // Fetch the change request
    const changeRequest = await prisma.ticketChangeRequest.findUnique({
      where: { id: parseInt(changeRequestId) },
      include: {
        ticket: true
      }
    });

    if (!changeRequest) {
      return res.status(404).json({ error: 'Change request not found' });
    }

    // Verify access
    if (!isBPOAdmin && changeRequest.ticket.clientId !== clientId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (changeRequest.status !== 'pending') {
      return res.status(400).json({ error: 'Change request has already been processed' });
    }

    // Build the update data for the ticket
    const ticketUpdateData = {};
    if (changeRequest.requestedStatus) {
      ticketUpdateData.status = changeRequest.requestedStatus;
    }
    if (changeRequest.requestedPriority) {
      ticketUpdateData.priority = changeRequest.requestedPriority;
    }
    if (changeRequest.requestedAssignedToId !== null) {
      ticketUpdateData.assignedToId = changeRequest.requestedAssignedToId;
    }
    if (changeRequest.requestedDepartmentId !== null) {
      ticketUpdateData.departmentId = changeRequest.requestedDepartmentId;
    }

    // Use a transaction to update both the change request and the ticket
    const result = await prisma.$transaction([
      // Update the change request
      prisma.ticketChangeRequest.update({
        where: { id: parseInt(changeRequestId) },
        data: {
          status: 'approved',
          reviewedById: userId,
          reviewedAt: new Date()
        }
      }),
      // Update the ticket
      prisma.ticket.update({
        where: { id: changeRequest.ticketId },
        data: ticketUpdateData,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          },
          assignedTo: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          },
          department: {
            select: {
              id: true,
              name: true,
              email: true,
              responsibleUser: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true
                }
              }
            }
          }
        }
      })
    ]);

    res.json({
      success: true,
      message: 'Change request approved and changes applied',
      data: {
        changeRequest: result[0],
        ticket: result[1]
      }
    });
  } catch (error) {
    log.error('Error approving change request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   PUT /api/tickets/change-requests/:id/reject
 * @desc    Reject a change request
 * @access  Private (BPO Admin and Client Admin only)
 */
router.put('/change-requests/:id/reject', authenticateToken, async (req, res) => {
  try {
    const { id: changeRequestId } = req.params;
    const { id: userId, clientId, permissions } = req.user;
    const { rejectionReason } = req.body;

    const isBPOAdmin = permissions.includes('admin_users') && permissions.includes('admin_clients');

    // Fetch the change request
    const changeRequest = await prisma.ticketChangeRequest.findUnique({
      where: { id: parseInt(changeRequestId) },
      include: {
        ticket: true
      }
    });

    if (!changeRequest) {
      return res.status(404).json({ error: 'Change request not found' });
    }

    // Verify access
    if (!isBPOAdmin && changeRequest.ticket.clientId !== clientId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (changeRequest.status !== 'pending') {
      return res.status(400).json({ error: 'Change request has already been processed' });
    }

    // Update the change request as rejected
    const updatedRequest = await prisma.ticketChangeRequest.update({
      where: { id: parseInt(changeRequestId) },
      data: {
        status: 'rejected',
        reviewedById: userId,
        reviewedAt: new Date(),
        rejectionReason: rejectionReason || null
      },
      include: {
        ticket: {
          select: {
            id: true,
            subject: true
          }
        },
        requestedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    res.json({
      success: true,
      message: 'Change request rejected',
      data: updatedRequest
    });
  } catch (error) {
    log.error('Error rejecting change request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   GET /api/tickets/:id/change-requests
 * @desc    Get change requests for a specific ticket
 * @access  Private
 */
router.get('/:id/change-requests', authenticateToken, async (req, res) => {
  try {
    const { id: ticketId } = req.params;
    const { clientId, permissions } = req.user;

    const isBPOAdmin = permissions.includes('admin_users') && permissions.includes('admin_clients');

    // First verify ticket exists and user has access
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { clientId: true }
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    if (!isBPOAdmin && ticket.clientId !== clientId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const changeRequests = await prisma.ticketChangeRequest.findMany({
      where: { ticketId: ticketId },
      include: {
        requestedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        reviewedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        requestedAssignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json({
      success: true,
      data: changeRequests
    });
  } catch (error) {
    log.error('Error fetching ticket change requests:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
