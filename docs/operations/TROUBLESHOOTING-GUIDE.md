# Basset Hound Browser - Troubleshooting Guide

**Document Version:** 1.0  
**Last Updated:** June 2, 2026  
**Classification:** Internal Operations

---

## Quick Navigation

- [Service Won't Start](#service-wont-start)
- [High Resource Usage](#high-resource-usage)
- [Network Issues](#network-issues)
- [API Errors](#api-errors)
- [Database Issues](#database-issues)
- [Security Issues](#security-issues)
- [Deployment Issues](#deployment-issues)

---

## Service Won't Start

### Problem: Process exits immediately after starting

**Symptoms:**
- `systemctl status` shows "inactive (dead)"
- Docker container exits within 5 seconds
- No error messages in console

**Root Causes:**
1. Configuration file missing or invalid
2. Required port already in use
3. Insufficient file permissions
4. Missing dependencies

**Solution Steps:**

1. **Check Configuration**
   ```bash
   ls -la config.yaml
   cat config.yaml | head -20
   # Should have valid YAML syntax
   ```

2. **Check Port Availability**
   ```bash
   netstat -tuln | grep 8765
   # Should show nothing if available
   lsof -i :8765  # If occupied, kill process or change port
   ```

3. **Check Permissions**
   ```bash
   ls -la /data/ /var/log/
   # User running service should own these
   chown -R basset:basset /data /var/log
   ```

4. **Check Dependencies**
   ```bash
   node --version  # Should be v18+
   npm list ws  # WebSocket library should be installed
   npm install  # Reinstall if missing
   ```

5. **Start with Debug Output**
   ```bash
   node /app/websocket/server.js 2>&1 | head -50
   ```

---

### Problem: Service starts but crashes after 1-5 minutes

**Symptoms:**
- Service runs briefly then exits
- Logs show "FATAL" or "ERROR" before exit
- Container restarts in loop

**Root Causes:**
1. Memory exhaustion
2. Unhandled exception
3. Dependency failure
4. Resource limits too strict

**Solution Steps:**

1. **Check Logs for Errors**
   ```bash
   tail -100 /var/log/basset-hound/websocket.log | grep -E 'ERROR|FATAL|Uncaught'
   ```

2. **Check Memory**
   ```bash
   free -h
   # If <100MB available, restart other processes
   # If OOM killer active: dmesg | tail -20
   ```

3. **Check Resource Limits**
   ```bash
   ulimit -a
   # Increase if needed: ulimit -n 65536
   ```

4. **Run with Verbose Logging**
   ```bash
   DEBUG=* node /app/websocket/server.js 2>&1 | tail -50
   ```

---

## High Resource Usage

### Problem: CPU usage consistently >80%

**Symptoms:**
- `top` shows process using 80%+ CPU
- System sluggish
- Latency increasing

**Root Causes:**
1. Tight loop or infinite recursion
2. High volume of connections
3. Inefficient database queries
4. Unoptimized code path

**Solution Steps:**

1. **Identify the Bottleneck**
   ```bash
   # Get process details
   ps aux | grep websocket
   # Check number of connections
   ss -tnap | grep 8765 | wc -l
   ```

2. **If High Connection Count is Normal:**
   ```bash
   # This may be expected load
   # Check if latency is also high
   # If not, this is acceptable
   ```

3. **If Not Load-Related:**
   ```bash
   # Check for infinite loops in logs
   tail -200 /var/log/basset-hound/websocket.log | grep -E 'loop|recursive|processing'
   
   # Escalate to L2 for code profiling
   ```

4. **Temporary Fix:**
   ```bash
   # Reduce logging verbosity
   systemctl stop basset-hound-websocket
   # Edit config to reduce logging
   systemctl start basset-hound-websocket
   ```

---

### Problem: Memory usage >85% and growing

**Symptoms:**
- `free -h` shows memory climbing
- Process RSS keeps growing
- Eventually OOM killer activates

**Root Causes:**
1. Memory leak in application
2. Large dataset cached in memory
3. Unbounded cache growth
4. Large messages not cleaned up

**Solution Steps:**

1. **Monitor Memory Growth**
   ```bash
   # Check every 30 seconds for 5 minutes
   for i in {1..10}; do 
     free -h | grep Mem
     ps aux | grep websocket | grep -v grep | awk '{print $6 " MB"}'
     sleep 30
   done
   ```

2. **If Growing Linearly (leak):**
   ```bash
   # Restart service
   systemctl restart basset-hound-websocket
   
   # Monitor again
   watch -n 5 'free -h && ps aux | grep websocket | grep -v grep'
   ```

3. **If Memory Stable (just high load):**
   ```bash
   # This is normal under load
   # Monitor that it doesn't continue growing
   # Scale horizontally if needed
   ```

4. **If Still Leaking After Restart:**
   ```bash
   # Escalate to L2
   # Provide: memory growth chart, logs, reproduction steps
   ```

---

### Problem: Disk usage >90%

**Symptoms:**
- `df -h` shows critical space
- Application can't write logs
- New files can't be created

**Root Causes:**
1. Old log files not rotated
2. Cache directory growing unbounded
3. Temporary files not cleaned
4. Large data files retained

**Solution Steps:**

1. **Find What's Using Space**
   ```bash
   du -sh /* | sort -rh
   du -sh /var/log/* | sort -rh
   du -sh /data/* | sort -rh
   
   find / -type f -size +100M 2>/dev/null | head -10
   ```

2. **Clean Old Logs (Safe)**
   ```bash
   # Keep last 7 days
   find /var/log/basset-hound -name "*.log" -mtime +7 -delete
   
   # If still critical, keep only 3 days
   find /var/log/basset-hound -name "*.log" -mtime +3 -delete
   ```

3. **Clean Old Docker Images**
   ```bash
   docker system prune -a
   # This removes unused images and layers
   ```

4. **Clean Temp Files**
   ```bash
   rm -rf /tmp/* /var/tmp/*
   ```

5. **Verify Space**
   ```bash
   df -h
   # Should now have >20% free space
   ```

---

## Network Issues

### Problem: Can't connect to API (WebSocket)

**Symptoms:**
- Connection refused on port 8765
- `curl` returns connection error
- Clients can't establish connection

**Root Causes:**
1. Service not running
2. Port not exposed
3. Firewall blocking
4. Wrong IP/hostname

**Solution Steps:**

1. **Check Service Running**
   ```bash
   systemctl status basset-hound-websocket
   ps aux | grep websocket
   ```

2. **Check Port Listening**
   ```bash
   netstat -tuln | grep 8765
   # Should see: tcp 0 0 0.0.0.0:8765 LISTEN
   
   lsof -i :8765  # Show process
   ```

3. **Check Firewall**
   ```bash
   # Linux iptables
   iptables -L -n | grep 8765
   
   # Or ufw
   ufw status | grep 8765
   
   # Or firewalld
   firewall-cmd --list-ports
   ```

4. **Test Locally**
   ```bash
   # From server
   curl -v http://localhost:8765/health
   
   # From client
   curl -v http://<server-ip>:8765/health
   ```

5. **If Firewall Blocking:**
   ```bash
   # Open port 8765
   sudo ufw allow 8765
   # Or
   sudo firewall-cmd --add-port=8765/tcp --permanent
   sudo firewall-cmd --reload
   ```

---

### Problem: Slow network response / High latency

**Symptoms:**
- API responds but slowly (>500ms)
- `curl` shows high `time_total`
- Clients timeout waiting

**Root Causes:**
1. High load (many connections)
2. Network congestion
3. Service processing slowly
4. DNS resolution slow

**Solution Steps:**

1. **Check Service Response Time**
   ```bash
   time curl -s http://localhost:8765/health > /dev/null
   # Should be <50ms for health check
   ```

2. **Check Connection Count**
   ```bash
   ss -tnap | grep 8765 | wc -l
   # If >1000, this may be expected under load
   ```

3. **Check Network**
   ```bash
   # Check for packet loss
   ping -c 10 8.8.8.8 | grep "loss"
   
   # Check DNS resolution
   nslookup basset-hound.local
   time nslookup basset-hound.local  # Should be <10ms
   ```

4. **If Service Slow:**
   ```bash
   # Check CPU and memory
   top -b -n 1 | head
   
   # May need to scale or optimize
   ```

---

## API Errors

### Problem: 400 Bad Request errors

**Symptoms:**
- Client receives HTTP 400
- Error message: "Invalid request"
- Specific field identified in error

**Root Causes:**
1. Missing required field
2. Wrong data type
3. Invalid value format
4. Header validation failure

**Solution Steps:**

1. **Check Request Format**
   ```bash
   # Verify JSON is valid
   echo '{"command":"navigate","url":"..."}' | jq .
   ```

2. **Verify Required Fields**
   ```bash
   # Check request has all required fields
   # See API-REFERENCE.md for command format
   ```

3. **Check Field Types**
   ```bash
   # String fields should be quoted
   # Number fields should be unquoted
   # Example: {"sessionId": "123", "count": 5}
   ```

4. **Review Error Message**
   ```bash
   # Error message should indicate which field is invalid
   # "Invalid field 'url'" means url is wrong
   ```

---

### Problem: 500 Internal Server Error

**Symptoms:**
- Server returns HTTP 500
- Error message: "Internal Server Error"
- Logs show exceptions

**Root Causes:**
1. Unhandled exception in code
2. Database connection failure
3. External dependency failure
4. Out of memory

**Solution Steps:**

1. **Check Logs Immediately**
   ```bash
   tail -50 /var/log/basset-hound/websocket.log | grep ERROR
   ```

2. **Look for Stack Trace**
   ```bash
   tail -100 /var/log/basset-hound/websocket.log | grep -A 10 "Error:"
   ```

3. **Check Dependencies**
   ```bash
   # Try reaching external services
   curl -s http://db-server:5432
   ```

4. **Escalate to L2**
   ```bash
   # This requires debugging
   # Share: full error message, request that caused it, logs
   ```

---

### Problem: Timeout (request hangs indefinitely)

**Symptoms:**
- Client request never returns
- Client eventually times out
- No error in logs

**Root Causes:**
1. Request processing takes >30 seconds
2. Deadlock between systems
3. Infinite loop
4. Resource exhaustion

**Solution Steps:**

1. **Check Active Requests**
   ```bash
   # Monitor requests
   tail -f /var/log/basset-hound/websocket.log | grep 'request\|processing'
   ```

2. **Check System Status**
   ```bash
   vmstat 1 5  # Check CPU/memory/I/O
   ```

3. **If Consistently Timing Out:**
   ```bash
   # Restart service
   systemctl restart basset-hound-websocket
   sleep 10
   
   # Retry request
   curl -v --max-time 10 http://localhost:8765/health
   ```

4. **Escalate to L2**
   ```bash
   # Provide: Request details, when timeout occurs, logs from time
   ```

---

## Database Issues

### Problem: Can't connect to database

**Symptoms:**
- "Connection refused" in logs
- Database commands fail
- Service degrades but doesn't crash

**Root Causes:**
1. Database service not running
2. Wrong hostname/port
3. Credentials incorrect
4. Firewall blocking

**Solution Steps:**

1. **Check Database Running**
   ```bash
   # For PostgreSQL
   systemctl status postgresql
   
   # For MongoDB
   systemctl status mongodb
   ```

2. **Test Connection**
   ```bash
   # PostgreSQL
   psql -U user -d database -h localhost -c "SELECT 1"
   
   # MongoDB
   mongo --host localhost --eval "db.adminCommand('ping')"
   ```

3. **Check Credentials**
   ```bash
   # Verify in config file
   grep -i "database\|username\|password" /etc/basset-hound/config.yaml
   ```

4. **Check Network**
   ```bash
   # Verify port listening
   netstat -tuln | grep 5432  # PostgreSQL default
   ```

---

### Problem: Database queries are slow

**Symptoms:**
- API latency high (>2 seconds)
- Database queries take >1 second
- CPU high during queries

**Root Causes:**
1. Missing database indexes
2. Large full table scans
3. Inefficient query
4. Database needs vacuuming

**Solution Steps:**

1. **Check Slow Query Logs**
   ```bash
   tail -50 /var/log/postgresql/query.log | grep "duration: [1-9][0-9]+ms"
   ```

2. **Enable Query Logging**
   ```bash
   # In PostgreSQL config
   log_min_duration_statement = 1000  # Log queries >1 second
   ```

3. **Run VACUUM**
   ```bash
   # If last maintenance was long ago
   vacuumdb -U user database_name
   ```

4. **Check Missing Indexes**
   ```bash
   # Query frequently slow? May need index
   # Escalate to database team
   ```

---

## Security Issues

### Problem: Suspected intrusion or unauthorized access

**Symptoms:**
- Unusual log entries
- Failed authentication attempts spike
- Unexpected data access

**Solution Steps:**

1. **STOP - Don't Panic**
   - Don't modify files/logs yet
   - Don't restart services
   - Preserve evidence

2. **Escalate Immediately to L3**
   ```
   Call L3 and say: "Potential security incident"
   Don't discuss details over insecure channel
   ```

3. **Preserve Logs**
   ```bash
   # Copy logs to separate location
   cp /var/log/basset-hound/* /backup/security-incident/
   ```

4. **Disconnect if Necessary**
   ```bash
   # If confirmed breach, may need to:
   # - Take service offline
   # - Rotate credentials
   # - Notify customers
   # - Contact law enforcement
   ```

---

### Problem: SSL/TLS certificate issues

**Symptoms:**
- "Certificate expired" warning
- Clients can't establish secure connection
- Certificate validation failures

**Solution Steps:**

1. **Check Certificate Expiration**
   ```bash
   # View certificate details
   openssl x509 -in /etc/basset-hound/ssl/cert.pem -noout -dates
   ```

2. **If Expired or Expiring Soon**
   ```bash
   # Renew certificate
   certbot renew --force-renewal
   
   # Or install new certificate
   cp new-cert.pem /etc/basset-hound/ssl/
   systemctl restart basset-hound-websocket
   ```

3. **Verify Certificate Installed**
   ```bash
   # Check certificate in use
   openssl s_client -connect localhost:8765 </dev/null | grep -E "subject|issuer|dates"
   ```

---

## Deployment Issues

### Problem: Failed deployment - service won't start after update

**Symptoms:**
- Deployment completes
- Service fails to start
- Previous version works

**Root Causes:**
1. New code has bugs
2. Database schema incompatible
3. Missing dependencies
4. Configuration mismatch

**Solution Steps:**

1. **Check Deployment Logs**
   ```bash
   tail -100 /var/log/deployment.log
   ```

2. **Check Service Logs**
   ```bash
   systemctl status basset-hound-websocket
   journalctl -u basset-hound-websocket -n 50
   ```

3. **Rollback Immediately**
   ```bash
   # Use deployment script
   ./scripts/deploy.sh --version previous
   
   # Or manually
   docker pull basset-hound:v12.0.0
   docker stop basset-hound-browser
   docker run -d basset-hound:v12.0.0
   ```

4. **Investigate**
   ```bash
   # Compare new vs old code
   git diff v12.0.1 v12.0.0 -- websocket/server.js | head -50
   ```

5. **Escalate to L2**
   ```bash
   # Provide: deployment logs, service logs, code diff
   ```

---

## Additional Resources

- **API Reference:** `/docs/API-REFERENCE.md`
- **Architecture:** `/docs/ARCHITECTURE.md`
- **Runbooks:** `/docs/operations/ON-CALL-PROCEDURES.md`
- **Incident Response:** `/docs/operations/INCIDENT-RESPONSE-PLAN.md`

---

## Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-02 | Engineering | Initial document |

---

**Last Review:** June 2, 2026  
**Next Review:** Q3 2026
