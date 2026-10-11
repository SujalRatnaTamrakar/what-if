"""Intervention catalog (§10.3). The model chooses FROM this catalog and fills
in specifics. It never invents a category."""

CATALOG = {
    "shade": [
        {
            "id": "shade_canopy",
            "title": "Shade canopy",
            "base_goal": "a freestanding slim-post shade canopy",
        },
        {
            "id": "shade_tree",
            "title": "Street tree",
            "base_goal": "a medium street tree in a tree pit",
        },
        {
            "id": "shade_sail",
            "title": "Shade sail",
            "base_goal": "a tensioned fabric shade sail on posts",
        },
    ]
}
