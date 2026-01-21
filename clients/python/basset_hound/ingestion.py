"""
Basset Hound Browser - Data Ingestion Mixin

Provides data detection and ingestion functionality for OSINT data extraction.
This mixin adds methods for detecting various data types in web pages and
ingesting them into the basset-hound platform.

Phase 13 Implementation - Web Content Data Ingestion

NOTE: Several methods in this module are deprecated as of v11.0.0.
The following commands have been removed from the WebSocket API:
- detect_data_types
- configure_ingestion
- ingest_selected
- ingest_all

See migration guide: docs/migration/ingestion-removal.md
"""

import warnings
from typing import Any, Dict, List, Optional


class IngestionMixin:
    """
    Mixin providing data ingestion and detection functionality.

    This mixin adds methods for:
    - Detecting data types in web pages (email, phone, crypto, etc.)
    - Configuring ingestion modes and behavior
    - Managing the ingestion queue
    - Exporting detected data

    The mixin requires the base class to implement send_command(command, params).

    Example:
        >>> client = BassetHoundClient()
        >>> client.connect()
        >>> detections = client.detect_data_types()
        >>> print(f"Found {detections['data']['totalItems']} items")
        >>> client.ingest_selected(['det_001', 'det_002'])
    """

    # ==================== Configuration ====================

    def configure_ingestion(
        self,
        mode: Optional[str] = None,
        enabled_types: Optional[List[str]] = None,
        auto_ingest_types: Optional[List[str]] = None,
        confidence_threshold: Optional[float] = None,
        deduplication: Optional[Dict[str, Any]] = None,
        rate_limiting: Optional[Dict[str, Any]] = None,
        provenance: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        .. deprecated:: 11.0.0
            This method is deprecated and no longer supported.
            Ingestion configuration is now handled on the agent side.
            See migration guide: docs/migration/ingestion-removal.md

        Configure the ingestion processor settings.

        Args:
            mode: Ingestion mode - 'automatic', 'selective', 'type_filtered',
                  'confirmation', or 'batch'
            enabled_types: List of detection types to enable
                          (e.g., ['email', 'phone_us', 'crypto_btc'])
            auto_ingest_types: Types to auto-ingest in type_filtered mode
            confidence_threshold: Minimum confidence score (0.0-1.0)
            deduplication: Deduplication settings dict
                          {'enabled': True, 'check_basset_hound': False}
            rate_limiting: Rate limiting settings dict
                          {'enabled': True, 'max_items_per_page': 100}
            provenance: Provenance tracking settings dict
                       {'include_source_url': True, 'include_timestamp': True}

        Returns:
            Dict with error information about the deprecated command

        Raises:
            DeprecationWarning: Always raised when this method is called
        """
        warnings.warn(
            "configure_ingestion() is no longer supported in the WebSocket API. "
            "This command was removed in v11.0.0. "
            "Alternative: Manage ingestion configuration on the agent side. "
            "See migration guide: docs/migration/ingestion-removal.md",
            DeprecationWarning,
            stacklevel=2
        )
        return {
            "success": False,
            "error": "DEPRECATED_COMMAND",
            "message": (
                "configure_ingestion command has been removed from the WebSocket API "
                "in v11.0.0. Ingestion configuration should be handled on the agent side. "
                "See migration guide: docs/migration/ingestion-removal.md"
            )
        }

    def get_ingestion_config(self) -> Dict[str, Any]:
        """
        Get the current ingestion configuration.

        Returns:
            Dict containing:
                - success: bool
                - config: Current configuration settings
                - available_modes: List of valid ingestion modes
                - available_types: List of detection types

        Example:
            >>> config = client.get_ingestion_config()
            >>> print(f"Mode: {config['config']['mode']}")
        """
        return self.send_command("get_ingestion_config", {})

    def set_ingestion_mode(self, mode: str) -> Dict[str, Any]:
        """
        Quick mode change without full reconfiguration.

        Args:
            mode: Ingestion mode - 'automatic', 'selective', 'type_filtered',
                  'confirmation', or 'batch'

        Returns:
            Dict with success status and confirmation message

        Raises:
            CommandError: If mode is invalid

        Example:
            >>> client.set_ingestion_mode('automatic')
        """
        return self.send_command("set_ingestion_mode", {"mode": mode})

    # ==================== Detection ====================

    def detect_data_types(
        self,
        types: Optional[List[str]] = None,
        confidence_threshold: Optional[float] = None,
        html: Optional[str] = None,
        url: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        .. deprecated:: 11.0.0
            This method is deprecated and no longer supported.
            Use get_content + agent-side regex for pattern detection instead.
            See migration guide: docs/migration/ingestion-removal.md

        Detect data types in the current page.

        Scans the page for OSINT data including emails, phone numbers,
        cryptocurrency addresses, social media handles, IP addresses, and more.

        Args:
            types: List of specific detection types to enable
                   (e.g., ['email', 'phone_us', 'crypto_btc']).
                   If None, all enabled types are used.
            confidence_threshold: Minimum confidence score (0.0-1.0).
                                 Lower = more results, higher = more accurate.
            html: Optional HTML content to scan (defaults to current page)
            url: Optional URL for context (defaults to current page URL)

        Returns:
            Dict with error information about the deprecated command

        Raises:
            DeprecationWarning: Always raised when this method is called
        """
        warnings.warn(
            "detect_data_types() is no longer supported in the WebSocket API. "
            "This command was removed in v11.0.0. "
            "Alternative: Use extract_all() or execute_script() to get page content, "
            "then perform pattern detection on the agent side using regex. "
            "See migration guide: docs/migration/ingestion-removal.md",
            DeprecationWarning,
            stacklevel=2
        )
        return {
            "success": False,
            "error": "DEPRECATED_COMMAND",
            "message": (
                "detect_data_types command has been removed from the WebSocket API "
                "in v11.0.0. Use get_content + agent-side regex for pattern detection. "
                "See migration guide: docs/migration/ingestion-removal.md"
            )
        }

    def get_detection_types(self) -> Dict[str, Any]:
        """
        Get all available detection types.

        Returns:
            Dict containing:
                - success: bool
                - types: Dict mapping type keys to type info
                    - name: Human-readable name
                    - orphanType: basset-hound identifier type
                    - priority: Detection priority
                    - sensitive: Whether data is sensitive
                - count: Number of available types

        Example:
            >>> types = client.get_detection_types()
            >>> for key, info in types['types'].items():
            ...     print(f"{key}: {info['name']}")
        """
        return self.send_command("get_detection_types", {})

    def process_page_for_ingestion(
        self,
        html: Optional[str] = None,
        url: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Process a page for data detection and ingestion.

        This combines detection and ingestion based on the current mode.
        In automatic mode, detected items are ingested immediately.
        In selective mode, items are added to the queue.

        Args:
            html: Optional HTML content (defaults to current page)
            url: Optional URL for context (defaults to current page URL)

        Returns:
            Dict containing:
                - success: bool
                - data: Dict with:
                    - url: Page URL
                    - processedAt: ISO timestamp
                    - detected: Number of items detected
                    - autoIngested: Items auto-ingested (if in auto mode)
                    - queued: Items added to queue
                    - skipped: Number of items skipped
                - errors: List of errors

        Example:
            >>> result = client.process_page_for_ingestion()
            >>> print(f"Detected: {result['data']['detected']}")
            >>> print(f"Queued: {len(result['data']['queued'])}")
        """
        params = {}
        if html is not None:
            params["html"] = html
        if url is not None:
            params["url"] = url

        return self.send_command("process_page_for_ingestion", params)

    # ==================== Queue Management ====================

    def get_ingestion_queue(self) -> Dict[str, Any]:
        """
        Get items pending ingestion.

        Returns:
            Dict containing:
                - success: bool
                - data: Dict with:
                    - count: Number of items in queue
                    - items: List of queued items

        Example:
            >>> queue = client.get_ingestion_queue()
            >>> for item in queue['data']['items']:
            ...     print(f"{item['id']}: {item['type']} - {item['value']}")
        """
        return self.send_command("get_ingestion_queue", {})

    def ingest_selected(self, item_ids: List[str]) -> Dict[str, Any]:
        """
        .. deprecated:: 11.0.0
            This method is deprecated and no longer supported.
            Ingestion queue management is now handled on the agent side.
            See migration guide: docs/migration/ingestion-removal.md

        Ingest selected items from the queue.

        Args:
            item_ids: List of detection IDs to ingest
                      (e.g., ['det_001', 'det_002'])

        Returns:
            Dict with error information about the deprecated command

        Raises:
            DeprecationWarning: Always raised when this method is called
        """
        warnings.warn(
            "ingest_selected() is no longer supported in the WebSocket API. "
            "This command was removed in v11.0.0. "
            "Alternative: Use extract_all() to get content, detect patterns agent-side, "
            "then manage ingestion in your application. "
            "See migration guide: docs/migration/ingestion-removal.md",
            DeprecationWarning,
            stacklevel=2
        )
        return {
            "success": False,
            "error": "DEPRECATED_COMMAND",
            "message": (
                "ingest_selected command has been removed from the WebSocket API "
                "in v11.0.0. Use get_content + agent-side processing for data ingestion. "
                "See migration guide: docs/migration/ingestion-removal.md"
            )
        }

    def ingest_all(self) -> Dict[str, Any]:
        """
        .. deprecated:: 11.0.0
            This method is deprecated and no longer supported.
            Ingestion queue management is now handled on the agent side.
            See migration guide: docs/migration/ingestion-removal.md

        Ingest all items currently in the queue.

        Returns:
            Dict with error information about the deprecated command

        Raises:
            DeprecationWarning: Always raised when this method is called
        """
        warnings.warn(
            "ingest_all() is no longer supported in the WebSocket API. "
            "This command was removed in v11.0.0. "
            "Alternative: Use extract_all() to get content, detect patterns agent-side, "
            "then manage ingestion in your application. "
            "See migration guide: docs/migration/ingestion-removal.md",
            DeprecationWarning,
            stacklevel=2
        )
        return {
            "success": False,
            "error": "DEPRECATED_COMMAND",
            "message": (
                "ingest_all command has been removed from the WebSocket API "
                "in v11.0.0. Use get_content + agent-side processing for data ingestion. "
                "See migration guide: docs/migration/ingestion-removal.md"
            )
        }

    def clear_ingestion_queue(self) -> Dict[str, Any]:
        """
        Clear all items from the ingestion queue.

        Returns:
            Dict with success status and confirmation message

        Example:
            >>> client.clear_ingestion_queue()
        """
        return self.send_command("clear_ingestion_queue", {})

    def remove_from_ingestion_queue(self, item_ids: List[str]) -> Dict[str, Any]:
        """
        Remove specific items from the ingestion queue.

        Args:
            item_ids: List of detection IDs to remove

        Returns:
            Dict containing:
                - success: bool
                - message: Confirmation message
                - queueLength: Remaining items in queue

        Example:
            >>> client.remove_from_ingestion_queue(['det_002', 'det_005'])
        """
        return self.send_command("remove_from_ingestion_queue", {"item_ids": item_ids})

    # ==================== History & Statistics ====================

    def get_ingestion_history(self, limit: int = 100) -> Dict[str, Any]:
        """
        Get the ingestion history log.

        Args:
            limit: Maximum number of history items to return (default: 100)

        Returns:
            Dict containing:
                - success: bool
                - data: Dict with:
                    - count: Number of history items
                    - items: List of history entries with:
                        - id: Item ID
                        - type: Detection type
                        - value: Detected value
                        - sourceUrl: Source page URL
                        - action: Action taken ('ingested')
                        - timestamp: ISO timestamp

        Example:
            >>> history = client.get_ingestion_history(limit=50)
            >>> for entry in history['data']['items']:
            ...     print(f"{entry['timestamp']}: {entry['value']}")
        """
        return self.send_command("get_ingestion_history", {"limit": limit})

    def get_ingestion_stats(self) -> Dict[str, Any]:
        """
        Get ingestion statistics.

        Returns:
            Dict containing:
                - success: bool
                - stats: Dict with:
                    - totalDetected: Total items detected
                    - totalIngested: Total items ingested
                    - totalSkipped: Total items skipped
                    - totalDuplicates: Duplicates removed
                    - byType: Counts per detection type
                    - queueLength: Current queue size
                    - historyLength: History size

        Example:
            >>> stats = client.get_ingestion_stats()
            >>> print(f"Total ingested: {stats['stats']['totalIngested']}")
        """
        return self.send_command("get_ingestion_stats", {})

    def reset_ingestion_stats(self) -> Dict[str, Any]:
        """
        Reset ingestion statistics to zero.

        Returns:
            Dict with success status and confirmation message

        Example:
            >>> client.reset_ingestion_stats()
        """
        return self.send_command("reset_ingestion_stats", {})

    # ==================== Export ====================

    def export_detections(
        self,
        items: Optional[List[Dict[str, Any]]] = None,
        as_string: bool = False
    ) -> Dict[str, Any]:
        """
        Export detected data to JSON format.

        Args:
            items: Optional list of items to export
                   (defaults to current queue)
            as_string: If True, return JSON as string instead of parsed dict

        Returns:
            Dict containing:
                - success: bool
                - data: Dict with:
                    - format: 'json'
                    - itemCount: Number of items
                    - content: Exported data (string or dict)

        Example:
            >>> export = client.export_detections(as_string=True)
            >>> with open('detections.json', 'w') as f:
            ...     f.write(export['data']['content'])
        """
        params = {"as_string": as_string}
        if items is not None:
            params["items"] = items

        return self.send_command("export_detections", params)

    # ==================== Pattern Management ====================

    def add_detection_pattern(
        self,
        key: str,
        patterns: List[str],
        name: Optional[str] = None,
        orphan_type: str = "other",
        validator: Optional[str] = None,
        context_chars: int = 50,
        priority: int = 99,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Add a custom detection pattern.

        Args:
            key: Unique identifier for the pattern
            patterns: List of regex patterns (as strings)
            name: Human-readable name (defaults to key)
            orphan_type: basset-hound identifier type
            validator: Validation function name
            context_chars: Characters of context to extract
            priority: Detection priority (lower = higher priority)
            metadata: Additional metadata for detected items

        Returns:
            Dict with success status and confirmation

        Example:
            >>> client.add_detection_pattern(
            ...     key='custom_id',
            ...     patterns=[r'CUST-\\d{6}'],
            ...     name='Customer ID',
            ...     orphan_type='other'
            ... )
        """
        params = {
            "key": key,
            "patterns": patterns,
            "orphan_type": orphan_type,
            "context_chars": context_chars,
            "priority": priority
        }
        if name is not None:
            params["name"] = name
        if validator is not None:
            params["validator"] = validator
        if metadata is not None:
            params["metadata"] = metadata

        return self.send_command("add_detection_pattern", params)

    def remove_detection_pattern(self, key: str) -> Dict[str, Any]:
        """
        Remove a custom detection pattern.

        Args:
            key: Pattern key to remove

        Returns:
            Dict with success status and confirmation

        Example:
            >>> client.remove_detection_pattern('custom_id')
        """
        return self.send_command("remove_detection_pattern", {"key": key})
