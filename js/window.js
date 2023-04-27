// These are variables to indicate our user's settings. They are assigned from the BroadcastChannel message.
let startingUrlInput;
let depthInput;
let omitImgs;
// initializes empty lists for duplicate checking
let urlList = [];
let urlCSS = [];
let urlImage = [];
let urlVideo = [];
let urlJS = [];
let urlPdf = [];

const bc = new BroadcastChannel('scraper_data');

// Receive the message from the popup.js which contains the user's scraping settings
bc.addEventListener('message', async (event) => {
  startingUrlInput = event.data[0];
  depthInput = event.data[1];
  omitImgs = event.data[2];
  setFlagDownload('True');
  await saveAs();
});

let extId = chrome.runtime.id; // Get the extension's ID

let depth = 0; //sets the default depth of the crawl
let zip = new JSZip(); //creates a new file to hold the zipped contents

async function saveAs() {
  //Set the user interface before downloading
  showProgressBar(0,true);
  document.getElementById('spinner').hidden = false;

  //Getting all links in to urlList
  await get_HTMLlinks(startingUrlInput, depthInput);

  //Download on promise batch
  await downloadHTML();
}

//Download html in the urlList
async function downloadHTML() {
  const maxDownloads = 50; // maximum number of downloads at a time
  const promises = [];

  for (let i = 0; i < urlList.length; i += maxDownloads) {
    const downloadBatch = urlList.slice(i, i + maxDownloads); // get a batch of URLs to download

    // create an array of promises for the batch of downloads
    const batchPromises = downloadBatch.map(async (urlElement) => {
      try {
        const html_response = await scrapeHtml(
          urlElement.url,
          urlElement.depth
        );
        if (html_response) {
          const myBlob = new Blob([html_response], { type: 'text/plain' });

          if (urlElement.depth == 0) {
            zip.file(getTitle(urlElement.url) + '.html', myBlob); // Puts the starting webpage in the main directory
          } else {
            zip.file('html/' + getTitle(urlElement.url) + '.html', myBlob); //The rest of the links are placed in the html folder
          }
          return myBlob;
        }
      } catch (error) {
        console.error(error);
      }
    });
    const batchResults = await Promise.all(batchPromises);
    promises.push(...batchResults);
    showProgressBar(i, 0);
  }

  // use Promise.all to wait for all of the download batches to complete
  const results = await Promise.all(promises);

  // results is an array of all downloaded files
  console.log('All downloads completed');

  // call zipFile() after all downloads have completed
  await zipFile();
  showProgressBar(100, true);
}

async function zipFile() {
  console.log('loop is finished'); //scraping of all pages is done
  let zipName = new URL(startingUrlInput).hostname;
  zip.generateAsync({ type: 'blob' }).then(function (content) {
    //Block of Code Downloads the zip
    let urlBlob = URL.createObjectURL(content); //
    chrome.downloads
      .download({
        url: urlBlob,
        filename: zipName + '.zip',
        saveAs: true,
      })
      .catch(
        (err) =>
          (document.getElementById('current-progress').innerText = 'error')
      );

    document.getElementById('current-progress').innerText =
      'Done. Please unzip file before using.'; //Informs user of successful download
    document.getElementById('spinner').hidden = true;
    setFlagDownload('False');
  });
  zip = new JSZip(); //Clears the zip for future use
}
// crawl all the link of the webpage
const get_HTMLlinks = async (startUrlInput, depthInput) => {
  urlList.push({ url: startUrlInput, depth: 0 }); //sets the first url to the depth of 0
  for (const element of urlList) {
    //console.log('element url : ' + element.url);
    if (element.depth <= depthInput) {
      let html = await getData(element.url);
      var parser = new DOMParser();
      var parsed = parser.parseFromString(html, 'text/html');
      var links = parsed.getElementsByTagName('a');
      for (var j = 0; j < links.length; j++) {
        let relative = links[j].getAttribute('href'); // Given a relative path
        let link = links[j].href; //Given a link
        // if link does not contains any string belongs to "mailto", "tel", and "#", then scrape file.
        // if the resulting link is not one that is currently in the list
        if (
          link.toString().search('mailto') !== -1 ||
          link.toString().search('tel') !== -1 ||
          link.toString().search('#') !== -1 ||
          link.length === 0
        )
          continue;

        //checks if the link is in the correct format
        if (link.search('chrome-extension://' + extId) !== -1)
          link = getAbsolutePath(relative, element.url);
        if (!checkDuplicate(link, urlList))
          urlList.push({ url: link, depth: element.depth + 1 }); //push it to the list. thus setting it up for more scraping
      }
    }
  }
  showProgressBar(5, true);
  console.log('length of urlList : ' + urlList.length);
};
// Show progress bar
function showProgressBar(value, boolConstant) {
  if (boolConstant == true) {
    document.getElementById('current-progress').innerText =
      'Progress: ' + value.toString() + '%';
    document.getElementById('progress-bar').style =
      'width:' + value.toString() + '%';
  } else {
    document.getElementById('current-progress').innerText =
      'Progress: ' +
      Math.ceil((value / urlList.length) * 90 + 5).toString() +
      '%';
    document.getElementById('progress-bar').style =
      'width:' + Math.ceil((value / urlList.length) * 90 + 5).toString() + '%';
  }
}
// Set flag download
function setFlagDownload(bool) {
  chrome.storage.sync.set({ flagDownload: bool });
}
//given the url, makes url availible for file system naming conventions, used for html files, css files, and image files
function getTitle(url) {
  url = url.toString();
  url = url.substring(8);
  if (url.length >= 70) url = url.substring(url.length - 70);
  url = url.replace(/[^a-zA-Z0-9 ]/g, '_');
  return url;
}
//Method that makes requests to the get html,css,and image blobs
let getData = async (url) => {
  let result = '';
  try {
    result = $.get(url);
  } catch (e) {
    return 'Failed';
  }
  return result;
};
// Check a url for working
let checkUrl = async (url) => {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    if (response.ok) {
      return true;
    } else {
      return false;
    }
  } catch (error) {
    console.error('Error:', error);
  }
};
function getAbsolutePath(relPath, baseUrl) {
  // To get absolute path, we need use URL class to concat a relative path and an absolute path
  /** 
  // Example
  // new URL("../mypath","http://www.stackoverflow.com/search").href
  //=> "http://www.stackoverflow.com/mypath"  
  */

  let URLconcat = new URL(relPath, baseUrl);
  return URLconcat;
}
//checks a url for a duplicate url
function checkDuplicate(e, list) {
  for (let i = 0; i < list.length; i++) {
    if (e.toString() === list[i].url.toString()) {
      return true;
    }
  }
  return false;
}
// //checks the href of the link for a duplicate file
// function checkDuplicateLink(e, list) {
//   for (let i = 0; i < list.length; i++) {
//     if (e.toString() === list[i].url.toString()) {
//       console.log("dupplicate href "+e.href);
//       console.log("duplicate "+ e);
//       return true;
//     }
//   }
//   return false;
// }
//GIVEN THE URL AND URL_DEPTH, updates the zip files and adds more urls to the list
async function scrapeHtml(url, urlDepth) {
  console.log('going to scrape html : ' + url);
  let html = ''; //starts the
  // Asynchronous function to retrieve CSS from links
  async function getCSS(html) {
    let dp = new DOMParser();
    let PARSEDHTML = dp.parseFromString(html, 'text/html');
    let linkElements = PARSEDHTML.getElementsByTagName('link');
    for (const elementRef of linkElements) {
      // Create a dummy element to transfer <link> tag href to an <a> tag
      // so that JQuery can identify its protocol, hostname, and pathname etc.
      if (elementRef.getAttribute('rel') !== 'stylesheet') continue;
      // The important of getAttribute is that the return is relative path.
      let relativePath = elementRef.getAttribute('href');
      let element = elementRef.href;
      if (relativePath.search('https://') === -1) {
        //Change path to absolute path if it's relative
        element = getAbsolutePath(relativePath, url);
      }
      let cssFile = getTitle(element);
      if (urlDepth >= 1) {
        elementRef.setAttribute('href', '../css/' + cssFile + '.css');
      } else {
        elementRef.setAttribute('href', 'css/' + cssFile + '.css');
      }
      html = PARSEDHTML.documentElement.innerHTML; //updates the current html
      if (checkDuplicate(element, urlCSS)) continue;
      try {
        urlCSS.push({ url: element });

        let cssText = await getData(element);
        if (cssText === 'Failed') continue;

        cssText = await getCSSImg(cssText, 'css', element);
        zip.file('css/' + cssFile + '.css', cssText);
      } catch (err) {
        console.error(err);
      }
    }
    return html;
  }

  // Asynchronous function to retrieve Javascript files from script tags
  async function getJavascript(html) {
    let dp = new DOMParser();
    let PARSEDHTML = dp.parseFromString(html, 'text/html');
    let scriptElements = PARSEDHTML.getElementsByTagName('script'); // this contains all script elements
    for (const elementRef of scriptElements) {
      // iterate through script elements
      let elementSrc = elementRef.getAttribute('src');
      if (elementSrc === null) continue; // only attempt to download if the script tag has a src, otherwise do nothing
      if (elementSrc.toString().search('https://') === -1) {
        //Change path to absolute path if it's relative
        elementSrc = getAbsolutePath(elementSrc, url);
      }
      let scriptFile = getTitle(elementSrc);
      let eString = elementSrc.toString(); // This line is used to check duplicate js file
      let lastPart = eString.toString().substring(eString.lastIndexOf('/') + 1); //

      // update html with proper path, if the depth is 0 we do not want ../
      if (urlDepth >= 1) {
        elementRef.setAttribute('src', '../js/' + scriptFile + '.js');
      } else {
        elementRef.setAttribute('src', 'js/' + scriptFile + '.js');
      }
      html = PARSEDHTML.documentElement.innerHTML; //updates the current html

      if (checkDuplicate(lastPart, urlJS)) continue;
      try {
        urlJS.push({ url: lastPart });
        let scriptText = await getData(elementSrc); // get the js data
        if (scriptText === 'Failed') continue;
        zip.file('js/' + scriptFile + '.js', scriptText); // add to the zip file
      } catch (err) {
        console.error(err);
      }
    }
    return html;
  }

  const getCSSImg = async (data, place, urlFile) => {
    try {
      // Waits for the function to fulfill promise then set data to cssText
      // Wrap data into <sytle> tags to append to html
      //This block of code essentially takes background images and downloads them
      //Note, svgs are not a part of this
      const regex = /url\s*\(\s*/;
      let bg = data.substring(data.search(regex));
      let count = 0;
      while (bg.search(regex) !== -1 && count <= 100) {
        //limit the loop because some url cannot handle
        //Replaces Bg Images and Downloads them
        try {
          bg = data.substring(data.search(regex));
          let bgIni = bg.substring(bg.indexOf('url') + 4, bg.indexOf(')')); // take a string from url to )
          // Trim url with some case in each if statement. These if statement need to be in order.
          let path;
          if (bgIni.search('xmlns') !== -1) break; // handle url contain xmlns, svgs
          if (bgIni.search("'") !== -1) {
            bgIni = bgIni.substring(
              bgIni.indexOf("'") + 1,
              bgIni.lastIndexOf("'")
            );
          }
          if (bgIni.search('"') !== -1) {
            bgIni = bgIni.substring(
              bgIni.indexOf('"') + 1,
              bgIni.lastIndexOf('"')
            );
          }
          if (bgIni.search('//') !== -1 && bgIni.indexOf('//') === 0) {
            bgIni = bgIni.replace('//', 'https://');
          }
          bgIni = bgIni.replace('\\', '');
          //Get path
          // Depends on absolute path or relative path
          if (bgIni.search('http') !== -1) {
            path = bgIni;
          } else {
            path = getAbsolutePath(bgIni, urlFile);
          }
          //Get image name by get the part after /
          let imageName = '';
          if (bgIni.lastIndexOf('?') !== -1) {
            imageName = bgIni.substring(
              bgIni.lastIndexOf('/') + 1,
              bgIni.lastIndexOf('?')
            );
          } else {
            imageName = bgIni.substring(bgIni.lastIndexOf('/') + 1);
          }
          imageName = imageName.substring(imageName.length - 50);
          // replace the file with the appropriate path
          if (place === 'css')
            // if file data is css, path go back to main folder and go into img folder
            data = data.replace(bgIni, '../img/' + imageName);
          else {
            // else if file data is html, it depends on the depth of html to giving the href
            if (urlDepth >= 1)
              data = data.replace(bgIni, '../img/' + imageName);
            else data = data.replace(bgIni, 'img/' + imageName);
          }

          //Zip file
          if (!checkDuplicate(imageName, urlImage)) {
            // check Duplicate file before zipping file
            urlImage.push({ url: imageName });
            zip.file('img/' + imageName, urlToPromise(path), { binary: true });
          } // end replace and download image
          count++;
          bg = data.substring(data.search(regex) + 20);
        } catch (err) {
          console.error(err);
        }
      }
      return data;
    } catch (err) {
      console.error(err);
    }
    return data;
  };

  const getPDF_setHref = async (html) => {
    // Parsing html text to  DOM object
    let parser = new DOMParser();
    let parsed = parser.parseFromString(html, 'text/html');
    let links = parsed.getElementsByTagName('a');
    for (let j = 0; j < links.length; j++) {
      let relative = links[j].getAttribute('href'); // Given a relative path
      let link = links[j].href; //Given a link
      // if link does not contains any string belongs to "mailto", "tel", and "#", then scrape file.
      // if the resulting link is not one that is currently in the list
      if (
        link.toString().search('mailto') !== -1 ||
        link.toString().search('tel') !== -1 ||
        link.toString().search('#') !== -1 ||
        link.length === 0
      )
        continue;

      //checks if the link is in the correct format
      if (link.search('chrome-extension://' + extId) !== -1)
        link = getAbsolutePath(relative, url);

      // set href for url in html file
      if (link.toString().search('.pdf') === -1) {
        let linkTitle = getTitle(link);
        if (urlDepth >= 1) {
          links[j].setAttribute('href', linkTitle + '.html'); // when the depth >=1, we have already set the html/ part, so this avoids linking to /html/html...
        } else {
          links[j].setAttribute('href', 'html/' + linkTitle + '.html'); //This line of code essentially makes it so the user can navigate all the pages they scraped when they are offline
        }
      } else {
        // ----- get PDF file --------
        try {
          let pdfName = getTitle(link) + '.pdf';
          if (!checkDuplicate(pdfName, urlPdf)) {
            urlPdf.push({ url: pdfName, depth: urlDepth });
            zip.file('pdf/' + pdfName, urlToPromise(link), { binary: true });
          }
          if (urlDepth >= 1) {
            // Set the proper href values if they are pdf file
            links[j].setAttribute('href', '../pdf/' + pdfName);
          } else {
            links[j].setAttribute('href', 'pdf/' + pdfName);
          }
        } catch (error) {
          console.error(error);
        }
      }
      html = parsed.documentElement.innerHTML;
    }
    return html;
  };

  // Function to download image and replace their links with our own
  const getImgs = async (html) => {
    try {
      // Wait for function to fulfill promise then set HTML data to
      // variable
      let dp = new DOMParser();
      let parsed = dp.parseFromString(html, 'text/html');
      let testImageElements = parsed.getElementsByTagName('img');
      Array.from(testImageElements).forEach(async (img) => {
        let src = img.getAttribute('src');

        // let lastPart = srcString.toString().substring(srcString.lastIndexOf('/')+1); //
        // skip a loop in ForEach loop  // return is instead of continue;
        if (src === null) return;
        if (src.search('base64') !== -1) return;

        // These code is used to check duplicate css file
        let imageName = src.substring(src.lastIndexOf('/') + 1);
        imageName = imageName.replace(/[&\/\\#,+()$~%'":*?<>{}]/g, '');
        if (!checkDuplicate(imageName, urlImage)) {
          urlImage.push({ url: imageName });
          if (src.search('//') !== -1) {
            src = src.substring(src.indexOf('//'));
            src = 'https:' + src;
          } else {
            src = getAbsolutePath(src, url);
          }
          zip.file('img/' + imageName, urlToPromise(src), { binary: true });
        }
        img.setAttribute('srcset','');
        if (urlDepth >= 1) img.setAttribute('src', '../img/' + imageName);
        else img.setAttribute('src', 'img/' + imageName);
      });
      html = parsed.documentElement.innerHTML;
      return html;
    } catch (err) {
      console.error(err);
    }
    return html;
  };

  const getVideos = async (html) => {
    try {
      let dp = new DOMParser();
      let parsed = dp.parseFromString(html, 'text/html');
      let testVideoElements = parsed.getElementsByTagName('iframe');
      Array.from(testVideoElements).forEach(async (video) => {
        let src = video.getAttribute('src');

        if (src === null) return;

        let videoName = src.substring(src.lastIndexOf('/') + 1);
        videoName = videoName.replace(/[&\/\\#,+()$~%'":*?<>{}]/g, '');
        if (!checkDuplicate(videoName, urlVideo)) {
          urlVideo.push({ url: videoName });
          if (src.search('//') !== -1) {
            src = src.substring(src.indexOf('//'));
            src = 'https:' + src;
          } else {
            src = getAbsolutePath(src, url);
          }
          zip.file('video/' + videoName, urlToPromise(src), { binary: true });
        }
        if (urlDepth >= 1) video.setAttribute('src', '../video/' + videoName);
        else video.setAttribute('src', 'video/' + videoName);
      });
      html = parsed.documentElement.innerHTML;
      return html;
    } catch (err) {
      console.error(err);
    }
    return html;
  };
  //Used for getting image data, used in getCSS and getImgs
  function urlToPromise(url) {
    return new Promise(function (resolve, reject) {
      JSZipUtils.getBinaryContent(url, function (err, data) {
        if (err) {
          resolve('Failed To Find Content');
        } else {
          resolve(data);
        }
      });
    });
  }

  // Main Asynchronous function that initiates the scraping process
  const scrape = async (url) => {
    try {
      html = await getData(url); //gets html of the url
      try {
        html = await getJavascript(html); // download external Javascript files
        html = await getCSS(html); //downloads css
        if (!omitImgs) {
          // checks if the user wants to omit images or not
          html = await getImgs(html); //downloads images
        }
        html = await getCSSImg(html, 'html', url); // gets back-ground:image in the html text
        html = await getVideos(html);
        //html = await getLinks(html);
        html = await getPDF_setHref(html);
      } catch (err) {
        console.error(err);
      }
      return html;
    } catch (err) {
      console.error(err);
    }
  };

  return await scrape(url); //returns the result of crawl/scrape
}
