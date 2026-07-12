# Docker Issues

Troubleshoot Docker-related problems.

## Container Won't Start

**Error:** `docker run` returns immediately or shows error

**Solutions:**

1. **Check logs**
   ```bash
   docker logs <container-id>
   ```

2. **Run with verbose output**
   ```bash
   docker run -it basset-hound:dev
   # Shows output directly instead of exiting
   ```

3. **Check image built**
   ```bash
   docker images | grep basset-hound
   ```

4. **Rebuild image**
   ```bash
   docker build -f Dockerfile.dev -t basset-hound:dev --no-cache .
   ```

## Port Already in Use

**Error:** `bind: Address already in use`

**Solutions:**

1. **Find process using port**
   ```bash
   lsof -i :8765
   # or
   netstat -tulpn | grep 8765
   ```

2. **Kill process**
   ```bash
   kill -9 <PID>
   ```

3. **Or use different port**
   ```bash
   docker run -p 9000:8765 basset-hound:dev
   # WebSocket at ws://localhost:9000
   ```

## Can't Connect to Container

**Error:** Can't reach container from client

**Solutions:**

1. **Container running?**
   ```bash
   docker ps
   # Should show basset-hound container
   ```

2. **Port exposed?**
   ```bash
   docker port <container>
   # Should show 8765 mapping
   ```

3. **Check network**
   ```bash
   # If using custom network
   docker network inspect <network>
   ```

4. **Use container IP**
   ```bash
   CONTAINER_IP=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' <container>)
   curl http://$CONTAINER_IP:8765/api/diagnostics
   ```

## Out of Memory

**Error:** `OOMKilled` or container exits with code 137

**Solutions:**

1. **Limit other containers**
   - Stop unused containers

2. **Increase Docker memory limit**
   - Docker Desktop Settings → Resources

3. **Set explicit limit**
   ```bash
   docker run -m 2g basset-hound:dev
   ```

4. **Reduce footprint**
   - Use smaller base image
   - Clear logs: `docker system prune`

## Disk Space Issues

**Error:** `No space left on device`

**Solutions:**

1. **Check disk usage**
   ```bash
   docker system df
   ```

2. **Clean up**
   ```bash
   # Remove unused images
   docker image prune -a
   
   # Remove unused containers
   docker container prune
   
   # Remove unused volumes
   docker volume prune
   
   # Clean everything
   docker system prune -a
   ```

## Slow Performance

**Issue:** Container running slow

**Solutions:**

1. **Check CPU/memory usage**
   ```bash
   docker stats <container>
   ```

2. **Increase resources**
   ```bash
   docker run --cpus 2 --memory 4g basset-hound:prod
   ```

3. **Check network**
   - Volume mounts can be slow on Docker Desktop
   - Use named volumes instead: `-v basset-hound-data:/app/data`

## Build Failures

**Error:** `docker build` fails

**Solutions:**

1. **Check Dockerfile**
   - Ensure file exists: `ls -la Dockerfile.dev`
   - Check syntax: `hadolint Dockerfile.dev`

2. **Check context**
   ```bash
   # Make sure running from repo root
   cd basset-hound-browser
   docker build -f Dockerfile.dev -t basset-hound:dev .
   ```

3. **Build with verbose output**
   ```bash
   docker build --progress=plain -f Dockerfile.dev -t basset-hound:dev .
   ```

4. **Check base image available**
   ```bash
   # If custom base image, ensure it's available
   docker pull <base-image>
   ```

## Network Issues

**Container can't reach external URLs**

**Solutions:**

1. **Check Docker network**
   ```bash
   docker network inspect bridge
   ```

2. **Test connectivity from container**
   ```bash
   docker run basset-hound:dev curl http://example.com
   ```

3. **Fix DNS**
   ```bash
   docker run --dns 8.8.8.8 basset-hound:dev
   # Or in docker-compose.yml:
   # dns:
   #   - 8.8.8.8
   #   - 1.1.1.1
   ```

## Volume Mount Issues

**Files not visible in container**

**Solutions:**

1. **Check mount path**
   ```bash
   docker run -v $(pwd):/app basset-hound:dev
   # Not -v /app (that's inside container)
   ```

2. **Verify with ls**
   ```bash
   docker run -v $(pwd):/app basset-hound:dev ls -la /app
   ```

3. **Check permissions**
   ```bash
   # May need chmod
   docker run -v $(pwd):/app basset-hound:dev chmod 755 /app
   ```

## Docker Desktop Specific

**On macOS/Windows:**

1. **Slow volumes**
   - Use named volumes instead
   - Or use delegated mounts: `-v $(pwd):/app:delegated`

2. **Memory limit issues**
   - Settings → Resources → Memory slider
   - Increase to at least 4GB

3. **Can't connect to localhost**
   - Use `docker.for.mac.localhost` (macOS)
   - Use `docker.for.win.localhost` (Windows)
   - Or use container IP

## See Also

- **[Docker Deployment](../deployment/DOCKER-DEPLOYMENT.md)** - Setup guide
- **[Docker Quick Start](../getting-started/DOCKER-QUICKSTART.md)** - Getting started
- **[Connection Issues](CONNECTION-ISSUES.md)** - General connection help
