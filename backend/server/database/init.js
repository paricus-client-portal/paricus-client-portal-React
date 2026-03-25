import pg from 'pg';
import dotenv from 'dotenv';
import log from '../utils/console-logger.js';

dotenv.config();

const { Pool } = pg;

// Database connection pool
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Initialize database schema
export async function initializeDatabase() {
  const client = await pool.connect();
  
  try {
    // Create tables
    await client.query(`
      -- Clients table
      CREATE TABLE IF NOT EXISTS clients (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        is_active BOOLEAN DEFAULT true,
        is_prospect BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      -- Permissions table
      CREATE TABLE IF NOT EXISTS permissions (
        id SERIAL PRIMARY KEY,
        permission_name VARCHAR(100) UNIQUE NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      -- Roles table
      CREATE TABLE IF NOT EXISTS roles (
        id SERIAL PRIMARY KEY,
        client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
        role_name VARCHAR(100) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(client_id, role_name)
      );
    `);

    await client.query(`
      -- Users table
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        role_id INTEGER REFERENCES roles(id),
        is_active BOOLEAN DEFAULT true,
        last_login TIMESTAMP,
        password_reset_token VARCHAR(255),
        password_reset_expires TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      -- Role_Permissions junction table
      CREATE TABLE IF NOT EXISTS role_permissions (
        role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
        permission_id INTEGER REFERENCES permissions(id) ON DELETE CASCADE,
        PRIMARY KEY (role_id, permission_id)
      );
    `);

    // Insert default permissions
    await client.query(`
      INSERT INTO permissions (permission_name, description) VALUES
        ('view_dashboard', 'View dashboard and basic metrics'),
        ('view_financials', 'View financial information and invoices'),
        ('download_invoices', 'Download invoice files'),
        ('view_reporting', 'View reports and KPIs'),
        ('download_reports', 'Download report files'),
        ('view_interactions', 'View interaction history'),
        ('download_audio_files', 'Download audio interaction files'),
        ('view_knowledge_base', 'View knowledge base articles'),
        ('create_kb_articles', 'Create knowledge base articles'),
        ('edit_kb_articles', 'Edit knowledge base articles'),
        ('admin_clients', 'Manage clients (BPO Admin only)'),
        ('admin_users', 'Manage users (BPO Admin only)'),
        ('admin_roles', 'Manage roles and permissions (BPO Admin only)'),
        ('admin_dashboard_config', 'Configure dashboard layouts (BPO Admin only)')
      ON CONFLICT (permission_name) DO NOTHING;
    `);

    // Create default BPO client and admin role
    const bpoClient = await client.query(`
      INSERT INTO clients (name, is_active, is_prospect) 
      VALUES ('BPO Administration', true, false)
      ON CONFLICT DO NOTHING
      RETURNING id;
    `);

    let bpoClientId;
    if (bpoClient.rows.length > 0) {
      bpoClientId = bpoClient.rows[0].id;
    } else {
      const existingBpo = await client.query(`
        SELECT id FROM clients WHERE name = 'BPO Administration' LIMIT 1;
      `);
      bpoClientId = existingBpo.rows[0].id;
    }

    // Create BPO Admin role with all permissions
    const adminRole = await client.query(`
      INSERT INTO roles (client_id, role_name, description)
      VALUES ($1, 'BPO Admin', 'Full administrative access to the portal')
      ON CONFLICT (client_id, role_name) DO NOTHING
      RETURNING id;
    `, [bpoClientId]);

    if (adminRole.rows.length > 0) {
      // Assign all permissions to BPO Admin role
      await client.query(`
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT $1, id FROM permissions
        ON CONFLICT DO NOTHING;
      `, [adminRole.rows[0].id]);
    }

    log.info('Database schema initialized successfully');
  } catch (error) {
    log.error('Error initializing database:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Helper function to execute queries
export async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  log.debug('Executed query', { duration, rows: res.rowCount });
  return res;
}