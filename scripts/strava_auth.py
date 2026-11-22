#!/usr/bin/env python3
"""One-time Strava authorization for the Run page.

Run it in your own terminal from the site folder:  python3 scripts/strava_auth.py
It asks for the API app's Client ID and Client Secret, opens Strava's approval page,
catches the redirect on http://localhost:8723, and stores the three values:
  - as Netlify environment variables (via the netlify CLI), and
  - in .env.strava (git-ignored, readable only by you) for local builds.
Requested scopes: read, activity:read (public and followers activities; the site shows only public ones).
"""
import getpass
import http.server
import json
import os
import subprocess
import sys
import urllib.parse
import urllib.request
import webbrowser

PORT = 8723
REDIRECT = f"http://localhost:{PORT}/callback"


def main():
    client_id = input("Strava Client ID: ").strip()
    client_secret = getpass.getpass("Strava Client Secret (hidden): ").strip()
    url = "https://www.strava.com/oauth/authorize?" + urllib.parse.urlencode({
        "client_id": client_id, "response_type": "code", "redirect_uri": REDIRECT,
        "approval_prompt": "force", "scope": "read,activity:read"})

    result = {}

    class Handler(http.server.BaseHTTPRequestHandler):
        def do_GET(self):
            q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            result.update({k: v[0] for k, v in q.items()})
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write("<p>Done. You can close this tab and go back to the terminal.</p>".encode())

        def log_message(self, *args):
            pass

    print("\nOpening Strava in your browser. Approve access, then come back here.")
    print(f"If nothing opens, visit:\n{url}\n")
    webbrowser.open(url)
    with http.server.HTTPServer(("localhost", PORT), Handler) as srv:
        while "code" not in result and "error" not in result:
            srv.handle_request()
    if "error" in result:
        sys.exit(f"Strava returned an error: {result['error']}")
    if "activity:read" not in result.get("scope", ""):
        sys.exit("Activity access was not granted (the 'View data about your activities' box must stay ticked).")

    body = urllib.parse.urlencode({"client_id": client_id, "client_secret": client_secret,
                                   "code": result["code"], "grant_type": "authorization_code"}).encode()
    tok = json.load(urllib.request.urlopen("https://www.strava.com/oauth/token", data=body, timeout=30))
    values = {"STRAVA_CLIENT_ID": client_id, "STRAVA_CLIENT_SECRET": client_secret,
              "STRAVA_REFRESH_TOKEN": tok["refresh_token"]}

    fd = os.open(".env.strava", os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w") as f:
        f.writelines(f"export {k}='{v}'\n" for k, v in values.items())
    print("Saved .env.strava (local builds).")

    for k, v in values.items():
        subprocess.run(["netlify", "env:set", k, v], check=True, stdout=subprocess.DEVNULL)
    print("Saved STRAVA_* variables in Netlify. All set.")


if __name__ == "__main__":
    main()
