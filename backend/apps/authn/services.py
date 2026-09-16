import re
import secrets

from eth_account import Account
from eth_account.messages import encode_defunct
from eth_utils import is_address, to_checksum_address


NONCE_PATTERN = re.compile(r"(?mi)^Nonce:\s*([A-Za-z0-9_-]+)\s*$")


def generate_nonce() -> str:
    return secrets.token_urlsafe(24)


def normalize_wallet(wallet: str) -> str:
    if not wallet or not is_address(wallet):
        return ""
    return to_checksum_address(wallet)


def extract_siwe_nonce(message: str) -> str:
    if not message:
        return ""
    match = NONCE_PATTERN.search(message)
    return match.group(1) if match else ""


def verify_siwe_signature(wallet: str, message: str, signature: str, expected_nonce: str) -> bool:
    normalized = normalize_wallet(wallet)
    if not normalized or not message or not signature or not expected_nonce:
        return False

    nonce_in_message = extract_siwe_nonce(message)
    if nonce_in_message != expected_nonce:
        return False

    try:
        signed_message = encode_defunct(text=message)
        recovered = Account.recover_message(signed_message, signature=signature)
    except Exception:
        return False

    return recovered.lower() == normalized.lower()
