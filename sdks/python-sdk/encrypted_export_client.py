"""
Encrypted Export Client for Basset Hound Browser

Provides transparent encryption/decryption for forensic exports
Supports both password-based and key-based encryption with AES-256-GCM

Features:
- Automatic encryption/decryption of exports
- Password-based key derivation (PBKDF2)
- Direct key-based encryption
- HMAC integrity verification
- Performance monitoring

Usage:
    client = EncryptedExportClient(browser_client)

    # Encrypt export with password
    result = await client.export_raw_html_encrypted(password='secret')

    # Or with a key
    key = await client.generate_key()
    result = await client.export_raw_html_encrypted(key=key)

    # Decrypt
    decrypted = await client.decrypt_export(
        encrypted_data=result['encryptedData'],
        password='secret'
    )

Requirements:
    - cryptography
    - basset_hound (main client)
"""

import asyncio
import json
import base64
import logging
from typing import Optional, Dict, Any, Union
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend
import os

logger = logging.getLogger(__name__)


class EncryptionConfig:
    """Encryption configuration (matches JS implementation)"""
    ALGORITHM = 'aes-256-gcm'
    KEY_LENGTH = 32  # 256 bits
    IV_LENGTH = 16  # 128 bits
    AUTH_TAG_LENGTH = 16  # 128 bits

    # PBKDF2 settings
    PBKDF2_ALGORITHM = 'sha256'
    PBKDF2_ITERATIONS = 100000
    PBKDF2_SALT_LENGTH = 32

    # HMAC settings
    HMAC_ALGORITHM = 'sha256'

    # Format version
    FORMAT_VERSION = 1


class EncryptionHeader:
    """Encryption header for encrypted data"""
    SIZE = 16

    @staticmethod
    def create(iv_length: int) -> bytes:
        """Create encryption header"""
        header = bytearray(EncryptionHeader.SIZE)
        header[0] = EncryptionConfig.FORMAT_VERSION
        header[1] = 0x01  # Format: binary
        header[2] = 0x00  # Reserved
        header[3:5] = iv_length.to_bytes(2, 'big')
        return bytes(header)

    @staticmethod
    def parse(header: bytes) -> Dict[str, int]:
        """Parse encryption header"""
        if len(header) < EncryptionHeader.SIZE:
            raise ValueError('Invalid encryption header size')

        version = header[0]
        format_type = header[1]
        iv_length = int.from_bytes(header[3:5], 'big')

        if version != EncryptionConfig.FORMAT_VERSION:
            raise ValueError(f'Unsupported format version: {version}')

        if format_type != 0x01:
            raise ValueError(f'Unsupported format: {format_type}')

        return {
            'version': version,
            'format': format_type,
            'iv_length': iv_length
        }


class EncryptedExportClient:
    """
    Client for encrypted forensic exports

    Provides transparent encryption/decryption with automatic key management
    """

    def __init__(self, browser_client):
        """
        Initialize encrypted export client

        Args:
            browser_client: BrowserClient instance
        """
        self.browser_client = browser_client
        self.backend = default_backend()
        self.stats = {
            'encryption_operations': 0,
            'decryption_operations': 0,
            'total_data_encrypted': 0,
            'total_data_decrypted': 0,
            'encryption_errors': 0,
            'decryption_errors': 0
        }

    def generate_key(self, key_length: int = 32) -> str:
        """
        Generate random encryption key

        Args:
            key_length: Key length in bytes (default: 32 for AES-256)

        Returns:
            Base64-encoded key
        """
        key = os.urandom(key_length)
        return base64.b64encode(key).decode('utf-8')

    def derive_key(self, password: str, salt: Optional[str] = None) -> Dict[str, str]:
        """
        Derive encryption key from password

        Uses PBKDF2 with SHA-256, 100,000 iterations

        Args:
            password: User password
            salt: Optional base64-encoded salt

        Returns:
            {
                'key': base64-encoded derived key,
                'salt': base64-encoded salt,
                'iterations': iteration count
            }
        """
        if not password:
            raise ValueError('Password cannot be empty')

        # Generate or decode salt
        if salt:
            salt_bytes = base64.b64decode(salt)
        else:
            salt_bytes = os.urandom(EncryptionConfig.PBKDF2_SALT_LENGTH)

        # Derive key using PBKDF2
        kdf = PBKDF2(
            algorithm=hashes.SHA256(),
            length=EncryptionConfig.KEY_LENGTH,
            salt=salt_bytes,
            iterations=EncryptionConfig.PBKDF2_ITERATIONS,
            backend=self.backend
        )

        derived_key = kdf.derive(password.encode('utf-8'))

        return {
            'key': base64.b64encode(derived_key).decode('utf-8'),
            'salt': base64.b64encode(salt_bytes).decode('utf-8'),
            'iterations': EncryptionConfig.PBKDF2_ITERATIONS
        }

    def encrypt_data(
        self,
        data: Union[str, bytes],
        password_or_key: Union[str, bytes]
    ) -> Dict[str, Any]:
        """
        Encrypt data locally (without server)

        Args:
            data: Data to encrypt (string or bytes)
            password_or_key: Password (str) or key (base64 str or bytes)

        Returns:
            {
                'encrypted': base64-encoded encrypted data,
                'iv': base64-encoded IV,
                'auth_tag': base64-encoded auth tag,
                'salt': base64-encoded salt (if password-based),
                'original_size': original data size,
                'encrypted_size': encrypted data size
            }
        """
        try:
            # Convert data to bytes
            if isinstance(data, str):
                data_bytes = data.encode('utf-8')
            else:
                data_bytes = data

            if not data_bytes:
                raise ValueError('Data to encrypt cannot be empty')

            # Determine encryption key
            if isinstance(password_or_key, str):
                # Password-based encryption
                if password_or_key.startswith('base64:'):
                    # It's a base64-encoded key
                    key_bytes = base64.b64decode(password_or_key[7:])
                    salt = None
                else:
                    # It's a password
                    derivation = self.derive_key(password_or_key)
                    key_bytes = base64.b64decode(derivation['key'])
                    salt = derivation['salt']
            elif isinstance(password_or_key, bytes):
                key_bytes = password_or_key
                salt = None
            else:
                raise ValueError('password_or_key must be string (password) or bytes (key)')

            if len(key_bytes) != EncryptionConfig.KEY_LENGTH:
                raise ValueError(f'Key must be {EncryptionConfig.KEY_LENGTH} bytes')

            # Generate IV
            iv = os.urandom(EncryptionConfig.IV_LENGTH)

            # Create cipher
            cipher = Cipher(
                algorithms.AES(key_bytes),
                modes.GCM(iv),
                backend=self.backend
            )
            encryptor = cipher.encryptor()

            # Encrypt
            encrypted_data = encryptor.update(data_bytes) + encryptor.finalize()
            auth_tag = encryptor.tag

            # Create header
            header = EncryptionHeader.create(len(iv))

            # Assemble: header + IV + salt (if pwd) + encrypted + authTag
            output_parts = [header, iv]
            if salt:
                output_parts.append(base64.b64decode(salt))
            output_parts.append(encrypted_data)
            output_parts.append(auth_tag)

            final_encrypted = b''.join(output_parts)

            self.stats['encryption_operations'] += 1
            self.stats['total_data_encrypted'] += len(data_bytes)

            result = {
                'encrypted': base64.b64encode(final_encrypted).decode('utf-8'),
                'iv': base64.b64encode(iv).decode('utf-8'),
                'auth_tag': base64.b64encode(auth_tag).decode('utf-8'),
                'original_size': len(data_bytes),
                'encrypted_size': len(final_encrypted),
                'is_password_based': salt is not None
            }

            if salt:
                result['salt'] = salt

            return result

        except Exception as e:
            self.stats['encryption_errors'] += 1
            logger.error(f'Encryption error: {e}')
            raise

    def decrypt_data(
        self,
        encrypted_data: str,
        password_or_key: Union[str, bytes]
    ) -> Dict[str, Any]:
        """
        Decrypt data locally (without server)

        Args:
            encrypted_data: Base64-encoded encrypted data (full buffer)
            password_or_key: Password (str) or key (base64 str or bytes)

        Returns:
            {
                'data': decrypted string,
                'original_size': decrypted size,
                'integrity_verified': boolean
            }
        """
        try:
            # Decode encrypted data
            encrypted_bytes = base64.b64decode(encrypted_data)

            # Parse header
            header_bytes = encrypted_bytes[:EncryptionHeader.SIZE]
            header_data = EncryptionHeader.parse(header_bytes)

            offset = EncryptionHeader.SIZE

            # Extract IV
            iv_length = header_data['iv_length']
            iv = encrypted_bytes[offset:offset + iv_length]
            offset += iv_length

            # Determine if password-based by checking passwordOrKey type
            salt = None

            if isinstance(password_or_key, str):
                if password_or_key.startswith('base64:'):
                    # Direct key
                    key_bytes = base64.b64decode(password_or_key[7:])
                else:
                    # Password - try to extract salt
                    remaining = encrypted_bytes[offset:-EncryptionConfig.AUTH_TAG_LENGTH]
                    if len(remaining) > EncryptionConfig.PBKDF2_SALT_LENGTH:
                        salt_bytes = remaining[:EncryptionConfig.PBKDF2_SALT_LENGTH]
                        offset += len(salt_bytes)

                        # Derive key
                        derivation = self.derive_key(
                            password_or_key,
                            base64.b64encode(salt_bytes).decode('utf-8')
                        )
                        key_bytes = base64.b64decode(derivation['key'])
                        salt = salt_bytes
                    else:
                        raise ValueError('Password-based encryption requires salt, but none found')
            elif isinstance(password_or_key, bytes):
                key_bytes = password_or_key
            else:
                raise ValueError('password_or_key must be string or bytes')

            if len(key_bytes) != EncryptionConfig.KEY_LENGTH:
                raise ValueError(f'Key must be {EncryptionConfig.KEY_LENGTH} bytes')

            # Extract encrypted content and auth tag
            encrypted_content = encrypted_bytes[offset:-EncryptionConfig.AUTH_TAG_LENGTH]
            auth_tag = encrypted_bytes[-EncryptionConfig.AUTH_TAG_LENGTH:]

            # Create cipher and decrypt
            cipher = Cipher(
                algorithms.AES(key_bytes),
                modes.GCM(iv, auth_tag),
                backend=self.backend
            )
            decryptor = cipher.decryptor()

            decrypted = decryptor.update(encrypted_content) + decryptor.finalize()

            self.stats['decryption_operations'] += 1
            self.stats['total_data_decrypted'] += len(decrypted)

            return {
                'data': decrypted.decode('utf-8'),
                'original_size': len(decrypted),
                'integrity_verified': True,
                'is_password_based': salt is not None
            }

        except Exception as e:
            self.stats['decryption_errors'] += 1
            logger.error(f'Decryption error: {e}')
            raise

    async def export_raw_html_encrypted(
        self,
        password: Optional[str] = None,
        key: Optional[str] = None,
        use_hmac: bool = False
    ) -> Dict[str, Any]:
        """
        Export raw HTML with optional encryption

        Args:
            password: Password for encryption (optional)
            key: Base64-encoded key (optional)
            use_hmac: Include HMAC verification

        Returns:
            Export result (encrypted if password/key provided)
        """
        params = {}
        if password:
            params['password'] = password
        if key:
            params['key'] = key
        if use_hmac:
            params['useHmac'] = True

        result = await self.browser_client.send_command(
            'export_raw_html_encrypted',
            params
        )

        return result

    async def export_network_log_encrypted(
        self,
        password: Optional[str] = None,
        key: Optional[str] = None,
        format: str = 'json'
    ) -> Dict[str, Any]:
        """
        Export network log with optional encryption

        Args:
            password: Password for encryption (optional)
            key: Base64-encoded key (optional)
            format: Export format ('json', 'har')

        Returns:
            Export result (encrypted if password/key provided)
        """
        params = {'format': format}
        if password:
            params['password'] = password
        if key:
            params['key'] = key

        result = await self.browser_client.send_command(
            'export_network_log_encrypted',
            params
        )

        return result

    async def decrypt_export(
        self,
        encrypted_data: str,
        password: Optional[str] = None,
        key: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Decrypt exported data

        Args:
            encrypted_data: Base64-encoded encrypted data
            password: Password for decryption
            key: Base64-encoded key for decryption

        Returns:
            Decrypted data
        """
        params = {'encrypted': encrypted_data}
        if password:
            params['password'] = password
        if key:
            params['key'] = key

        result = await self.browser_client.send_command(
            'decrypt_export',
            params
        )

        return result

    async def get_encryption_stats(self) -> Dict[str, Any]:
        """
        Get encryption performance statistics

        Returns:
            Performance metrics from server
        """
        result = await self.browser_client.send_command(
            'get_encryption_stats',
            {}
        )

        return result

    def get_local_stats(self) -> Dict[str, Any]:
        """
        Get local client encryption statistics

        Returns:
            Local performance metrics
        """
        return self.stats.copy()

    def reset_local_stats(self):
        """Reset local statistics"""
        self.stats = {
            'encryption_operations': 0,
            'decryption_operations': 0,
            'total_data_encrypted': 0,
            'total_data_decrypted': 0,
            'encryption_errors': 0,
            'decryption_errors': 0
        }


class EncryptedExportAsync:
    """Async context manager for encrypted exports"""

    def __init__(self, client: EncryptedExportClient, password: Optional[str] = None):
        self.client = client
        self.password = password
        self.key = None

    async def __aenter__(self):
        if not self.password and not self.key:
            self.password = 'temp_password'
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        pass

    async def export_html(self) -> Dict[str, Any]:
        """Export HTML with encryption"""
        return await self.client.export_raw_html_encrypted(
            password=self.password
        )

    async def export_network_log(self) -> Dict[str, Any]:
        """Export network log with encryption"""
        return await self.client.export_network_log_encrypted(
            password=self.password
        )
