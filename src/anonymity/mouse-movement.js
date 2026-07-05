/**
 * Mouse Movement Anonymization Module
 * Generates realistic mouse movement curves (not straight lines)
 * Features: Bezier curves, variable speed, hesitation points, overshooting, jitter
 */

class MouseMovement {
  constructor() {
    this.enabled = false;
  }

  /**
   * Enable mouse movement anonymization
   */
  enable() {
    this.enabled = true;
  }

  /**
   * Disable mouse movement anonymization
   */
  disable() {
    this.enabled = false;
  }

  /**
   * Generate a Bézier curve path from start to end position
   * Creates natural, curved paths (not straight lines)
   * @param {Object} startPos - {x, y}
   * @param {Object} endPos - {x, y}
   * @param {number} duration - milliseconds to take for movement
   * @returns {Array} Array of {x, y, timestamp}
   */
  generateBezierPath(startPos, endPos, duration = 500) {
    const controlPoints = this._generateControlPoints(startPos, endPos);
    const path = [];

    // Calculate path length for proper timing
    const segments = Math.ceil(duration / 16); // ~60fps
    const speedProfile = this._generateSpeedProfile(segments);

    let elapsedTime = 0;

    for (let i = 0; i < segments; i++) {
      // Use speed profile to get non-uniform progression
      const t = speedProfile[i];

      // Calculate Bézier curve point: B(t) = (1-t)³P0 + 3(1-t)²tP1 + 3(1-t)t²P2 + t³P3
      const point = this._calculateBezierPoint(
        startPos,
        controlPoints[0],
        controlPoints[1],
        endPos,
        t
      );

      // Add micro-jitter (±2-5px random movement)
      const jitter = this._getJitter();
      point.x += jitter.x;
      point.y += jitter.y;

      // Calculate timing for this segment
      elapsedTime = (i / segments) * duration;

      path.push({
        x: Math.round(point.x),
        y: Math.round(point.y),
        timestamp: elapsedTime
      });

      // Add hesitation points (5-20% chance to pause mid-move)
      if (i > 1 && i < segments - 1 && Math.random() < 0.1) {
        // Repeat current position for hesitation
        path.push({
          x: Math.round(point.x),
          y: Math.round(point.y),
          timestamp: elapsedTime + (50 + Math.random() * 150)
        });
      }
    }

    return path;
  }

  /**
   * Generate realistic speed profile (not constant velocity)
   * Starts slow, accelerates, maintains, then decelerates
   * @param {number} segments - number of segments
   * @returns {Array} Array of t values (0-1) for each segment
   */
  _generateSpeedProfile(segments) {
    const profile = [];

    // Acceleration phase (0-0.3 of duration)
    const accelSegments = Math.ceil(segments * 0.3);
    for (let i = 0; i < accelSegments; i++) {
      const ratio = i / accelSegments;
      // Ease-in: t³ for smooth acceleration
      profile.push(ratio * ratio * ratio * 0.3);
    }

    // Constant speed phase (0.3-0.7 of duration)
    const constantSegments = Math.ceil(segments * 0.4);
    const startT = profile[profile.length - 1];
    for (let i = 0; i < constantSegments; i++) {
      const ratio = i / constantSegments;
      profile.push(startT + ratio * 0.4);
    }

    // Deceleration phase (0.7-1.0 of duration)
    const decelSegments = segments - profile.length;
    const decelStartT = profile[profile.length - 1];
    for (let i = 0; i < decelSegments; i++) {
      const ratio = i / decelSegments;
      // Ease-out: 1 - (1-t)³ for smooth deceleration
      const easeOut = 1 - Math.pow(1 - ratio, 3);
      profile.push(decelStartT + easeOut * (1 - decelStartT));
    }

    return profile;
  }

  /**
   * Calculate point on Bézier curve
   * @private
   */
  _calculateBezierPoint(p0, p1, p2, p3, t) {
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;
    const t2 = t * t;
    const t3 = t2 * t;

    return {
      x:
        mt3 * p0.x +
        3 * mt2 * t * p1.x +
        3 * mt * t2 * p2.x +
        t3 * p3.x,
      y:
        mt3 * p0.y +
        3 * mt2 * t * p1.y +
        3 * mt * t2 * p2.y +
        t3 * p3.y
    };
  }

  /**
   * Generate control points for Bézier curve
   * Creates natural arc paths from start to end
   * @private
   */
  _generateControlPoints(startPos, endPos) {
    const dx = endPos.x - startPos.x;
    const dy = endPos.y - startPos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Perpendicular offset for arc (±20-50% of distance)
    const offsetMagnitude = distance * (0.2 + Math.random() * 0.3);
    const offsetDirection = Math.random() > 0.5 ? 1 : -1;

    // Perpendicular vector
    const perpX = (-dy / distance) * offsetMagnitude * offsetDirection;
    const perpY = (dx / distance) * offsetMagnitude * offsetDirection;

    // Control points form natural curve
    const cp1 = {
      x: startPos.x + dx * 0.25 + perpX * 0.3,
      y: startPos.y + dy * 0.25 + perpY * 0.3
    };

    const cp2 = {
      x: startPos.x + dx * 0.75 + perpX * 0.7,
      y: startPos.y + dy * 0.75 + perpY * 0.7
    };

    return [cp1, cp2];
  }

  /**
   * Get random jitter for micro-movements
   * @private
   */
  _getJitter() {
    return {
      x: (Math.random() - 0.5) * 4, // ±2px
      y: (Math.random() - 0.5) * 4 // ±2px
    };
  }

  /**
   * Calculate realistic movement duration based on distance
   * Typical human mouse speeds: 50-300 px/s
   * @param {number} distance - pixels to move
   * @returns {number} duration in milliseconds
   */
  calculateMovementDuration(distance) {
    // Realistic speed range: 50-300 px/s
    const baseSpeed = 100 + Math.random() * 150;
    const duration = (distance / baseSpeed) * 1000;

    // Add some randomness (±15%)
    const variance = duration * (0.85 + Math.random() * 0.3);

    return Math.max(100, variance); // Minimum 100ms
  }

  /**
   * Generate overshooting then correcting pattern
   * Mouse overshoots target, then corrects back
   * @param {Object} startPos - {x, y}
   * @param {Object} targetPos - {x, y}
   * @returns {Array} Array of path segments
   */
  generateOvershooting(startPos, targetPos) {
    const overshootAmount = 1 + Math.random() * 0.3; // 100-130% overshoot
    const overshootPos = {
      x: targetPos.x + (targetPos.x - startPos.x) * (overshootAmount - 1),
      y: targetPos.y + (targetPos.y - startPos.y) * (overshootAmount - 1)
    };

    const distance1 = Math.sqrt(
      Math.pow(overshootPos.x - startPos.x, 2) +
        Math.pow(overshootPos.y - startPos.y, 2)
    );
    const duration1 = this.calculateMovementDuration(distance1);

    const path1 = this.generateBezierPath(startPos, overshootPos, duration1);

    // Correction back to target
    const distance2 = Math.sqrt(
      Math.pow(targetPos.x - overshootPos.x, 2) +
        Math.pow(targetPos.y - overshootPos.y, 2)
    );
    const duration2 = this.calculateMovementDuration(distance2) * 0.5; // Faster correction

    const path2 = this.generateBezierPath(
      overshootPos,
      targetPos,
      duration2
    ).slice(1); // Skip first point (duplicate)

    // Adjust timestamps for second path
    const lastTimestamp = path1[path1.length - 1].timestamp;
    path2.forEach((p) => {
      p.timestamp += lastTimestamp;
    });

    return [...path1, ...path2];
  }

  /**
   * Get status of mouse movement anonymization
   * @returns {Object} Status object
   */
  getStatus() {
    return {
      enabled: this.enabled,
      module: 'mouse-movement',
      features: [
        'bezier-curves',
        'variable-speed',
        'hesitation-points',
        'overshooting',
        'micro-jitter'
      ]
    };
  }
}

module.exports = MouseMovement;
