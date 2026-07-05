# Real-World Workflows

Complete end-to-end examples for common tasks.

## Web Scraping with Evasion

```python
import asyncio, json, websockets, random

async def scrape_with_evasion():
    async with websockets.connect("ws://localhost:8765") as ws:
        # Setup evasion
        await ws.send(json.dumps({
            "command": "randomize_fingerprint"
        }))
        await ws.recv()
        
        await ws.send(json.dumps({
            "command": "set_proxy",
            "host": "proxy.example.com",
            "port": 8080,
            "type": "http"
        }))
        await ws.recv()
        
        # Navigate
        await ws.send(json.dumps({
            "command": "navigate",
            "url": "https://example.com"
        }))
        await ws.recv()
        await asyncio.sleep(random.uniform(2, 5))
        
        # Scroll naturally
        await ws.send(json.dumps({
            "command": "scroll",
            "y": 500
        }))
        await ws.recv()
        await asyncio.sleep(random.uniform(1, 3))
        
        # Extract content
        await ws.send(json.dumps({
            "command": "get_content"
        }))
        response = json.loads(await ws.recv())
        
        return response['content']['html']

asyncio.run(scrape_with_evasion())
```

## Forensic Evidence Collection

```python
async def collect_evidence():
    async with websockets.connect("ws://localhost:8765") as ws:
        await ws.send(json.dumps({
            "command": "navigate",
            "url": "https://evidence.example.com"
        }))
        await ws.recv()
        await asyncio.sleep(2)
        
        # Capture complete state
        await ws.send(json.dumps({
            "command": "capture_html"
        }))
        html = json.loads(await ws.recv())
        
        await ws.send(json.dumps({
            "command": "capture_dom_snapshot"
        }))
        dom = json.loads(await ws.recv())
        
        await ws.send(json.dumps({
            "command": "get_console_logs"
        }))
        logs = json.loads(await ws.recv())
        
        await ws.send(json.dumps({
            "command": "extract_javascript_context"
        }))
        js = json.loads(await ws.recv())
        
        # Export all
        await ws.send(json.dumps({
            "command": "export_forensic_data",
            "format": "json"
        }))
        export = json.loads(await ws.recv())
        
        return {
            'html': html,
            'dom': dom,
            'logs': logs,
            'javascript': js,
            'export': export
        }

asyncio.run(collect_evidence())
```

## Form Submission with Validation

```python
async def submit_form():
    async with websockets.connect("ws://localhost:8765") as ws:
        await ws.send(json.dumps({
            "command": "navigate",
            "url": "https://form.example.com"
        }))
        await ws.recv()
        await asyncio.sleep(2)
        
        # Fill form fields with delays
        fields = [
            ("input[name='email']", "test@example.com"),
            ("input[name='password']", "password123"),
            ("textarea[name='message']", "Hello, this is a test")
        ]
        
        for selector, value in fields:
            await ws.send(json.dumps({
                "command": "fill",
                "selector": selector,
                "value": value
            }))
            await ws.recv()
            await asyncio.sleep(random.uniform(0.5, 2))
        
        # Click submit
        await ws.send(json.dumps({
            "command": "click",
            "selector": "button[type='submit']"
        }))
        await ws.recv()
        
        # Wait for confirmation
        await ws.send(json.dumps({
            "command": "wait_for_element",
            "selector": "div.success-message",
            "timeout": 5000
        }))
        await ws.recv()
        
        # Get result page
        await ws.send(json.dumps({
            "command": "get_content"
        }))
        response = json.loads(await ws.recv())
        return response['content']['text']

asyncio.run(submit_form())
```

## Multi-Account Management

```python
async def multi_account_workflow():
    accounts = [
        {"username": "user1", "password": "pass1"},
        {"username": "user2", "password": "pass2"}
    ]
    
    async with websockets.connect("ws://localhost:8765") as ws:
        for i, account in enumerate(accounts):
            profile_name = f"account-{i}"
            
            # Create profile
            await ws.send(json.dumps({
                "command": "create_profile",
                "name": profile_name
            }))
            await ws.recv()
            
            await ws.send(json.dumps({
                "command": "switch_profile",
                "name": profile_name
            }))
            await ws.recv()
            
            # Login
            await ws.send(json.dumps({
                "command": "navigate",
                "url": "https://example.com/login"
            }))
            await ws.recv()
            await asyncio.sleep(2)
            
            await ws.send(json.dumps({
                "command": "fill",
                "selector": "input[name='username']",
                "value": account['username']
            }))
            await ws.recv()
            
            await ws.send(json.dumps({
                "command": "fill",
                "selector": "input[name='password']",
                "value": account['password']
            }))
            await ws.recv()
            
            await ws.send(json.dumps({
                "command": "click",
                "selector": "button[type='submit']"
            }))
            await ws.recv()
            
            # Wait for login
            await ws.send(json.dumps({
                "command": "wait_for_navigation",
                "timeout": 5000
            }))
            await ws.recv()
            
            # Save session
            await ws.send(json.dumps({
                "command": "save_session",
                "name": f"session-{i}"
            }))
            await ws.recv()

asyncio.run(multi_account_workflow())
```

## See Also

- **[Basic Navigation](BASIC-NAVIGATION.md)** - Core commands
- **[Forensic Extraction](FORENSIC-EXTRACTION.md)** - Detailed extraction
- **[Bot Evasion](BOT-EVASION.md)** - Detection avoidance
- **[Error Handling](ERROR-HANDLING.md)** - Resilience patterns
