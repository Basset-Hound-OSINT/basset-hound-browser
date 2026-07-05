# Error Handling & Debugging

Common error patterns and debugging strategies.

## Common Errors

### Connection Refused
**Cause:** Browser not running  
**Solution:** Start browser with `npm start:dev` or Docker

### Invalid JSON
**Cause:** Malformed command JSON  
**Solution:** Use JSON validator, check quotes and commas

### Timeout
**Cause:** Command took too long  
**Solution:** Increase timeout, check page loading, simplify command

### Element Not Found
**Cause:** Selector doesn't match  
**Solution:** Use DevTools to verify selector, check page loaded

### Network Error
**Cause:** Page load failed  
**Solution:** Check URL valid, check network connectivity, check proxy

## Error Response Format

```json
{
  "id": "1",
  "success": false,
  "error": "Element not found",
  "code": "ELEMENT_NOT_FOUND",
  "details": "Selector 'button.invalid' did not match any elements"
}
```

## Debugging Tips

### Enable Verbose Logging

```bash
DEBUG=basset-hound:* npm start:dev
```

### Check Console Output

```python
await ws.send(json.dumps({
    "id": "1",
    "command": "get_console_logs"
}))
response = json.loads(await ws.recv())
for log in response['logs']:
    print(f"{log['level']}: {log['message']}")
```

### Validate Selector Works

```python
await ws.send(json.dumps({
    "id": "1",
    "command": "execute_script",
    "script": "document.querySelectorAll('button.submit').length"
}))
response = json.loads(await ws.recv())
print(f"Elements found: {response['result']}")
```

### Take Screenshot for Visual Inspection

```python
await ws.send(json.dumps({
    "id": "1",
    "command": "screenshot"
}))
response = json.loads(await ws.recv())
# Save and inspect screenshot
```

## Error Handling Pattern

```python
async def safe_command(ws, command):
    try:
        await ws.send(json.dumps(command))
        response = json.loads(await ws.recv())
        
        if not response.get('success'):
            error = response.get('error', 'Unknown error')
            code = response.get('code', 'UNKNOWN')
            print(f"Error ({code}): {error}")
            return None
        
        return response
    except json.JSONDecodeError:
        print("Invalid JSON response")
        return None
    except Exception as e:
        print(f"Exception: {e}")
        return None
```

## Retry Pattern

```python
import asyncio
import random

async def retry_command(ws, command, max_retries=3):
    for attempt in range(max_retries):
        try:
            response = await safe_command(ws, command)
            if response:
                return response
        except Exception as e:
            if attempt < max_retries - 1:
                wait = (2 ** attempt) + random.uniform(0, 1)  # Exponential backoff
                await asyncio.sleep(wait)
                continue
            raise
```

## See Also

- **[Complete API Reference](../api/ERROR-CODES.md)** - All error codes
- **[Troubleshooting Guide](../troubleshooting/CONNECTION-ISSUES.md)** - Common issues
- **[FAQ](../troubleshooting/FAQ.md)** - Frequently asked questions
