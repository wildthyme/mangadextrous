const request = require('request');
const fs = require('fs');
const numeral = require('numeral');
const util = require('util');
const Bottleneck = require('bottleneck/es5');
let configuredManga = require('./config.json');
configuredManga.outputFolder = typeof(configuredManga.outputFolder) == 'undefined' ? './output' : configuredManga.outputFolder
const limiter = new Bottleneck({
  minTime: 100,
  maxConcurrent: 5
});
function fetchOrLoad(path, fileName, url, isImage = false, writeFile = true) {
  return new Promise ((resolve, reject) => {
    let fullPath = path + '/' + fileName
    fs.access(fullPath, (err) => {
      if (err && err.code === 'ENOENT') {
        if(writeFile) {
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
          if (writeFile) {
            fs.mkdir(path, {recursive: true}, err => {
              if (err) console.error(err);
              fs.writeFile(fullPath, body, encoding, err => {
                console.log('Downloaded ' + fullPath);
              });
            });
          }
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
function getChapters (chapterIDs) {
  return Promise.all(chapterIDs.map(chapterID => {
    return fetchOrLoad(configuredManga.outputFolder + '/json', 'ch' + chapterID + '.json', 'https://mangadex.org/api/chapter/' + chapterID);
  }));
}
function getImages (chapters) {
  let images = new Array;
  chapters.forEach((item, index) => {
    item.page_array.forEach(page => {
      if (typeof(item.volume) == 'undefined' || item.volume == '') {
        if (typeof(configuredManga[item.manga_id].volumes) == 'undefined') {
          item.volume = '0';
        } else {
          item.volume = Math.max.apply(Math, Object.keys(configuredManga[item.manga_id].volumes).filter(element => {
            if (configuredManga[item.manga_id].volumes[element] <= parseFloat(item.chapter)) {
              return parseFloat(element);
            }
          })).toString();
        }
      }
      if (typeof(item.title) != 'undefined' && item.title !== '') {
        item.titleString = ' - ' + item.title.replace(/\//g, '_');
      } else {
        item.titleString = '';
      }
      function padPage (match, offset, string) {
        return numeral(match).format('0000');
      }
      images.push({
        folder: util.format('%s/%s/vol%s/ch%s%s', configuredManga.outputFolder, item.manga_id, numeral(item.volume).format('000'), numeral(item.chapter).format('000.0'), item.titleString),
        fileName: util.format('vol%sch%s%s - %s', numeral(item.volume).format('000'), numeral(item.chapter).format('000.0'), item.titleString, page.replace(/^[A-Za-z]?(\d+)/, padPage)),
        url: item.server + item.hash + '/' + page
      });
    });
  });
  return Promise.all(images.map(image => {
    return fetchOrLoad(image.folder, image.fileName, image.url, true);
  }));
}
Object.keys(configuredManga).forEach(mangaID => {
  if (mangaID !== 'outputFolder') {
    configuredManga[mangaID].langCode = typeof(configuredManga[mangaID].langCode) == 'undefined' ? 'gb' : configuredManga[mangaID].langCode
    fetchOrLoad(configuredManga.outputFolder + '/json', mangaID + '.json', 'https://mangadex.org/api/manga/' + mangaID, false, false).then((result) => {
      let chapters = getChapters(Object.keys(result.chapter).filter((chapter) => {
        return result.chapter[chapter].lang_code === configuredManga[mangaID].langCode;
      }));
      chapters.then(result => {
        getImages(result);
      });
    });
  }
});
