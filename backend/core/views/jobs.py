"""E12 job status."""
from rest_framework.decorators import api_view
from rest_framework.response import Response

from core import serializers
from core.exceptions import ApiError
from core.models import Job
from core.permissions import require_auth


@api_view(["GET"])
def job_detail(request, job_id):
    user = require_auth(request)
    try:
        job = Job.objects.get(pk=job_id)
    except Job.DoesNotExist:
        raise ApiError("NOT_FOUND")
    if str(job.owner_id) != str(user.id):
        raise ApiError("NOT_FOUND", "Not found or not yours.")
    return Response(serializers.job_dict(job))
