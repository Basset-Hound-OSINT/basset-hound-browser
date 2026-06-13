/**
 * Support Notification System
 *
 * Multi-channel notification delivery for ticket status updates, SLA warnings,
 * escalation alerts, and team notifications via email, SMS, and in-app messaging.
 *
 * Features:
 * - Ticket status notifications
 * - SLA warning alerts
 * - Escalation notifications
 * - Email delivery
 * - SMS delivery
 * - In-app messaging
 * - Notification preferences
 * - Delivery tracking
 * - Retry logic
 */

const EventEmitter = require('events');

class NotificationSystem extends EventEmitter {
  constructor(options = {}) {
    super();
    this.notificationQueues = new Map();
    this.deliveryLog = [];
    this.preferences = new Map();
    this.templates = new Map();
    this.maxDeliveryAttempts = options.maxDeliveryAttempts || 3;
    this.deliveryTimeout = options.deliveryTimeout || 30000;
    this.maxLogSize = options.maxLogSize || 10000;

    this.initializeNotificationChannels();
    this.initializeTemplates();
    this.startDeliveryProcessor();
  }

  /**
   * Initialize notification channels
   */
  initializeNotificationChannels() {
    this.channels = {
      email: {
        name: 'Email',
        enabled: true,
        priority: 1,
        maxRetries: 3
      },
      sms: {
        name: 'SMS',
        enabled: true,
        priority: 2,
        maxRetries: 2
      },
      'in-app': {
        name: 'In-App',
        enabled: true,
        priority: 3,
        maxRetries: 5
      },
      slack: {
        name: 'Slack',
        enabled: true,
        priority: 2,
        maxRetries: 2
      }
    };
  }

  /**
   * Initialize notification templates
   */
  initializeTemplates() {
    this.templates.set('ticket-created', {
      email: {
        subject: 'New Support Ticket: {ticketId}',
        body: 'Your ticket {ticketId} has been created. We will respond within {responseTime}.'
      },
      sms: 'Ticket {ticketId} created. Ref: {ticketId}',
      'in-app': {
        title: 'Ticket Created',
        message: 'Your support ticket {ticketId} has been created.',
        action: 'View Ticket'
      }
    });

    this.templates.set('ticket-assigned', {
      email: {
        subject: 'Ticket Assigned: {ticketId}',
        body: 'Your ticket {ticketId} has been assigned to {agentName}.'
      },
      'in-app': {
        title: 'Ticket Assigned',
        message: 'Your ticket has been assigned to {agentName}.'
      }
    });

    this.templates.set('ticket-updated', {
      email: {
        subject: 'Ticket Update: {ticketId}',
        body: 'Your ticket {ticketId} status is now {status}.'
      },
      'in-app': {
        title: 'Ticket Updated',
        message: 'Your ticket {ticketId} has been updated.',
        action: 'View Update'
      }
    });

    this.templates.set('ticket-resolved', {
      email: {
        subject: 'Ticket Resolved: {ticketId}',
        body: 'Your ticket {ticketId} has been resolved. Thank you for contacting us!'
      },
      sms: 'Ticket {ticketId} resolved. Please reply with feedback.',
      'in-app': {
        title: 'Ticket Resolved',
        message: 'Your ticket {ticketId} has been resolved.',
        action: 'Leave Feedback'
      }
    });

    this.templates.set('sla-warning', {
      email: {
        subject: 'SLA Warning: {ticketId}',
        body: 'Ticket {ticketId} {metric} SLA deadline approaching: {deadline}'
      },
      sms: 'ALERT: Ticket {ticketId} SLA {metric} breach imminent',
      'in-app': {
        title: 'SLA Warning',
        message: 'Ticket {ticketId} {metric} deadline approaching',
        priority: 'high'
      }
    });

    this.templates.set('escalation-alert', {
      email: {
        subject: 'ESCALATION: {ticketId}',
        body: 'Ticket {ticketId} has been escalated. Level: {level}. Reason: {reason}'
      },
      sms: 'ESCALATION: Ticket {ticketId} escalated to level {level}',
      'in-app': {
        title: 'Ticket Escalated',
        message: 'Ticket {ticketId} escalated: {reason}',
        priority: 'critical'
      }
    });
  }

  /**
   * Register notification preferences
   */
  registerNotificationPreferences(userId, preferences) {
    const prefs = {
      userId,
      channels: preferences.channels || ['email', 'in-app'],
      frequency: preferences.frequency || 'immediate',
      doNotDisturb: preferences.doNotDisturb || {
        enabled: false,
        startTime: '20:00',
        endTime: '08:00'
      },
      categories: preferences.categories || {
        ticketCreated: true,
        ticketAssigned: true,
        ticketUpdated: true,
        slaWarning: true,
        escalation: true
      },
      createdAt: new Date().toISOString()
    };

    this.preferences.set(userId, prefs);
    return prefs;
  }

  /**
   * Get notification preferences
   */
  getNotificationPreferences(userId) {
    return this.preferences.get(userId) || this.getDefaultPreferences(userId);
  }

  /**
   * Get default preferences
   */
  getDefaultPreferences(userId) {
    return {
      userId,
      channels: ['email', 'in-app'],
      frequency: 'immediate',
      doNotDisturb: {
        enabled: false,
        startTime: '20:00',
        endTime: '08:00'
      },
      categories: {
        ticketCreated: true,
        ticketAssigned: true,
        ticketUpdated: true,
        slaWarning: true,
        escalation: true
      }
    };
  }

  /**
   * Queue ticket notification
   */
  queueTicketNotification(notification) {
    const {
      type,
      recipient,
      ticketId,
      data = {},
      channels = null,
      priority = 'normal'
    } = notification;

    const prefs = this.getNotificationPreferences(recipient);

    // Check category preferences
    const categoryKey = `ticket${type.charAt(0).toUpperCase() + type.slice(1).replace('-', '')}`;
    if (!prefs.categories[categoryKey]) {
      return { success: false, reason: 'Category disabled in user preferences' };
    }

    // Use user preferences or provided channels
    const activeChannels = channels || prefs.channels;

    const queuedNotification = {
      id: `NOTIF-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      recipient,
      ticketId,
      channels: activeChannels.map(channel => ({
        name: channel,
        status: 'pending',
        attempts: 0,
        lastAttempt: null,
        error: null
      })),
      data,
      priority,
      createdAt: new Date().toISOString(),
      deliveredAt: null,
      failedAt: null
    };

    // Enqueue by priority
    if (!this.notificationQueues.has(priority)) {
      this.notificationQueues.set(priority, []);
    }

    this.notificationQueues.get(priority).push(queuedNotification);

    this.emit('notification-queued', queuedNotification);

    return { success: true, notification: queuedNotification };
  }

  /**
   * Start delivery processor
   */
  startDeliveryProcessor() {
    setInterval(() => {
      this.processDeliveryQueue();
    }, 5000); // Check every 5 seconds
  }

  /**
   * Process delivery queue
   */
  async processDeliveryQueue() {
    // Process by priority: critical, high, normal, low
    const priorities = ['critical', 'high', 'normal', 'low'];

    for (const priority of priorities) {
      const queue = this.notificationQueues.get(priority) || [];

      for (let i = 0; i < queue.length; i++) {
        const notification = queue[i];

        if (notification.channels.some(c => c.status === 'pending')) {
          const result = await this.deliverNotification(notification);

          if (result.allDelivered) {
            queue.splice(i, 1);
            i--;
            notification.deliveredAt = new Date().toISOString();
          } else if (result.allFailed) {
            queue.splice(i, 1);
            i--;
            notification.failedAt = new Date().toISOString();
          }
        }
      }
    }
  }

  /**
   * Deliver notification
   */
  async deliverNotification(notification) {
    let allDelivered = true;
    let allFailed = true;

    for (const channel of notification.channels) {
      if (channel.status !== 'pending') continue;

      const canRetry = channel.attempts < this.maxDeliveryAttempts;

      try {
        const result = await this.deliverToChannel(
          channel.name,
          notification
        );

        if (result.success) {
          channel.status = 'delivered';
          channel.deliveredAt = new Date().toISOString();
          allFailed = false;
        } else {
          channel.attempts += 1;
          channel.lastAttempt = new Date().toISOString();
          channel.error = result.error;

          if (!canRetry) {
            channel.status = 'failed';
            allFailed = false; // At least one channel failed finally
          } else {
            allDelivered = false;
          }
        }
      } catch (error) {
        channel.attempts += 1;
        channel.lastAttempt = new Date().toISOString();
        channel.error = error.message;

        if (channel.attempts >= this.maxDeliveryAttempts) {
          channel.status = 'failed';
        } else {
          allDelivered = false;
        }
      }
    }

    // Log delivery
    this.logDelivery(notification);

    return {
      notification,
      allDelivered: notification.channels.every(c => c.status === 'delivered'),
      allFailed: notification.channels.every(c => c.status === 'failed')
    };
  }

  /**
   * Deliver to specific channel
   */
  async deliverToChannel(channelName, notification) {
    return new Promise((resolve) => {
      setTimeout(() => {
        switch (channelName) {
          case 'email':
            resolve(this.sendEmail(notification));
            break;
          case 'sms':
            resolve(this.sendSMS(notification));
            break;
          case 'in-app':
            resolve(this.sendInApp(notification));
            break;
          case 'slack':
            resolve(this.sendSlack(notification));
            break;
          default:
            resolve({ success: false, error: 'Unknown channel' });
        }
      }, 100);
    });
  }

  /**
   * Send email notification
   */
  sendEmail(notification) {
    const template = this.getTemplate(notification.type, 'email');
    if (!template) {
      return { success: false, error: 'No email template' };
    }

    const subject = this.renderTemplate(template.subject, notification.data);
    const body = this.renderTemplate(template.body, notification.data);

    // Simulate email sending
    this.emit('email-sent', {
      to: notification.recipient,
      subject,
      body
    });

    return { success: true };
  }

  /**
   * Send SMS notification
   */
  sendSMS(notification) {
    const template = this.getTemplate(notification.type, 'sms');
    if (!template) {
      return { success: false, error: 'No SMS template' };
    }

    const message = this.renderTemplate(template, notification.data);

    // Simulate SMS sending
    this.emit('sms-sent', {
      to: notification.recipient,
      message
    });

    return { success: true };
  }

  /**
   * Send in-app notification
   */
  sendInApp(notification) {
    const template = this.getTemplate(notification.type, 'in-app');
    if (!template) {
      return { success: false, error: 'No in-app template' };
    }

    const message = {
      title: this.renderTemplate(template.title, notification.data),
      message: this.renderTemplate(template.message, notification.data),
      action: template.action,
      priority: template.priority || 'normal',
      timestamp: new Date().toISOString()
    };

    // Simulate in-app delivery
    this.emit('in-app-sent', {
      recipient: notification.recipient,
      message
    });

    return { success: true };
  }

  /**
   * Send Slack notification
   */
  sendSlack(notification) {
    const template = this.getTemplate(notification.type, 'email');
    if (!template) {
      return { success: false, error: 'No Slack template' };
    }

    const message = {
      text: this.renderTemplate(template.subject, notification.data),
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: this.renderTemplate(template.body, notification.data)
          }
        }
      ]
    };

    // Simulate Slack delivery
    this.emit('slack-sent', {
      channel: notification.recipient,
      message
    });

    return { success: true };
  }

  /**
   * Get template
   */
  getTemplate(notificationType, channel) {
    const typeTemplate = this.templates.get(notificationType);
    if (!typeTemplate) return null;

    return typeTemplate[channel];
  }

  /**
   * Render template with data
   */
  renderTemplate(templateStr, data) {
    let result = templateStr;

    for (const [key, value] of Object.entries(data)) {
      result = result.replace(`{${key}}`, value);
    }

    return result;
  }

  /**
   * Log delivery
   */
  logDelivery(notification) {
    const logEntry = {
      id: notification.id,
      timestamp: new Date().toISOString(),
      type: notification.type,
      recipient: notification.recipient,
      ticketId: notification.ticketId,
      channels: notification.channels.map(c => ({
        name: c.name,
        status: c.status,
        attempts: c.attempts
      }))
    };

    this.deliveryLog.push(logEntry);

    if (this.deliveryLog.length > this.maxLogSize) {
      this.deliveryLog.shift();
    }
  }

  /**
   * Get delivery log
   */
  getDeliveryLog(options = {}) {
    let log = [...this.deliveryLog];

    if (options.ticketId) {
      log = log.filter(l => l.ticketId === options.ticketId);
    }

    if (options.recipient) {
      log = log.filter(l => l.recipient === options.recipient);
    }

    if (options.status) {
      log = log.filter(l => l.channels.some(c => c.status === options.status));
    }

    return log.slice(-(options.limit || 50));
  }

  /**
   * Update notification preference
   */
  updateNotificationPreference(userId, updates) {
    const prefs = this.getNotificationPreferences(userId);

    if (updates.channels) prefs.channels = updates.channels;
    if (updates.frequency) prefs.frequency = updates.frequency;
    if (updates.doNotDisturb) prefs.doNotDisturb = updates.doNotDisturb;
    if (updates.categories) prefs.categories = { ...prefs.categories, ...updates.categories };

    this.preferences.set(userId, prefs);

    return prefs;
  }

  /**
   * Get delivery statistics
   */
  getDeliveryStats() {
    const stats = {
      total: this.deliveryLog.length,
      byStatus: {
        delivered: 0,
        pending: 0,
        failed: 0
      },
      byChannel: {
        email: 0,
        sms: 0,
        'in-app': 0,
        slack: 0
      },
      successRate: 0,
      averageDeliveryTime: 0
    };

    for (const log of this.deliveryLog) {
      for (const channel of log.channels) {
        if (channel.status === 'delivered') {
          stats.byStatus.delivered += 1;
        } else if (channel.status === 'pending') {
          stats.byStatus.pending += 1;
        } else {
          stats.byStatus.failed += 1;
        }

        stats.byChannel[channel.name] = (stats.byChannel[channel.name] || 0) + 1;
      }
    }

    stats.successRate = stats.total > 0
      ? Math.round((stats.byStatus.delivered / stats.total) * 100)
      : 0;

    return stats;
  }

  /**
   * Batch queue notifications
   */
  batchQueueNotifications(notifications) {
    const results = [];

    for (const notification of notifications) {
      const result = this.queueTicketNotification(notification);
      results.push(result);
    }

    return { success: true, queued: results.filter(r => r.success).length };
  }

  /**
   * Get pending notifications for user
   */
  getPendingNotifications(userId) {
    const pending = [];

    for (const queue of this.notificationQueues.values()) {
      for (const notification of queue) {
        if (notification.recipient === userId && notification.channels.some(c => c.status === 'pending')) {
          pending.push(notification);
        }
      }
    }

    return pending;
  }

  /**
   * Mark notification as read
   */
  markAsRead(notificationId) {
    // In a real implementation, would update a database
    this.emit('notification-read', { notificationId });
    return { success: true };
  }
}

module.exports = NotificationSystem;
