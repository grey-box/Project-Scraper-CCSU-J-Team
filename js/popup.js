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

//This method fills the starting url with the current tabs url. and starts the getLinks() method
chrome.tabs.query({ currentWindow: true, active: true }, function (tabs) {
  console.log(tabs[0].url);
  const urlForm = document.getElementById('urlFormInput');
  urlForm.value = tabs[0].url;
  getLinks();
});

//Given a limit, displays a warning if it is available
var overLimit = false;
async function getLinks() {
  var html = await getData(document.getElementById('urlFormInput').value);
  var parser = new DOMParser();
  var parsed = parser.parseFromString(html, 'text/html');
  var links = parsed.getElementsByTagName('a');
  var link_limit = 100; //This link limit IS adjustable, if the number of links on the start page is over this, then a warning will appear
  overLimit = links.length > link_limit;
  if (overLimit) {
    document.getElementById('link_alert').hidden = false;
    document.getElementById('link_alert').innerText =
      'This page has over ' +
      link_limit +
      ' connected pages, we recommend setting a max depth or limiting links via max links.';
  }
}

var extId = chrome.runtime.id;
// document.addEventListener('DOMContentLoaded', popupFunction); //When extension is opened, popupFunction is ran

var urlList = []; //initializes empty urls

// Create BroadcastChannel for sending messages, called scraper_data
const bc = new BroadcastChannel("scraper_data");

// parameters for the window we will open
let params = `scrollbars=no,resizable=no,status=no,location=no,toolbar=no,menubar=no,
width=600,height=300,left=100,top=100`;

document.getElementById('submitBtn').addEventListener('click', openWindow);

// Opens a new window which executes the scraping code from window.js
function openWindow() {
  let popupWindow = window.open("../window.html", "scraper_window", params);
}

document.getElementById('submitBtn2').addEventListener('click', send);

// sends a message containing the form data from the extension popup window
function send() {
  bc.postMessage([document.getElementById('urlFormInput').value, document.getElementById('depthFormInput').value, document.getElementById('omit_imgs').checked]);
}