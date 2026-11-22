+++
title = "{{ replace .File.ContentBaseName "-" " " | title }}"
date = "{{ .Date }}"
draft = true
kind = 'track'   # track | album | live | cover ...
summary = 'One sentence shown on the card.'
links = [
  # { name = 'Listen on Bandcamp', url = 'https://...' },
  # { name = 'SoundCloud', url = 'https://...' },
]
+++

A few words about it. Put a cover.jpg in this folder.
To embed a YouTube video: {{"{{"}}< youtube VIDEO_ID >{{"}}"}}
