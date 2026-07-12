# Command Categories

WebSocket commands organized by category.

## Navigation

| Command | Description | Parameters |
|---------|-------------|------------|
| `navigate` | Go to URL | `url` |
| `get_url` | Current URL | - |
| `back` | Go back | - |
| `forward` | Go forward | - |
| `refresh` | Refresh page | - |
| `reload` | Force reload | - |

## Content Extraction

| Command | Description | Parameters |
|---------|-------------|------------|
| `get_content` | HTML, text, title | - |
| `get_page_state` | Forms, buttons, links | - |
| `capture_html` | Complete HTML | - |
| `capture_dom_snapshot` | Full DOM snapshot | - |
| `extract_javascript_context` | JavaScript state | - |
| `get_console_logs` | Console output | - |

## Interaction

| Command | Description | Parameters |
|---------|-------------|------------|
| `click` | Click element | `selector` |
| `fill` | Fill form field | `selector`, `value` |
| `type` | Type text | `selector`, `value` |
| `scroll` | Scroll page | `x`, `y` or `selector` |
| `hover` | Hover element | `selector` |
| `focus` | Focus element | `selector` |
| `blur` | Blur element | `selector` |

## Waiting

| Command | Description | Parameters |
|---------|-------------|------------|
| `wait_for_element` | Wait for element | `selector`, `timeout` |
| `wait_for_navigation` | Wait for page load | `timeout` |
| `wait_for_function` | Wait for JS condition | `script`, `timeout` |

## Screenshots

| Command | Description | Parameters |
|---------|-------------|------------|
| `screenshot` | Capture page | `type`, `selector` |

## Proxy

| Command | Description | Parameters |
|---------|-------------|------------|
| `set_proxy` | Set single proxy | `host`, `port`, `type` |
| `clear_proxy` | Disable proxy | - |
| `set_proxy_list` | Set multiple proxies | `proxies` |
| `start_proxy_rotation` | Auto-rotate proxies | `intervalMs`, `mode` |
| `stop_proxy_rotation` | Stop rotation | - |
| `get_proxy_status` | Current proxy | - |

## User Agent

| Command | Description | Parameters |
|---------|-------------|------------|
| `set_user_agent` | Set user agent | `userAgent` or `category` |
| `start_user_agent_rotation` | Auto-rotate UA | `intervalMs`, `mode` |
| `stop_user_agent_rotation` | Stop rotation | - |
| `get_user_agent_status` | Current UA | - |

## Evasion

| Command | Description | Parameters |
|---------|-------------|------------|
| `randomize_fingerprint` | Spoof fingerprint | - |
| `set_tor_mode` | Enable/disable Tor | `mode` |
| `rotate_tor_circuit` | Change Tor exit | - |

## Profile Management

| Command | Description | Parameters |
|---------|-------------|------------|
| `create_profile` | Create profile | `name` |
| `switch_profile` | Switch profile | `name` |
| `save_session` | Save session | `name` |
| `restore_session` | Restore session | `name` |

## Forensic Commands

| Command | Description | Parameters |
|---------|-------------|------------|
| `export_forensic_data` | Export data | `format` |
| `batch_extract` | Extract multiple URLs | `urls` |
| `correlate_evidence` | Correlation analysis | `data_sources` |
| `create_export_template` | Custom export | config |

## Utilities

| Command | Description | Parameters |
|---------|-------------|------------|
| `ping` | Test connection | - |
| `status` | Browser status | - |
| `execute_script` | Run JavaScript | `script` |
| `get_cookies` | Get cookies | `url` |
| `set_cookies` | Set cookies | `cookies` |

## See Also

- **[Complete Reference](COMPLETE-REFERENCE.md)** - All 140+ commands with examples
- **[Error Codes](ERROR-CODES.md)** - All error codes and solutions
