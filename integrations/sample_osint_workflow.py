"""
Basset Hound Browser - Sample OSINT Workflow
Version: 1.0.0
Protocol: WebSocket (JSON)

This sample demonstrates a complete open-source intelligence (OSINT) workflow
using the Basset Hound Browser Python client library.

Workflow:
1. Target reconnaissance: navigate to target domain
2. Initial analysis: extract page structure, links, metadata
3. Screenshot capture: document page state
4. Deep analysis: extract forms, analyze page structure
5. Reporting: compile findings into structured report
"""

import asyncio
import json
import sys
from datetime import datetime
from pathlib import Path

# Import the Python client library
from python_client import BassetHoundClient, BassetHoundClientError


class OSINTWorkflow:
    """Complete OSINT reconnaissance workflow"""

    def __init__(self, target_url, output_dir='osint_results'):
        self.target_url = target_url
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True)
        self.browser = BassetHoundClient()
        self.findings = {
            'timestamp': None,
            'target_url': target_url,
            'page_title': None,
            'current_url': None,
            'page_structure': None,
            'links': [],
            'forms': [],
            'screenshot': None,
            'page_state': None,
            'metadata': {}
        }

    async def run(self):
        """Execute the complete OSINT workflow"""
        print(f"\n{'='*60}")
        print(f"BASSET HOUND OSINT WORKFLOW")
        print(f"Target: {self.target_url}")
        print(f"Start Time: {datetime.now().isoformat()}")
        print(f"{'='*60}\n")

        try:
            await self._connect()
            await self._initial_reconnaissance()
            await self._extract_content()
            await self._capture_screenshot()
            await self._analyze_structure()
            await self._compile_report()
            print(f"\n{'='*60}")
            print("WORKFLOW COMPLETED SUCCESSFULLY")
            print(f"{'='*60}\n")

        except BassetHoundClientError as e:
            print(f"\n❌ ERROR: {e}")
            return False

        except Exception as e:
            print(f"\n❌ UNEXPECTED ERROR: {e}")
            return False

        finally:
            await self._disconnect()

        return True

    async def _connect(self):
        """Connect to browser"""
        print("1️⃣  CONNECTING TO BROWSER")
        print("-" * 40)
        try:
            await self.browser.connect()
            is_alive = await self.browser.ping()
            print(f"✓ Connected to {self.browser.url}")
            print(f"✓ Browser health: {'OK' if is_alive else 'WARNING'}\n")
        except Exception as e:
            print(f"✗ Connection failed: {e}\n")
            raise

    async def _initial_reconnaissance(self):
        """Navigate to target and gather initial information"""
        print("2️⃣  INITIAL RECONNAISSANCE")
        print("-" * 40)

        # Navigate to target
        print(f"Navigating to {self.target_url}...")
        response = await self.browser.navigate(self.target_url)
        print(f"✓ Navigation complete (status: {response.get('success')})")

        # Get page title
        self.findings['page_title'] = await self.browser.get_title()
        print(f"✓ Page title: {self.findings['page_title']}")

        # Get current URL (may differ from target due to redirects)
        self.findings['current_url'] = await self.browser.get_url()
        print(f"✓ Current URL: {self.findings['current_url']}")

        # Record timestamp
        self.findings['timestamp'] = datetime.now().isoformat()
        print(f"✓ Timestamp: {self.findings['timestamp']}\n")

    async def _extract_content(self):
        """Extract all accessible content"""
        print("3️⃣  CONTENT EXTRACTION")
        print("-" * 40)

        # Extract links
        print("Extracting links...")
        self.findings['links'] = await self.browser.extract_links()
        print(f"✓ Found {len(self.findings['links'])} links")
        if self.findings['links']:
            print(f"  Sample links:")
            for link in self.findings['links'][:3]:
                print(f"    - {link.get('text', 'N/A')}: {link.get('href', 'N/A')}")

        # Extract forms
        print("\nExtracting forms...")
        self.findings['forms'] = await self.browser.extract_forms()
        print(f"✓ Found {len(self.findings['forms'])} forms")
        if self.findings['forms']:
            print(f"  Form summary:")
            for i, form in enumerate(self.findings['forms'][:2]):
                print(f"    - Form {i+1}: {form.get('method', 'N/A').upper()} to {form.get('action', 'N/A')}")

        print()

    async def _capture_screenshot(self):
        """Capture page screenshot for visual documentation"""
        print("4️⃣  VISUAL DOCUMENTATION")
        print("-" * 40)

        print("Capturing screenshot...")
        screenshot_data = await self.browser.screenshot()

        if screenshot_data:
            # Save screenshot to file
            screenshot_path = self.output_dir / f"screenshot_{int(datetime.now().timestamp())}.png"

            # Decode base64 and write binary
            import base64
            screenshot_bytes = base64.b64decode(screenshot_data)
            with open(screenshot_path, 'wb') as f:
                f.write(screenshot_bytes)

            print(f"✓ Screenshot saved: {screenshot_path}")
            self.findings['screenshot'] = str(screenshot_path)
        else:
            print("⚠ Screenshot failed")

        print()

    async def _analyze_structure(self):
        """Get detailed page state for structure analysis"""
        print("5️⃣  PAGE STRUCTURE ANALYSIS")
        print("-" * 40)

        print("Analyzing page structure...")
        page_state = await self.browser.get_page_state()

        self.findings['page_state'] = page_state

        # Extract metadata
        if page_state:
            print(f"✓ Page structure analyzed:")
            if 'forms' in page_state:
                print(f"  - Forms: {len(page_state.get('forms', []))}")
            if 'links' in page_state:
                print(f"  - Links: {len(page_state.get('links', []))}")
            if 'buttons' in page_state:
                print(f"  - Buttons: {len(page_state.get('buttons', []))}")
            if 'title' in page_state:
                print(f"  - Title: {page_state['title']}")

        print()

    async def _compile_report(self):
        """Compile all findings into structured report"""
        print("6️⃣  REPORT COMPILATION")
        print("-" * 40)

        # Create report
        report_path = self.output_dir / f"report_{int(datetime.now().timestamp())}.json"

        with open(report_path, 'w') as f:
            json.dump(self.findings, f, indent=2)

        print(f"✓ Report saved: {report_path}")

        # Print summary
        print("\nFINDINGS SUMMARY:")
        print(f"  Target: {self.findings['target_url']}")
        print(f"  Final URL: {self.findings['current_url']}")
        print(f"  Page Title: {self.findings['page_title']}")
        print(f"  Links Found: {len(self.findings['links'])}")
        print(f"  Forms Found: {len(self.findings['forms'])}")
        print(f"  Screenshot: {'Yes' if self.findings['screenshot'] else 'No'}")
        print(f"  Report: {report_path}\n")

    async def _disconnect(self):
        """Clean disconnect from browser"""
        print("7️⃣  CLEANUP")
        print("-" * 40)
        await self.browser.disconnect()
        print("✓ Browser disconnected\n")


class AdvancedOSINTWorkflow(OSINTWorkflow):
    """Extended OSINT workflow with additional analysis"""

    async def run(self):
        """Execute advanced workflow with additional steps"""
        print(f"\n{'='*60}")
        print(f"ADVANCED BASSET HOUND OSINT WORKFLOW")
        print(f"Target: {self.target_url}")
        print(f"Start Time: {datetime.now().isoformat()}")
        print(f"{'='*60}\n")

        try:
            await self._connect()
            await self._initial_reconnaissance()
            await self._extract_content()
            await self._capture_screenshot()
            await self._analyze_structure()
            await self._javascript_analysis()
            await self._compile_advanced_report()
            print(f"\n{'='*60}")
            print("ADVANCED WORKFLOW COMPLETED SUCCESSFULLY")
            print(f"{'='*60}\n")

        except BassetHoundClientError as e:
            print(f"\n❌ ERROR: {e}")
            return False

        except Exception as e:
            print(f"\n❌ UNEXPECTED ERROR: {e}")
            return False

        finally:
            await self._disconnect()

        return True

    async def _javascript_analysis(self):
        """Execute JavaScript to extract dynamic content"""
        print("6️⃣  JAVASCRIPT ANALYSIS")
        print("-" * 40)

        # Example: Extract all data attributes
        js_code = """
        return {
            scripts: Array.from(document.scripts).length,
            stylesheets: Array.from(document.styleSheets).length,
            images: Array.from(document.images).length,
            iframes: Array.from(document.iframes).length,
            inputs: Array.from(document.querySelectorAll('input')).length,
            hasLocalStorage: !!window.localStorage,
            hasSessionStorage: !!window.sessionStorage,
            localStorage: window.localStorage ? localStorage.length : 0
        };
        """

        try:
            result = await self.browser.execute_script(js_code)
            self.findings['javascript_analysis'] = result
            print(f"✓ JavaScript analysis complete:")
            for key, value in result.items():
                print(f"  - {key}: {value}")
        except Exception as e:
            print(f"⚠ JavaScript analysis failed: {e}")

        print()

    async def _compile_advanced_report(self):
        """Compile advanced report with all findings"""
        print("7️⃣  ADVANCED REPORT COMPILATION")
        print("-" * 40)

        # Create report
        report_path = self.output_dir / f"advanced_report_{int(datetime.now().timestamp())}.json"

        with open(report_path, 'w') as f:
            json.dump(self.findings, f, indent=2)

        print(f"✓ Advanced report saved: {report_path}")

        # Print summary
        print("\nEXTENDED FINDINGS SUMMARY:")
        print(f"  Target: {self.findings['target_url']}")
        print(f"  Final URL: {self.findings['current_url']}")
        print(f"  Page Title: {self.findings['page_title']}")
        print(f"  Links Found: {len(self.findings['links'])}")
        print(f"  Forms Found: {len(self.findings['forms'])}")
        if 'javascript_analysis' in self.findings:
            print(f"  Scripts: {self.findings['javascript_analysis'].get('scripts', 'N/A')}")
            print(f"  Stylesheets: {self.findings['javascript_analysis'].get('stylesheets', 'N/A')}")
        print(f"  Report: {report_path}\n")


async def main():
    """CLI entry point"""
    if len(sys.argv) < 2:
        print("Basset Hound Browser - Sample OSINT Workflow")
        print("\nUsage:")
        print("  python sample_osint_workflow.py <url> [--advanced]")
        print("\nExample:")
        print("  python sample_osint_workflow.py https://example.com")
        print("  python sample_osint_workflow.py https://example.com --advanced")
        return False

    url = sys.argv[1]
    advanced = '--advanced' in sys.argv

    if advanced:
        workflow = AdvancedOSINTWorkflow(url)
    else:
        workflow = OSINTWorkflow(url)

    return await workflow.run()


if __name__ == '__main__':
    success = asyncio.run(main())
    sys.exit(0 if success else 1)
