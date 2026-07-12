# Complete Command Reference

All 164 WebSocket commands with parameters and examples.

## Canonical Sources

**Single Source of Truth:**
- **Overview:** [API-DOCUMENTATION-SUMMARY.md](../../API-DOCUMENTATION-SUMMARY.md) — Feature overview and quick navigation
- **Complete Spec:** [openapi.yaml](../../openapi.yaml) — Machine-readable OpenAPI 3.0.3 specification (all 164 commands)
- **Version History:** [API-VERSIONS.md](../../API-VERSIONS.md) — Version timeline and changelog

This page provides organized reference by category. For complete parameter details, examples, and error codes:
1. See the OpenAPI spec (`openapi.yaml`) for authoritative command definitions
2. See `API-DOCUMENTATION-SUMMARY.md` for feature overview
3. See `COMMAND-CATEGORIES.md` below for commands organized by function

## Quick Lookup Table

| Command | Category | Parameters | Returns |
|---------|----------|------------|---------|
| navigate | Navigation | url | success |
| get_url | Navigation | - | url |
| click | Interaction | selector | success |
| fill | Interaction | selector, value | success |
| screenshot | Screenshots | type, selector | data (base64) |
| get_content | Extraction | - | html, text, title |
| set_proxy | Proxy | host, port, type | success |
| set_user_agent | UserAgent | userAgent or category | success |
| create_profile | Profile | name | profileId |
| capture_html | Forensic | - | html |
| get_console_logs | Forensic | - | logs array |

## Navigation Commands

```
navigate(url)
get_url()
back()
forward()
refresh()
reload()
get_title()
```

## Interaction Commands

```
click(selector)
fill(selector, value)
type(selector, value)
scroll(x, y)
hover(selector)
focus(selector)
blur(selector)
double_click(selector)
right_click(selector)
```

## Waiting Commands

```
wait_for_element(selector, timeout)
wait_for_navigation(timeout)
wait_for_function(script, timeout)
wait_for_selector(selector, timeout)
```

## Content Commands

```
get_content()
get_page_state()
get_text()
get_html()
execute_script(script)
```

## Screenshot Commands

```
screenshot(type, selector, quality)
screenshot_element(selector)
screenshot_viewport()
screenshot_fullpage()
```

## Proxy Commands

```
set_proxy(host, port, type, auth)
clear_proxy()
get_proxy_status()
set_proxy_list(proxies)
rotate_proxy()
start_proxy_rotation(intervalMs, mode)
stop_proxy_rotation()
test_proxy(host, port)
get_proxy_stats()
```

## User Agent Commands

```
set_user_agent(userAgent or category)
get_random_user_agent()
rotate_user_agent()
start_user_agent_rotation(intervalMs, mode)
stop_user_agent_rotation()
get_user_agent_status()
get_user_agent_categories()
```

## Profile Commands

```
create_profile(name)
switch_profile(name)
delete_profile(name)
list_profiles()
save_session(name)
restore_session(name)
```

## Cookie Commands

```
get_cookies(url)
set_cookies(cookies)
clear_cookies()
add_cookie(cookie)
remove_cookie(name)
```

## Forensic Commands

```
capture_html()
capture_dom_snapshot()
extract_javascript_context()
get_console_logs()
export_forensic_data(format)
batch_extract(urls)
correlate_evidence(data_sources)
create_export_template(config)
```

## Tor Commands

```
set_tor_mode(mode)
get_tor_status()
rotate_tor_circuit()
set_tor_proxy_settings()
```

## Utility Commands

```
ping()
status()
diagnostics()
health_check()
get_version()
```

## More Information

- **[Detailed Reference](../../API-REFERENCE-AUTHORITATIVE.md)** - Full parameter descriptions and examples
- **[Error Codes](ERROR-CODES.md)** - All error responses
- **[WebSocket Protocol](WEBSOCKET-PROTOCOL.md)** - Protocol details
- **[Command Categories](COMMAND-CATEGORIES.md)** - Organized by category
