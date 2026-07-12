# Error Codes & Handling

Reference for all error codes and troubleshooting.

## Common Error Codes

### ELEMENT_NOT_FOUND
**Cause:** Selector doesn't match any element  
**Solution:** Verify selector with DevTools, check page fully loaded

### TIMEOUT
**Cause:** Command took longer than specified timeout  
**Solution:** Increase timeout, simplify command, check page load

### NAVIGATION_ERROR
**Cause:** URL unreachable or invalid  
**Solution:** Verify URL valid, check network connectivity, check proxy

### INVALID_COMMAND
**Cause:** Command name unknown  
**Solution:** Check command spelling, verify version supports command

### CONNECTION_REFUSED
**Cause:** Cannot connect to WebSocket server  
**Solution:** Start browser, verify port, check firewall

### PROXY_ERROR
**Cause:** Proxy connection failed  
**Solution:** Verify proxy host/port, check authentication, test proxy

### SCRIPT_ERROR
**Cause:** JavaScript execution failed  
**Solution:** Check script syntax, verify page state, check console logs

### PROFILE_NOT_FOUND
**Cause:** Profile doesn't exist  
**Solution:** Create profile first, verify name

### SESSION_NOT_FOUND
**Cause:** Saved session doesn't exist  
**Solution:** Save session first, verify name

## Error Response Format

```json
{
  "id": "1",
  "success": false,
  "error": "Element not found",
  "code": "ELEMENT_NOT_FOUND",
  "details": "Selector 'button.submit' did not match any elements"
}
```

## Error Handling Pattern

```python
response = json.loads(await ws.recv())

if not response.get('success'):
    code = response.get('code')
    error = response.get('error')
    details = response.get('details', '')
    
    # Handle specific error
    if code == 'ELEMENT_NOT_FOUND':
        print("Element not found, retrying with different selector...")
    elif code == 'TIMEOUT':
        print("Timeout, increasing wait time...")
    elif code == 'PROXY_ERROR':
        print("Proxy error, trying next proxy...")
```

## Debugging Tools

**Get browser diagnostics:**
```python
await ws.send(json.dumps({"command": "diagnostics"}))
```

**Get console logs:**
```python
await ws.send(json.dumps({"command": "get_console_logs"}))
```

**Test JavaScript:**
```python
await ws.send(json.dumps({
    "command": "execute_script",
    "script": "console.log('test'); document.querySelectorAll('button').length"
}))
```

## See Also

- **[Error Handling Guide](../guides/ERROR-HANDLING.md)** - Patterns and debugging
- **[Troubleshooting](../troubleshooting/FAQ.md)** - Common issues
- **[Connection Issues](../troubleshooting/CONNECTION-ISSUES.md)** - Connection problems
