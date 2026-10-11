from datetime import datetime, timezone

from django.conf import settings
from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings

from core.models import Asset, AssetKind, Job, JobKind, JobStatus, Post, PostStatus
from core.serializers import (
    asset_payload,
    author_payload,
    post_payload,
    post_summary_payload,
)


User = get_user_model()


class SerializerTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            auth0_sub="dev|serializer-owner",
            display_name="Owner",
        )
        self.viewer = User.objects.create_user(
            auth0_sub="dev|serializer-viewer",
            display_name="Viewer",
        )
        self.source = Asset.objects.create(
            owner=self.owner,
            kind=AssetKind.SOURCE,
            file_path="sources/source.jpg",
            mime_type="image/jpeg",
            width=1200,
            height=800,
            sha256="a" * 64,
        )
        self.concept = Asset.objects.create(
            owner=self.owner,
            kind=AssetKind.CONCEPT,
            file_path="concepts/concept.jpg",
            mime_type="image/jpeg",
            width=1200,
            height=800,
            sha256="b" * 64,
        )
        self.mask = Asset.objects.create(
            owner=self.owner,
            kind=AssetKind.MASK,
            file_path="masks/mask.jpg",
            mime_type="image/jpeg",
            width=1200,
            height=800,
            sha256="c" * 64,
        )
        self.post = Post.objects.create(
            owner=self.owner,
            source=self.source,
            concept=self.concept,
            mask=self.mask,
            status=PostStatus.READY,
            title="A better stop",
            prompt="A covered bus stop",
            place_label="Atlanta",
            lat=33.772456,
            lng=-84.366789,
            location_source="gps",
            consent_at=datetime.now(timezone.utc),
        )

    @override_settings(SECRET_KEY="serializer-secret", PUBLIC_BASE_URL="http://testserver")
    def test_asset_payload_contains_signed_url_metadata(self):
        payload = asset_payload(self.source)

        self.assertEqual(payload["id"], str(self.source.id))
        self.assertEqual(payload["mimeType"], "image/jpeg")
        self.assertIn("/api/v1/media/", payload["url"])
        self.assertIsNotNone(payload["urlExpiresAt"])

    def test_author_marks_only_matching_viewer(self):
        self.assertTrue(author_payload(self.owner, self.owner)["isViewer"])
        self.assertFalse(author_payload(self.owner, self.viewer)["isViewer"])
        self.assertFalse(author_payload(self.owner)["isViewer"])

    @override_settings(
        SECRET_KEY="serializer-secret",
        PUBLIC_BASE_URL="http://testserver",
        PUBLIC_COORD_DECIMALS=3,
    )
    def test_post_payload_applies_privacy_and_owner_fields(self):
        owner_payload = post_payload(self.post, self.owner, (33.772, -84.367))
        public_payload = post_payload(self.post, self.viewer, (33.772, -84.367))

        self.assertEqual(owner_payload["location"]["lat"], 33.772456)
        self.assertEqual(public_payload["location"]["lat"], 33.772)
        self.assertEqual(owner_payload["maskAssetId"], str(self.mask.id))
        self.assertIsNone(public_payload["maskAssetId"])
        self.assertEqual(owner_payload["viewerVote"], 0)
        self.assertIsNone(public_payload["activeJob"])
        self.assertIsNotNone(public_payload["distanceKm"])
        self.assertEqual(public_payload["author"]["isViewer"], False)
        self.assertEqual(public_payload["aiDisclosure"], settings.AI_DISCLOSURE)

    @override_settings(SECRET_KEY="serializer-secret", PUBLIC_BASE_URL="http://testserver")
    def test_post_payload_includes_latest_active_job(self):
        job = Job.objects.create(
            post=self.post,
            owner=self.owner,
            kind=JobKind.GENERATE,
            status=JobStatus.RUNNING,
            base_revision=self.post.revision,
            error={"code": "TEMPORARY"},
        )

        payload = post_payload(self.post, self.owner)

        self.assertEqual(payload["activeJob"]["id"], str(job.id))
        self.assertEqual(payload["activeJob"]["postId"], str(self.post.id))
        self.assertEqual(payload["activeJob"]["error"], {"code": "TEMPORARY"})

    def test_summary_uses_prompt_preview_and_thumbnail_urls(self):
        payload = post_summary_payload(self.post)

        self.assertEqual(payload["promptPreview"], self.post.prompt[:140])
        self.assertIn("w=480", payload["sourceThumbUrl"])
        self.assertIn("w=480", payload["conceptThumbUrl"])
