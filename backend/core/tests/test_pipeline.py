"""End-to-end generate flow with fake providers: upload -> mask -> generate -> worker -> concept."""
import io
import os
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import mock
from uuid import uuid4

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from PIL import Image, ImageDraw
from rest_framework.test import APIClient

from common.errors import ProviderUnavailable
from common.schema_test import assert_matches_schema
from core.models import Job, JobStatus, Post, PostStatus
from core.services import jobs
from core.services.pipeline import run_job


User = get_user_model()
FAKE_ENV = {"PROMPT_PROVIDER": "fake", "MODERATION_PROVIDER": "fake", "REVIEW_PROVIDER": "fake",
            "RENDER_PROVIDER": "fake", "RENDER_FALLBACK_PROVIDER": ""}


def _jpeg(size=(320, 240)):
    buf = io.BytesIO()
    Image.new("RGB", size, (120, 140, 160)).save(buf, format="JPEG")
    buf.seek(0)
    buf.name = "photo.jpg"
    return buf


def _mask_png(size):
    img = Image.new("L", size, 0)
    w, h = size
    ImageDraw.Draw(img).rectangle([w // 4, h // 4, w // 2, h // 2], fill=255)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    buf.name = "mask.png"
    return buf


@mock.patch.dict(os.environ, FAKE_ENV)
class GeneratePipelineTests(TestCase):
    def setUp(self):
        self.media = TemporaryDirectory()
        self.addCleanup(self.media.cleanup)
        override = override_settings(DEBUG=True, AUTH_DEV_BYPASS=True, SECRET_KEY="pipeline-secret",
                                     PUBLIC_BASE_URL="http://testserver", MEDIA_ROOT=Path(self.media.name))
        override.enable()
        self.addCleanup(override.disable)
        self.client = APIClient(HTTP_X_DEV_USER="pipeline-owner")

    def _create_masked_post(self, prompt="This bus stop needs a roof"):
        created = self.client.post("/api/v1/posts", {"photo": _jpeg(), "placeLabel": "Ponce Ave",
                                                     "locationSource": "none", "consent": "true"},
                                   format="multipart")
        self.assertEqual(created.status_code, 201, created.content)
        post = created.json()
        size = (post["source"]["width"], post["source"]["height"])
        masked = self.client.post(f"/api/v1/posts/{post['id']}/mask",
                                  {"mask": _mask_png(size), "expectedRevision": post["revision"]},
                                  format="multipart")
        self.assertEqual(masked.status_code, 201, masked.content)
        accepted = self.client.post(f"/api/v1/posts/{post['id']}/generate",
                                    {"prompt": prompt, "maskAssetId": masked.json()["assetId"],
                                     "expectedRevision": masked.json()["revision"]},
                                    format="json", HTTP_IDEMPOTENCY_KEY=str(uuid4()))
        self.assertEqual(accepted.status_code, 202, accepted.content)
        return post["id"], accepted.json()["jobId"]

    def test_generate_job_produces_ready_post_with_concept(self):
        post_id, job_id = self._create_masked_post()
        run_job(jobs.claim())

        job = self.client.get(f"/api/v1/jobs/{job_id}").json()
        self.assertEqual(job["status"], "succeeded", job)
        post = self.client.get(f"/api/v1/posts/{post_id}").json()
        assert_matches_schema(post, "Post")
        self.assertEqual(post["status"], "ready")
        self.assertIsNotNone(post["concept"])
        self.assertNotEqual(post["concept"]["sha256"], post["source"]["sha256"])
        self.assertEqual((post["concept"]["width"], post["concept"]["height"]),
                         (post["source"]["width"], post["source"]["height"]))
        self.assertEqual(post["generation"]["provider"], "fake")
        self.assertEqual(post["review"]["verdict"], "needs_review")
        self.assertTrue(post["title"])
        concept_bytes = self.client.get(post["concept"]["url"].replace("http://testserver", ""))
        self.assertEqual(concept_bytes.status_code, 200)
        concept_bytes.close()

    def test_disallowed_prompt_is_rejected_before_queueing(self):
        created = self.client.post("/api/v1/posts", {"photo": _jpeg(), "locationSource": "none",
                                                     "consent": "true"}, format="multipart")
        post = created.json()
        size = (post["source"]["width"], post["source"]["height"])
        masked = self.client.post(f"/api/v1/posts/{post['id']}/mask",
                                  {"mask": _mask_png(size), "expectedRevision": post["revision"]},
                                  format="multipart").json()
        resp = self.client.post(f"/api/v1/posts/{post['id']}/generate",
                                {"prompt": "add a gun to the bench", "maskAssetId": masked["assetId"],
                                 "expectedRevision": masked["revision"]},
                                format="json", HTTP_IDEMPOTENCY_KEY=str(uuid4()))
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.json()["error"]["code"], "PROMPT_DISALLOWED")

    def test_provider_failure_requeues_then_fails(self):
        post_id, job_id = self._create_masked_post()
        with mock.patch("imaging.render_edit", side_effect=ProviderUnavailable("down")):
            run_job(jobs.claim())
            self.assertEqual(Job.objects.get(id=job_id).status, JobStatus.QUEUED)
            run_job(jobs.claim())
        job = Job.objects.get(id=job_id)
        self.assertEqual(job.status, JobStatus.FAILED)
        self.assertEqual(job.error["code"], "PROVIDER_UNAVAILABLE")
        self.assertIsNone(Post.objects.get(id=post_id).concept)

    def test_stale_revision_discards_result(self):
        post_id, job_id = self._create_masked_post()
        job = jobs.claim()
        Post.objects.filter(id=post_id).update(revision=99)
        run_job(job)
        job = Job.objects.get(id=job_id)
        self.assertEqual(job.status, JobStatus.FAILED)
        self.assertEqual(job.error["code"], "STALE_RESULT")
        post = Post.objects.get(id=post_id)
        self.assertIsNone(post.concept)
        self.assertEqual(post.status, PostStatus.DRAFT)
