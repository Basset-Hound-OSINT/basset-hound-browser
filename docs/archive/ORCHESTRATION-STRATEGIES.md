# Orchestration Strategies for Basset Hound Browser

**Version**: 1.0  
**Date**: May 2026  
**Scope**: High-level orchestration approaches for multi-agent OSINT workflows

---

## Table of Contents

1. [Overview](#overview)
2. [Strategy 1: Decentralized Peer-to-Peer](#strategy-1-decentralized-peer-to-peer)
3. [Strategy 2: Centralized Coordinator](#strategy-2-centralized-coordinator)
4. [Strategy 3: Message Queue Pattern](#strategy-3-message-queue-pattern)
5. [Strategy 4: Stream Processing](#strategy-4-stream-processing)
6. [Strategy 5: Hybrid Hub-and-Spoke](#strategy-5-hybrid-hub-and-spoke)
7. [Strategy 6: Event-Driven Architecture](#strategy-6-event-driven-architecture)
8. [Strategy 7: Microservices Choreography](#strategy-7-microservices-choreography)
9. [Strategy 8: Serverless/Function-as-a-Service](#strategy-8-serverlessfaas-architecture)
10. [Comparison Matrix](#comparison-matrix)
11. [Implementation Recommendations](#implementation-recommendations)

---

## Overview

Orchestration strategy defines how multiple browser agents coordinate work, share state, and respond to errors. Choosing the right strategy depends on your workflow complexity, scale, and requirements.

### Key Considerations

1. **Coupling**: How tightly agents are bound
2. **Scalability**: How many agents can run simultaneously
3. **Latency**: End-to-end task completion time
4. **Fault Isolation**: Whether one agent failure affects others
5. **Complexity**: Ease of implementation and maintenance
6. **State Management**: How shared state is coordinated

---

## Strategy 1: Decentralized Peer-to-Peer

**Architecture**: Each agent discovers and coordinates with others directly via peer discovery.

### Characteristics

- **No central authority**: Agents make decisions autonomously
- **Direct communication**: Agent-to-agent WebSocket connections
- **Discovery mechanism**: Shared cache, DNS, or gossip protocol
- **Consensus-based**: Agents vote on resource allocation

### Use Case Example: Distributed Lead Generation

```
Agent 1 ──────────────── Agent 2 ──────────────── Agent 3
  │                        │                        │
  └──────────────────────┬─┴──────────────────────┘
                   Peer Registry
                  (Shared State)
```

### Implementation Outline (JavaScript)

```javascript
// peer-coordinator.js
class PeerCoordinator {
  constructor(agentId) {
    this.agentId = agentId;
    this.peers = new Map();
    this.registry = new Map(); // domain -> responsible agent
  }

  async discoverPeers(registryUrl) {
    const response = await fetch(`${registryUrl}/agents`);
    const agents = await response.json();
    
    for (const agent of agents) {
      if (agent.id !== this.agentId) {
        await this.connectToPeer(agent);
      }
    }
  }

  async connectToPeer(peerInfo) {
    const ws = new WebSocket(`ws://${peerInfo.host}:${peerInfo.port}`);
    this.peers.set(peerInfo.id, ws);
  }

  async acquireWorkTarget(domain) {
    // Try to acquire exclusivity for this domain
    const request = {
      type: 'acquire',
      domain,
      agentId: this.agentId
    };
    
    // Send to all peers
    const responses = await Promise.all(
      Array.from(this.peers.values()).map(ws =>
        this._sendToPeer(ws, request)
      )
    );
    
    // Grant if majority don't object
    const grants = responses.filter(r => r.grant).length;
    return grants / responses.length > 0.5;
  }

  async releaseWorkTarget(domain) {
    const request = {
      type: 'release',
      domain,
      agentId: this.agentId
    };
    
    for (const ws of this.peers.values()) {
      this._sendToPeer(ws, request).catch(() => {});
    }
  }
}
```

### Pros & Cons

| Pros | Cons |
|------|------|
| No single point of failure | Consensus overhead |
| Scales horizontally | Complex coordination logic |
| Self-healing | Network partition issues |
| No centralized bottleneck | Debugging difficult |

### Performance Profile

| Metric | Value |
|--------|-------|
| Startup time | 5-30 seconds (peer discovery) |
| Coordination overhead | 200-500ms per decision |
| Scalability | Up to 20-30 agents |
| Latency | 500-2000ms (consensus rounds) |

### When to Use

- **Recommended** for resilient systems (critical OSINT infrastructure)
- **Good for** 5-20 agent networks
- **Avoid** if you need sub-second coordination
- **Challenging** for real-time data aggregation

---

## Strategy 2: Centralized Coordinator

**Architecture**: Single coordinator service manages all agents and work distribution.

### Characteristics

- **Master-worker model**: Central server makes all decisions
- **HTTP/gRPC API**: Agents ask coordinator for work
- **Simple logic**: Agents are dumb, coordinator is smart
- **Easy debugging**: All state in one place

### Use Case Example: Competitive Intelligence

```
           ┌─────────────────────────────┐
           │   Coordinator Service       │
           │  - Task distribution        │
           │  - State aggregation        │
           │  - Result collection        │
           └──────┬──────────────────────┘
                  │
      ┌───────────┼───────────┬──────────────┐
      │           │           │              │
   Agent 1     Agent 2     Agent 3        Agent N
  LinkedIn    GitHub     Company DB      News Sites
```

### Implementation (Node.js)

```javascript
// coordinator-service.js
const express = require('express');
const WebSocket = require('ws');
const http = require('http');

class CoordinatorService {
  constructor(options = {}) {
    this.agents = new Map();
    this.taskQueue = [];
    this.results = new Map();
    this.port = options.port || 3000;
    
    this.app = express();
    this.httpServer = http.createServer(this.app);
    this.wsServer = new WebSocket.Server({ server: this.httpServer });
    this._setupRoutes();
    this._setupWebSocket();
  }

  _setupRoutes() {
    // Register agent
    this.app.post('/agents/register', (req, res) => {
      const agentId = req.body.agentId;
      this.agents.set(agentId, {
        id: agentId,
        status: 'idle',
        lastHeartbeat: Date.now(),
        completedTasks: 0
      });
      res.json({ success: true, agentId });
    });

    // Get next task
    this.app.get('/agents/:agentId/next-task', (req, res) => {
      const agentId = req.params.agentId;
      const agent = this.agents.get(agentId);
      
      if (!agent) {
        return res.status(404).json({ error: 'Agent not found' });
      }
      
      const task = this.taskQueue.shift();
      if (task) {
        agent.currentTask = task.id;
        agent.status = 'working';
        res.json(task);
      } else {
        res.json({ task: null });
      }
    });

    // Submit result
    this.app.post('/agents/:agentId/results', (req, res) => {
      const agentId = req.params.agentId;
      const result = req.body;
      
      this.results.set(result.taskId, {
        ...result,
        completedBy: agentId,
        completedAt: Date.now()
      });
      
      const agent = this.agents.get(agentId);
      if (agent) {
        agent.status = 'idle';
        agent.completedTasks++;
      }
      
      res.json({ success: true });
    });

    // Coordinator status
    this.app.get('/status', (req, res) => {
      res.json({
        agents: {
          active: Array.from(this.agents.values()).filter(a => a.status === 'working').length,
          total: this.agents.size
        },
        tasks: {
          queued: this.taskQueue.length,
          completed: this.results.size
        }
      });
    });
  }

  _setupWebSocket() {
    this.wsServer.on('connection', (ws) => {
      console.log('Agent connected via WebSocket');
      
      ws.on('message', async (message) => {
        const { type, agentId, data } = JSON.parse(message);
        
        if (type === 'register') {
          this.agents.set(agentId, {
            id: agentId,
            ws,
            status: 'idle',
            lastHeartbeat: Date.now()
          });
          ws.send(JSON.stringify({ type: 'registered', agentId }));
        }
        
        if (type === 'ready') {
          const task = this.taskQueue.shift();
          if (task) {
            ws.send(JSON.stringify({ type: 'task', data: task }));
            this.agents.get(agentId).status = 'working';
          } else {
            ws.send(JSON.stringify({ type: 'no-task' }));
          }
        }
        
        if (type === 'result') {
          this.results.set(data.taskId, {
            ...data,
            completedBy: agentId,
            completedAt: Date.now()
          });
          this.agents.get(agentId).status = 'idle';
        }
      });
    });
  }

  async addTask(task) {
    task.id = `task-${Date.now()}-${Math.random()}`;
    task.createdAt = Date.now();
    this.taskQueue.push(task);
  }

  async addTaskBatch(tasks) {
    for (const task of tasks) {
      await this.addTask(task);
    }
  }

  getResults() {
    return Array.from(this.results.values());
  }

  start() {
    this.httpServer.listen(this.port, () => {
      console.log(`Coordinator listening on port ${this.port}`);
    });
  }
}

module.exports = { CoordinatorService };

// Example usage
const coordinator = new CoordinatorService({ port: 3000 });

// Add tasks
coordinator.addTaskBatch([
  { url: 'https://competitor1.com', type: 'crawl' },
  { url: 'https://competitor2.com', type: 'crawl' },
  { url: 'https://competitor3.com', type: 'crawl' }
]);

coordinator.start();
```

### Pros & Cons

| Pros | Cons |
|------|------|
| Simple to understand | Single point of failure |
| Easy to debug | Coordinator bottleneck at scale |
| Centralized state | Network hop for every decision |
| Good for small-medium teams | Less resilient to failures |

### Performance Profile

| Metric | Value |
|--------|-------|
| Startup time | < 1 second |
| Task assignment latency | 10-50ms |
| Scalability | Up to 50-100 agents |
| State consistency | Immediate (single source) |

### When to Use

- **Recommended** for most OSINT workflows (10-50 agents)
- **Good for** centralized analysis teams
- **Avoid** if coordinator availability is critical
- **Perfect** for getting started quickly

---

## Strategy 3: Message Queue Pattern

**Architecture**: Tasks and results flow through a message broker (RabbitMQ, AWS SQS, etc.).

### Characteristics

- **Asynchronous**: Agents and coordinator decouple via queue
- **Durable**: Messages persisted, survives crashes
- **Scalable**: Queues handle many producers/consumers
- **Observable**: Each message is tracked

### Use Case Example: Large-Scale Lead Generation

```
                   ┌──────────────────┐
                   │  Message Broker  │
                   │  (RabbitMQ/SQS)  │
                   └────────┬─────────┘
                            │
          ┌─────────────────┼─────────────────┐
          │                 │                 │
      Task Queue        Result Queue      State Queue
          │                 │                 │
      Agent 1           Agent 2           Aggregator
```

### Implementation (Python with RabbitMQ)

```python
# queue-orchestrator.py
import pika
import json
import uuid
from typing import Dict, Any, List, Callable

class QueueOrchestrator:
    def __init__(self, rabbitmq_url='localhost'):
        self.connection = pika.BlockingConnection(
            pika.ConnectionParameters(host=rabbitmq_url)
        )
        self.channel = self.connection.channel()
        self._setup_queues()
        self.task_handlers: Dict[str, Callable] = {}
    
    def _setup_queues(self):
        """Declare all queues and exchanges"""
        # Declare queues
        self.channel.queue_declare(queue='tasks', durable=True)
        self.channel.queue_declare(queue='results', durable=True)
        self.channel.queue_declare(queue='errors', durable=True)
        
        # Set QoS for fair dispatch
        self.channel.basic_qos(prefetch_count=1)
    
    def publish_task(self, task: Dict[str, Any]):
        """Publish a task to the queue"""
        message = {
            'id': str(uuid.uuid4()),
            'type': task.get('type'),
            'data': task,
            'createdAt': datetime.now().isoformat(),
            'attempts': 0
        }
        
        self.channel.basic_publish(
            exchange='',
            routing_key='tasks',
            body=json.dumps(message),
            properties=pika.BasicProperties(
                delivery_mode=pika.spec.PERSISTENT_DELIVERY_MODE,
                correlation_id=message['id']
            )
        )
    
    def publish_task_batch(self, tasks: List[Dict[str, Any]]):
        """Publish multiple tasks"""
        for task in tasks:
            self.publish_task(task)
    
    def subscribe_tasks(self, agent_id: str, handler: Callable):
        """Agent subscribes to tasks"""
        def callback(ch, method, properties, body):
            try:
                task = json.loads(body)
                result = handler(task)
                
                # Publish result
                self.channel.basic_publish(
                    exchange='',
                    routing_key='results',
                    body=json.dumps({
                        'taskId': task['id'],
                        'agentId': agent_id,
                        'result': result,
                        'completedAt': datetime.now().isoformat()
                    })
                )
                
                # Acknowledge task
                ch.basic_ack(delivery_tag=method.delivery_tag)
            except Exception as e:
                # Publish error
                self.channel.basic_publish(
                    exchange='',
                    routing_key='errors',
                    body=json.dumps({
                        'taskId': task['id'],
                        'agentId': agent_id,
                        'error': str(e),
                        'timestamp': datetime.now().isoformat()
                    })
                )
                
                # Reject and requeue
                ch.basic_nack(delivery_tag=method.delivery_tag, requeue=True)
        
        self.channel.basic_consume(queue='tasks', on_message_callback=callback)
        print(f'Agent {agent_id} listening for tasks...')
        self.channel.start_consuming()
    
    def subscribe_results(self, handler: Callable):
        """Central aggregator subscribes to results"""
        def callback(ch, method, properties, body):
            result = json.loads(body)
            handler(result)
            ch.basic_ack(delivery_tag=method.delivery_tag)
        
        self.channel.basic_consume(queue='results', on_message_callback=callback)
        print('Result aggregator listening...')
        self.channel.start_consuming()
    
    def get_queue_stats(self) -> Dict[str, int]:
        """Get queue depths"""
        stats = {}
        for queue_name in ['tasks', 'results', 'errors']:
            method, properties, body = self.channel.basic_get(queue_name)
            stats[queue_name] = method.message_count if method else 0
        return stats

# Example agent
class QueueAgent:
    def __init__(self, agent_id: str, orchestrator: QueueOrchestrator):
        self.agent_id = agent_id
        self.orchestrator = orchestrator
    
    async def start(self):
        """Start processing tasks"""
        def handle_task(task):
            print(f'Agent {self.agent_id} processing task {task["id"]}')
            # Do work here
            return {'data': 'results'}
        
        self.orchestrator.subscribe_tasks(self.agent_id, handle_task)

# Example aggregator
class ResultAggregator:
    def __init__(self, orchestrator: QueueOrchestrator):
        self.orchestrator = orchestrator
        self.results = []
    
    def start(self):
        """Start aggregating results"""
        def handle_result(result):
            self.results.append(result)
            print(f'Aggregated result from {result["agentId"]}')
        
        self.orchestrator.subscribe_results(handle_result)
```

### Pros & Cons

| Pros | Cons |
|------|------|
| Highly scalable (100+ agents) | Operational complexity (broker setup) |
| Durable (handles failures) | Higher latency (100-500ms per task) |
| Observable (each message logged) | Requires external service |
| Decouples agents | Harder to debug |

### Performance Profile

| Metric | Value |
|--------|-------|
| Throughput | 1000+ tasks/second |
| Latency | 100-500ms per task |
| Durability | Persistent (survives crashes) |
| Scalability | 100+ agents easily |

### When to Use

- **Recommended** for high-volume operations (1000+ tasks)
- **Critical** for failure-resilient systems
- **Good for** distributed teams (agents on different servers)
- **Avoid** if you need sub-100ms latency

---

## Strategy 4: Stream Processing

**Architecture**: Use stream processing framework (Kafka, Flink) for continuous data flow.

### Characteristics

- **Real-time**: Processes data as it arrives
- **Stateful**: Maintains state over time windows
- **Scalable**: Processes billions of events
- **Windowing**: Aggregates data over time

### Use Case Example: Real-Time Content Monitoring

```
Website Changes ──→ Kafka ──→ Flink ──→ Analysis ──→ Alerts
(5000 sites)        Stream    Engine    (aggregation)
```

### Implementation Outline (Apache Flink)

```python
# stream-processor.py
from pyflink.datastream import StreamExecutionEnvironment, KeyedStream
from pyflink.datastream.functions import MapFunction, ReduceFunction
import json

class PageChangeDetector(MapFunction):
    """Detects changes in web pages"""
    
    def map(self, event):
        data = json.loads(event)
        
        # Compare with previous version
        previous_hash = self._get_previous_hash(data['url'])
        current_hash = self._compute_hash(data['content'])
        
        if current_hash != previous_hash:
            return {
                'url': data['url'],
                'changed': True,
                'timestamp': data['timestamp'],
                'changeSize': len(data['content']) - len(self._get_previous_content(data['url']))
            }
        
        return None
    
    def _get_previous_hash(self, url):
        # Retrieve from state/cache
        pass
    
    def _compute_hash(self, content):
        import hashlib
        return hashlib.sha256(content.encode()).hexdigest()

class ChangeAggregator(ReduceFunction):
    """Aggregates changes over time window"""
    
    def reduce(self, a, b):
        return {
            'urls': a.get('urls', []) + b.get('urls', []),
            'totalChanges': a.get('totalChanges', 0) + b.get('totalChanges', 0),
            'maxChangeSize': max(a.get('maxChangeSize', 0), b.get('maxChangeSize', 0))
        }

def setup_stream_pipeline():
    """Setup Flink stream processing pipeline"""
    env = StreamExecutionEnvironment.get_execution_environment()
    
    # Read from Kafka
    kafka_stream = env.add_source(
        KafkaSource.builder()
            .setBootstrapServers('localhost:9092')
            .setTopics('page-scans')
            .setGroupId('content-monitor')
            .build()
    )
    
    # Map to change events
    changes = kafka_stream.map(PageChangeDetector())
    
    # Aggregate by domain (5-minute windows)
    from pyflink.datastream.window import TumblingEventTimeWindow
    
    aggregated = changes \
        .key_by(lambda e: e['url'].split('/')[2]) \
        .window(TumblingEventTimeWindow.of(5 * 60 * 1000)) \
        .reduce(ChangeAggregator())
    
    # Send alerts for significant changes
    alerts = aggregated.filter(lambda e: e['totalChanges'] > 10)
    alerts.add_sink(AlertSink())
    
    env.execute("Content Monitor")
```

### Pros & Cons

| Pros | Cons |
|------|------|
| Real-time processing | Complex to understand |
| Handles massive scale | Operational complexity |
| Stateful aggregations | Harder to debug |
| Fault-tolerant | Overkill for small workloads |

### When to Use

- **Recommended** for 10,000+ concurrent observations
- **Critical** for real-time alerting systems
- **Good for** continuous monitoring (24/7 operations)
- **Avoid** unless you have operational expertise

---

## Strategy 5: Hybrid Hub-and-Spoke

**Architecture**: Centralized hub with smart agents at spokes; agents have local autonomy.

### Characteristics

- **Hub**: Central coordinator for global decisions
- **Spokes**: Agents make local decisions autonomously
- **Hybrid**: Combines centralized + decentralized
- **Resilient**: Hub failure doesn't stop agents

### Use Case Example: Multi-Region Competitive Intelligence

```
Region 1           Region 2           Region 3
┌──────────┐      ┌──────────┐      ┌──────────┐
│ Agent 1  │      │ Agent 3  │      │ Agent 5  │
│ Agent 2  │      │ Agent 4  │      │ Agent 6  │
└────┬─────┘      └────┬─────┘      └────┬─────┘
     │                 │                 │
  ┌──┴─────────────────┼─────────────────┴──┐
  │      Regional Hubs                      │
  │  (Local orchestration)                  │
  └──────────────────┬──────────────────────┘
                     │
              ┌──────┴──────┐
              │ Global Hub  │
              │ State sync  │
              │ Aggregation │
              └─────────────┘
```

### Implementation (Node.js)

```javascript
// global-hub.js
class GlobalHub {
  constructor() {
    this.regionalHubs = new Map();
    this.globalState = {};
  }

  registerRegionalHub(regionId, hub) {
    this.regionalHubs.set(regionId, hub);
    hub.on('stateChange', (state) => {
      this.updateGlobalState(regionId, state);
    });
  }

  updateGlobalState(regionId, state) {
    // Merge regional state into global state
    if (!this.globalState[regionId]) {
      this.globalState[regionId] = {};
    }
    Object.assign(this.globalState[regionId], state);
  }

  queryGlobalState(query) {
    // Support cross-region queries
    const results = [];
    for (const [regionId, state] of Object.entries(this.globalState)) {
      if (this._matchesQuery(state, query)) {
        results.push({ region: regionId, data: state });
      }
    }
    return results;
  }

  _matchesQuery(state, query) {
    // Simple query matching
    return Object.entries(query).every(([key, value]) =>
      state[key] === value
    );
  }
}

// regional-hub.js
class RegionalHub {
  constructor(regionId) {
    this.regionId = regionId;
    this.agents = new Map();
    this.localState = {};
  }

  registerAgent(agentId, agent) {
    this.agents.set(agentId, agent);
    agent.on('taskComplete', (result) => {
      this.handleTaskComplete(result);
    });
  }

  async assignTask(task) {
    // Local scheduling decision
    const agent = this._selectBestAgent();
    if (agent) {
      return await agent.executeTask(task);
    }
    return null;
  }

  _selectBestAgent() {
    // Select agent with lowest load
    let best = null;
    let minLoad = Infinity;
    
    for (const agent of this.agents.values()) {
      if (agent.load < minLoad) {
        best = agent;
        minLoad = agent.load;
      }
    }
    
    return best;
  }

  handleTaskComplete(result) {
    // Update local state
    this.localState = { ...this.localState, ...result.data };
    this.emit('stateChange', this.localState);
  }
}
```

### Pros & Cons

| Pros | Cons |
|------|------|
| Combines benefits of both approaches | More complex architecture |
| Resilient to hub failure | Harder to reason about |
| Local + global optimization | Eventual consistency issues |
| Good for distributed teams | Requires careful design |

### When to Use

- **Recommended** for multi-region deployments
- **Good for** hybrid cloud/on-premise
- **Consider** if regional autonomy matters
- **Avoid** for simple workflows

---

## Strategy 6: Event-Driven Architecture

**Architecture**: Agents publish events; other agents subscribe to interesting events.

### Characteristics

- **Loosely coupled**: Agents don't know about each other
- **Event sourcing**: All changes are events
- **Reactive**: Agents respond to events
- **Observable**: Full audit trail

### Use Case Example: Dynamic Investigation Workflows

```
Agent discovers email
        │
        ▼
    EmailFound event
        │
   ┌────┴────────────┬──────────────────┐
   │                 │                  │
   ▼                 ▼                  ▼
SearchSocial    ValidateEmail     AddToDatabase
```

### Implementation (Node.js with EventEmitter)

```javascript
// event-hub.js
const EventEmitter = require('events');

class EventHub extends EventEmitter {
  constructor() {
    super();
    this.eventLog = [];
    this.subscribers = new Map();
  }

  registerAgent(agentId, handlers = {}) {
    this.subscribers.set(agentId, handlers);
    
    for (const [eventType, handler] of Object.entries(handlers)) {
      this.on(eventType, async (event) => {
        try {
          await handler(event, agentId);
        } catch (error) {
          console.error(`Error handling ${eventType} in agent ${agentId}:`, error);
          this.emit('error', { agentId, eventType, error });
        }
      });
    }
  }

  async publishEvent(eventType, data, source) {
    const event = {
      id: `event-${Date.now()}-${Math.random()}`,
      type: eventType,
      data,
      source,
      timestamp: Date.now()
    };
    
    this.eventLog.push(event);
    this.emit(eventType, event);
    
    return event;
  }

  getEventHistory(filter = {}) {
    let history = this.eventLog;
    
    if (filter.type) {
      history = history.filter(e => e.type === filter.type);
    }
    
    if (filter.source) {
      history = history.filter(e => e.source === filter.source);
    }
    
    if (filter.since) {
      history = history.filter(e => e.timestamp > filter.since);
    }
    
    return history;
  }

  replay(fromTime = 0) {
    const events = this.eventLog.filter(e => e.timestamp >= fromTime);
    for (const event of events) {
      this.emit(event.type, event);
    }
  }
}

// Example agents
class LinkedInAgent {
  constructor(eventHub) {
    this.eventHub = eventHub;
  }

  register() {
    this.eventHub.registerAgent('linkedin', {
      'profile.found': this.onProfileFound.bind(this),
      'email.found': this.onEmailFound.bind(this)
    });
  }

  async onProfileFound(event) {
    console.log('Processing LinkedIn profile:', event.data);
    
    // Publish downstream event
    await this.eventHub.publishEvent('profile.analyzed', {
      name: event.data.name,
      company: event.data.company,
      connections: event.data.connections
    }, 'linkedin');
  }

  async onEmailFound(event) {
    console.log('Validating email:', event.data.email);
    
    // Do validation...
    await this.eventHub.publishEvent('email.validated', {
      email: event.data.email,
      valid: true
    }, 'linkedin');
  }
}

class EmailValidationAgent {
  constructor(eventHub) {
    this.eventHub = eventHub;
  }

  register() {
    this.eventHub.registerAgent('email-validator', {
      'email.found': this.onEmailFound.bind(this)
    });
  }

  async onEmailFound(event) {
    console.log('Email validation agent: checking', event.data.email);
    
    // Validate email...
    const valid = await this.validateEmail(event.data.email);
    
    await this.eventHub.publishEvent('email.validation.complete', {
      email: event.data.email,
      valid,
      verified: true
    }, 'email-validator');
  }

  async validateEmail(email) {
    // Implementation
    return true;
  }
}

// Setup
const hub = new EventHub();
const linkedinAgent = new LinkedInAgent(hub);
const emailAgent = new EmailValidationAgent(hub);

linkedinAgent.register();
emailAgent.register();

// Publishing events
hub.publishEvent('profile.found', {
  name: 'John Smith',
  company: 'TechCorp',
  connections: 500
}, 'web-scraper');

// Query history
console.log(hub.getEventHistory({ type: 'email.found' }));
```

### Pros & Cons

| Pros | Cons |
|------|------|
| Loose coupling | Harder to trace flow |
| Reactive and responsive | Implicit dependencies |
| Full audit trail | Debugging complex |
| Scalable architecture | Event ordering issues |

### When to Use

- **Recommended** for complex workflows (5+ steps)
- **Good for** systems that need audit trails
- **Perfect** for dynamic/adaptive workflows
- **Avoid** if you need deterministic execution

---

## Strategy 7: Microservices Choreography

**Architecture**: Services coordinate by watching others' outputs and reacting.

### Characteristics

- **Independent services**: Each handles one responsibility
- **Service discovery**: Services find each other
- **Choreography**: Services react to events from others
- **Scalable**: Easy to add new services

### Use Case Example: Comprehensive Company Research

```
Company Input
    │
    ├─→ Website Scraper Service
    │       │
    │       └─→ Industry Classification Service
    │               │
    │               ├─→ Financial Data Service
    │               │
    │               └─→ News Aggregator Service
    │
    ├─→ People Finder Service
    │       │
    │       └─→ LinkedIn Crawler Service
    │               │
    │               └─→ Email Validator Service
    │
    └─→ Report Generator Service
            (aggregates all results)
```

### Implementation (Python with Flask microservices)

```python
# microservices-orchestrator.py
from flask import Flask, request, jsonify
import requests
import json
from typing import Dict, List, Any

class MicroserviceOrchestrator:
    def __init__(self):
        self.services: Dict[str, str] = {}
        self.workflow_definitions: Dict[str, List[str]] = {}
    
    def register_service(self, service_name: str, url: str):
        """Register a microservice"""
        self.services[service_name] = url
    
    def define_workflow(self, workflow_name: str, steps: List[str]):
        """Define workflow as ordered service calls"""
        self.workflow_definitions[workflow_name] = steps
    
    async def execute_workflow(self, workflow_name: str, input_data: Dict[str, Any]) -> Dict:
        """Execute workflow by calling services in sequence"""
        steps = self.workflow_definitions.get(workflow_name, [])
        current_result = input_data
        
        for step_service in steps:
            service_url = self.services.get(step_service)
            if not service_url:
                raise ValueError(f"Service not found: {step_service}")
            
            try:
                response = requests.post(
                    f"{service_url}/process",
                    json=current_result,
                    timeout=30
                )
                response.raise_for_status()
                current_result = response.json()
            except requests.exceptions.RequestException as e:
                return {
                    'success': False,
                    'failedService': step_service,
                    'error': str(e)
                }
        
        return current_result

# Service 1: Website Scraper
scraper = Flask('website-scraper')

@scraper.route('/process', methods=['POST'])
def scrape_website():
    data = request.json
    company_name = data.get('company')
    
    # Scrape website
    result = {
        'company': company_name,
        'website_content': 'scraped content...',
        'emails': ['contact@company.com'],
        'phone': '1-800-COMPANY'
    }
    
    return jsonify(result)

# Service 2: Industry Classification
classifier = Flask('industry-classifier')

@classifier.route('/process', methods=['POST'])
def classify_industry():
    data = request.json
    
    # Classify based on content
    result = {
        **data,
        'industry': 'Technology',
        'subIndustry': 'SaaS',
        'employees': '1000-5000'
    }
    
    return jsonify(result)

# Service 3: Report Generator
reporter = Flask('report-generator')

@reporter.route('/process', methods=['POST'])
def generate_report():
    data = request.json
    
    # Generate final report
    report = {
        'summary': f"Comprehensive report for {data.get('company')}",
        'sections': {
            'overview': data.get('industry'),
            'contact': data.get('emails'),
            'employees': data.get('employees')
        },
        'generated_at': datetime.now().isoformat()
    }
    
    return jsonify(report)

# Orchestration setup
orchestrator = MicroserviceOrchestrator()
orchestrator.register_service('scraper', 'http://localhost:5001')
orchestrator.register_service('classifier', 'http://localhost:5002')
orchestrator.register_service('reporter', 'http://localhost:5003')
orchestrator.define_workflow('company_research', [
    'scraper',
    'classifier',
    'reporter'
])
```

### Pros & Cons

| Pros | Cons |
|------|------|
| Highly modular | Network overhead |
| Easy to scale | Distributed debugging hard |
| Can reuse services | Service discovery complexity |
| Independent deployment | Eventual consistency |

### When to Use

- **Recommended** for teams with multiple services
- **Good for** companies with DevOps expertise
- **Perfect** for large-scale operations (100+ agents)
- **Avoid** if you're just starting

---

## Strategy 8: Serverless/FaaS Architecture

**Architecture**: Use serverless functions triggered by events; platform manages scaling.

### Characteristics

- **Event-triggered**: Functions execute in response to events
- **Auto-scaling**: Platform scales automatically
- **Stateless**: Functions don't maintain state
- **Pay-per-execution**: Cost model based on usage

### Use Case Example: Elastic Lead Generation

```
Website List (S3)
    │
    ▼
S3 Trigger
    │
    ▼
Lambda: Extract Links (100x parallel)
    │
    ▼
Queue: Email Validation Jobs
    │
    ▼
Lambda: Validate Emails (1000x parallel)
    │
    ▼
DynamoDB: Store Results
```

### Implementation (AWS Lambda + Python)

```python
# lambda-orchestrator.py
import boto3
import json
import asyncio
from concurrent.futures import ThreadPoolExecutor

s3 = boto3.client('s3')
sqs = boto3.client('sqs')
dynamodb = boto3.resource('dynamodb')

# Lambda 1: Website Processor
def lambda_website_processor(event, context):
    """Process websites and extract emails"""
    bucket = event['Records'][0]['s3']['bucket']['name']
    key = event['Records'][0]['s3']['object']['key']
    
    # Get website list
    response = s3.get_object(Bucket=bucket, Key=key)
    websites = json.loads(response['Body'].read())
    
    # Process each website
    jobs = []
    for website in websites:
        job = {
            'website': website,
            'taskId': f"extract-{website}-{int(time.time())}"
        }
        
        # Queue job
        sqs.send_message(
            QueueUrl='https://sqs.region.amazonaws.com/123456789/email-extraction-queue',
            MessageBody=json.dumps(job)
        )
        jobs.append(job)
    
    return {
        'statusCode': 200,
        'body': json.dumps({
            'processed': len(jobs),
            'jobs': jobs
        })
    }

# Lambda 2: Email Extractor
def lambda_email_extractor(event, context):
    """Extract emails from website"""
    for record in event['Records']:
        job = json.loads(record['body'])
        website = job['website']
        
        try:
            # Scrape website
            emails = scrape_website_for_emails(website)
            
            # Store results
            table = dynamodb.Table('extracted-emails')
            table.put_item(Item={
                'website': website,
                'emails': emails,
                'timestamp': int(time.time())
            })
            
            # Mark job complete
            sqs.delete_message(
                QueueUrl='https://sqs.region.amazonaws.com/123456789/email-extraction-queue',
                ReceiptHandle=record['receiptHandle']
            )
        except Exception as e:
            print(f"Error processing {website}: {str(e)}")
            # Requeue job
            sqs.change_message_visibility(
                QueueUrl='...',
                ReceiptHandle=record['receiptHandle'],
                VisibilityTimeout=300  # Retry in 5 minutes
            )

def scrape_website_for_emails(website):
    """Scrape website for emails"""
    # Implementation using requests + regex
    return ['contact@company.com']

# Lambda 3: Results Aggregator
def lambda_results_aggregator(event, context):
    """Aggregate and report results"""
    table = dynamodb.Table('extracted-emails')
    
    # Scan all results
    response = table.scan()
    items = response['Items']
    
    # Aggregate
    summary = {
        'total_websites': len(items),
        'total_emails': sum(len(item['emails']) for item in items),
        'extraction_date': datetime.now().isoformat()
    }
    
    # Save summary
    s3.put_object(
        Bucket='reports',
        Key=f"summary-{int(time.time())}.json",
        Body=json.dumps(summary)
    )
    
    return {
        'statusCode': 200,
        'body': json.dumps(summary)
    }
```

### Pros & Cons

| Pros | Cons |
|------|------|
| Auto-scaling to 1000s | Cold start latency |
| Pay only for execution | Vendor lock-in |
| No infrastructure mgmt | Limited execution time |
| Easy to parallelize | Limited local state |

### When to Use

- **Recommended** for bursting workloads
- **Good for** event-driven workflows
- **Perfect** for one-time large operations
- **Avoid** for always-on services

---

## Comparison Matrix

| Strategy | Complexity | Scalability | Latency | Fault Tolerance | Best Use Case |
|----------|-----------|-------------|---------|-----------------|---------------|
| 1. P2P | High | Medium (20-30 agents) | Medium (500ms) | High | Resilient systems |
| 2. Coordinator | Low | Medium (50-100 agents) | Low (50ms) | Medium | Standard OSINT |
| 3. Queue | Medium | High (100+ agents) | High (100-500ms) | Very High | High-volume ops |
| 4. Streams | High | Very High (1000+) | Very Low | High | Real-time monitoring |
| 5. Hub-Spoke | Medium | Medium-High | Medium | Medium-High | Multi-region ops |
| 6. Event-Driven | Medium | High | Low-Medium | High | Complex workflows |
| 7. Microservices | High | Very High | High | Very High | Large teams |
| 8. Serverless | Low | Very High | Medium | High | Bursty workloads |

---

## Implementation Recommendations

### For Small Teams (1-3 engineers, <50 agents)
**Recommended**: Strategy 2 (Centralized Coordinator)

- Simple to implement and understand
- Single codebase to maintain
- Easy to debug
- Sufficient for typical OSINT workflows

**Implementation**: Start with coordinator pattern from this guide

### For Growing Teams (3-10 engineers, 50-500 agents)
**Recommended**: Strategy 3 (Message Queue) + Strategy 6 (Event-Driven)

- Decouple agents from coordinator
- Add observability via event log
- Easy to scale agents horizontally

**Implementation**: Add RabbitMQ/Kafka + event hub

### For Enterprise Deployments (10+ engineers, 500+ agents)
**Recommended**: Strategy 7 (Microservices) + Strategy 8 (Serverless)

- Independent service teams
- Auto-scaling and cost efficiency
- Distributed resilience

**Implementation**: Containerize services, deploy to Kubernetes

### For Real-Time Operations (24/7 monitoring)
**Recommended**: Strategy 4 (Stream Processing)

- Detect changes in real-time
- Maintain state over time
- Alert on patterns

**Implementation**: Use Apache Kafka + Flink

---

## Architecture Decision Flow

```
Do you need to monitor 24/7?
├─ Yes → Strategy 4: Streams
└─ No → Do you have 500+ agents?
    ├─ Yes → Do you have multiple teams?
    │   ├─ Yes → Strategy 7: Microservices
    │   └─ No → Strategy 3: Queues
    └─ No → Do you need audit trail?
        ├─ Yes → Strategy 6: Event-Driven
        └─ No → Strategy 2: Coordinator
```

---

## Related Documentation

- `MULTI-AGENT-COORDINATION-PATTERNS.md` - Detailed pattern implementations
- `AGENT-COORDINATION-CODE-EXAMPLES.md` - Working code examples
- `/docs/DEPLOYMENT-GUIDE.md` - Production deployment
- `/docs/API-REFERENCE.md` - WebSocket API details
