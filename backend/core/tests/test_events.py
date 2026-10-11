from unittest.mock import patch

from django.test import TestCase, override_settings

from core.models import Event
from core.services.events import record


class EventServiceTests(TestCase):
    @override_settings(ANALYTICS_ENABLED=True)
    def test_record_creates_event(self):
        event = record("post_created", data={"source": "test"})

        if event is None:
            self.fail("record() should return the created event")
        self.assertEqual(Event.objects.count(), 1)
        self.assertEqual(event.type, "post_created")
        self.assertEqual(event.data, {"source": "test"})

    @override_settings(ANALYTICS_ENABLED=False)
    def test_record_is_noop_when_analytics_is_disabled(self):
        event = record("post_created", data={"source": "test"})

        self.assertIsNone(event)
        self.assertFalse(Event.objects.exists())

    @override_settings(ANALYTICS_ENABLED=True)
    @patch("core.services.events.Event.objects.create", side_effect=RuntimeError("database unavailable"))
    def test_record_logs_failure_without_raising(self, create_event):
        with self.assertLogs("core.services.events", level="ERROR") as logs:
            event = record("post_created")

        self.assertIsNone(event)
        create_event.assert_called_once()
        self.assertIn("Failed to record analytics event", logs.output[0])
