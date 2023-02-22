

//This method fills the starting url with the current tabs url. and starts the getLinks() method
chrome.tabs.query({currentWindow: true, active: true}, function(tabs){
    console.log(tabs[0].url);
    const urlForm = document.getElementById('urlFormInput');
    urlForm.value = tabs[0].url;
    getLinks();
});

//Given a limit, displays a warning if it is available
var overLimit = false;
async function getLinks(){
    var html = await getData(document.getElementById('urlFormInput').value);
    var parser = new DOMParser();
    var parsed = parser.parseFromString(html,'text/html');
    var links = parsed.getElementsByTagName('a');
    var link_limit = 100; //This link limit IS adjustable, if the number of links on the start page is over this, then a warning will appear
    overLimit = links.length>link_limit;
    if(overLimit)
    {
      document.getElementById("link_alert").hidden = false;
      document.getElementById('link_alert').innerText="This page has over "+link_limit+" connected pages, we recommend setting a max depth or limiting links via max links.";
    }
}

var extId = chrome.runtime.id;
document.addEventListener('DOMContentLoaded', popupFunction);//When extension is opened, popupFunction is ran

var urlList = [];//initializes empty urls

document.getElementById('submitBtn').addEventListener('click', saveAs);
async function popupFunction() {
    document.getElementById('submitBtn').addEventListener('click', saveAs);//On the download button, the form will complete and start downloading pages according to the users needs

    //The following is a function that removes the runtime warning if the user sets a limit to links
    document.getElementById('max_links_op').addEventListener('change', function(){
        document.getElementById('max_links_div').hidden=!document.getElementById('max_links_div').hidden;
          document.getElementById("link_alert").hidden = !document.getElementById("link_alert").hidden;
      }
    );
  
}
var depth = 0; //sets the default depth of the crawl
var zip = new JSZip(); //creates a new file to hold the zipped contents

async function saveAs(){
  console.log(urlList);
  urlList[0]= {url:document.getElementById('urlFormInput').value,depth:0}; //sets the first url to the depth of 0
  var max_links = document.getElementById('max-links').value; //gets the value of the max links (if it exists)
  depth = document.getElementById('depthFormInput').value;//gets the max depth input by the user
  document.getElementById('max_links_op').disabled=true;//checkbox disabled during crawling
  document.getElementById('max-links').disabled=true;//max links textbox also disabeled during crawling
    for(var i = 0; (i < urlList.length && !document.getElementById('max_links_op').checked)||(i<urlList.length&&i<=max_links&&document.getElementById('max_links_op').checked);i++)
    {
      //If the crawler was given max links, update the progress bar based on max_links
        if(document.getElementById('max_links_op').checked)
        {
          document.getElementById("currentProgress").innerText="Progress: "+Math.ceil(i/max_links*100).toString()+"%";
          document.getElementById("progress-bar").style="width:"+Math.ceil(i/max_links*100).toString()+"%";
        }
        else{ //If the crawler is not given max_links, then the progress bar will estimate based on the remaining links (based on max depths)
          document.getElementById("currentProgress").innerText="Progress: "+Math.ceil(i/urlList.length*100).toString()+"%";
          document.getElementById("progress-bar").style="width:"+Math.ceil(i/urlList.length*100).toString()+"%";
        }
        var html_response ="<p>Error has occured</p>";//Default html if something goes wrong with the 
        html_response = await scrape_html(urlList[i].url,urlList[i].depth); //scrapes the pages and returns html
        if(i===0)
          zip.file("A_"+getTitle(urlList[i].url)+".html", html_response); //Sets the first url to the depth of 0 with A_ so it appears at the top of the folder
        else
          zip.file(getTitle(urlList[i].url)+".html", html_response);//The rest of the links are essentially the url of the page
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
        }).catch(err => document.getElementById("currentProgress").innerText= "error");

        document.getElementById("currentProgress").innerText= "Successfully Download";//Informs user of successful download
        //Undisables max link options
        document.getElementById('max_links_op').disabled=false;
        document.getElementById('max-links').disabled=false;
    });
    zip = new JSZip();//Clears the zip for future use
}

//given the url, makes url availible for file system naming conventions, used for html files, css files, and image files
function getTitle(url){
  url = url.toString();
  if(url.length>=150)
    url = url.substring(url.length-150);
  url = url.replace(/[^a-zA-Z0-9 ]/g, '_');
  return url;
}

//Method that makes requests to the get html,css,and image blobs
let getData = async (url) => {
  console.log("getData:", "Getting data from URL");
  var result = ""
  try{
    result = $.get(url);
  }
  catch(e){
    return "Failed";
  }
  return result;
};
// Check a url for working
let checkUrl = async(url) => {
  try {
    const response = await fetch(url, { method: "HEAD" });
    if (response.ok) {
      return true;
    } else {
      return false;
    }
  } catch (error) {
    console.log("Error:", error);
  }
}
function getRelativePath(relPath, baseUrl){
  // To get absolute path, we need use URL class to concat a relative path and an absolute path
  /** 
  // Example
  // new URL("../mypath","http://www.stackoverflow.com/search").href
  //=> "http://www.stackoverflow.com/mypath"  
  */

  let URLconcat = new URL(relPath, baseUrl);
  console.log("URL concat : " + URLconcat);
  return URLconcat;
}
//checks a url for a duplicate url
function checkDuplicate(url){
  for(var i =0;i<urlList.length;i++)
  {
    if(url===urlList[i].url)
    {
      console.log("Duplicate found "+url);
      return true;
    }
  }
  return false;
}


//GIVEN THE URL AND URL_DEPTH, updates the zip files and adds more urls to the list
async function scrape_html(url,urlDepth){
    // Store url recieved from the form
    // let url = urlform.url.value;
    var html = "";//starts the 
    //let hostname = url.match(/(?<=(http|https):\/\/)(\S+?)(?=\/)/)[0];
    let hostname = new URL(url).hostname;
    // Asynchronous function to retrieve CSS from links
    async function getCSS(html){
      var dp = new DOMParser();
      var PARSEDHTML = dp.parseFromString(html, 'text/html');
      console.log(PARSEDHTML);
      var linkElements = PARSEDHTML.getElementsByTagName("link");
      console.log(linkElements);
      for(const elementRef of linkElements){
        // Create a dummy element to transfer <link> tag href to an <a> tag
        // so that JQuery can identify its protocol, hostname, and pathname etc.
        if(elementRef.getAttribute('rel')==='stylesheet')
        {
        // The important of getAttribute is that the return is relative path.   
        let relativePath = elementRef.getAttribute('href');
        let element = document.createElement("a");
        $(element).attr("href", elementRef.getAttribute('href'));

        if (element.protocol === "chrome-extension:") {
          element = element.toString().replace("chrome-extension:", "https:");
        }
        if (element.toString().search(extId) >= 1) {
          element = element.toString().replace(extId, hostname);
        }
        // Check URL work 
        let flagURL = await checkUrl(element); 
        console.log("The result after checkURL" + flagURL);
        // If URL does not work, replace in relative path.
        if(!flagURL) {
          element = getRelativePath(relativePath,url);
        }
        console.log(element);
        let cssText = await getData(element);
        
        if(cssText !== "Failed"){
        try {
          // Waits for the function to fulfill promise then set data to cssText
          //console.log(cssText)

          // Wrap data into <sytle> tags to append to html

          //THIs block of code essentially takes background images and downloads them
          //Note, svgs are not a part of this
          var i = 0;
          while(cssText.indexOf("background-image:url(",i)!==-1)//Replaces Bg Images and Downloads them
          {
            var bg = cssText.substring(cssText.indexOf("background-image:url(",i));
            var bgIni = bg.substring(bg.indexOf("url")+4,bg.indexOf(")"));
            var imageName = "";
            if(bgIni.lastIndexOf('?')!==-1){
              imageName = bgIni.substring(bgIni.lastIndexOf('/')+1,bgIni.lastIndexOf('?'));
            }
            else{
              imageName = bgIni.substring(bgIni.lastIndexOf('/')+1);
            }
            console.log(bgIni);
            if(bgIni.indexOf("https")===-1)
            {
              var data = await urlToPromise("https://"+(new URL(url)).hostname+bgIni);
              zip.file("img/"+imageName, data, {binary: true});
            }
            else{
              zip.file("img/"+imageName, urlToPromise(bgIni), {binary: true});
            }
            cssText = cssText.replace(bgIni,"../img/"+imageName);
            //console.log(bgIni + " => "+"https://"+(new URL(url)).hostname+bgIni + " => img/" + imageName );
            i = cssText.indexOf("background-image:url(",i)+1;
          }
          var cssFile = getTitle(element);
          zip.file("css/"+cssFile+".css",cssText);
          elementRef.setAttribute("href","css/"+cssFile+".css");
          html = PARSEDHTML.documentElement.innerHTML; //updates the current html
        } catch (err) {       
          console.log(err);
        }
      }
    }
      };
      console.log("finished CSS");
      return html;
    }


    // Function to download image and replace their links with our own
    const get_imgs = async (html) => {
      try {
          // Wait for function to fulfill promise then set HTML data to
          // variable
          var dp = new DOMParser();
          var parsed = dp.parseFromString(html, 'text/html');
          var testImageElements = parsed.getElementsByTagName("img");
          Array.from(testImageElements).forEach((img) => {
              let src = img.getAttribute('src');
              let srcset = img.getAttribute('srcset');
              //console.log(src)
              if(src.toString().search("//") !== -1) {
                  if(src.toString().search("https:")===-1)
                  {
                    src = "https:"+src;
                  }
                  var imageName = src.substring(src.lastIndexOf('/') + 1);
                  imageName = imageName.replace(/[&\/\\#,+()$~%'":*?<>{}]/g, '');
                  zip.file("img/"+imageName, urlToPromise(src), {binary: true});
              }
              else{
                src = "https:"+(new URL(url)).hostname+src;
                var imageName = src.substring(src.lastIndexOf('/') + 1);
                imageName = imageName.replace(/[&\/\\#,+()$~%'":*?<>{}]/g, '');
                zip.file("img/"+imageName, urlToPromise(src), {binary: true});
              }
              img.setAttribute('srcset','');
              img.setAttribute("src","img/"+imageName);
          });
          html=parsed.documentElement.innerHTML;
          return html;
      } catch (e) {
          console.log(url);
      }
      return html;
  };

  //Used for gettning image data, used in getCSS and get_IMGS
  function urlToPromise(url) {
    return new Promise(function (resolve, reject) {
        JSZipUtils.getBinaryContent(url, function (err, data) {
            if (err) {
                resolve("Failed To Find Content");
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
            if (!document.getElementById('omit_imgs').checked) { // checks if the user wants to omit images or not
              html = await get_imgs(html); //downloads images
            }
            if(urlDepth < depth){ //if the max depth is higher than our current depth

              //Crawls html for all links
              var parser = new DOMParser();
              var parsed = parser.parseFromString(html,'text/html');
              var links = parsed.getElementsByTagName('a');
              for(var j = 0; j < links.length;j++) 
              {

                var link =links[j].href.toString(); //Given a link
                if((link.search('chrome-extension://' + extId)!==-1&&link.indexOf('#')===-1))//checks if the link is in the correct format
                {
                  link = "https://"+(new URL(url)).hostname+link;
                  link = link.replace('chrome-extension://' + extId,''); //also for the links structure
                  // Check Link work 
                   let flagURL = await checkUrl(link); 
                  console.log("The result after checkURL : " + flagURL);
                  // If URL does not work, replace in relative path.
                  if(!flagURL) {
                    link = getRelativePath(links[j].getAttribute('href'),url);
                  }
                  if(!checkDuplicate(link)&&link.length!==0){ //if the resulting link is not one that is currently in the list
                    console.log("adding to list:" + link);
                    urlList.push({url:link,depth:urlDepth+1});//push it to the list. thus setting it up for more scraping
                  }
                  links[j].setAttribute('href',getTitle(link)+".html");//This line of code essentially makes it so the user can navigate all the pages they scraped when they are offline
                }
                
              }
              html = parsed.documentElement.innerHTML;//gets the resulting html
            }
            return html;
          } catch (err) {
            console.log(err);
          }
        }
       catch (err) {
        console.log(err);
      }
    };

    return await scrape(url); //returns the result of crawl/scrape
}