import sql from 'mssql';
import NodeCache from 'node-cache';
import envConfig from '../config/environment.js';
import log from '../utils/console-logger.js';

// Query result cache (5 minute TTL for count queries, 1 minute for data)
const queryCache = new NodeCache({ stdTTL: 60, checkperiod: 120 });
const countCache = new NodeCache({ stdTTL: 300, checkperiod: 600 });

// SQL Server configuration - optimized for performance
const config = {
  server: envConfig.mssql.server,
  database: envConfig.mssql.database,
  user: envConfig.mssql.user,
  password: envConfig.mssql.password,
  port: envConfig.mssql.port,
  options: {
    encrypt: process.env.MSSQL_ENCRYPT === 'true',
    trustServerCertificate: process.env.MSSQL_TRUST_SERVER_CERTIFICATE === 'true',
    enableArithAbort: true,
    connectionTimeout: 30000, // 30 seconds (reduced from 5 minutes)
    requestTimeout: 60000, // 1 minute (reduced from 5 minutes)
    // Performance optimizations
    packetSize: 32768, // Increase packet size for better throughput
    rowCollectionOnRequestCompletion: true,
    useUTC: true,
  },
  pool: {
    max: 50, // Increased from 10 for better concurrency
    min: 5, // Keep 5 warm connections
    idleTimeoutMillis: 60000, // 1 minute idle timeout
    acquireTimeoutMillis: 30000, // 30 seconds to acquire connection
  }
};

// Connection pool
let pool = null;

// Flag to check if MSSQL is configured
const isMSSQLConfigured = () => {
  return !!(config.server && config.user && config.password &&
            config.server !== 'localhost' &&
            config.password !== 'your_local_password');
};

/**
 * Get or create SQL Server connection pool
 */
export async function getPool() {
  if (!pool) {
    // Check if credentials are configured
    if (!isMSSQLConfigured()) {
      log.info('[MSSQL] SQL Server credentials not configured - using mock data mode');
      return null; // Return null to trigger mock data
    }

    try {
      log.info('[MSSQL] Connecting to SQL Server...', {
        server: config.server,
        database: config.database,
        poolSize: `${config.pool.min}-${config.pool.max}`
      });
      pool = await sql.connect(config);
      log.info('[MSSQL] SQL Server connected successfully with optimized pool');
    } catch (error) {
      log.error('[MSSQL] Connection failed:', error.message);
      pool = null;
      throw error;
    }
  }
  return pool;
}

/**
 * Generate UUID-like ID
 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Generate mock audio recordings for testing
 */
function getMockAudioRecordings(limit = 100, offset = 0, filters = {}) {
  const agents = ['John Smith', 'Maria Garcia', 'David Johnson', 'Sarah Williams', 'Michael Brown'];

  // Only 3 main companies with their tags
  const companies = [
    { tag: 'exc', name: 'IM Telecom' },
    { tag: 'flex', name: 'Flex Mobile' },
    { tag: 'tem', name: 'Tempo Wireless' }
  ];

  // Generate full dataset
  const allMockData = [];
  for (let i = 0; i < 150; i++) {
    const startTime = new Date(2024, 11, 1 + (i % 30), 9 + (i % 8), i % 60);
    const endTime = new Date(startTime.getTime() + (5 + (i % 10)) * 60000);

    // Randomly assign one of the 3 companies
    const companyData = companies[Math.floor(Math.random() * companies.length)];

    allMockData.push({
      interaction_id: generateUUID(),
      call_type: 'inbound',
      start_time: startTime,
      end_time: endTime,
      customer_phone_number: `555-${String(1000 + i)}`,
      agent_name: agents[i % agents.length],
      audiofilename: i % 3 === 0 ? `audio_${generateUUID()}.wav` : null,
      tags: companyData.tag,
      company: companyData.name
    });
  }

  // Apply filters
  let filteredData = allMockData;

  if (filters.company) {
    filteredData = filteredData.filter(record => {
      const recordTagsLower = record.tags.toLowerCase();
      if (filters.company === 'IM Telecom') {
        return recordTagsLower.includes('exc') || recordTagsLower.includes('infiniti');
      } else if (filters.company === 'Flex Mobile') {
        return recordTagsLower.includes('flex') || recordTagsLower.includes('flx');
      } else if (filters.company === 'Tempo Wireless') {
        return recordTagsLower.includes('tem') || recordTagsLower.includes('tempo');
      }
      return true;
    });
  }

  if (filters.agentName) {
    filteredData = filteredData.filter(record =>
      record.agent_name.toLowerCase().includes(filters.agentName.toLowerCase())
    );
  }

  if (filters.customerPhone) {
    filteredData = filteredData.filter(record =>
      record.customer_phone_number.includes(filters.customerPhone)
    );
  }

  if (filters.interactionId) {
    filteredData = filteredData.filter(record =>
      record.interaction_id === filters.interactionId
    );
  }

  if (filters.hasAudio !== undefined) {
    const hasAudioBool = filters.hasAudio === 'true' || filters.hasAudio === true;
    filteredData = filteredData.filter(record => {
      const hasAudio = record.audiofilename !== null && record.audiofilename !== '';
      return hasAudioBool ? hasAudio : !hasAudio;
    });
  }

  if (filters.startDate) {
    const startDate = new Date(filters.startDate);
    filteredData = filteredData.filter(record => record.start_time >= startDate);
  }

  if (filters.endDate) {
    const endDate = new Date(filters.endDate);
    filteredData = filteredData.filter(record => record.end_time <= endDate);
  }

  // Return paginated results
  const total = filteredData.length;
  const paginatedData = filteredData.slice(offset, offset + limit);

  return { data: paginatedData, total };
}

/**
 * Generate cache key for query
 */
function generateCacheKey(filters, limit, offset) {
  return JSON.stringify({ filters, limit, offset });
}

/**
 * Get total count with caching and optimization
 */
async function getTotalCount(pool, filters) {
  const countCacheKey = `count_${JSON.stringify(filters)}`;
  const cachedCount = countCache.get(countCacheKey);

  if (cachedCount !== undefined) {
    log.info('[MSSQL] Count cache hit');
    return cachedCount;
  }

  const request = pool.request();

  // Build optimized count query with query hints
  let countQuery = `
    SELECT COUNT_BIG(*) AS total_count
    FROM calls_report WITH (NOLOCK, INDEX(idx_start_time))
    WHERE call_type = 'inbound'
      AND (tags NOT LIKE '%test%' AND tags NOT LIKE '%demo%')
  `;

  // Add filters (same as main query)
  if (filters.startDate) {
    countQuery += ` AND start_time >= @startDate`;
    request.input('startDate', sql.DateTime, new Date(filters.startDate));
  }
  if (filters.endDate) {
    countQuery += ` AND end_time <= @endDate`;
    request.input('endDate', sql.DateTime, new Date(filters.endDate));
  }
  if (filters.agentName) {
    // Use indexed column if available, avoid leading wildcard
    countQuery += ` AND agent_name LIKE @agentName`;
    request.input('agentName', sql.NVarChar, `${filters.agentName}%`);
  }
  if (filters.callType) {
    countQuery += ` AND call_type = @callType`;
    request.input('callType', sql.NVarChar, filters.callType);
  }
  if (filters.customerPhone) {
    // Only add if exact match to use index
    countQuery += ` AND customer_phone_number LIKE @customerPhone`;
    request.input('customerPhone', sql.NVarChar, `${filters.customerPhone}%`);
  }
  if (filters.interactionId) {
    // Exact match for index usage
    countQuery += ` AND interaction_id = @interactionId`;
    request.input('interactionId', sql.NVarChar, filters.interactionId);
  }
  if (filters.company) {
    // Filter by company using tags pattern matching
    if (filters.company === 'IM Telecom') {
      countQuery += ` AND (tags LIKE '%exc%' OR tags LIKE '%infiniti%')`;
    } else if (filters.company === 'Flex Mobile') {
      countQuery += ` AND (tags LIKE '%flex%' OR tags LIKE '%flx%')`;
    } else if (filters.company === 'Tempo Wireless') {
      countQuery += ` AND (tags LIKE '%tem%' OR tags LIKE '%tempo%')`;
    }
  }
  if (filters.hasAudio !== undefined) {
    // Filter by whether record has audio file
    if (filters.hasAudio === 'true' || filters.hasAudio === true) {
      countQuery += ` AND audiofilename IS NOT NULL AND audiofilename != ''`;
    } else if (filters.hasAudio === 'false' || filters.hasAudio === false) {
      countQuery += ` AND (audiofilename IS NULL OR audiofilename = '')`;
    }
  }

  const countResult = await request.query(countQuery);
  const totalCount = parseInt(countResult.recordset[0].total_count);

  // Cache the count for 5 minutes
  countCache.set(countCacheKey, totalCount);

  return totalCount;
}

/**
 * Get all call recordings from calls_report table - OPTIMIZED
 * Only returns inbound calls
 * @param {Object} filters - Optional filters (startDate, endDate, agentName, callType)
 * @param {number} limit - Number of records to return
 * @param {number} offset - Number of records to skip
 */
export async function getCallRecordings(filters = {}, limit = 100, offset = 0) {
  const startTime = Date.now();

  try {
    // Check cache first
    const cacheKey = generateCacheKey(filters, limit, offset);
    const cached = queryCache.get(cacheKey);

    if (cached) {
      log.info(`[MSSQL] Cache hit - returned in ${Date.now() - startTime}ms`);
      return cached;
    }

    let pool;
    try {
      pool = await getPool();
    } catch (configError) {
      // Return error indicating DB is not configured instead of crashing
      throw new Error('SQL Server not configured');
    }

    // If pool is null, MSSQL is not configured - return mock data
    if (!pool) {
      log.info('[MSSQL] Using mock data with filters:', JSON.stringify(filters));
      const mockResult = getMockAudioRecordings(limit, offset, filters);
      const resultData = {
        recordings: mockResult.data,
        totalCount: mockResult.total
      };
      queryCache.set(cacheKey, resultData);
      log.info(`[MSSQL] Returning ${mockResult.data.length} mock recordings (total: ${mockResult.total})`);
      return resultData;
    }

    const poolTime = Date.now() - startTime;

    // Run count query in parallel if it's a fresh query
    const countPromise = getTotalCount(pool, filters);

    const request = pool.request();

    // Build optimized query with query hints and proper indexes
    let query = `
      SELECT
        interaction_id,
        call_type,
        start_time,
        end_time,
        customer_phone_number,
        agent_name,
        audiofilename,
        tags,
        company
      FROM calls_report WITH (NOLOCK)
      WHERE call_type = 'inbound'
        AND (tags NOT LIKE '%test%' AND tags NOT LIKE '%demo%')
    `;

    // Add filters - optimized to use indexes
    if (filters.startDate) {
      query += ` AND start_time >= @startDate`;
      request.input('startDate', sql.DateTime, new Date(filters.startDate));
    }

    if (filters.endDate) {
      query += ` AND end_time <= @endDate`;
      request.input('endDate', sql.DateTime, new Date(filters.endDate));
    }

    if (filters.agentName) {
      // Remove leading wildcard for index usage
      query += ` AND agent_name LIKE @agentName`;
      request.input('agentName', sql.NVarChar, `${filters.agentName}%`);
    }

    if (filters.callType) {
      query += ` AND call_type = @callType`;
      request.input('callType', sql.NVarChar, filters.callType);
    }

    if (filters.customerPhone) {
      // Remove leading wildcard for index usage
      query += ` AND customer_phone_number LIKE @customerPhone`;
      request.input('customerPhone', sql.NVarChar, `${filters.customerPhone}%`);
    }

    if (filters.interactionId) {
      // Use exact match for index usage
      query += ` AND interaction_id = @interactionId`;
      request.input('interactionId', sql.NVarChar, filters.interactionId);
    }

    if (filters.company) {
      // Filter by company using tags pattern matching
      if (filters.company === 'IM Telecom') {
        query += ` AND (tags LIKE '%exc%' OR tags LIKE '%infiniti%')`;
      } else if (filters.company === 'Flex Mobile') {
        query += ` AND (tags LIKE '%flex%' OR tags LIKE '%flx%')`;
      } else if (filters.company === 'Tempo Wireless') {
        query += ` AND (tags LIKE '%tem%' OR tags LIKE '%tempo%')`;
      }
    }

    if (filters.hasAudio !== undefined) {
      // Filter by whether record has audio file
      if (filters.hasAudio === 'true' || filters.hasAudio === true) {
        query += ` AND audiofilename IS NOT NULL AND audiofilename != ''`;
      } else if (filters.hasAudio === 'false' || filters.hasAudio === false) {
        query += ` AND (audiofilename IS NULL OR audiofilename = '')`;
      }
    }

    // Optimized ordering and pagination using TOP and ROW_NUMBER for better performance
    query += `
      ORDER BY start_time DESC
      OFFSET @offset ROWS
      FETCH NEXT @limit ROWS ONLY
      OPTION (RECOMPILE, MAXDOP 4)
    `;

    request.input('limit', sql.Int, limit);
    request.input('offset', sql.Int, offset);

    log.info('[MSSQL] Executing optimized query...');
    const queryStartTime = Date.now();

    // Execute query and count in parallel
    const [result, totalCount] = await Promise.all([
      request.query(query),
      countPromise
    ]);

    const queryDuration = Date.now() - queryStartTime;
    const totalDuration = Date.now() - startTime;

    log.info(`[MSSQL] Performance metrics:`);
    log.info(`  - Pool acquisition: ${poolTime}ms`);
    log.info(`  - Query execution: ${queryDuration}ms`);
    log.info(`  - Total time: ${totalDuration}ms`);
    log.info(`  - Rows returned: ${result.recordset.length}`);
    log.info(`  - Total count: ${totalCount}`);

    const resultData = {
      recordings: result.recordset,
      totalCount: totalCount
    };

    // Cache result for 1 minute
    queryCache.set(cacheKey, resultData);

    return resultData;
  } catch (error) {
    const totalDuration = Date.now() - startTime;
    log.error(`[MSSQL] Error after ${totalDuration}ms:`, error);
    throw error;
  }
}

/**
 * Get a single call recording by interaction ID - OPTIMIZED
 * @param {string} interactionId - Interaction ID
 */
export async function getCallRecordingById(interactionId) {
  try {
    // Check cache first
    const cacheKey = `recording_${interactionId}`;
    const cached = queryCache.get(cacheKey);

    if (cached) {
      log.info('[MSSQL] Single record cache hit');
      return cached;
    }

    let pool;
    try {
      pool = await getPool();
    } catch (configError) {
      throw new Error('SQL Server not configured');
    }
    const request = pool.request();

    request.input('interactionId', sql.NVarChar, interactionId);

    // Use NOLOCK and index hint for faster reads
    const result = await request.query(`
      SELECT
        interaction_id,
        call_type,
        start_time,
        end_time,
        customer_phone_number,
        agent_name,
        audiofilename,
        tags
      FROM calls_report WITH (NOLOCK, INDEX(idx_interaction_id))
      WHERE interaction_id = @interactionId
    `);

    const record = result.recordset[0] || null;

    // Cache for 5 minutes
    if (record) {
      queryCache.set(cacheKey, record, 300);
    }

    return record;
  } catch (error) {
    log.error('[MSSQL] Error fetching call recording by ID:', error);
    throw error;
  }
}

/**
 * Get unique agent names from calls_report - OPTIMIZED
 */
export async function getAgentNames() {
  try {
    const cacheKey = 'agent_names';
    const cached = queryCache.get(cacheKey);

    if (cached) {
      log.info('[MSSQL] Agent names cache hit');
      return cached;
    }

    const pool = await getPool();

    // Use NOLOCK and index hint for faster reads
    const result = await pool.request().query(`
      SELECT DISTINCT agent_name
      FROM calls_report WITH (NOLOCK, INDEX(idx_agent_name))
      WHERE agent_name IS NOT NULL
      ORDER BY agent_name
      OPTION (MAXDOP 2)
    `);

    const agentNames = result.recordset.map(row => row.agent_name);

    // Cache for 10 minutes
    queryCache.set(cacheKey, agentNames, 600);

    return agentNames;
  } catch (error) {
    log.error('[MSSQL] Error fetching agent names:', error);
    throw error;
  }
}

/**
 * Get unique call types from calls_report - OPTIMIZED
 */
export async function getCallTypes() {
  try {
    const cacheKey = 'call_types';
    const cached = queryCache.get(cacheKey);

    if (cached) {
      log.info('[MSSQL] Call types cache hit');
      return cached;
    }

    let pool;
    try {
      pool = await getPool();
    } catch (configError) {
      throw new Error('SQL Server not configured');
    }

    // If pool is null, MSSQL is not configured - return mock data
    if (!pool) {
      log.info('[MSSQL] Using mock call types');
      const mockCallTypes = ['inbound', 'outbound'];
      queryCache.set(cacheKey, mockCallTypes, 600);
      return mockCallTypes;
    }

    // Use NOLOCK and index hint for faster reads
    const result = await pool.request().query(`
      SELECT DISTINCT call_type
      FROM calls_report WITH (NOLOCK, INDEX(idx_call_type))
      WHERE call_type IS NOT NULL
      ORDER BY call_type
      OPTION (MAXDOP 2)
    `);

    const callTypes = result.recordset.map(row => row.call_type);

    // Cache for 10 minutes
    queryCache.set(cacheKey, callTypes, 600);

    return callTypes;
  } catch (error) {
    log.error('[MSSQL] Error fetching call types:', error);
    throw error;
  }
}

/**
 * Get unique tags from calls_report - OPTIMIZED
 */
export async function getTags() {
  try {
    const cacheKey = 'tags';
    const cached = queryCache.get(cacheKey);

    if (cached) {
      log.info('[MSSQL] Tags cache hit');
      return cached;
    }

    const pool = await getPool();

    const result = await pool.request().query(`
      SELECT DISTINCT tags
      FROM calls_report WITH (NOLOCK)
      WHERE tags IS NOT NULL
      ORDER BY tags
      OPTION (MAXDOP 2)
    `);

    const tags = result.recordset.map(row => row.tags);

    // Cache for 10 minutes
    queryCache.set(cacheKey, tags, 600);

    return tags;
  } catch (error) {
    log.error('[MSSQL] Error fetching tags:', error);
    throw error;
  }
}

/**
 * Map tags to company name based on naming patterns
 * - "exc" or "infiniti" → IM Telecom
 * - "flex" or "flx" → Flex Mobile
 * - "tem" or "tempo" → Tempo Wireless
 */
export function getCompanyNameFromTags(tags) {
  if (!tags) return 'Unknown';

  const tagsLower = tags.toLowerCase();

  if (tagsLower.includes('exc') || tagsLower.includes('infiniti')) {
    return 'IM Telecom';
  }
  if (tagsLower.includes('flex') || tagsLower.includes('flx')) {
    return 'Flex Mobile';
  }
  if (tagsLower.includes('tem') || tagsLower.includes('tempo')) {
    return 'Tempo Wireless';
  }

  return tags; // Return original if no match
}

/**
 * Test SQL Server connection
 */
export async function testConnection() {
  try {
    const pool = await getPool();

    // If pool is null, MSSQL is not configured - return mock mode message
    if (!pool) {
      return { success: true, message: 'Using mock data mode (MSSQL not configured)' };
    }

    await pool.request().query('SELECT 1 AS test');
    return { success: true, message: 'SQL Server connection successful' };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

/**
 * Clear query cache (useful for testing or manual refresh)
 */
export function clearCache() {
  queryCache.flushAll();
  countCache.flushAll();
  log.info('[MSSQL] Query cache cleared');
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return {
    queryCache: queryCache.getStats(),
    countCache: countCache.getStats()
  };
}

/**
 * Close SQL Server connection pool
 */
export async function closePool() {
  if (pool) {
    try {
      await pool.close();
      pool = null;
      clearCache();
      log.info('[MSSQL] SQL Server connection closed and cache cleared');
    } catch (error) {
      log.error('[MSSQL] Error closing SQL Server connection:', error);
    }
  }
}
