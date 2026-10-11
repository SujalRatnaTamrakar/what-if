"""Data model — §9.3 of the master plan.

Field types are Postgres-compatible (UUIDField, JSONField) and also run on
sqlite for local dev. Timescale hypertable for Event is a later migration
(§9.5 step 7); E19 uses date_trunc/TruncHour until then.
"""
from __future__ import annotations

import uuid

from django.db import models


class User(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    auth0_sub = models.CharField(max_length=255, unique=True)
    display_name = models.CharField(max_length=40)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = "core"

    def __str__(self) -> str:  # pragma: no cover
        return f"{self.display_name} ({self.auth0_sub})"

    # DRF compatibility: this model is not django.contrib.auth's User.
    @property
    def is_authenticated(self) -> bool:
        return True

    @property
    def is_anonymous(self) -> bool:
        return False

    @property
    def pk(self):  # keep default behaviour explicit
        return self.id


class Asset(models.Model):
    KIND_CHOICES = [("source", "source"), ("mask", "mask"), ("concept", "concept")]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    proposal = models.ForeignKey(
        "Proposal", null=True, blank=True, on_delete=models.SET_NULL, related_name="assets"
    )
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name="assets")
    kind = models.CharField(max_length=16, choices=KIND_CHOICES)
    file_path = models.CharField(max_length=512)  # relative to MEDIA_ROOT
    thumb_path = models.CharField(max_length=512, null=True, blank=True)  # relative to MEDIA_ROOT
    mime_type = models.CharField(max_length=64)
    width = models.IntegerField()
    height = models.IntegerField()
    sha256 = models.CharField(max_length=64)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = "core"


class Proposal(models.Model):
    STATUS_CHOICES = [("draft", "draft"), ("ready", "ready"), ("published", "published")]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name="proposals")
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="draft")
    revision = models.IntegerField(default=1)
    category = models.CharField(max_length=32, default="shade")
    place_label = models.CharField(max_length=120)
    problem_text = models.CharField(max_length=500)
    title = models.CharField(max_length=120, default="", blank=True)
    change_request = models.CharField(max_length=1500, default="", blank=True)
    recipient_label = models.CharField(max_length=120, default="To confirm")
    text_user_edited = models.BooleanField(default=False)
    selected_option_id = models.CharField(max_length=64, null=True, blank=True)
    consent_at = models.DateTimeField(null=True, blank=True)
    source = models.ForeignKey(Asset, on_delete=models.PROTECT, related_name="+")
    concept = models.ForeignKey(Asset, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    mask = models.ForeignKey(Asset, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    scene = models.JSONField(null=True, blank=True)
    review = models.JSONField(null=True, blank=True)
    generation = models.JSONField(null=True, blank=True)
    support_count = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    published_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        app_label = "core"
        indexes = [
            models.Index(fields=["status", "-published_at"]),
            models.Index(fields=["owner", "-updated_at"]),
        ]


class Job(models.Model):
    KIND_CHOICES = [("scene", "scene"), ("preview", "preview")]
    STATUS_CHOICES = [
        ("queued", "queued"),
        ("running", "running"),
        ("succeeded", "succeeded"),
        ("failed", "failed"),
    ]
    STAGE_CHOICES = [
        ("queued", "queued"),
        ("analyze", "analyze"),
        ("prompt", "prompt"),
        ("render", "render"),
        ("review", "review"),
        ("draft", "draft"),
        ("finalize", "finalize"),
        ("done", "done"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    proposal = models.ForeignKey(Proposal, on_delete=models.CASCADE, related_name="jobs")
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name="jobs")
    kind = models.CharField(max_length=16, choices=KIND_CHOICES)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="queued")
    stage = models.CharField(max_length=16, choices=STAGE_CHOICES, default="queued")
    attempt = models.IntegerField(default=0)
    base_revision = models.IntegerField()
    payload = models.JSONField(default=dict, blank=True)
    error = models.JSONField(null=True, blank=True)
    idempotency_key = models.CharField(max_length=64, null=True, blank=True)
    lease_expires_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = "core"
        constraints = [
            # Partial unique index on Postgres; sqlite ignores the condition
            # (enforced in code instead — see jobs.enqueue).
            models.UniqueConstraint(
                fields=["proposal", "idempotency_key"],
                name="unique_proposal_idem",
                condition=models.Q(idempotency_key__isnull=False),
            ),
        ]
        indexes = [models.Index(fields=["status", "created_at"])]


class Support(models.Model):
    proposal = models.ForeignKey(Proposal, on_delete=models.CASCADE, related_name="supports")
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="supports")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = "core"
        constraints = [
            models.UniqueConstraint(fields=["proposal", "user"], name="unique_proposal_user"),
        ]


class Event(models.Model):
    # Plain id + created_at; the Timescale hypertable migration (§9.5 step 7)
    # will use a composite PK (id, created_at) when enabled.
    id = models.BigAutoField(primary_key=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    type = models.CharField(max_length=64, db_index=True)
    proposal_id = models.UUIDField(null=True, blank=True)
    user_id = models.UUIDField(null=True, blank=True)
    data = models.JSONField(default=dict, blank=True)

    class Meta:
        app_label = "core"


class Packet(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    proposal = models.ForeignKey(Proposal, on_delete=models.CASCADE, related_name="packets")
    file_path = models.CharField(max_length=512)  # relative to MEDIA_ROOT
    support_count_at_export = models.IntegerField(default=0)
    exported_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = "core"
