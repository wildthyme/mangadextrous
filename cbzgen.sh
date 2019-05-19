#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
outputFolder=`node -pe 'JSON.parse(process.argv[1]).outputFolder' "$(cat $DIR/config.json)"`
node $DIR/index.js
for i in `ls -1 "$outputFolder"`; do
  if [[ $i != json ]]; then
    for j in `ls -1 "$outputFolder/$i"`; do
      zip -ju "$outputFolder/$i$j.cbz" "$outputFolder/$i/$j/"*/*
  done;
  fi;
done