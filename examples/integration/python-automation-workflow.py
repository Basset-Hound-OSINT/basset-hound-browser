#!/usr/bin/env python3
"""
Basset Hound Browser - Python Automation Workflow Example
Version: 1.0.0
Date: 2026-05-11

Complete example of building complex automation workflows with Basset Hound
using the Python client library.

Demonstrates:
- Connection management and error handling
- Multi-page workflows
- Data extraction and storage
- Evasion techniques
- Workflow coordination

Usage:
    python python-automation-workflow.py <target-url>
    python python-automation-workflow.py https://example.com --output results.json
"""

import asyncio
import json
import sys
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional

# Import the Basset Hound client
sys.path.insert(0, str(Path(__file__).parent.parent.parent))
from integrations.python_client import BassetHoundClient, BassetHoundClientError

# ============================================================================
# CONFIGURATION
# ============================================================================

CONFIG = {
    'browser_host': 'localhost',
    'browser_port': 8765,
    'command_timeout': 30.0,
    'page_load_delay': 2.0,
    'output_dir': Path(__file__).parent / 'automation-output',
    'verbose': '--verbose' in sys.argv,
    'max_pages': 5
}

# Set up logging
logging.basicConfig(
    level=logging.DEBUG if CONFIG['verbose'] else logging.INFO,
    format='[%(asctime)s] [%(levelname)s] %(message)s'
)
logger = logging.getLogger(__name__)

# ============================================================================
# AUTOMATION WORKFLOW
# ============================================================================

class AutomationWorkflow:
    """Complete automation workflow for website analysis and data collection."""

    def __init__(self, target_url: str, config: Dict[str, Any] = None):
        self.target_url = target_url
        self.config = {**CONFIG, **(config or {})}
        self.browser = BassetHoundClient(
            host=self.config['browser_host'],
            port=self.config['browser_port'],
            timeout=self.config['command_timeout']
        )
        self.results = {
            'target': target_url,
            'timestamp': datetime.now().isoformat(),
            'status': 'pending',
            'pages': [],
            'data': {},
            'errors': []
        }

    async def run(self) -> Dict[str, Any]:
        """Execute the complete automation workflow."""
        try:
            logger.info(f"Starting automation workflow for {self.target_url}")

            # Connect to browser
            await self.browser.connect()
            logger.info("Connected to Basset Hound Browser")

            # Execute workflow steps
            await self.apply_evasion()
            await self.navigate_and_analyze()
            await self.extract_all_data()
            await self.perform_interactions()

            self.results['status'] = 'success'
            logger.info("Automation workflow completed successfully")

        except BassetHoundClientError as err:
            logger.error(f"Client error: {err}")
            self.results['status'] = 'failed'
            self.results['errors'].append({
                'type': 'client_error',
                'message': str(err),
                'timestamp': datetime.now().isoformat()
            })
            raise
        finally:
            await self.browser.disconnect()

        return self.results

    async def apply_evasion(self):
        """Apply evasion techniques to avoid detection."""
        logger.info("Applying evasion techniques...")

        try:
            # Rotate user agent
            response = await self.browser.rotate_user_agent()
            if response.get('success'):
                ua_status = await self.browser.get_user_agent_status()
                user_agent = ua_status.get('data', {}).get('userAgent', 'unknown')
                logger.debug(f"User agent rotated to: {user_agent}")
                self.results['data']['user_agent'] = user_agent

            # Could also apply proxy, Tor, etc.
            # await self.browser.set_proxy('proxy.example.com', 8080)

            logger.info("Evasion techniques applied")
        except Exception as err:
            logger.warning(f"Evasion error: {err}")

    async def navigate_and_analyze(self):
        """Navigate to target and perform initial analysis."""
        logger.info(f"Navigating to {self.target_url}...")

        # Navigate
        response = await self.browser.navigate(self.target_url)
        if not response.get('success'):
            raise BassetHoundClientError(
                f"Navigation failed: {response.get('error', 'Unknown error')}"
            )

        # Wait for page to load
        await asyncio.sleep(self.config['page_load_delay'])

        # Get current URL (may redirect)
        current_url = await self.browser.get_url()
        logger.info(f"Navigated to: {current_url}")

        # Get page state
        page_state = await self.browser.get_page_state()
        page_data = page_state.get('data', {})

        # Store page info
        self.results['data']['page'] = {
            'title': page_data.get('title'),
            'url': current_url,
            'redirected': current_url != self.target_url
        }

        logger.info(f"Page title: {page_data.get('title')}")

    async def extract_all_data(self):
        """Extract all relevant data from the page."""
        logger.info("Extracting page data...")

        try:
            # Extract page content
            content_response = await self.browser.get_content()
            content_data = content_response.get('data', {})

            self.results['data']['content'] = {
                'html_length': len(content_data.get('html', '')),
                'text_length': len(content_data.get('text', '')),
                'text_preview': content_data.get('text', '')[:500]
            }

            # Extract links
            links_response = await self.browser.extract_links()
            links_data = links_response.get('data', {})
            links = links_data.get('links', [])

            self.results['data']['links'] = {
                'count': len(links),
                'links': [
                    {
                        'url': link.get('url'),
                        'text': link.get('text', '')[:100]
                    }
                    for link in links[:10]  # Store first 10
                ]
            }

            logger.info(f"Extracted {len(links)} links")

            # Extract forms
            forms_response = await self.browser.extract_forms()
            forms_data = forms_response.get('data', {})
            forms = forms_data.get('forms', [])

            self.results['data']['forms'] = {
                'count': len(forms),
                'forms': [
                    {
                        'id': form.get('id'),
                        'action': form.get('action'),
                        'method': form.get('method'),
                        'fields': [
                            {
                                'name': f.get('name'),
                                'type': f.get('type')
                            }
                            for f in form.get('fields', [])
                        ]
                    }
                    for form in forms
                ]
            }

            logger.info(f"Extracted {len(forms)} forms")

            # Take screenshot
            screenshot_response = await self.browser.screenshot()
            if screenshot_response.get('success'):
                screenshot_data = screenshot_response.get('data')
                if screenshot_data:
                    # Save screenshot
                    await self._save_screenshot(screenshot_data)
                    self.results['data']['screenshot'] = 'saved'
            else:
                logger.warning("Screenshot capture failed")

        except Exception as err:
            logger.error(f"Data extraction error: {err}")
            self.results['errors'].append({
                'type': 'extraction_error',
                'message': str(err),
                'timestamp': datetime.now().isoformat()
            })

    async def perform_interactions(self):
        """Perform interactions if needed (e.g., search, click)."""
        logger.info("Checking for interactive elements...")

        try:
            # Look for search input
            search_inputs = await self.browser.execute_script(
                "return document.querySelectorAll('input[type=\"search\"], input[type=\"text\"]').length"
            )

            if search_inputs and search_inputs > 0:
                logger.info(f"Found {search_inputs} search inputs")
                self.results['data']['interactive_elements'] = {
                    'search_inputs': search_inputs
                }

        except Exception as err:
            logger.warning(f"Interaction check error: {err}")

    async def _save_screenshot(self, base64_data: str):
        """Save screenshot to file."""
        try:
            self.config['output_dir'].mkdir(parents=True, exist_ok=True)

            filename = self.config['output_dir'] / f"screenshot-{datetime.now().timestamp()}.png"

            # Decode base64 and write to file
            import base64
            image_data = base64.b64decode(base64_data)
            with open(filename, 'wb') as f:
                f.write(image_data)

            logger.info(f"Screenshot saved to {filename}")
        except Exception as err:
            logger.warning(f"Failed to save screenshot: {err}")

    def save_results(self, output_file: Optional[Path] = None) -> Path:
        """Save results to JSON file."""
        if not output_file:
            self.config['output_dir'].mkdir(parents=True, exist_ok=True)
            output_file = (
                self.config['output_dir'] /
                f"workflow-{datetime.now().timestamp()}.json"
            )

        with open(output_file, 'w') as f:
            json.dump(self.results, f, indent=2)

        logger.info(f"Results saved to {output_file}")
        return output_file

# ============================================================================
# MAIN EXECUTION
# ============================================================================

async def main():
    """Main entry point."""
    # Parse arguments
    if len(sys.argv) < 2:
        print("Usage: python python-automation-workflow.py <target-url> [--output file.json]")
        print("Example: python python-automation-workflow.py https://example.com")
        sys.exit(1)

    target_url = sys.argv[1]
    output_file = None

    if '--output' in sys.argv:
        idx = sys.argv.index('--output')
        if idx + 1 < len(sys.argv):
            output_file = Path(sys.argv[idx + 1])

    # Create and run workflow
    workflow = AutomationWorkflow(target_url)

    try:
        results = await workflow.run()

        # Display results
        print("\n" + "="*80)
        print("WORKFLOW RESULTS")
        print("="*80)
        print(json.dumps(results, indent=2))

        # Save results
        output_path = workflow.save_results(output_file)
        print(f"\nResults saved to: {output_path}")

        sys.exit(0)

    except Exception as err:
        logger.error(f"Workflow failed: {err}")
        sys.exit(1)

if __name__ == '__main__':
    asyncio.run(main())
