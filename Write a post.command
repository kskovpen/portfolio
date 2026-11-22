#!/bin/bash
# Double-click in Finder: opens the post editor in the browser (and a live preview of the site).
cd "$(dirname "$0")" && exec python3 tools/post-editor/server.py
