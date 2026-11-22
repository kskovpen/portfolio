+++
title = "{{ replace .File.ContentBaseName "-" " " | title }}"
date = "{{ .Date }}"
draft = true
summary = 'One sentence shown on the card.'
# Places shown on the travel map (decimal degrees)
places = [
  { name = 'Geneva', lat = 46.204, lon = 6.143 },
]
+++

The story of the trip. Put cover.jpg in this folder for the card image;
all other photos in this folder become the trip's gallery (captions come from file names,
e.g. "Lake Geneva at sunset.jpg").
