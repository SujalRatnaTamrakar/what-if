from __future__ import annotations

import logging
import signal
import time

from django.conf import settings
from django.core.management.base import BaseCommand

from core.services.jobs import claim


logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Run the WhatIf background job worker."

    def handle(self, *args, **options):
        self._stopping = False
        signal.signal(signal.SIGINT, self._stop)
        signal.signal(signal.SIGTERM, self._stop)

        self.stdout.write("Worker started.")
        while not self._stopping:
            job = claim()
            if job is None:
                time.sleep(settings.WORKER_POLL_SECONDS)
                continue
            self._dispatch(job)
        self.stdout.write("Worker stopped.")

    def _dispatch(self, job):
        """Dispatch a claimed job once the agent/imaging pipeline is available."""
        logger.error(
            "No generation pipeline is installed; leaving job=%s for lease recovery.",
            job.pk,
        )

    def _stop(self, signum, frame):
        self._stopping = True
