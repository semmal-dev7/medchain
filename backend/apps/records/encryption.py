import base64
import hashlib
import os

from cryptography.fernet import Fernet


def get_fernet() -> Fernet:
    configured_key = os.getenv("FERNET_KEY", "").strip()
    if configured_key:
        return Fernet(configured_key.encode("ascii"))

    # Development fallback keeps local setup usable; production must configure FERNET_KEY.
    seed = os.getenv("DJANGO_SECRET_KEY", "dev-only-secret-key").encode("utf-8")
    derived_key = base64.urlsafe_b64encode(hashlib.sha256(seed).digest())
    return Fernet(derived_key)


def encrypt_file(contents: bytes) -> bytes:
    return get_fernet().encrypt(contents)


def decrypt_file(contents: bytes) -> bytes:
    return get_fernet().decrypt(contents)