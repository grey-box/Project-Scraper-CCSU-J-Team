// These are variables to indicate our user's settings. They are assigned from the BroadcastChannel message.
let startingUrlInput;
let depthInput;
let omitImgs;

const bc = new BroadcastChannel("scraper_data");

// Receive the message from the popup.js which contains the user's scraping settings
bc.addEventListener("message", (event) => {
  startingUrlInput = event.data[0];
  depthInput = event.data[1];
  omitImgs = event.data[2];
  saveAs();
});

var urlList = []; //initializes empty urls

var extId = chrome.runtime.id; // Get the extension's ID

var depth = 0; //sets the default depth of the crawl
var zip = new JSZip(); //creates a new file to hold the zipped contents

// Currently, max links is disabled. We will decide if we should or how to reimplement this during sprint 3.
async function saveAs(){
  urlList[0] = {url:startingUrlInput,depth:0}; //sets the first url to the depth of 0
  // var max_links = document.getElementById('max-links').value; //gets the value of the max links (if it exists)
  depth = depthInput;//gets the max depth input by the user
  // document.getElementById('max_links_op').disabled=true;//checkbox disabled during crawling
  // document.getElementById('max-links').disabled=true;//max links textbox also disabeled during crawling
  for(var i = 0; (i < urlList.length) ;i++)
    {
      //If the crawler was given max links, update the progress bar based on max_links
        // if(document.getElementById('max_links_op').checked)
        // {
        //   document.getElementById("currentProgress").innerText="Progress: "+Math.ceil(i/max_links*100).toString()+"%";
        //   document.getElementById("progress-bar").style="width:"+Math.ceil(i/max_links*100).toString()+"%";
        // }
        // else{ //If the crawler is not given max_links, then the progress bar will estimate based on the remaining links (based on max depths)
      document.getElementById("currentProgress").innerText="Progress: "+Math.ceil(i/urlList.length*100).toString()+"%";
      document.getElementById("progress-bar").style="width:"+Math.ceil(i/urlList.length*100).toString()+"%";
        // }
      var html_response ="<p>Error has occured</p>";//Default html if something goes wrong with the 
      html_response = await scrape_html(urlList[i].url,urlList[i].depth); //scrapes the pages and returns html
      if(i==0) {
        zip.file(getTitle(urlList[i].url)+".html", html_response); // Puts the starting webpage in the main directory
      }
      else
        zip.file("html/" + getTitle(urlList[i].url)+".html", html_response);//The rest of the links are placed in the html folder
    }

    console.log('loop is finished'); //scraping of all pages is done
    zip.generateAsync({type:"blob"})
    .then(function(content) {

      //Block of Code Downloads the zip
        var urlBlob = URL.createObjectURL(content);//
        chrome.downloads.download({
            url: urlBlob,
            filename: "scrapedWebsites.zip",
            saveAs:true
        }).catch(err => document.getElementById("currentProgress").innerText= "error")


        document.getElementById("currentProgress").innerText= "Successfully Downloaded";//Informs user of successful download

        //Undisables max link options
        // document.getElementById('max_links_op').disabled=false;
        // document.getElementById('max-links').disabled=false;

    });
    zip = new JSZip();//Clears the zip for future use
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
  console.log('getData:', 'Getting data from URL');
  var result = '';
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
    console.log('Error:', error);
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
  console.log('URL concat : ' + URLconcat);
  return URLconcat;
}
//checks a url for a duplicate url
function checkDuplicate(e, list) {
  for (var i = 0; i < list.length; i++) {
    if (e === list[i].url) {
      console.log('Duplicate found ' + e);
      return true;
    }
  }
  return false;
}

//GIVEN THE URL AND URL_DEPTH, updates the zip files and adds more urls to the list
async function scrape_html(url, urlDepth) {
  // Store url recieved from the form
  // let url = urlform.url.value;
  var html = ''; //starts the
  //let hostname = url.match(/(?<=(http|https):\/\/)(\S+?)(?=\/)/)[0];
  let hostname = new URL(url).hostname;
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
        console.log('attribute (href) : ' + elementRef.getAttribute('href'));
        console.log('href : ' + elementRef.href);
        let element = elementRef.href;
        if (relativePath.search('https://') == -1) {
          element = getAbsolutePath(relativePath, url);
        }
        console.log('element : ' + element);


        let cssText = await getData(element);
        if (cssText !== 'Failed') {
          try {
            
            // Waits for the function to fulfill promise then set data to cssText
            //console.log(cssText)

            // Wrap data into <sytle> tags to append to html

            //THIs block of code essentially takes background images and downloads them
            //Note, svgs are not a part of this
            var i = 0;
            while (!omitImgs && cssText.indexOf('background-image:url(', i) !== -1) {
              //Replaces Bg Images and Downloads them
              var bg = cssText.substring(
                cssText.indexOf('background-image:url(', i)
              );
              var bgIni = bg.substring(bg.indexOf('url') + 4, bg.indexOf(')'));
              var imageName = '';
              if (bgIni.lastIndexOf('?') !== -1) {
                imageName = bgIni.substring(
                  bgIni.lastIndexOf('/') + 1,
                  bgIni.lastIndexOf('?')
                );
              } else {
                imageName = bgIni.substring(bgIni.lastIndexOf('/') + 1);
              }
              console.log(bgIni);
              if (bgIni.indexOf('https') === -1) {
                var data = await urlToPromise(
                  'https://' + new URL(url).hostname + bgIni
                );
                zip.file('img/' + imageName, data, { binary: true });
              } else {
                zip.file('img/' + imageName, urlToPromise(bgIni), {
                  binary: true,
                });
              }
              if (depth >=1) {
                cssText = cssText.replace(bgIni, '../img/' + imageName);
              }
              else {
                cssText = cssText.replace(bgIni, 'img/' + imageName);
              }
              //console.log(bgIni + " => "+"https://"+(new URL(url)).hostname+bgIni + " => img/" + imageName );
              i = cssText.indexOf('background-image:url(', i) + 1;
            }
            var cssFile = getTitle(element);
            zip.file('css/' + cssFile + '.css', cssText);
            // Set the href for our stylesheet. If the depth is greater than 1, we need ../css/ 
            if (urlDepth >= 1) {
              elementRef.setAttribute('href', '../css/' + cssFile + '.css');
            }
            else {
              elementRef.setAttribute('href', 'css/' + cssFile + '.css');
            }
            
            html = PARSEDHTML.documentElement.innerHTML; //updates the current html
          } catch (err) {
            console.log(err);
          }
        }
      }
    }
    console.log('finished CSS');
    return html;
  }

  // Function to download image and replace their links with our own
  async function get_imgs(html) {
    try {
        // Wait for function to fulfill promise then set HTML data to
        // variable
        var dp = new DOMParser();
        var parsed = dp.parseFromString(html, 'text/html');
        var testImageElements = parsed.getElementsByTagName("img");
        Array.from(testImageElements).forEach(async (img) => { // for each img element on page, pass the img element to this function
            let src = img.getAttribute('src');

            let srcset = img.getAttribute('srcset');

            if (src.search('https://') == -1) { // if the image is a relative path
              src = getAbsolutePath(src, url);
            }

            let imageName =  getTitle(src); 

            // Changes the end of imageName to .[file extension]. Example: img_png -> img.png
            // WARNING: if src is greater than 150 in length , then this will not work due to how getTitle is written.
            // Therefore, we need to look for a more versatile solution to get the file type of images.
            let lastUnderscPos = imageName.lastIndexOf('_');
            imageName = imageName.substring(0, lastUnderscPos) + '.' + imageName.substring(lastUnderscPos + 1);

            img.setAttribute('srcset','');
            if (urlDepth >=1) { // if page is saved to html folder, we exit the folder with ../
              img.setAttribute("src","../img/"+ imageName);
            }
            else { // we download the starting page to the main folder, so we do not need ../
              img.setAttribute("src","img/"+ imageName);
            }

            // add the image to our zip file
            zip.file("img/"+imageName, urlToPromise(src), {binary: true});    
        });
        html=parsed.documentElement.innerHTML;
        return html;
    } catch (e) {
        console.log(url);
    }
    return html;
  }

  //Used for getting image data, used in getCSS and get_IMGS
  function urlToPromise(url) {
    return new Promise(function (resolve, reject) {
      JSZipUtils.getBinaryContent(url, function (err, data) {
        if (err) {
          resolve("error");
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
        html = await getCSS(html); //downloads css
        if (!omitImgs) {
          // checks if the user wants to omit images or not
          html = await get_imgs(html); //downloads images
        }
        if (urlDepth <= depth) {
          //if the max depth is higher than our current depth

          //Crawls html for all links
          var parser = new DOMParser();
          var parsed = parser.parseFromString(html, 'text/html');
          var links = parsed.getElementsByTagName('a');
          for (var j = 0; j < links.length; j++) {
            let relative = links[j].getAttribute('href');
            let link = links[j].href;//Given a link
            if((link.search('chrome-extension://' + extId)!==-1))//&&link.indexOf('#')===-1))//checks if the link is in the correct format
             {
              link = getAbsolutePath(relative, url);
            }
            if (!checkDuplicate(link,urlList) && link.length !== 0 && urlDepth < depth) {
              //if the resulting link is not one that is currently in the list
              console.log('adding to list:' + link);
              urlList.push({ url: link, depth: urlDepth + 1 }); //push it to the list. thus setting it up for more scraping
            }
            // Set the proper href values for our page
            let linkTitle = getTitle(link);
            if (urlDepth >= 1) {
              links[j].setAttribute('href', linkTitle + '.html'); // when the depth >=1, we have already set the html/ part, so this avoids linking to /html/html...
            }
            else {
              links[j].setAttribute('href', "html/" + linkTitle + '.html'); //This line of code essentially makes it so the user can navigate all the pages they scraped when they are offline
            }

          }
          html = parsed.documentElement.innerHTML; //gets the resulting html
        }
        return html;
      } catch (err) {
        console.log(err);
      }
    } catch (err) {
      console.log(err);
    }
  };

  return await scrape(url); //returns the result of crawl/scrape
}