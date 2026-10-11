"""E19 analytics (stretch).

Uses the Support table as the source of truth for hourly buckets (works on
sqlite and Postgres). When the Timescale hypertable migration lands (§9.5
step 7), switch supportsByHour to time_bucket() over core_event.
"""
from datetime import timedelta, timezone as dt_utc

from django.db.models import Count
from django.db.models.functions import TruncHour
from django.utils import timezone
from rest_framework.decorators import api_view
from rest_framework.response import Response

from core.models import Proposal, Support


def _bucket_key(dt) -> str:
    return dt.astimezone(dt_utc.utc).strftime("%Y-%m-%dT%H:00:00Z")


@api_view(["GET"])
def stats(request):
    now = timezone.now()
    start = now - timedelta(hours=24)
    buckets = (
        Support.objects.filter(created_at__gte=start)
        .annotate(bucket=TruncHour("created_at"))
        .values("bucket")
        .annotate(count=Count("id"))
        .order_by("bucket")
    )
    by_hour = {_bucket_key(b["bucket"]): b["count"] for b in buckets}
    series = []
    cursor = start.replace(minute=0, second=0, microsecond=0)
    while cursor <= now:
        key = _bucket_key(cursor)
        series.append({"bucket": key, "count": by_hour.get(key, 0)})
        cursor += timedelta(hours=1)
    return Response(
        {
            "proposalsPublished": Proposal.objects.filter(status="published").count(),
            "supportsTotal": Support.objects.count(),
            "supportsByHour": series,
        }
    )
