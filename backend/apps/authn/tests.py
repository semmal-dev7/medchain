from django.test import TestCase
from eth_account import Account
from eth_account.messages import encode_defunct
from rest_framework.test import APIClient

from apps.users.models import UserProfile
from .services import extract_siwe_nonce, verify_siwe_signature


class AuthnServiceTests(TestCase):
    def test_registration_role_is_preserved_on_login(self):
        account = Account.create()
        client = APIClient()

        nonce = client.post(
            "/api/v1/auth/nonce",
            {"wallet": account.address},
            format="json",
        ).data["nonce"]
        message = (
            "healthchain.local wants you to sign in with your Ethereum account:\n"
            f"{account.address.lower()}\n\n"
            "Sign in to HealthChain\n\n"
            "URI: http://localhost:8080\n"
            "Version: 1\n"
            "Chain ID: 80002\n"
            f"Nonce: {nonce}\n"
            "Issued At: 2026-03-03T10:00:00.000Z"
        )
        signature = Account.sign_message(encode_defunct(text=message), account.key).signature.hex()

        registered = client.post(
            "/api/v1/auth/verify",
            {
                "wallet": account.address.lower(),
                "message": message,
                "signature": signature,
                "role": "doctor",
                "full_name": "Dr. Test",
            },
            format="json",
        )
        self.assertEqual(registered.status_code, 200)
        self.assertEqual(registered.data["user"]["role"], UserProfile.ROLE_DOCTOR)

        nonce = client.post(
            "/api/v1/auth/nonce",
            {"wallet": account.address},
            format="json",
        ).data["nonce"]
        message = message.replace(message.split("Nonce: ")[1], f"{nonce}\nIssued At: 2026-03-03T10:00:00.000Z")
        signature = Account.sign_message(encode_defunct(text=message), account.key).signature.hex()
        logged_in = client.post(
            "/api/v1/auth/verify",
            {"wallet": account.address, "message": message, "signature": signature},
            format="json",
        )

        self.assertEqual(logged_in.status_code, 200)
        self.assertEqual(logged_in.data["user"]["role"], UserProfile.ROLE_DOCTOR)

    def test_extract_siwe_nonce(self):
        message = (
            "example.com wants you to sign in with your Ethereum account:\n"
            "0x0000000000000000000000000000000000000000\n\n"
            "Sign in\n\n"
            "URI: https://example.com\n"
            "Version: 1\n"
            "Chain ID: 80002\n"
            "Nonce: abc123_XYZ-\n"
            "Issued At: 2026-03-03T10:00:00.000Z\n"
        )
        self.assertEqual(extract_siwe_nonce(message), "abc123_XYZ-")

    def test_verify_siwe_signature_success(self):
        account = Account.create()
        nonce = "nonce12345"
        message = (
            "example.com wants you to sign in with your Ethereum account:\n"
            f"{account.address}\n\n"
            "Sign in\n\n"
            "URI: https://example.com\n"
            "Version: 1\n"
            "Chain ID: 80002\n"
            f"Nonce: {nonce}\n"
            "Issued At: 2026-03-03T10:00:00.000Z\n"
        )
        signature = Account.sign_message(encode_defunct(text=message), account.key).signature.hex()
        self.assertTrue(verify_siwe_signature(account.address, message, signature, nonce))

    def test_verify_siwe_signature_fails_for_wrong_nonce(self):
        account = Account.create()
        message = (
            "example.com wants you to sign in with your Ethereum account:\n"
            f"{account.address}\n\n"
            "Sign in\n\n"
            "URI: https://example.com\n"
            "Version: 1\n"
            "Chain ID: 80002\n"
            "Nonce: rightnonce\n"
            "Issued At: 2026-03-03T10:00:00.000Z\n"
        )
        signature = Account.sign_message(encode_defunct(text=message), account.key).signature.hex()
        self.assertFalse(verify_siwe_signature(account.address, message, signature, "wrongnonce"))
