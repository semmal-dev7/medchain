from django.db import models


class AuthNonce(models.Model):
    wallet = models.CharField(max_length=42, primary_key=True)
    nonce = models.CharField(max_length=255)
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.wallet
