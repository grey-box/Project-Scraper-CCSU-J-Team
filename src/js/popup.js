import $ from 'jquery'
import 'bootstrap'
import JSZip from 'jszip';
import * as JSZipUtils from 'jszip-utils';

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

//This fills the starting url with the current tabs url, and starts the getLinks() method
chrome.tabs.query({ currentWindow: true, active: true }, function (tabs) {
  console.log(tabs[0].url);
  const urlInput = document.getElementById('url-input');
  urlInput.value = tabs[0].url;
  getLinks();
});

//Given a limit, displays a warning if it is available
var overLimit = false;
async function getLinks() {
  var html = await getData(document.getElementById('url-input').value);
  var parser = new DOMParser();
  var parsed = parser.parseFromString(html, 'text/html');
  var links = parsed.getElementsByTagName('a');
  var linkLimit = 100; //This link limit IS adjustable, if the number of links on the start page is over this, then a warning will appear
  overLimit = links.length > link_limit;
  if (overLimit) {
    document.getElementById('link-alert').hidden = false;
    document.getElementById('link-alert').innerText =
      'This page links to over ' +
      linkLimit +
      ' pages, we recommend setting a small depth (less than 2) for a faster download.';
  }
}

// Set the appropriate options values from chrome.storage
function fillOptions() {
  chrome.storage.sync.get(
    (items) => {
      console.log(items.depth);
      document.getElementById('depth-input').value = items.depth;
      document.getElementById('omit-imgs').checked = items.omitImages;
      // The following is commented out since we do not have these options implemented
      // document.getElementById('omit-video').checked = items.omitVideo;
      // document.getElementById('restrict-domain').checked = items.restrictDomain;
    }
  );
}

var extId = chrome.runtime.id;
// document.addEventListener('DOMContentLoaded', popupFunction); //When extension is opened, popupFunction is ran

var urlList = []; //initializes empty urls

// Create BroadcastChannel for sending messages, called scraper_data
const bc = new BroadcastChannel("scraper_data");

// parameters for the window we will open
let params = `scrollbars=no,resizable=no,status=no,location=no,toolbar=no,menubar=no,
width=375,height=275,left=100,top=100`;

// When extension opens, fill the values from options, and open the popup window
document.addEventListener('DOMContentLoaded', () => {
  fillOptions();
  openWindow();
}); 

// Opens a new window which executes the scraping code from window.js
function openWindow() {
  let popupWindow = window.open("../html/window.html", "scraper_window", params);
}

document.getElementById('submit-btn').addEventListener('click', send); // When user submits, send the form data

// sends a message containing the form data from the extension popup window
function send() {
  bc.postMessage([document.getElementById('url-input').value, document.getElementById('depth-input').value, document.getElementById('omit-imgs').checked]);
}

document.querySelector('#go-to-options').addEventListener('click', function() {
  console.log("Opening options")
  chrome.runtime.openOptionsPage();
});