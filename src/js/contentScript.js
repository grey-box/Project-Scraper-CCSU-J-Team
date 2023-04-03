//import $ from 'jquery';
import 'bootstrap';
import JSZip from 'jszip';
import * as JSZipUtils from 'jszip-utils';

//Global variables
var startingUrlInput;
var depthInput;
var omitImgs;
var omitVideo;
var restrictDomain;

// initializes empty lists for duplicate checking
const urlList = new Set();
const urlCSS = new Set();
const urlImage = new Set();
const urlJS = new Set();
const urlPdf = new Set();

// Initial variables
var zip = new JSZip(); //creates a new file to hold the zipped contents
var extId = chrome.runtime.id; // Get the extension's ID

//Get value default first
getValueDefault();

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  // Handle the message received from the background script
  console.log('got messeg from background');
  if (request.greeting === 'downloadPage') {
    await get_links(startingUrlInput, depthInput);
    await downloadPage();
  }
});

function getValueDefault() {
  startingUrlInput = document.URL;
  chrome.storage.sync.get((items) => {
    depthInput = items.depth;
    omitImgs = items.omitImages;
    omitVideo = items.omitVideo;
    restrictDomain = items.restrictDomain;
  });
}
const get_links = async (startUrlInput, depthInput) => {
  console.log('depth input : ' + depthInput);
  urlList.add({ url: startUrlInput, depth: 0 });
  for (const element of urlList) {
    //console.log('element url : ' + element.url);
    if (element.depth <= depthInput) {
      let html = await getData(element.url);
      var parser = new DOMParser();
      var parsed = parser.parseFromString(html, 'text/html');
      var links = parsed.getElementsByTagName('a');
      for (var j = 0; j < links.length; j++) {
        var relative = links[j].getAttribute('href'); // Given a relative path
        var link = links[j].href; //Given a absolute link contain protocol : chrome-extension://
        // console.log("relative in link : "+relative);
        // console.log("href of a link :"+link );
        // console.log("element url is source of link : "+element.url);
        // if link does not contains any string belongs to "mailto", "tel", and "#", then scrape file.
        if (
          link.toString().search('mailto') === -1 &&
          link.toString().search('tel') === -1 &&
          link.toString().search('#') === -1 &&
          link.toString() !== '' // in case: tag <a> does NOT contain href attribute
        ) {
          link = getAbsolutePath(relative, element.url);
          if (!checkDuplicate(link, urlList) && link.length !== 0) {
            //console.log('add link to urlList : ' + link);
            urlList.add({ url: link, depth: element.depth + 1 });
          }
        }
      }
    }
  }
};
async function downloadPage() {
  console.log('get into download function');

  // Download multiple file URLs
  const promises = Array.from(urlList).map(async (urlElement) => {
    let html_response = await scrape_html(urlElement.url, urlElement.depth);
    if (urlElement.depth == 0) {
      zip.file(getTitle(urlElement.url) + '.html', html_response); // Puts the starting webpage in the main directory
    } else {
      zip.file('html/' + getTitle(urlElement.url) + '.html', html_response); //The rest of the links are placed in the html folder
    }
    return html_response;
  });
  const websiteDataArray = await Promise.all(promises);

  // Send content to background
  zip.generateAsync({ type: 'blob' }).then(function (content) {
    console.log('sending content to background');
    //Block of Code Downloads the zip
    var urlBlob = URL.createObjectURL(content); //
    let message = {
      command: 'downloadURLBlob',
      content: urlBlob,
    };
    chrome.runtime.sendMessage({ message: message }, function (response) {
      console.log('Response from background script:', response);
    });
    zip = new JSZip();
  });
}

//given the url, makes url availible for file system naming conventions, used for html files, css files, and image files
function getTitle(url) {
  url = url.toString();
  if (url.length >= 150) url = url.substring(url.length - 150);
  url = url.replace(/[^a-zA-Z0-9 ]/g, '_');
  return url;
}

//Method that makes requests to the get html,css,and image blobs
let getData = async (url) => {
  //console.log('getData:', 'Getting data from URL');
  var result = '';
  try {
    let response = await fetch(url);
    result = await response.text();
  } catch (error) {
    return 'FAILED';
  }
  return result;
};
// Check a url for working

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
//checks a url for a duplicate url for a set
function checkDuplicate(e, set) {
  set.forEach((element) => {
    if (element.url === e) {
      return true;
    }
  });
  return false;
}

//GIVEN THE URL AND URL_DEPTH, updates the zip files and adds more urls to the list
async function scrape_html(url, urlDepth) {
  var html = ''; //starts the
  // Asynchronous function to retrieve CSS from links
  async function getCSS(html) {
    var dp = new DOMParser();
    var PARSEDHTML = dp.parseFromString(html, 'text/html');
    var linkElements = PARSEDHTML.getElementsByTagName('link');
    for (const elementRef of linkElements) {
      // Create a dummy element to transfer <link> tag href to an <a> tag
      // so that JQuery can identify its protocol, hostname, and pathname etc.
      if (elementRef.getAttribute('rel') === 'stylesheet') {
        // The important of getAttribute is that the return is relative path.
        let relativePath = elementRef.getAttribute('href');
        let element = elementRef.href;
        element = getAbsolutePath(relativePath, url);
        if (!urlCSS.has(element)) {
          try {
            console.log("element url of css : "+ element);
            urlCSS.add(element);
            let cssText = await getData(element);
            if (cssText !== 'Failed') {
              cssText = await get_css_img(cssText, 'css', element);
              var cssFile = getTitle(element);
              zip.file('css/' + cssFile + '.css', cssText);
            }
          } catch (err) {
            console.log(err);
          }
        }
        var cssFile = getTitle(element);
        if (urlDepth >= 1) {
          elementRef.setAttribute('href', '../css/' + cssFile + '.css');
        } else {
          elementRef.setAttribute('href', 'css/' + cssFile + '.css');
        }
        html = PARSEDHTML.documentElement.innerHTML; //updates the current html
      }
    }
    //console.log("urlCSS : "+ urlCSS);
    console.log('finished CSS');
    return html;
  }

  // Asynchronous function to retrieve Javascript files from script tags
  async function getJavascript(html) {
    console.log("get in get Javascript with url : "+url);
    var dp = new DOMParser();
    var PARSEDHTML = dp.parseFromString(html, 'text/html');
    var scriptElements = PARSEDHTML.getElementsByTagName('script'); // this contains all script elements
    for (const elementRef of scriptElements) {
      // iterate through script elements
      let elementSrc = elementRef.getAttribute('src');
      if (elementSrc !== null) {
        // only attempt to download if the script tag has a src, otherwise do nothing
        if (elementSrc.toString().search('https://') == -1) {
          //Change path to absolute path if it's relative
          elementSrc = getAbsolutePath(elementSrc, url);
        }
        let eString = elementSrc.toString(); // This line is used to check duplicate js file
        let lastPart = eString
          .toString()
          .substring(eString.lastIndexOf('/') + 1); //
        if (!urlJS.has(lastPart)) {
          try {
            urlJS.add(lastPart);
            let scriptText = await getData(elementSrc); // get the js data
            if (scriptText !== 'Failed') {
              var scriptFile = getTitle(elementSrc);
              zip.file('js/' + scriptFile + '.js', scriptText); // add to the zip file
            }
          } catch (err) {
            console.log(err);
          }
        }
        var scriptFile = getTitle(elementSrc);
        // update html with proper path, if the depth is 0 we do not want ../
        if (urlDepth >= 1) {
          elementRef.setAttribute('src', '../js/' + scriptFile + '.js');
        } else {
          elementRef.setAttribute('src', 'js/' + scriptFile + '.js');
        }

        html = PARSEDHTML.documentElement.innerHTML; //updates the current html
      }
    }

    return html;
  }

  const get_css_img = async (data, place, urlFile) => {
    try {
      // Waits for the function to fulfill promise then set data to cssText
      // Wrap data into <sytle> tags to append to html
      //This block of code essentially takes background images and downloads them
      //Note, svgs are not a part of this
      const regex = /url\s*\(\s*/;
      var bg = data.substring(data.search(regex));
      var count = 0;
      while (bg.search(regex) !== -1 && count <= 100) {
        //limit the loop because some url cannot handle
        //Replaces Bg Images and Downloads them
        bg = data.substring(data.search(regex));
        var bgIni = bg.substring(bg.indexOf('url') + 4, bg.indexOf(')')); // take a string from url to )
        // Trim url with some case in each if statement. These if statement need to be in order.
        var path;
        if (bgIni.search('xmlns') === -1) {
          // handle url contain xmlns, svgs
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
          if (bgIni.search('//') !== -1) {
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
          var imageName = '';
          if (bgIni.lastIndexOf('?') !== -1) {
            imageName = bgIni.substring(
              bgIni.lastIndexOf('/') + 1,
              bgIni.lastIndexOf('?')
            );
          } else {
            imageName = bgIni.substring(bgIni.lastIndexOf('/') + 1);
          }

          // replace the file with the appropriate path
          if (place == 'css')
            // if file data is css, path go back to main folder and go into img folder
            data = data.replace(bgIni, '../img/' + imageName);
          else {
            // else if file data is html, it depends on the depth of html to giving the href
            if (urlDepth >= 1)
              data = data.replace(bgIni, '../img/' + imageName);
            else data = data.replace(bgIni, 'img/' + imageName);
          }

          //Zip file
          if (!urlImage.has(imageName)) {
            // check Duplicate file before zipping file
            urlImage.add(imageName);
            zip.file('img/' + imageName, urlToPromise(path), { binary: true });
          } // end replace and download image
          count++;
          bg = data.substring(data.search(regex) + 20);
        } else {
          break;
        } // end if bgIni contain xmlns
      }
      return data;
    } catch (err) {
      console.log(err);
    }
    return data;
  };
  const get_Pdf_setHTMLhref = async (html) => {
    console.log("get in get Pdf_set with url : "+url);
    let dp = new DOMParser();
    let parsed = dp.parseFromString(html, 'text/html');
    let links = parsed.getElementsByTagName('a');
    //----- get PDF file --------
    for (let i = 0; i < links.length; i++) {
      let relative = links[i].getAttribute('href'); // Given a relative path
      let link = links[i].href; //Given a link
      if (
        link.toString().search('mailto') === -1 &&
        link.toString().search('tel') === -1 &&
        link.toString().search('#') === -1 &&
        link.toString()!==''
      ) {
        link = getAbsolutePath(relative, url);
        // ----- get PDF file --------
        if (link.toString().search('.pdf') !== -1) {
          try {
            let pdfName = getTitle(link) + '.pdf';
            if (!urlPdf.has(link)) {
              urlPdf.add(link);
              zip.file('pdf/' + pdfName, urlToPromise(link), { binary: true });
            }
            if (urlDepth >= 1) {
              // Set the proper href values if they are pdf file
              links[i].setAttribute('href', '../pdf/' + pdfName);
            } else {
              links[i].setAttribute('href', 'pdf/' + pdfName);
            }
          } catch (error) {
            console.error(error);
          }
        } // end get PDF File
        else {
          // Set the proper href values for our page if they are html file
          let linkTitle = getTitle(link);
          if (urlDepth >= 1) {
            links[i].setAttribute('href', linkTitle + '.html'); // when the depth >=1, we have already set the html/ part, so this avoids linking to /html/html...
          } else {
            links[i].setAttribute('href', 'html/' + linkTitle + '.html'); //This line of code essentially makes it so the user can navigate all the pages they scraped when they are offline
          }
        }
      }
      html = parsed.documentElement.innerHTML;
    }
    return html;
  };
  // Function to download image and replace their links with our own
  const get_imgs = async (html) => {
    try {
      // Wait for function to fulfill promise then set HTML data to
      // variable
      var dp = new DOMParser();
      var parsed = dp.parseFromString(html, 'text/html');
      var testImageElements = parsed.getElementsByTagName('img');
      Array.from(testImageElements).forEach(async (img) => {
        let src = img.getAttribute('src');
        var imageName = src.substring(src.lastIndexOf('/') + 1);
        imageName = imageName.replace(/[&\/\\#,+()$~%'":*?<>{}]/g, '');
        // srcString = src.toString();               // This line is used to check duplicate css file
        // let lastPart = srcString.toString().substring(srcString.lastIndexOf('/')+1); //
        if (!urlImage.has(imageName)) {
          urlImage.add(imageName);
          if (src.toString().search('//') != -1) {
            if (src.toString().search('https:') == -1) {
              // Convert to https:
              src = 'https:' + src;
            }
          } else {
            src = getAbsolutePath(src, url);
          }
          zip.file('img/' + imageName, urlToPromise(src), { binary: true });
        }
        img.setAttribute('srcset', '');
        if (urlDepth >= 1) img.setAttribute('src', '../img/' + imageName);
        else img.setAttribute('src', 'img/' + imageName);
      });
      html = parsed.documentElement.innerHTML;
      return html;
    } catch (e) {
      console.log(url);
    }
    return html;
  };
  //Used for getting image data, used in getCSS and get_IMGS
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
          html = await get_imgs(html); //downloads images
        }
        html = await get_css_img(html, 'html', url); // gets back-ground:image in the html text
        html = await get_Pdf_setHTMLhref(html);
      } catch (err) {
        console.log(err);
      }
      return html;
    } catch (err) {
      console.log(err);
    }
  };

  return await scrape(url); //returns the result of crawl/scrape
}
