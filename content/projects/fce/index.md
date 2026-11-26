+++
title = 'Future Collider Experiment'
category = 'software'
year = 2026
summary = "A desktop app to explore collisions at a future collider: connect building blocks to select particles, and watch a measurement appear."
links = [{ name = 'GitHub', url = 'https://github.com/kskovpen/fce' }, { name = 'PyPI', url = 'https://pypi.org/project/fce/' }]
weight = 3
+++

The Future Collider Experiment (FCE) studio gives a sneak peek into the physics that will become possible at the Future Circular Collider (FCC), the proposed 91-kilometre successor of the LHC at CERN. It works with simulated collisions of a future detector.

Instead of writing analysis code, you connect building blocks on the screen: choose the data and the collision energy, ask for a number of particles, add selections, pick what to measure, and a histogram appears. In the screenshot, two leptons are combined and their mass shows the peak of the Z boson.

I made it for the student projects I led at the [Belgian–Dutch–German graduate school]({{< relref "/talks" >}}) in 2024 and, in an advanced and improved version, in 2026. It runs on macOS, Windows and Linux and installs with `pip install fce`.
