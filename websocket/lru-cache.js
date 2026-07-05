/**
 * LRU Cache Implementation using Doubly-Linked List
 *
 * Provides O(1) operations for:
 * - get(key): Retrieve value and update recency
 * - set(key, value): Insert/update and maintain LRU order
 * - delete(key): Remove entry
 *
 * Replaces array.filter() O(n) approach with O(1) linked list operations
 * Target: 95%+ cache hit rate
 */

class LRUNode {
  constructor(key, value) {
    this.key = key;
    this.value = value;
    this.prev = null;
    this.next = null;
  }
}

class LRUCache {
  /**
   * Initialize LRU cache with max capacity
   * @param {number} maxSize - Maximum number of items to store (default: 1000)
   */
  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
    this.map = new Map(); // O(1) key lookup

    // Sentinel nodes for doubly-linked list (dummy head/tail)
    this.head = new LRUNode(null, null);
    this.tail = new LRUNode(null, null);
    this.head.next = this.tail;
    this.tail.prev = this.head;

    // Metrics
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
  }

  /**
   * Add node right after head (most recently used)
   * @private
   */
  _addToHead(node) {
    node.prev = this.head;
    node.next = this.head.next;
    this.head.next.prev = node;
    this.head.next = node;
  }

  /**
   * Remove node from its current position
   * @private
   */
  _removeNode(node) {
    node.prev.next = node.next;
    node.next.prev = node.prev;
  }

  /**
   * Move node to head (mark as recently used)
   * @private
   */
  _moveToHead(node) {
    this._removeNode(node);
    this._addToHead(node);
  }

  /**
   * Get value by key and mark as recently used
   * @param {string} key - Cache key
   * @returns {*} Cached value or undefined
   */
  get(key) {
    if (!this.map.has(key)) {
      this.misses++;
      return undefined;
    }

    const node = this.map.get(key);
    this._moveToHead(node); // Mark as recently used
    this.hits++;
    return node.value;
  }

  /**
   * Set key-value pair in cache
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   */
  set(key, value) {
    if (this.map.has(key)) {
      // Update existing entry
      const node = this.map.get(key);
      node.value = value;
      this._moveToHead(node);
      return;
    }

    // Add new entry
    const newNode = new LRUNode(key, value);
    this.map.set(key, newNode);
    this._addToHead(newNode);

    // Evict least recently used if over capacity
    if (this.map.size > this.maxSize) {
      const lruNode = this.tail.prev;
      this._removeNode(lruNode);
      this.map.delete(lruNode.key);
      this.evictions++;
    }
  }

  /**
   * Delete key from cache
   * @param {string} key - Cache key
   * @returns {boolean} True if deleted, false if not found
   */
  delete(key) {
    if (!this.map.has(key)) {
      return false;
    }

    const node = this.map.get(key);
    this._removeNode(node);
    this.map.delete(key);
    return true;
  }

  /**
   * Clear all entries
   */
  clear() {
    this.map.clear();
    this.head.next = this.tail;
    this.tail.prev = this.head;
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
  }

  /**
   * Get cache size
   * @returns {number} Number of items in cache
   */
  size() {
    return this.map.size;
  }

  /**
   * Get cache hit rate
   * @returns {number} Hit rate as percentage (0-100)
   */
  hitRate() {
    const total = this.hits + this.misses;
    if (total === 0) return 0;
    return (this.hits / total) * 100;
  }

  /**
   * Get cache metrics
   * @returns {object} Cache statistics
   */
  getMetrics() {
    return {
      size: this.map.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      hitRate: this.hitRate().toFixed(2) + '%',
      utilization: ((this.map.size / this.maxSize) * 100).toFixed(2) + '%'
    };
  }

  /**
   * Get all keys in LRU order (head = most recent)
   * @returns {array} Keys from most to least recently used
   */
  keys() {
    const keys = [];
    let current = this.head.next;
    while (current !== this.tail) {
      keys.push(current.key);
      current = current.next;
    }
    return keys;
  }

  /**
   * Validate cache integrity (for testing)
   * @private
   * @returns {object} Validation result
   */
  _validate() {
    const errors = [];

    // Check map size matches linked list size
    let listSize = 0;
    let current = this.head.next;
    while (current !== this.tail) {
      listSize++;
      current = current.next;
    }

    if (listSize !== this.map.size) {
      errors.push(`Size mismatch: map=${this.map.size}, list=${listSize}`);
    }

    // Check all map entries are in list
    for (const [key, node] of this.map.entries()) {
      if (node.key !== key) {
        errors.push(`Key mismatch: expected ${key}, got ${node.key}`);
      }
    }

    // Check list bidirectional integrity
    let forward = [];
    current = this.head;
    while (current) {
      forward.push(current);
      current = current.next;
    }

    let backward = [];
    current = this.tail;
    while (current) {
      backward.push(current);
      current = current.prev;
    }

    if (forward.length !== backward.length) {
      errors.push(`Bidirectional mismatch: forward=${forward.length}, backward=${backward.length}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

module.exports = { LRUCache };
