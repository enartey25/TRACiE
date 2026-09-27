const crypto = require('crypto');

/**
 * High-performance in-memory LRU Cache with TTL and eviction.
 */
class LRUCache {
  constructor(maxSize = 300, defaultTtlMs = 20 * 60 * 1000) {
    this.maxSize = maxSize;
    this.defaultTtlMs = defaultTtlMs;
    this.cache = new Map();
    this.hits = 0;
    this.misses = 0;
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) {
      this.misses++;
      return null;
    }
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }
    entry.accessedAt = Date.now();
    this.hits++;
    return entry.value;
  }

  set(key, value, ttlMs = this.defaultTtlMs) {
    if (this.cache.size >= this.maxSize) {
      let oldestKey = null;
      let oldestTime = Infinity;
      for (const [k, v] of this.cache.entries()) {
        if (v.accessedAt < oldestTime) {
          oldestTime = v.accessedAt;
          oldestKey = k;
        }
      }
      if (oldestKey) this.cache.delete(oldestKey);
    }
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
      accessedAt: Date.now()
    });
  }

  has(key) {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  delete(key) {
    return this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  stats() {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      hitRatio: total > 0 ? Number((this.hits / total).toFixed(3)) : 0
    };
  }
}

// Global LRU instances
const responseCache   = new LRUCache(200, 20 * 60 * 1000); // 20 min TTL
const chunksCache     = new LRUCache(300, 15 * 60 * 1000); // 15 min TTL
const embeddingCache  = new LRUCache(500, 60 * 60 * 1000); // 60 min TTL
const sessionContexts = new Map(); // sessionId -> { chunks, lastQuery, lastWidgetType, timestamp }

// Patterns indicating a follow-up question
const FOLLOW_UP_PATTERNS = [
  /\b(it|this|that|these|those|they|them|its)\b/i,
  /\b(what about|how about|why|more|elaborate|expand|explain more|simpler|in detail)\b/i,
  /\b(show me the code|show code|give me a quiz|quiz on this|flashcards for this|make a quiz|quiz me)\b/i,
  /\b(and then|what else|another example|next step|follow up|continue)\b/i
];

/**
 * Normalizes query string for stable hash caching.
 */
function normalizeQueryKey(query, repoId = 'TRACiE', requestedWidget = 'auto') {
  const normQ = String(query || '')
    .toLowerCase()
    .trim()
    .replace(/[?!.,;:]+$/, '')
    .replace(/\s+/g, ' ');
  const normWidget = String(requestedWidget || 'auto').toLowerCase().trim();
  const normRepo = String(repoId || 'TRACiE').trim();

  return crypto.createHash('sha256')
    .update(`${normRepo}::${normWidget}::${normQ}`)
    .digest('hex');
}

/**
 * Determines whether a query is likely a follow-up to the preceding turn.
 */
function isFollowUpQuery(query) {
  if (!query || typeof query !== 'string') return false;
  const q = query.trim().toLowerCase();
  if (q.split(/\s+/).length <= 4) {
    return FOLLOW_UP_PATTERNS.some(re => re.test(q)) || q.length < 25;
  }
  return FOLLOW_UP_PATTERNS.some(re => re.test(q));
}

/**
 * Saves warm chunks and last query into session context cache.
 */
function setSessionChunks(sessionId, { chunks, query, widgetType }) {
  if (!sessionId) return;
  sessionContexts.set(sessionId, {
    chunks: chunks ? [...chunks] : [],
    lastQuery: query,
    lastWidgetType: widgetType,
    timestamp: Date.now()
  });

  // Prune sessions older than 2 hours
  if (sessionContexts.size > 200) {
    const cutoff = Date.now() - 2 * 60 * 60 * 1000;
    for (const [id, data] of sessionContexts.entries()) {
      if (data.timestamp < cutoff) sessionContexts.delete(id);
    }
  }
}

/**
 * Retrieves warm chunks from session context cache.
 */
function getSessionChunks(sessionId) {
  if (!sessionId || !sessionContexts.has(sessionId)) return null;
  const data = sessionContexts.get(sessionId);
  // Max 45 min idle session context
  if (Date.now() - data.timestamp > 45 * 60 * 1000) {
    sessionContexts.delete(sessionId);
    return null;
  }
  return data;
}

/**
 * Retrieves cached response widget if present.
 */
function getCachedResponse(query, repoId, requestedWidget) {
  const key = normalizeQueryKey(query, repoId, requestedWidget);
  const cached = responseCache.get(key);
  if (cached) {
    // Return a fresh clone and stamp cache metadata
    const cloned = JSON.parse(JSON.stringify(cached.payload));
    cloned._cached = true;
    cloned._cacheTier = 'exact_response';
    cloned._cacheAgeMs = Date.now() - cached.cachedAt;
    cloned._cacheKey = key.slice(0, 12);
    return cloned;
  }
  return null;
}

/**
 * Stores response widget in cache.
 */
function setCachedResponse(query, repoId, requestedWidget, payload) {
  if (!payload || payload.type === 'alert_card') return; // Do not cache error cards
  // Do not cache audio widgets without a real audio URL — a retry should re-synthesize
  if (payload.type === 'audio_player' && !payload.audio_url) return;
  const key = normalizeQueryKey(query, repoId, requestedWidget);
  responseCache.set(key, {
    payload,
    cachedAt: Date.now()
  });
}

/**
 * Retrieves cached vector chunks for a query + repo.
 */
function getCachedChunks(repoId, query) {
  const key = crypto.createHash('sha256').update(`${repoId || 'TRACiE'}::${query.trim().toLowerCase()}`).digest('hex');
  return chunksCache.get(key);
}

/**
 * Stores vector chunks in cache.
 */
function setCachedChunks(repoId, query, chunks) {
  if (!chunks || !chunks.length) return;
  const key = crypto.createHash('sha256').update(`${repoId || 'TRACiE'}::${query.trim().toLowerCase()}`).digest('hex');
  chunksCache.set(key, chunks);
}

/**
 * Retrieves cached embedding vector.
 */
function getCachedEmbedding(text) {
  const key = crypto.createHash('sha256').update(text.trim()).digest('hex');
  return embeddingCache.get(key);
}

/**
 * Stores embedding vector.
 */
function setCachedEmbedding(text, vector) {
  if (!vector || !vector.length) return;
  const key = crypto.createHash('sha256').update(text.trim()).digest('hex');
  embeddingCache.set(key, vector);
}

/**
 * Returns complete telemetry across all cache levels.
 */
function getGlobalCacheStats() {
  return {
    responseCache: responseCache.stats(),
    chunksCache: chunksCache.stats(),
    embeddingCache: embeddingCache.stats(),
    activeSessionContexts: sessionContexts.size
  };
}

/**
 * Clears all caches.
 */
function clearAllCaches() {
  responseCache.clear();
  chunksCache.clear();
  embeddingCache.clear();
  sessionContexts.clear();
}

module.exports = {
  isFollowUpQuery,
  normalizeQueryKey,
  getCachedResponse,
  setCachedResponse,
  getCachedChunks,
  setCachedChunks,
  getCachedEmbedding,
  setCachedEmbedding,
  setSessionChunks,
  getSessionChunks,
  getGlobalCacheStats,
  clearAllCaches
};
