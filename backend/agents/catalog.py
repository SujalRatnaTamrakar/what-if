"""Intervention catalog (§10.3). The model chooses FROM this catalog and fills
in specifics. It never invents a category.

``user_request`` is the resident's own wish: when their problem text asks for a
specific small physical change (a bench, a shelter, a bike rack…) the model
renders THAT instead of forcing it into a canopy/tree/sail. It is always shown
first (see ``analyze_scene``)."""

USER_REQUEST_ID = "user_request"

CATALOG = {
    "shade": [
        {
            "id": USER_REQUEST_ID,
            "title": "What the resident asked for",
            "base_goal": "the specific small physical change the resident described, if it is plausible in this scene",
        },
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
