+++
title = 'Future Collider Experiment'
category = 'software'
year = 2026
summary = "Une application de bureau pour explorer les collisions d'un futur collisionneur : on relie des blocs pour sélectionner des particules et une mesure apparaît."
links = [{ name = 'GitHub', url = 'https://github.com/kskovpen/fce' }, { name = 'PyPI', url = 'https://pypi.org/project/fce/' }]
weight = 3
+++

Le studio Future Collider Experiment (FCE) donne un avant-goût de la physique qui deviendra possible au Futur collisionneur circulaire (FCC), le successeur de 91 kilomètres envisagé pour le LHC au CERN. Il utilise des collisions simulées dans un futur détecteur.

Au lieu d'écrire du code d'analyse, on relie des blocs à l'écran : on choisit les données et l'énergie des collisions, on demande un nombre de particules, on ajoute des sélections, on choisit ce qu'on mesure, et un histogramme apparaît. Sur la capture d'écran, deux leptons sont combinés et leur masse fait apparaître le pic du boson Z.

Je l'ai créé pour les projets étudiants que j'ai encadrés à l'[école doctorale belgo-néerlando-allemande]({{< relref "/talks" >}}) en 2024 puis, dans une version avancée et améliorée, en 2026. Il fonctionne sous macOS, Windows et Linux et s'installe avec `pip install fce`.
