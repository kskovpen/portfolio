+++
title = "{{ replace .File.ContentBaseName "-" " " | title }}"
date = "{{ .Date }}"
draft = true
category = 'software'   # software | electronics | games (any word works; it becomes a filter button)
year = {{ now.Year }}
summary = 'One sentence shown on the card.'
# github = 'https://github.com/kskovpen/...'   # hides the repo from the "More code" list
links = [
  # { name = 'Play on itch.io', url = 'https://...' },
  # { name = 'Code on GitHub', url = 'https://github.com/kskovpen/...' },
]
weight = 100
+++

Describe the project. Put a cover.jpg in this folder for the card image;
any other images in the folder become the gallery.
