from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.models import PermissionsMixin
from django.db import models


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
