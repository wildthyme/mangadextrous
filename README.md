# mangadextrous
this is a fairly simple script to download manga from mangadex and get new issues whenever rerun. the config should be put in `config.json` and looks like so:

```json
{
  "outputFolder": "./output",
  "23424": {
    "langCode": "gb",
    "volumes": {
      "1": 1,
      "2": 5,
      "3": 7,
      "4": 9,
      "5": 10,
      "6": 12
    }
  }
}
```

`outputFolder` is where images and cached chapter information will be stored. every other key in the config should be a mangadex manga id. each accepts a `langCode` to determine which language to get (defaults to english). `volumes` is optional, used for specifying the first chapter of each volume and referred to when mangadex doesn't have a volume listed. if it's left out, volume-less chapters of the manga will be put in volume 0.

also included is a bash script, `cbzgen.sh`, which runs manga downloads and then generates (or updates if already-existing) a cbz for each volume.

metadata is generated from mangadex and saved in the comicrack style of a `ComicInfo.xml` for each volume. currently what's probably the most annoying limitation is that covers aren't downloaded. mangadex only supplies a single cover of dubious authenticity for each manga (currently ignored), and though it also frequently stores per-volume covers, they aren't programattically accessible. you can download them yourself and put them into the chapter folder or volume cbz manually if you like; mangadextrous won't tamper with them.

