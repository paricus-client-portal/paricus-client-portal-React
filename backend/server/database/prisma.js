import { PrismaClient } from '@prisma/client';
import log from '../utils/console-logger.js';

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? ['warn', 'error']
    : ['error'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

// Initialize Prisma connection
export async function initializePrisma() {
  try {
    await prisma.$connect();
    log.info('✅ Prisma connected successfully');
  } catch (error) {
    log.error('❌ Failed to connect to Prisma:', error);
    throw error;
  }
}

// Gracefully shutdown Prisma
export async function disconnectPrisma() {
  await prisma.$disconnect();
}