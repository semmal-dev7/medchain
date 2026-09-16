from django.db import models


class ChainSyncState(models.Model):
    id = models.SmallIntegerField(primary_key=True, default=1)
    last_processed_block = models.BigIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"sync@{self.last_processed_block}"
