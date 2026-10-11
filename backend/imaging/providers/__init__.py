"""Render providers for the imaging module.

Each provider exposes::

    WORKFLOW_VERSION: str
    def render_at_work_size(work_source: Path, work_mask: Path, prompt,
                            *, seed: int, timeout_s: int) -> tuple[PIL.Image.Image, str]:
        ...

The returned image is the provider's edit at work size; the §11.4 step-4
composite (which enforces mask locality) is applied by ``imaging.render_edit``
for every provider.
"""
