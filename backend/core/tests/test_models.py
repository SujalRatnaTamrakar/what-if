from datetime import datetime, timezone

from django.contrib.auth import get_user_model
from django.test import TestCase

from core.models import Asset, AssetKind, Event, Job, JobKind, Post, PostStatus


User = get_user_model()


class CoreModelTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            auth0_sub="dev|models",
            display_name="Model Tester",
        )
        source = Asset.objects.create(
            owner=self.user,
            kind=AssetKind.SOURCE,
            file_path="sources/test.jpg",
            mime_type="image/jpeg",
            width=100,
            height=100,
            sha256="a" * 64,
        )
        self.post = Post.objects.create(
            owner=self.user,
            place_label="Test place",
            consent_at=datetime.now(timezone.utc),
            source=source,
        )
        source.post = self.post
        source.save(update_fields=["post"])

    def test_post_defaults_to_draft(self):
        self.assertEqual(self.post.status, PostStatus.DRAFT)
        self.assertEqual(self.post.revision, 1)

    def test_asset_can_be_linked_to_post(self):
        asset = Asset.objects.create(
            post=self.post,
            owner=self.user,
            kind=AssetKind.SOURCE,
            file_path="sources/test.jpg",
            mime_type="image/jpeg",
            width=100,
            height=100,
            sha256="a" * 64,
        )
        self.post.source = asset
        self.post.save(update_fields=["source"])
        self.assertEqual(self.post.source_id, asset.id)

    def test_job_idempotency_is_unique_per_post(self):
        Job.objects.create(
            post=self.post,
            owner=self.user,
            kind=JobKind.GENERATE,
            base_revision=self.post.revision,
            idempotency_key="request-1",
        )
        with self.assertRaises(Exception):
            Job.objects.create(
                post=self.post,
                owner=self.user,
                kind=JobKind.GENERATE,
                base_revision=self.post.revision,
                idempotency_key="request-1",
            )

    def test_event_stores_json_data(self):
        event = Event.objects.create(
            type="post_created",
            post=self.post,
            user=self.user,
            data={"source": "test"},
        )
        self.assertEqual(event.data["source"], "test")
