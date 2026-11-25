#!/usr/bin/env python3
"""Local blog-post editor for the portfolio site.

Start it by double-clicking "Write a post.command" in the site folder (or run
`python3 tools/post-editor/server.py`). It opens a page in the browser where you
write a post, drop photos and pick rubrics. "Save" writes the files on this Mac,
"Publish" commits the post and pushes it to GitHub, after which Cloudflare Pages rebuilds
the site. A live preview runs at http://localhost:1313 while the editor is open.

Only listens on 127.0.0.1; every API call needs the per-session token embedded in
the page, so other websites cannot talk to it.
"""
import atexit, datetime, io, json, os, re, secrets, shutil, socket, subprocess, sys
import tempfile, tomllib, unicodedata, webbrowser
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
POSTS = os.path.join(ROOT, "content", "posts")
HERE = os.path.dirname(os.path.abspath(__file__))
PORT = int(os.environ.get("POST_EDITOR_PORT", "8724"))
HUGO_PORT = 1313
TOKEN = secrets.token_urlsafe(24)
LANGS = ["en", "fr", "nl", "ru"]
SHARED = ("date", "sections", "tags")        # kept identical in every language version
IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
CONVERT_EXT = {".heic", ".heif", ".tif", ".tiff"}
MAX_SIDE = 2400

# ---------------------------------------------------------------- front matter

def toml_value(v):
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return repr(v)
    if isinstance(v, (datetime.date, datetime.datetime)):
        return v.isoformat()
    if isinstance(v, (list, tuple)):
        return "[" + ", ".join(toml_value(x) for x in v) + "]"
    return json.dumps(str(v), ensure_ascii=False)


def read_post(path):
    with open(path, encoding="utf-8") as f:
        text = f.read()
    m = re.match(r"\+\+\+\s*\n(.*?)\n\+\+\+\s*\n?(.*)", text, re.S)
    if not m:
        return {}, text
    return tomllib.loads(m.group(1)), m.group(2)


def write_post(path, meta, body):
    order = ["title", "date", "draft", "sections", "tags"]
    keys = [k for k in order if k in meta] + [k for k in meta if k not in order]
    lines = []
    for k in keys:
        v = meta[k]
        if isinstance(v, dict) or v is None:
            continue
        if k in ("sections", "tags") and not v:
            continue
        lines.append(f"{k} = {toml_value(v)}")
    body = body.replace("\r\n", "\n").strip("\n")
    tmp = path + ".tmp~"                              # atomic: the live preview never sees half a file
    with open(tmp, "w", encoding="utf-8") as f:
        f.write("+++\n" + "\n".join(lines) + "\n+++\n\n" + body + "\n")
    os.replace(tmp, path)


def post_file(slug, lang):
    return os.path.join(POSTS, slug, "index.md" if lang == "en" else f"index.{lang}.md")

# ---------------------------------------------------------------- helpers

CYR = dict(zip("абвгдеёжзийклмнопрстуфхцчшщъыьэюя",
               "a b v g d e e zh z i y k l m n o p r s t u f kh ts ch sh shch - y - e yu ya".split()))


def slugify(title):
    s = "".join(CYR.get(c, c) for c in title.lower()).replace("-", " ")
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return "-".join(s.split("-")[:8]) or "post-" + datetime.date.today().strftime("%Y%m%d")


def valid_slug(slug):
    return bool(re.fullmatch(r"[a-z0-9][a-z0-9-]{0,80}", slug or ""))


def safe_name(name):
    stem, ext = os.path.splitext(os.path.basename(name))
    stem = unicodedata.normalize("NFKD", stem).encode("ascii", "ignore").decode().lower()
    stem = re.sub(r"[^a-z0-9]+", "-", stem).strip("-") or "photo"
    return stem[:60], ext.lower()


def now_iso(day=None):
    t = datetime.datetime.now().astimezone().replace(microsecond=0)
    if day:
        d = datetime.date.fromisoformat(day)
        t = t.replace(year=d.year, month=d.month, day=d.day, hour=12, minute=0, second=0)
    return t.isoformat()


def date_str(v):
    if isinstance(v, (datetime.date, datetime.datetime)):
        return v.isoformat()
    return str(v or "")


def git(*args, check=False):
    p = subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True)
    if check and p.returncode:
        raise RuntimeError((p.stdout + p.stderr).strip() or f"git {args[0]} failed")
    return p.stdout.strip()


def rubrics():
    with open(os.path.join(ROOT, "hugo.toml"), "rb") as f:
        cfg = tomllib.load(f)
    items = cfg.get("languages", {}).get("en", {}).get("menus", {}).get("main", [])
    return [{"key": m["identifier"], "label": m["name"]}
            for m in sorted(items, key=lambda m: m.get("weight", 0))
            if m.get("identifier") not in ("blog", "about")]


def list_posts():
    out, tags = [], set()
    for slug in sorted(os.listdir(POSTS)):
        d = os.path.join(POSTS, slug)
        if not os.path.isdir(d):
            continue
        entry = {"slug": slug, "langs": {}}
        for lang in LANGS:
            p = post_file(slug, lang)
            if os.path.exists(p):
                try:
                    meta, _ = read_post(p)
                except Exception:
                    meta = {}
                tags.update(meta.get("tags") or [])
                entry["langs"][lang] = {"title": meta.get("title", slug),
                                        "draft": bool(meta.get("draft", False)),
                                        "date": date_str(meta.get("date"))[:10]}
        if entry["langs"]:
            first = next(iter(entry["langs"].values()))
            entry["date"] = first["date"]
            out.append(entry)
    out.sort(key=lambda e: e.get("date", ""), reverse=True)
    return out, sorted(tags, key=str.lower)


def photos(slug):
    d = os.path.join(POSTS, slug)
    if not os.path.isdir(d):
        return []
    files = [f for f in os.listdir(d) if os.path.splitext(f)[1].lower() in IMAGE_EXT]
    for sub in ("images",):
        if os.path.isdir(os.path.join(d, sub)):
            files += [f"{sub}/{f}" for f in os.listdir(os.path.join(d, sub))
                      if os.path.splitext(f)[1].lower() in IMAGE_EXT]
    return sorted(files, key=lambda f: os.path.getmtime(os.path.join(d, f)))


def preview_url(slug, lang, date):
    year = (date or now_iso())[:4]
    prefix = "" if lang == "en" else f"/{lang}"
    return f"http://localhost:{HUGO_PORT}{prefix}/posts/{year}/{slug}/"


def git_status():
    ahead = git("rev-list", "--count", "@{u}..HEAD") or "0"
    return {"unpushed": int(ahead) if ahead.isdigit() else 0}


def store_photo(slug, filename, data):
    d = os.path.join(POSTS, slug)
    os.makedirs(d, exist_ok=True)
    stem, ext = safe_name(filename)
    with tempfile.TemporaryDirectory() as tmp:
        src = os.path.join(tmp, "in" + ext)
        with open(src, "wb") as f:
            f.write(data)
        if ext in CONVERT_EXT:                       # iPhone HEIC etc. -> JPEG via macOS sips
            conv = os.path.join(tmp, "in.jpg")
            subprocess.run(["sips", "-s", "format", "jpeg", src, "--out", conv],
                           capture_output=True, check=True)
            src, ext = conv, ".jpg"
        if ext not in IMAGE_EXT:
            raise ValueError("Not a photo: " + filename)
        out_ext = ".jpg" if ext == ".jpeg" else ext
        name = stem + out_ext
        n = 2
        while os.path.exists(os.path.join(d, name)):
            name, n = f"{stem}-{n}{out_ext}", n + 1
        dest = os.path.join(d, name)
        try:
            from PIL import Image, ImageOps            # resize, fix rotation, drop EXIF (incl. GPS)
            if out_ext == ".gif":
                raise ImportError
            im = ImageOps.exif_transpose(Image.open(src))
            im.thumbnail((MAX_SIDE, MAX_SIDE))
            if out_ext == ".jpg":
                im.convert("RGB").save(dest, "JPEG", quality=85, optimize=True, progressive=True)
            else:
                im.save(dest)
        except ImportError:
            shutil.copy(src, dest)
            if out_ext != ".gif":
                subprocess.run(["sips", "-Z", str(MAX_SIDE), dest], capture_output=True)
    return name

# ---------------------------------------------------------------- saving / publishing

def save(req, publish=False):
    slug, lang = req.get("slug") or "", req.get("lang", "en")
    title = (req.get("title") or "").strip()
    if not title:
        raise ValueError("The post needs a title.")
    if lang not in LANGS:
        raise ValueError("Unknown language.")
    new = not slug
    if new:
        slug = slugify(title)
        base, n = slug, 2
        while os.path.exists(os.path.join(POSTS, slug)) and req.get("created") != slug:
            slug, n = f"{base}-{n}", n + 1
    if not valid_slug(slug):
        raise ValueError("Bad post id.")
    os.makedirs(os.path.join(POSTS, slug), exist_ok=True)
    path = post_file(slug, lang)
    meta, _ = read_post(path) if os.path.exists(path) else ({}, "")
    old_date = date_str(meta.get("date"))
    day = req.get("date") or datetime.date.today().isoformat()
    meta["title"] = title
    meta["date"] = old_date if old_date[:10] == day else now_iso(day)
    meta["draft"] = False if publish else bool(req.get("draft", True))
    meta["sections"] = [s for s in req.get("sections", []) if isinstance(s, str)]
    meta["tags"] = [t.strip() for t in req.get("tags", []) if isinstance(t, str) and t.strip()]
    write_post(path, meta, req.get("body", ""))
    for other in LANGS:                               # keep date / rubrics / tags in sync
        op = post_file(slug, other)
        if other != lang and os.path.exists(op):
            om, ob = read_post(op)
            for k in SHARED:
                om[k] = meta[k]
            write_post(op, om, ob)
    result = {"slug": slug, "preview": preview_url(slug, lang, meta["date"])}
    if publish:
        rel = os.path.relpath(os.path.join(POSTS, slug), ROOT)
        git("add", "-A", "--", rel, check=True)
        if git("diff", "--cached", "--name-only", "--", rel):
            verb = "Update" if git("log", "-1", "--format=%h", "--", rel) else "New post"
            git("commit", "-m", f"{verb}: {title}", "--", rel, check=True)
        p = subprocess.run(["git", "push"], cwd=ROOT, capture_output=True, text=True)
        if p.returncode:
            raise RuntimeError("Saved and committed, but pushing to GitHub failed:\n" + p.stderr.strip())
        result["published"] = True
        result["live"] = "https://kirillskovpen.pages.dev" + result["preview"].split(str(HUGO_PORT), 1)[1]
    return result

# ---------------------------------------------------------------- HTTP

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _ok_origin(self):
        host = self.headers.get("Host", "")
        return host in (f"127.0.0.1:{PORT}", f"localhost:{PORT}")

    def _send(self, code, body, ctype="application/json"):
        if isinstance(body, (dict, list)):
            body = json.dumps(body, ensure_ascii=False)
        if isinstance(body, str):
            body = body.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _authed(self, q):
        return self._ok_origin() and (self.headers.get("X-Token") == TOKEN or q.get("t", [""])[0] == TOKEN)

    def do_GET(self):
        u = urlparse(self.path)
        q = parse_qs(u.query)
        if not self._ok_origin():
            return self._send(403, {"error": "forbidden"})
        if u.path == "/":
            with open(os.path.join(HERE, "index.html"), encoding="utf-8") as f:
                return self._send(200, f.read().replace("__TOKEN__", TOKEN), "text/html; charset=utf-8")
        if not self._authed(q):
            return self._send(403, {"error": "forbidden"})
        try:
            if u.path == "/api/state":
                posts, tags = list_posts()
                return self._send(200, {"posts": posts, "tags": tags, "rubrics": rubrics(),
                                        "langs": LANGS, "git": git_status()})
            if u.path == "/api/post":
                slug, lang = q["slug"][0], q.get("lang", ["en"])[0]
                if not valid_slug(slug) or lang not in LANGS:
                    raise ValueError("bad request")
                path = post_file(slug, lang)
                data = {"slug": slug, "lang": lang, "exists": os.path.exists(path),
                        "photos": photos(slug)}
                src = path if data["exists"] else next(
                    (post_file(slug, l) for l in LANGS if os.path.exists(post_file(slug, l))), None)
                meta, body = read_post(src) if src else ({}, "")
                data.update(date=date_str(meta.get("date"))[:10],
                            sections=meta.get("sections") or [], tags=meta.get("tags") or [],
                            title=meta.get("title", "") if data["exists"] else "",
                            body=body if data["exists"] else "",
                            draft=bool(meta.get("draft", False)) if data["exists"] else True,
                            preview=preview_url(slug, lang, date_str(meta.get("date"))))
                return self._send(200, data)
            if u.path == "/photo":
                slug, name = q["slug"][0], q["name"][0]
                path = os.path.realpath(os.path.join(POSTS, slug, name))
                if not valid_slug(slug) or not path.startswith(os.path.realpath(os.path.join(POSTS, slug)) + os.sep):
                    raise ValueError("bad request")
                ext = os.path.splitext(path)[1].lower().lstrip(".")
                with open(path, "rb") as f:
                    return self._send(200, f.read(), "image/" + {"jpg": "jpeg"}.get(ext, ext))
        except (KeyError, ValueError, FileNotFoundError) as e:
            return self._send(400, {"error": str(e)})
        self._send(404, {"error": "not found"})

    def do_POST(self):
        u = urlparse(self.path)
        q = parse_qs(u.query)
        if not self._authed(q):
            return self._send(403, {"error": "forbidden"})
        data = self.rfile.read(int(self.headers.get("Content-Length", 0)))
        try:
            if u.path == "/api/upload":
                slug = q["slug"][0]
                if not valid_slug(slug):
                    raise ValueError("Save the post once before adding photos.")
                return self._send(200, {"name": store_photo(slug, q["name"][0], data)})
            req = json.loads(data or b"{}")
            if u.path == "/api/save":
                return self._send(200, save(req))
            if u.path == "/api/publish":
                return self._send(200, save(req, publish=True))
            if u.path == "/api/delete-photo":
                slug, name = req["slug"], req["name"]
                path = os.path.realpath(os.path.join(POSTS, slug, name))
                if not valid_slug(slug) or not path.startswith(os.path.realpath(os.path.join(POSTS, slug)) + os.sep):
                    raise ValueError("bad request")
                os.remove(path)
                return self._send(200, {"ok": True})
        except Exception as e:
            return self._send(400, {"error": str(e)})
        self._send(404, {"error": "not found"})

# ---------------------------------------------------------------- main

def port_open(port):
    with socket.socket() as s:
        s.settimeout(0.3)
        return s.connect_ex(("127.0.0.1", port)) == 0


def main():
    if port_open(PORT):
        print(f"The editor is already running: http://127.0.0.1:{PORT}/ — opening it.")
        webbrowser.open(f"http://127.0.0.1:{PORT}/")
        return
    if not port_open(HUGO_PORT) and shutil.which("hugo"):
        log = open(os.path.join(tempfile.gettempdir(), "post-editor-hugo.log"), "w")
        hugo = subprocess.Popen(["hugo", "server", "--buildDrafts", "--disableFastRender",
                                 "--renderToMemory", "--port", str(HUGO_PORT)],
                                cwd=ROOT, stdout=log, stderr=subprocess.STDOUT)
        atexit.register(hugo.terminate)
        print(f"Preview of the site: http://localhost:{HUGO_PORT}/  (drafts included)")
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    url = f"http://127.0.0.1:{PORT}/"
    print(f"Post editor: {url}\nKeep this window open while writing; close it (or press Ctrl+C) when done.")
    webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
