"""Drive the live generate flow over HTTP: photo + mask + prompt in, reimagined image out.

Requires the API (runserver) and the worker (run_worker) running, with DJANGO_DEBUG=true and
AUTH_DEV_BYPASS=true in backend/.env (auth is via the X-Dev-User header).

    python scripts/try_generate.py --image shared/demo/bus_stop.jpg --mask shared/demo/bus_stop_mask.png \
        --prompt "This bus stop needs a roof/shed" --out concept.png
"""
import argparse
import io
import sys
import time
import uuid
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

import requests
from PIL import Image


def check(resp, expected):
    if resp.status_code != expected:
        sys.exit(f"{resp.request.method} {resp.url} -> {resp.status_code}: {resp.text}")
    return resp.json()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--api", default="http://localhost:8000/api/v1")
    ap.add_argument("--user", default="tester")
    ap.add_argument("--image", required=True)
    ap.add_argument("--mask", required=True, help="PNG, white = area to change")
    ap.add_argument("--prompt", required=True)
    ap.add_argument("--place", default="")
    ap.add_argument("--out", default="concept.png")
    ap.add_argument("--timeout", type=int, default=300)
    args = ap.parse_args()

    s = requests.Session()
    s.headers["X-Dev-User"] = args.user

    with open(args.image, "rb") as f:
        post = check(s.post(f"{args.api}/posts", files={"photo": f},
                            data={"placeLabel": args.place, "locationSource": "none", "consent": "true"}), 201)
    print(f"post {post['id']} created, source {post['source']['width']}x{post['source']['height']}")

    # The server resizes/rotates the photo, so resize the mask to the sanitized source size.
    size = (post["source"]["width"], post["source"]["height"])
    mask = Image.open(args.mask).convert("L").resize(size, Image.NEAREST)
    buf = io.BytesIO()
    mask.save(buf, format="PNG")
    buf.seek(0)
    saved = check(s.post(f"{args.api}/posts/{post['id']}/mask", files={"mask": ("mask.png", buf, "image/png")},
                         data={"expectedRevision": post["revision"]}), 201)

    job = check(s.post(f"{args.api}/posts/{post['id']}/generate",
                       json={"prompt": args.prompt, "maskAssetId": saved["assetId"],
                             "expectedRevision": saved["revision"]},
                       headers={"Idempotency-Key": str(uuid.uuid4())}), 202)

    start, last_stage = time.time(), None
    while True:
        status = check(s.get(f"{args.api}/jobs/{job['jobId']}"), 200)
        if status["stage"] != last_stage:
            print(f"  [{time.time() - start:5.1f}s] {status['status']} / {status['stage']}")
            last_stage = status["stage"]
        if status["status"] == "succeeded":
            break
        if status["status"] == "failed":
            sys.exit(f"job failed: {status['error']}")
        if time.time() - start > args.timeout:
            sys.exit("timed out waiting for job (is run_worker running?)")
        time.sleep(2)

    result = check(s.get(f"{args.api}/posts/{post['id']}"), 200)
    # Fetch through the --api host even if PUBLIC_BASE_URL points elsewhere (e.g. a tunnel).
    api, url = urlsplit(args.api), urlsplit(result["concept"]["url"])
    img = s.get(urlunsplit((api.scheme, api.netloc, url.path, url.query, "")))
    img.raise_for_status()
    Path(args.out).write_bytes(img.content)
    gen, review = result["generation"], result["review"]
    print(f"title:    {result['title']}")
    print(f"render:   {gen['provider']} / {gen['model']} in {gen['durationMs']} ms")
    print(f"review:   {review['verdict']} {[f['code'] for f in review['flags']]}")
    print(f"saved:    {args.out}")


if __name__ == "__main__":
    main()
