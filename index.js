const request = require('request');
const fs = require('fs');
const numeral = require('numeral');
const util = require('util');
const Bottleneck = require('bottleneck/es5');
const he = require('he');
const countryLanguage = require('country-language');
let configuredManga = require('./config.json');
let tags = require('./tags.json');
const outputFolder = typeof(configuredManga.outputFolder) == 'undefined' ? './output' : configuredManga.outputFolder;
delete configuredManga.outputFolder;
const limiter = new Bottleneck({
  minTime: 100,
  maxConcurrent: 5
});
function fetchOrLoad(path, fileName, url, isImage = false, dontRead = false) {
  return new Promise ((resolve, reject) => {
    let fullPath = path + '/' + fileName
    fs.access(fullPath, (err) => {
      if ((err && err.code === 'ENOENT' || dontRead) {
        if(!dontRead) {
          console.log('No existing file ' + fullPath);
        }
        let opts = {url: url};
        let encoding = 'utf8';
        if (isImage) {
          opts.encoding = null;
          let encoding = 'binary';
        }
        limiter.submit(request, opts, (err, response, body) => {
          if (err) reject(err);
          fs.mkdir(path, {recursive: true}, err => {
            if (err) console.error(err);
            fs.writeFile(fullPath, body, encoding, err => {
              console.log('Downloaded ' + fullPath);
            });
          });
          if(!isImage) {
            resolve(JSON.parse(body));
          } else {
            resolve(true);
          }
        });
      } else if (isImage) {
        console.log('Existing file ' + fullPath);
        resolve(true);
      } else {
        fs.readFile(fullPath, 'utf8', (err, file) => {
          console.log('Existing file ' + fullPath);
          resolve(JSON.parse(file));
        });
      }
    });
  });
}
function generateVolume (officialVolume, mangaID, chapter) {
  if (typeof(officialVolume) == 'undefined' || officialVolume == '') {
    if (typeof(configuredManga[mangaID].volumes) == 'undefined') {
      return '0';
    } else {
      return Math.max.apply(Math, Object.keys(configuredManga[mangaID].volumes).filter(element => {
        if (configuredManga[mangaID].volumes[element] <= parseFloat(chapter)) {
          return parseFloat(element);
        }
      })).toString();
    }
  } else { return officialVolume };
}
function getImages (chapters) {
  let images = new Array;
  chapters.forEach((item, index) => {
    item.page_array.forEach(page => {
      item.volume = generateVolume(item.volume, item.manga_id, item.chapter);
      if (typeof(item.title) != 'undefined' && item.title !== '') {
        item.titleString = ' - ' + item.title.replace(/\//g, '_');
      } else {
        item.titleString = '';
      }
      function padPage (match, offset, string) {
        return numeral(match).format('0000');
      }
      images.push({
        folder: util.format('%s/%s/vol%s/ch%s%s', outputFolder, item.manga_id, numeral(item.volume).format('000'), numeral(item.chapter).format('000.0'), item.titleString),
        fileName: util.format('vol%sch%s%s - %s', numeral(item.volume).format('000'), numeral(item.chapter).format('000.0'), item.titleString, page.replace(/^[A-Za-z]?(\d+)/, padPage)),
        url: item.server + item.hash + '/' + page
      });
    });
  });
  return Promise.all(images.map(image => {
    return fetchOrLoad(image.folder, image.fileName, image.url, true);
  }));
}
let mangas = Promise.all(Object.keys(configuredManga).map(mangaID => {
  configuredManga[mangaID].langCode = typeof(configuredManga[mangaID].langCode) == 'undefined' ? 'gb' : configuredManga[mangaID].langCode
  let manga = fetchOrLoad(outputFolder + '/json', mangaID + '.json', 'https://mangadex.org/api/manga/' + mangaID, false, true)
  manga.then((result) => {
    let chapterIDs = Object.keys(result.chapter).filter((chapter) => {
      return result.chapter[chapter].lang_code === configuredManga[mangaID].langCode;
    });
    Promise.all(chapterIDs.map(chapterID => {
      return fetchOrLoad(outputFolder + '/json', 'ch' + chapterID + '.json', 'https://mangadex.org/api/chapter/' + chapterID);
    })).then(chapters => {
      let uniqVols = [...new Set(chapters.map(chapter => {return generateVolume(chapter.volume, chapter.manga_id, chapter.chapter)}))].sort();
      let timestampedVols = uniqVols.map(vol => {
        let volChapters = chapters.filter(chapter => generateVolume(chapter.volume, chapter.manga_id, chapter.chapter) === vol);
        let timestamps = volChapters.map(chapter => chapter.timestamp);
        let timestamp = new Date(1000*Math.max.apply(Math, timestamps));
        return {
          vol: he.encode(vol),
          year: he.encode(timestamp.getFullYear().toString()),
          month: he.encode((timestamp.getMonth()+1).toString()),
          day: he.encode(timestamp.getUTCDate().toString())
        }
      });
      let languageISO = countryLanguage.getCountryLanguages(configuredManga[mangaID].langCode, (err, langs) => {
        if(!err && typeof(langs[0].iso639_1) != 'undefined') {
          return langs[0].iso639_1;
        } else {
          return '';
        }
      });
      let metadata = {
        series: he.encode(result.manga.title),
        artist: he.encode(result.manga.artist),
        writer: he.encode(result.manga.author),
        summary: he.encode(result.manga.description),
        web: he.encode('https://mangadex.org/title/' + mangaID),
        languageISO: he.encode(languageISO),
        volumes: timestampedVols,
        direction: result.manga.lang_name === 'Japanese' ? 'YesAndRightToLeft' : 'Yes',
        tags: result.manga.genres.reduce((acc, cur) => acc + ', ' + tags[cur].toLowerCase(), '').substring(2)
      };
      metadata.volumes.forEach(volume => {
        let title = metadata.volumes.length === 1 ? metadata.series : `${metadata.series} (${volume.vol})`
        let comicInfoXML = `<?xml version="1.0"?>
    <ComicInfo xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
      <Title>${title}</Title>
      <Series>${metadata.series}</Series>
      <Volume>${volume.vol}</Volume>
      <Summary>${metadata.summary}</Summary>
      <Year>${volume.year}</Year>
      <Month>${volume.month}</Month>
      <Day>${volume.day}</Day>
      <Writer>${metadata.writer}</Writer>
      <Penciller>${metadata.artist}</Penciller>
      <Inker>${metadata.artist}</Inker>
      <Genre>${metadata.tags}</Genre>
      <Web>${metadata.web}</Web>
      <LanguageISO>${metadata.languageISO}</LanguageISO>
      <Manga>${metadata.direction}</Manga>
    </ComicInfo>`
        console.log(comicInfoXML);

        let path = `${outputFolder}/${mangaID}/vol${numeral(volume.vol).format('000')}`
        fs.mkdir(path, {recursive: true}, err => {
          if (err) console.error(err);
          fs.writeFile(path + '/ComicInfo.xml', comicInfoXML, 'utf8', err => {
            console.log(`Saved metadata to ${path}/ComicInfo.xml`);
          });
        });

      });
      getImages(chapters);
    });
  });
  return manga;
}));
