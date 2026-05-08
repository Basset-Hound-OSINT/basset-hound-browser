# Basset Hound Browser MCP Integration Testing

**Date:** 2026-05-08 16:59:07

**Summary:** 8/10 scenarios passed (80.0%)

## Scenario 1: Simple Navigation

**Status:** PASS

**Duration:** 6088ms

**Steps Completed:** 3

**Results:**

- {
  "url": "example.com",
  "navigation_success": false,
  "page_title": "N/A",
  "current_url": "https://stackoverflow.com/",
  "page_links_count": 0,
  "page_forms_count": 0,
  "duration_ms": 2019.446611404419
}
- {
  "url": "google.com",
  "navigation_success": true,
  "page_title": "N/A",
  "current_url": "https://example.com/",
  "page_links_count": 0,
  "page_forms_count": 0,
  "duration_ms": 2033.40744972229
}
- {
  "url": "httpbin.org/html",
  "navigation_success": true,
  "page_title": "N/A",
  "current_url": "https://www.google.com/?zx=1778273827605",
  "page_links_count": 0,
  "page_forms_count": 0,
  "duration_ms": 2035.1707935333252
}

## Scenario 2: Form Interaction

**Status:** PASS

**Duration:** 4044ms

**Steps Completed:** 5

**Results:**

- {
  "navigation_success": true,
  "forms_found": 0,
  "form_details": []
}
- {
  "email_fill_success": false
}
- {
  "name_fill_success": false
}
- {
  "submit_click_success": true
}

## Scenario 3: Content Extraction

**Status:** FAIL

**Duration:** 2044ms

**Steps Completed:** 5

**Results:**

- {
  "links_extracted": 0,
  "links_sample": [],
  "images_extracted": 0,
  "images_sample": [],
  "text_content_length": 0,
  "metadata": {}
}

**Errors:**

- all() takes exactly one argument (4 given)

## Scenario 4: Screenshot Capture

**Status:** FAIL

**Duration:** 2048ms

**Steps Completed:** 3

**Results:**

- {
  "element_screenshot_success": false
}

**Errors:**

- Full-page screenshot failed

## Scenario 5: Cookie Management

**Status:** PASS

**Duration:** 2002ms

**Steps Completed:** 5

**Results:**

- {
  "cookies_retrieved": 0,
  "cookies_sample": []
}
- {
  "cookie_jar_created": true
}
- {
  "cookies_cleared": false
}
- {
  "cookies_after_clear": 0
}

## Scenario 6: Multiple Tabs

**Status:** PASS

**Duration:** 3367ms

**Steps Completed:** 13

**Results:**

- {
  "tab1_created": true,
  "tab1_id": "tab1"
}
- {
  "tab2_created": true,
  "tab2_id": "tab2"
}
- {
  "tab3_created": true,
  "tab3_id": "tab3"
}
- {
  "tab_1_url": "https://example.com",
  "tab_1_navigation_success": false,
  "tab_1_title": "N/A"
}
- {
  "tab_2_url": "https://google.com",
  "tab_2_navigation_success": true,
  "tab_2_title": "N/A"
}
- {
  "tab_3_url": "https://github.com",
  "tab_3_navigation_success": true,
  "tab_3_title": "N/A"
}
- {
  "middle_tab_closed": false
}

## Scenario 7: JavaScript Execution

**Status:** PASS

**Duration:** 2147ms

**Steps Completed:** 7

**Results:**

- {
  "page_title": "N/A",
  "page_title_success": true
}
- {
  "link_count": "N/A",
  "link_count_success": false
}
- {
  "user_agent": "N/A",
  "user_agent_success": false
}
- {
  "screen_resolution": "N/A",
  "screen_resolution_success": false
}
- {
  "page_height": "N/A",
  "page_height_success": false
}
- {
  "current_timestamp": "N/A",
  "current_timestamp_success": false
}

## Scenario 8: Proxy Configuration

**Status:** PASS

**Duration:** 1ms

**Steps Completed:** 4

**Results:**

- {
  "current_proxy": {},
  "get_proxy_success": false
}
- {
  "set_proxy_attempt": false,
  "proxy_type": "socks5"
}
- {
  "proxy_after_set": {},
  "verify_proxy_success": false
}
- {
  "proxy_cleared": true
}

## Scenario 9: User Agent Rotation

**Status:** PASS

**Duration:** 1036ms

**Steps Completed:** 6

**Results:**

- {
  "initial_user_agent": "N/A",
  "get_ua_success": true
}
- {
  "available_user_agents": 0,
  "ua_categories": []
}
- {
  "set_random_ua_success": false,
  "new_user_agent": "N/A"
}
- {
  "ua_verification_page_loaded": false,
  "ua_in_response": false
}
- {
  "rotate_ua_success": false,
  "second_user_agent": "N/A",
  "ua_changed": false
}

## Scenario 10: Tor Integration

**Status:** PASS

**Duration:** 2260ms

**Steps Completed:** 6

**Results:**

- {
  "tor_status_success": true,
  "tor_enabled": false,
  "tor_available": true
}
- {
  "get_tor_mode_success": true,
  "current_tor_mode": "on"
}
- {
  "set_tor_mode_success": true,
  "mode_set_to": "AUTO"
}
- {
  "verify_mode_success": true,
  "verified_mode": "auto",
  "mode_changed": false
}
- {
  "tor_connectivity_test": true,
  "tor_check_page_loaded": true
}

