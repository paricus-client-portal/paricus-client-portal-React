import NodeCache from 'node-cache';
import log from '../utils/console-logger.js';

// Create cache instances with different TTL settings
const shortCache = new NodeCache({ stdTTL: 300 }); // 5 minutes
const mediumCache = new NodeCache({ stdTTL: 1800 }); // 30 minutes  
const longCache = new NodeCache({ stdTTL: 3600 }); // 1 hour

// Cache types
export const CACHE_TYPES = {
  SHORT: 'short',
  MEDIUM: 'medium', 
  LONG: 'long'
};

// Get appropriate cache instance
const getCacheInstance = (type) => {
  switch (type) {
    case CACHE_TYPES.SHORT:
      return shortCache;
    case CACHE_TYPES.MEDIUM:
      return mediumCache;
    case CACHE_TYPES.LONG:
      return longCache;
    default:
      return shortCache;
  }
};

// Generate cache key
const generateCacheKey = (req, prefix = '') => {
  const { method, path, query, user } = req;
  const queryString = Object.keys(query).length > 0 ? JSON.stringify(query) : '';
  const userId = user?.id || 'anonymous';
  const clientId = user?.clientId || 'no-client';
  
  return `${prefix}:${method}:${path}:${userId}:${clientId}:${queryString}`;
};

// Cache middleware factory
export const cache = (options = {}) => {
  const {
    type = CACHE_TYPES.SHORT,
    keyPrefix = '',
    skipCache = false,
    varyByUser = true,
    varyByClient = true
  } = options;

  return (req, res, next) => {
    // Skip cache in development or if disabled
    if (process.env.NODE_ENV === 'development' || skipCache) {
      return next();
    }

    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    const cacheInstance = getCacheInstance(type);
    const cacheKey = generateCacheKey(req, keyPrefix);

    // Try to get from cache
    const cachedData = cacheInstance.get(cacheKey);
    if (cachedData) {
      log.debug(`Cache hit: ${cacheKey}`);
      return res.json(cachedData);
    }

    // Override res.json to cache the response
    const originalJson = res.json;
    res.json = function(data) {
      // Only cache successful responses
      if (res.statusCode === 200) {
        log.debug(`Cache set: ${cacheKey}`);
        cacheInstance.set(cacheKey, data);
      }
      return originalJson.call(this, data);
    };

    next();
  };
};

// Cache invalidation functions
export const invalidateUserCache = (userId) => {
  [shortCache, mediumCache, longCache].forEach(cache => {
    cache.keys().forEach(key => {
      if (key.includes(`:${userId}:`)) {
        cache.del(key);
      }
    });
  });
};

export const invalidateClientCache = (clientId) => {
  [shortCache, mediumCache, longCache].forEach(cache => {
    cache.keys().forEach(key => {
      if (key.includes(`:${clientId}:`)) {
        cache.del(key);
      }
    });
  });
};

export const invalidatePatternCache = (pattern) => {
  [shortCache, mediumCache, longCache].forEach(cache => {
    cache.keys().forEach(key => {
      if (key.includes(pattern)) {
        cache.del(key);
      }
    });
  });
};

export const clearAllCache = () => {
  shortCache.flushAll();
  mediumCache.flushAll();
  longCache.flushAll();
};

// User session cache for reducing database lookups
const userCache = new NodeCache({ stdTTL: 600, checkperiod: 120 }); // 10 minutes

export const cacheUser = (userId, userData) => {
  userCache.set(`user:${userId}`, userData);
};

export const getCachedUser = (userId) => {
  return userCache.get(`user:${userId}`);
};

export const invalidateUserSession = (userId) => {
  userCache.del(`user:${userId}`);
};