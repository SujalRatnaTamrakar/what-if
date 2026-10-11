"""DB-backed worker — §9.5 step 4: loop claim → run → sleep."""
from __future__ import annotations

import logging
import time
import traceback

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import connection

from core.models import Job
from core.services import jobs
from core.services.pipeline import run_preview_job, run_scene_job

log = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Run the PlacePatch job worker (DB-backed queue, no Redis/Celery)."

    def handle(self, *args, **options):
        poll = settings.WORKER_POLL_SECONDS
        self.stdout.write(f"worker: polling every {poll}s (Ctrl-C to stop)")
        try:
            while True:
                try:
                    swept = jobs.sweep_expired()
                    if swept:
                        log.info("worker: swept %d expired jobs", swept)
                    job = jobs.claim()
                    if job is None:
                        time.sleep(poll)
                        continue
                    self._run(job)
                except Exception:
                    log.exception("worker: loop error")
                    time.sleep(poll)
        except KeyboardInterrupt:
            self.stdout.write("worker: stopped")

    def _run(self, job: Job):
        # Refresh: the claim transaction committed; re-read the row.
        job.refresh_from_db()
        # Close stale connections before long AI calls (prevents sqlite locks).
        connection.close()
        job = Job.objects.select_related("proposal", "owner").get(pk=job.pk)
        log.info("worker: running %s job %s (attempt %d)", job.kind, job.id, job.attempt)
        try:
            if job.kind == "scene":
                run_scene_job(job)
            elif job.kind == "preview":
                run_preview_job(job)
            else:
                jobs.fail(job, "INTERNAL", f"Unknown job kind {job.kind!r}.", retryable=False)
        except Exception:
            log.exception("worker: job %s crashed", job.id)
            traceback.print_exc()
            try:
                jobs.fail(job, "INTERNAL", "Something went wrong.")
            except Exception:
                log.exception("worker: could not mark job failed")
