+++
title = "{{ replace .Name "-" " " | title }}"
date = "{{ .Date }}"
draft = false
author = "Kirill Skovpen"
year = "{{ dateFormat "2006" .Date }}"
month = "{{ dateFormat "2006/01" .Date }}"
categories = ["Personal", "Thoughts"]
tags = ["software", "html"]
+++

Draft post text.

<!--more-->

Here is more text to read.