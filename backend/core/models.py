from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.models import PermissionsMixin
from django.db import models
import uuid


class UserManager(BaseUserManager):
    def create_user(self, auth0_sub, display_name=None, password=None, **extra_fields):
        if not auth0_sub:
            raise ValueError("auth0_sub is required")

        user = self.model(
            auth0_sub=auth0_sub,
            display_name=display_name or "Neighbor",
            **extra_fields,
        )
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_superuser(self, auth0_sub, display_name=None, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_active", True)
        return self.create_user(
            auth0_sub=auth0_sub,
            display_name=display_name,
            password=password,
            **extra_fields,
        )


class User(AbstractBaseUser, PermissionsMixin):
    auth0_sub = models.CharField(max_length=255, unique=True)
    display_name = models.CharField(max_length=40)
    created_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)

    objects = UserManager()

    USERNAME_FIELD = "auth0_sub"
    REQUIRED_FIELDS = ["display_name"]

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return self.display_name


class PostStatus(models.TextChoices):
    DRAFT = "draft", "Draft"
    READY = "ready", "Ready"
    PUBLISHED = "published", "Published"
    REMOVED = "removed", "Removed"


class AssetKind(models.TextChoices):
    SOURCE = "source", "Source"
    MASK = "mask", "Mask"
    CONCEPT = "concept", "Concept"


class JobKind(models.TextChoices):
    GENERATE = "generate", "Generate"


class JobStatus(models.TextChoices):
    QUEUED = "queued", "Queued"
    RUNNING = "running", "Running"
    SUCCEEDED = "succeeded", "Succeeded"
    FAILED = "failed", "Failed"


class JobStage(models.TextChoices):
    QUEUED = "queued", "Queued"
    MODERATE = "moderate", "Moderate"
    PROMPT = "prompt", "Prompt"
    RENDER = "render", "Render"
    REVIEW = "review", "Review"
    TITLE = "title", "Title"
    FINALIZE = "finalize", "Finalize"
    DONE = "done", "Done"


class Asset(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    post = models.ForeignKey(
        "Post",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assets",
    )
    owner = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="assets",
    )
    kind = models.CharField(max_length=16, choices=AssetKind.choices)
    file_path = models.CharField(max_length=1024)
    mime_type = models.CharField(max_length=128)
    width = models.PositiveIntegerField()
    height = models.PositiveIntegerField()
    sha256 = models.CharField(max_length=64)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["post", "kind"]),
            models.Index(fields=["owner", "-created_at"]),
        ]


class Post(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="posts",
    )
    status = models.CharField(
        max_length=16,
        choices=PostStatus.choices,
        default=PostStatus.DRAFT,
    )
    revision = models.PositiveIntegerField(default=1)
    title = models.CharField(max_length=120, blank=True)
    title_user_edited = models.BooleanField(default=False)
    prompt = models.CharField(max_length=300, blank=True)
    place_label = models.CharField(max_length=120, blank=True)
    lat = models.FloatField(null=True, blank=True)
    lng = models.FloatField(null=True, blank=True)
    location_source = models.CharField(max_length=16, default="none")
    location_accuracy_m = models.FloatField(null=True, blank=True)
    source = models.ForeignKey(
        Asset,
        on_delete=models.PROTECT,
        related_name="source_posts",
    )
    mask = models.ForeignKey(
        Asset,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="mask_posts",
    )
    concept = models.ForeignKey(
        Asset,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="concept_posts",
    )
    review = models.JSONField(null=True, blank=True)
    generation = models.JSONField(null=True, blank=True)
    score = models.IntegerField(default=0)
    upvotes = models.PositiveIntegerField(default=0)
    downvotes = models.PositiveIntegerField(default=0)
    comment_count = models.PositiveIntegerField(default=0)
    hot_rank = models.FloatField(default=0)
    consent_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    published_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["status", "-hot_rank"]),
            models.Index(fields=["status", "-published_at"]),
            models.Index(fields=["status", "-score"]),
            models.Index(fields=["status", "lat", "lng"]),
            models.Index(fields=["owner", "-updated_at"]),
        ]


class Job(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    post = models.ForeignKey(
        Post,
        on_delete=models.CASCADE,
        related_name="jobs",
    )
    owner = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="jobs",
    )
    kind = models.CharField(max_length=16, choices=JobKind.choices)
    status = models.CharField(
        max_length=16,
        choices=JobStatus.choices,
        default=JobStatus.QUEUED,
    )
    stage = models.CharField(
        max_length=16,
        choices=JobStage.choices,
        default=JobStage.QUEUED,
    )
    attempt = models.PositiveIntegerField(default=0)
    base_revision = models.PositiveIntegerField()
    payload = models.JSONField(default=dict)
    error = models.JSONField(null=True, blank=True)
    idempotency_key = models.CharField(max_length=255, null=True, blank=True)
    lease_expires_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["post", "idempotency_key"],
                condition=models.Q(idempotency_key__isnull=False),
                name="unique_post_idempotency_key",
            ),
        ]
        indexes = [
            models.Index(fields=["status", "created_at"]),
            models.Index(fields=["post", "status"]),
        ]


class Event(models.Model):
    id = models.BigAutoField(primary_key=True)
    created_at = models.DateTimeField(auto_now_add=True)
    type = models.CharField(max_length=64)
    post = models.ForeignKey(
        Post,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="events",
    )
    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="events",
    )
    data = models.JSONField(default=dict)

    class Meta:
        indexes = [
            models.Index(fields=["type", "-created_at"]),
            models.Index(fields=["post", "-created_at"]),
        ]
