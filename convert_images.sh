#!/bin/bash

files=$(find "content" -type f -name "*.pdf")
for f in ${files[@]}
do
  fpng=$(echo $f | sed "s%.pdf%.png%g")
  if ! test -f ${fpng}; then
    magick -density 300 -trim -quality 100 $f $fpng
  fi
done