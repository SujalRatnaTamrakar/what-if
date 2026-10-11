"""WhatIf API routes — /api/v1, NO trailing slash (§5.1)."""
from django.urls import path

from core.views import config as v_config
from core.views import health as v_health
from core.views import jobs as v_jobs
from core.views import me as v_me
from core.views import media as v_media
from core.views import packet as v_packet
from core.views import proposals as v_proposals
from core.views import stats as v_stats
from core.views import support as v_support

urlpatterns = [
    # E1, E2
    path("api/v1/health", v_health.health, name="health"),
    path("api/v1/config", v_config.public_config, name="public-config"),
    # E3, E4
    path("api/v1/me", v_me.me, name="me"),
    # E5, E6
    path("api/v1/proposals", v_proposals.proposals, name="proposals"),
    # E7, E8
    path("api/v1/proposals/<uuid:proposal_id>", v_proposals.proposal_detail, name="proposal-detail"),
    # E9, E10, E11, E13, E14, E15, E16
    path("api/v1/proposals/<uuid:proposal_id>/analyze", v_proposals.reanalyze, name="proposal-analyze"),
    path("api/v1/proposals/<uuid:proposal_id>/mask", v_proposals.save_mask, name="proposal-mask"),
    path("api/v1/proposals/<uuid:proposal_id>/preview", v_proposals.request_preview, name="proposal-preview"),
    path("api/v1/proposals/<uuid:proposal_id>/publish", v_proposals.publish, name="proposal-publish"),
    path("api/v1/proposals/<uuid:proposal_id>/support", v_support.support, name="proposal-support"),
    path("api/v1/proposals/<uuid:proposal_id>/packet", v_packet.export_packet, name="proposal-packet"),
    # E12
    path("api/v1/jobs/<uuid:job_id>", v_jobs.job_detail, name="job-detail"),
    # E17, E18
    path("api/v1/media/<uuid:asset_id>", v_media.serve_media, name="media"),
    path("api/v1/packets/<uuid:packet_id>.pdf", v_media.serve_packet, name="packet-pdf"),
    # E19
    path("api/v1/stats", v_stats.stats, name="stats"),
]
