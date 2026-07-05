"""
Export Integrity Verification for Basset Hound Browser (L-003)

Provides HMAC-SHA256 signature verification for exported data
Ensures integrity and authenticity of forensic exports

Features:
- HMAC-SHA256 signature verification
- Chain of custody tracking
- Batch verification
- Replay attack detection
- Event-driven architecture
- Type hints for IDE support

Usage:
    from export_integrity_client import ExportIntegrityClient, IntegrityError

    client = ExportIntegrityClient(secret_key=secret_key_hex)

    # Sign an export
    signed_export = client.sign_export(
        payload={'data': 'export_content'},
        export_type='html',
        export_id='export_123'
    )

    # Verify integrity
    result = client.verify_export(signed_export)
    if result['valid']:
        print(f"Export verified: {result['data']}")
    else:
        print(f"Integrity violation: {result['error']}")

    # Verify batch
    batch_result = client.verify_batch(signed_exports)
    print(f"Success rate: {batch_result['summary']['success_rate']}%")

@version 1.0.0
@requires hashlib, hmac, json, time, uuid, threading
"""

import hashlib
import hmac
import json
import time
import uuid
import threading
from typing import Any, Dict, Optional, List, Union, Callable
from datetime import datetime
from collections import defaultdict


class IntegrityError(Exception):
    """Base exception for integrity verification errors."""
    pass


class IntegrityViolation(IntegrityError):
    """Raised when export integrity verification fails."""
    pass


class ReplayDetected(IntegrityError):
    """Raised when replay attack is detected."""
    pass


class ExportIntegrityClient:
    """
    HMAC-based export integrity verification client.

    Provides secure signature generation and verification for forensic exports.
    Supports chain of custody tracking, batch verification, and replay protection.
    """

    DEFAULT_CONFIG = {
        'algorithm': 'sha256',
        'digest_format': 'hex',
        'key_min_length': 32,  # 256 bits
        'include_metadata': True,
        'include_timestamp': True,
        'max_signing_time': 0.5,  # ms
        'max_verification_time': 0.5,  # ms
        'enable_chain_of_custody': True,
        'max_chain_length': 1000,
        'enable_replay_protection': False,
        'replay_window_size': 60000,  # ms
    }

    def __init__(self, secret_key: Union[str, bytes], config: Optional[Dict] = None):
        """
        Initialize integrity client.

        Args:
            secret_key: HMAC secret key (hex string or bytes, 32+ bytes)
            config: Configuration options dict

        Raises:
            IntegrityError: If secret key is invalid
        """
        # Validate and convert secret key
        if isinstance(secret_key, str):
            try:
                self.secret_key = bytes.fromhex(secret_key)
            except ValueError:
                raise IntegrityError('Secret key must be valid hex string or bytes')
        elif isinstance(secret_key, bytes):
            self.secret_key = secret_key
        else:
            raise IntegrityError('Secret key must be string or bytes')

        if len(self.secret_key) < self.DEFAULT_CONFIG['key_min_length']:
            raise IntegrityError(
                f"Secret key must be at least {self.DEFAULT_CONFIG['key_min_length']} "
                f"bytes ({self.DEFAULT_CONFIG['key_min_length'] * 8} bits)"
            )

        # Merge configuration
        self.config = {**self.DEFAULT_CONFIG, **(config or {})}

        # Initialize state
        self.chain_of_custody = []
        self.replay_cache = {}

        # Statistics
        self.stats = {
            'signature_count': 0,
            'verification_count': 0,
            'verification_successes': 0,
            'verification_failures': 0,
            'replay_detections': 0,
            'total_signing_time': 0.0,
            'total_verification_time': 0.0,
        }

        # Performance metrics
        self.performance_metrics = {
            'signing_times': [],
            'verification_times': [],
            'payload_sizes': []
        }

        # Event callbacks
        self._event_handlers = defaultdict(list)

        # Locks for thread safety
        self._stats_lock = threading.Lock()
        self._chain_lock = threading.Lock()
        self._replay_lock = threading.Lock()

        # Start cleanup thread if replay protection enabled
        if self.config['enable_replay_protection']:
            self._cleanup_thread = threading.Thread(
                target=self._replay_cleanup_worker,
                daemon=True
            )
            self._cleanup_thread.start()
        else:
            self._cleanup_thread = None

        self._emit('initialized', {
            'timestamp': datetime.utcnow().isoformat(),
            'config': self.config,
            'key_length': len(self.secret_key)
        })

    # ========================================================================
    # PUBLIC API
    # ========================================================================

    def sign_export(
        self,
        payload: Union[Dict, str, bytes],
        export_type: str = 'unknown',
        export_id: Optional[str] = None,
        metadata: Optional[Dict] = None,
        include_chain: bool = False,
        enable_replay: bool = False
    ) -> Dict:
        """
        Sign export data with HMAC-SHA256.

        Args:
            payload: Data to sign (dict, string, or bytes)
            export_type: Type of export (html, network_log, etc.)
            export_id: Unique export ID (auto-generated if not provided)
            metadata: Additional metadata to include
            include_chain: Add to chain of custody
            enable_replay: Enable replay protection for this export

        Returns:
            Signed export envelope dict

        Raises:
            IntegrityError: If signing fails
        """
        start_time = time.time()

        try:
            # Normalize payload to string
            payload_str = self._normalize_payload(payload)
            payload_size = len(payload_str.encode('utf-8'))

            # Create metadata
            export_metadata = {
                'export_type': export_type,
                'export_id': export_id or self._generate_export_id(),
                'timestamp': int(time.time() * 1000),
                'payload_size': payload_size,
                'signature_format': 'v1',
                **(metadata or {})
            }

            # Create content to sign
            content_to_sign = payload_str
            # Always include metadata in signature if it's not empty
            if self.config['include_metadata'] and export_metadata:
                content_to_sign = self._create_signing_content(
                    payload_str,
                    export_metadata
                )

            # Generate signature
            signature = self._generate_hmac(content_to_sign)

            # Build envelope
            envelope = {
                'payload': payload,
                'signature': signature,
                'metadata': export_metadata,
                'formatVersion': 1,
            }

            # Add replay protection if enabled
            if enable_replay and self.config['enable_replay_protection']:
                nonce = uuid.uuid4().hex
                with self._replay_lock:
                    self.replay_cache[nonce] = {
                        'timestamp': export_metadata['timestamp'],
                        'export_id': export_metadata['export_id']
                    }
                envelope['nonce'] = nonce

            # Add to chain of custody
            if include_chain and self.config['enable_chain_of_custody']:
                self._add_to_chain(envelope, export_metadata)

            # Update statistics
            signing_time = (time.time() - start_time) * 1000  # Convert to ms
            with self._stats_lock:
                self.stats['signature_count'] += 1
                self.stats['total_signing_time'] += signing_time
                self.performance_metrics['signing_times'].append(signing_time)
                self.performance_metrics['payload_sizes'].append(payload_size)

            if signing_time > self.config['max_signing_time']:
                self._emit('warning', {
                    'type': 'slow_signing',
                    'signing_time': f"{signing_time:.3f}ms",
                    'max_time': f"{self.config['max_signing_time']}ms",
                    'payload_size': payload_size
                })

            self._emit('exported', {
                'timestamp': datetime.utcnow().isoformat(),
                'export_id': export_metadata['export_id'],
                'export_type': export_type,
                'signing_time': f"{signing_time:.3f}ms",
                'payload_size': payload_size
            })

            return envelope

        except Exception as e:
            self._emit('error', {
                'operation': 'sign_export',
                'error': str(e),
                'timestamp': datetime.utcnow().isoformat()
            })
            raise IntegrityError(f"Failed to sign export: {e}") from e

    def verify_export(
        self,
        envelope: Dict,
        check_replay: bool = False
    ) -> Dict:
        """
        Verify export integrity.

        Args:
            envelope: Signed export envelope to verify
            check_replay: Check for replay attacks

        Returns:
            Result dict with keys:
            - valid: bool - True if signature is valid
            - signature: str - The signature
            - error: str - Error message (if valid=False)
            - data: Any - The payload (if valid=True)
            - metadata: dict - Export metadata (if valid=True)
            - timing: dict - Verification timing info

        Raises:
            IntegrityError: If verification fails due to error
        """
        start_time = time.time()

        try:
            # Validate envelope
            if not isinstance(envelope, dict):
                return {
                    'valid': False,
                    'error': 'Invalid envelope structure',
                    'timing': {
                        'verification_time': f"{(time.time() - start_time) * 1000:.3f}ms"
                    }
                }

            payload = envelope.get('payload')
            signature = envelope.get('signature')
            metadata = envelope.get('metadata')
            nonce = envelope.get('nonce')

            # Validate required fields
            if payload is None:
                return {
                    'valid': False,
                    'error': 'Missing payload',
                    'timing': {
                        'verification_time': f"{(time.time() - start_time) * 1000:.3f}ms"
                    }
                }

            if not signature or not isinstance(signature, str):
                return {
                    'valid': False,
                    'error': 'Missing or invalid signature',
                    'timing': {
                        'verification_time': f"{(time.time() - start_time) * 1000:.3f}ms"
                    }
                }

            # Check replay protection
            if check_replay and self.config['enable_replay_protection'] and nonce:
                replay_check = self._check_replay(nonce, metadata)
                if replay_check['is_replay']:
                    with self._stats_lock:
                        self.stats['replay_detections'] += 1
                    return {
                        'valid': False,
                        'error': 'Replay attack detected',
                        'timing': {
                            'verification_time': f"{(time.time() - start_time) * 1000:.3f}ms"
                        }
                    }

            # Reconstruct signed content
            payload_str = self._normalize_payload(payload)
            content_to_sign = payload_str
            # Always include metadata in signature if it's present and not empty
            if self.config['include_metadata'] and metadata:
                content_to_sign = self._create_signing_content(payload_str, metadata)

            # Verify signature
            expected_signature = self._generate_hmac(content_to_sign)
            is_valid = self._timing_safe_compare(signature, expected_signature)

            verification_time = (time.time() - start_time) * 1000  # Convert to ms

            if not is_valid:
                with self._stats_lock:
                    self.stats['verification_count'] += 1
                    self.stats['verification_failures'] += 1

                self._emit('integrity_violation', {
                    'timestamp': datetime.utcnow().isoformat(),
                    'export_id': metadata.get('export_id') if metadata else 'unknown',
                    'reason': 'Signature mismatch'
                })

                return {
                    'valid': False,
                    'signature': signature,
                    'error': 'Invalid signature - payload may be tampered',
                    'timing': {
                        'verification_time': f"{verification_time:.3f}ms"
                    }
                }

            # Update statistics
            with self._stats_lock:
                self.stats['verification_count'] += 1
                self.stats['verification_successes'] += 1
                self.stats['total_verification_time'] += verification_time
                self.performance_metrics['verification_times'].append(verification_time)

            if verification_time > self.config['max_verification_time']:
                self._emit('warning', {
                    'type': 'slow_verification',
                    'verification_time': f"{verification_time:.3f}ms",
                    'max_time': f"{self.config['max_verification_time']}ms"
                })

            self._emit('verified', {
                'timestamp': datetime.utcnow().isoformat(),
                'export_id': metadata.get('export_id') if metadata else 'unknown',
                'export_type': metadata.get('export_type') if metadata else 'unknown',
                'verification_time': f"{verification_time:.3f}ms"
            })

            return {
                'valid': True,
                'signature': signature,
                'data': payload,
                'metadata': metadata,
                'timing': {
                    'verification_time': f"{verification_time:.3f}ms"
                }
            }

        except Exception as e:
            self._emit('error', {
                'operation': 'verify_export',
                'error': str(e),
                'timestamp': datetime.utcnow().isoformat()
            })
            raise IntegrityError(f"Verification error: {e}") from e

    def verify_batch(
        self,
        envelopes: List[Dict],
        check_replay: bool = False
    ) -> Dict:
        """
        Verify multiple exports in batch.

        Args:
            envelopes: List of signed export envelopes
            check_replay: Check for replay attacks

        Returns:
            Batch result dict with:
            - valid: bool - True if all exports are valid
            - total_count: int - Total number of exports
            - valid_count: int - Number of valid exports
            - failure_count: int - Number of failed exports
            - results: list - Individual verification results
            - summary: dict - Summary statistics
        """
        if not isinstance(envelopes, list):
            return {
                'valid': False,
                'error': 'Envelopes must be a list',
                'total_count': 0,
                'valid_count': 0,
                'failure_count': 0,
                'results': []
            }

        results = []
        valid_count = 0
        failure_count = 0

        for i, envelope in enumerate(envelopes):
            result = self.verify_export(envelope, check_replay=check_replay)
            results.append({
                'index': i,
                'export_id': envelope.get('metadata', {}).get('export_id', f'export_{i}'),
                'valid': result['valid'],
                'error': result.get('error')
            })

            if result['valid']:
                valid_count += 1
            else:
                failure_count += 1

        total = len(envelopes)
        success_rate = (valid_count / total * 100) if total > 0 else 0

        summary = {
            'timestamp': datetime.utcnow().isoformat(),
            'total_count': total,
            'valid_count': valid_count,
            'failure_count': failure_count,
            'success_rate': f"{success_rate:.1f}%"
        }

        self._emit('batch_verified', summary)

        return {
            'valid': failure_count == 0,
            'total_count': total,
            'valid_count': valid_count,
            'failure_count': failure_count,
            'results': results,
            'summary': summary
        }

    def get_stats(self) -> Dict:
        """
        Get integrity verification statistics.

        Returns:
            Statistics dict
        """
        with self._stats_lock:
            avg_signing = (
                self.stats['total_signing_time'] / self.stats['signature_count']
                if self.stats['signature_count'] > 0 else 0
            )
            avg_verification = (
                self.stats['total_verification_time'] / self.stats['verification_count']
                if self.stats['verification_count'] > 0 else 0
            )
            success_rate = (
                (self.stats['verification_successes'] / self.stats['verification_count'] * 100)
                if self.stats['verification_count'] > 0 else 'N/A'
            )

            return {
                'signature_count': self.stats['signature_count'],
                'verification_count': self.stats['verification_count'],
                'verification_successes': self.stats['verification_successes'],
                'verification_failures': self.stats['verification_failures'],
                'verification_success_rate': success_rate,
                'replay_detections': self.stats['replay_detections'],
                'average_signing_time': f"{avg_signing:.3f}ms",
                'average_verification_time': f"{avg_verification:.3f}ms",
                'total_signing_time': f"{self.stats['total_signing_time']:.3f}ms",
                'total_verification_time': f"{self.stats['total_verification_time']:.3f}ms",
                'chain_of_custody_size': len(self.chain_of_custody),
                'replay_cache_size': len(self.replay_cache)
            }

    def get_chain_of_custody(
        self,
        export_type: Optional[str] = None,
        export_id: Optional[str] = None,
        since: Optional[int] = None
    ) -> List[Dict]:
        """
        Get chain of custody records.

        Args:
            export_type: Filter by export type
            export_id: Filter by export ID
            since: Filter since timestamp (ms)

        Returns:
            List of chain of custody entries
        """
        with self._chain_lock:
            chain = list(self.chain_of_custody)

        if export_type:
            chain = [e for e in chain if e.get('export_type') == export_type]

        if export_id:
            chain = [e for e in chain if e.get('export_id') == export_id]

        if since is not None:
            chain = [e for e in chain if e.get('timestamp', 0) >= since]

        return chain

    def export_audit_log(self) -> Dict:
        """
        Export complete audit log.

        Returns:
            Audit log dict
        """
        return {
            'timestamp': datetime.utcnow().isoformat(),
            'statistics': self.get_stats(),
            'chain_of_custody': self.get_chain_of_custody(),
            'replay_protection_enabled': self.config['enable_replay_protection']
        }

    def on(self, event_type: str, handler: Callable) -> None:
        """
        Register event handler.

        Args:
            event_type: Event type to listen for
            handler: Callback function
        """
        self._event_handlers[event_type].append(handler)

    def off(self, event_type: str, handler: Callable) -> None:
        """
        Unregister event handler.

        Args:
            event_type: Event type
            handler: Callback function to remove
        """
        if event_type in self._event_handlers:
            try:
                self._event_handlers[event_type].remove(handler)
            except ValueError:
                pass

    # ========================================================================
    # PRIVATE METHODS
    # ========================================================================

    def _generate_hmac(self, content: str) -> str:
        """Generate HMAC signature."""
        h = hmac.new(
            self.secret_key,
            content.encode('utf-8'),
            getattr(hashlib, self.config['algorithm'])
        )
        return h.hexdigest()

    def _normalize_payload(self, payload: Union[Dict, str, bytes]) -> str:
        """Normalize payload to string."""
        if isinstance(payload, str):
            return payload
        if isinstance(payload, bytes):
            return payload.decode('utf-8')
        # For dicts, use sorted JSON keys for deterministic output
        return json.dumps(payload, sort_keys=True, separators=(',', ':'))

    def _create_signing_content(self, payload_str: str, metadata: Dict) -> str:
        """Create content for signing (payload + metadata hash)."""
        metadata_str = json.dumps(metadata, sort_keys=True, separators=(',', ':'))
        return f"{payload_str}::{metadata_str}"

    def _timing_safe_compare(self, a: str, b: str) -> bool:
        """Timing-safe string comparison."""
        try:
            a_bytes = bytes.fromhex(a)
            b_bytes = bytes.fromhex(b)
            # Python 3.3+ has hmac.compare_digest
            return hmac.compare_digest(a_bytes, b_bytes)
        except (ValueError, TypeError):
            return False

    def _check_replay(self, nonce: str, metadata: Optional[Dict]) -> Dict:
        """Check for replay attacks."""
        with self._replay_lock:
            if nonce in self.replay_cache:
                return {
                    'is_replay': True,
                    'previous_timestamp': self.replay_cache[nonce]['timestamp']
                }
        return {'is_replay': False}

    def _add_to_chain(self, envelope: Dict, metadata: Dict) -> None:
        """Add entry to chain of custody."""
        sig = envelope['signature']
        chain_entry = {
            'timestamp': int(time.time() * 1000),
            'export_id': metadata['export_id'],
            'export_type': metadata['export_type'],
            'payload_size': metadata['payload_size'],
            'signature': sig[:16] + '...'  # Truncate for display
        }

        with self._chain_lock:
            self.chain_of_custody.append(chain_entry)

            # Prevent unbounded memory growth
            if len(self.chain_of_custody) > self.config['max_chain_length']:
                self.chain_of_custody = self.chain_of_custody[
                    -self.config['max_chain_length']:
                ]

    def _replay_cleanup_worker(self) -> None:
        """Background cleanup worker for old replays."""
        while self.config['enable_replay_protection']:
            time.sleep(self.config['replay_window_size'] / 1000.0)
            now = int(time.time() * 1000)
            max_age = self.config['replay_window_size']

            with self._replay_lock:
                expired_nonces = [
                    nonce for nonce, entry in self.replay_cache.items()
                    if now - entry['timestamp'] > max_age
                ]

                for nonce in expired_nonces:
                    del self.replay_cache[nonce]

    def _generate_export_id(self) -> str:
        """Generate unique export ID."""
        return f"export_{int(time.time() * 1000)}_{uuid.uuid4().hex}"

    def _emit(self, event_type: str, data: Dict) -> None:
        """Emit event to registered handlers."""
        if event_type in self._event_handlers:
            for handler in self._event_handlers[event_type]:
                try:
                    handler(data)
                except Exception as e:
                    # Log but don't crash on handler errors
                    print(f"Error in event handler for {event_type}: {e}")

    # ========================================================================
    # STATIC HELPERS
    # ========================================================================

    @staticmethod
    def generate_secret_key() -> str:
        """
        Generate a random secret key.

        Returns:
            64-character hex string (32 bytes)
        """
        import os
        return os.urandom(32).hex()

    @staticmethod
    def create_with_generated_key(config: Optional[Dict] = None) -> 'ExportIntegrityClient':
        """
        Create client with auto-generated secret key.

        Args:
            config: Configuration options

        Returns:
            ExportIntegrityClient instance
        """
        key = ExportIntegrityClient.generate_secret_key()
        print('[SECURITY] Generated export integrity secret key (save this securely):')
        print(key)
        return ExportIntegrityClient(key, config)
