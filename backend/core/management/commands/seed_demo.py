"""Seed a published demo proposal from shared/demo (labeled 'seed').

Tolerant: skips quietly when shared/demo has no usable photo.
"""
from __future__ import annotations

from pathlib import Path

from django.core.management.base import BaseCommand
from django.utils import timezone

from core.models import Asset, Proposal, User


class Command(BaseCommand):
    help = "Seed a published demo proposal (labeled seed)."

    def handle(self, *args, **options):
        demo_dir = Path(__file__).resolve().parent.parent.parent.parent.parent / "shared" / "demo"
        photos = sorted(demo_dir.glob("*.jpg")) + sorted(demo_dir.glob("*.png"))
        if not photos:
            self.stdout.write("seed_demo: no photos in shared/demo — skipping")
            return
        user, _ = User.objects.get_or_create(
            auth0_sub="dev|seed", defaults={"display_name": "Seed Neighbor"}
        )
        asset = Asset.objects.create(
            proposal=None,
            owner=user,
            kind="source",
            file_path=f"seed/{photos[0].name}",
            mime_type="image/jpeg",
            width=1024,
            height=1024,
            sha256="seed",
        )
        proposal = Proposal.objects.create(
            owner=user,
            status="published",
            revision=1,
            category="shade",
            place_label="Seed demo stop",
            problem_text="Seeded demo proposal for integration testing.",
            title="Seed: shade canopy demo",
            change_request="Seeded request text.",
            consent_at=timezone.now(),
            source=asset,
            published_at=timezone.now(),
        )
        asset.proposal = proposal
        asset.save(update_fields=["proposal"])
        self.stdout.write(f"seed_demo: created published proposal {proposal.id}")
