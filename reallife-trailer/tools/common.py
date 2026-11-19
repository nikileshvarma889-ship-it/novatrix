"""Shared config: reads .env (gitignored) or the environment. Keys are never printed or written elsewhere."""
import json, os, time, urllib.error, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
API = "https://generativelanguage.googleapis.com/v1beta"

def load_env():
    f = ROOT / ".env"
    if f.exists():
        for line in f.read_text().splitlines():
            if "=" in line and not line.lstrip().startswith("#"):
                k, v = line.split("=", 1)
                if v.strip() and not os.environ.get(k.strip()):
                    os.environ[k.strip()] = v.strip()

def key(name, fallback=None):
    load_env()
    v = os.environ.get(name) or (os.environ.get(fallback) if fallback else None)
    if not v:
        raise SystemExit(f"Missing {name}. Copy .env.example to .env and fill it in (see README.md).")
    return v

def setting(name, default):
    load_env(); return os.environ.get(name) or default

def board():
    return json.loads((ROOT / "storyboard.json").read_text())

def call(method, path, apikey, body=None, timeout=120, raw=False):
    req = urllib.request.Request(path if path.startswith("http") else f"{API}/{path}", method=method,
                                 data=json.dumps(body).encode() if body is not None else None,
                                 headers={"content-type": "application/json", "x-goog-api-key": apikey})
    for attempt in range(5):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                data = r.read()
                return data if raw else json.loads(data)
        except urllib.error.HTTPError as e:
            msg = e.read()[:500].decode(errors="replace")
            if e.code in (429, 500, 503, 504) and attempt < 4:
                time.sleep(10 * (attempt + 1)); continue
            raise SystemExit(f"HTTP {e.code} from {path.split('?')[0]}: {msg}")
        except (urllib.error.URLError, TimeoutError) as e:
            if attempt < 4: time.sleep(10 * (attempt + 1)); continue
            raise SystemExit(f"Network error calling {path}: {e}")
