const getData = async (url) => {
  let result = '';
  try {
    result = $.get(url);
    return result;
  } catch (e) {
    console.error(e);
    return 'Failed';
  }
};

//This fills the starting url with the current tabs url, and starts the getLinks() method
chrome.tabs.query({ currentWindow: true, active: true }, function (tabs) {
  console.log(tabs[0].url);
  const urlInput = document.getElementById('urlFormInput');
  urlInput.value = tabs[0].url;
  getLinks();
});

//Given a limit, displays a warning if it is available
var overLimit = false;
async function getLinks() {
  var html = await getData(document.getElementById('urlFormInput').value);
  var parser = new DOMParser();
  var parsed = parser.parseFromString(html, 'text/html');
  var links = parsed.getElementsByTagName('a');
  var linkLimit = 100; //This link limit IS adjustable, if the number of links on the start page is over this, then a warning will appear
  overLimit = links.length > linkLimit;
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

// Create BroadcastChannel for sending messages, called scraper_data
const bc = new BroadcastChannel('scraper_data');

// parameters for the window we will open
let params = `scrollbars=no,resizable=no,status=no,location=no,toolbar=no,menubar=no,
width=375,height=275,left=100,top=100,dependent=yes`;

// When extension opens, fill the values from options, and open the popup window
document.addEventListener('DOMContentLoaded', () => {
  fillOptions();
  openWindow();
}); 

// Opens a new window which executes the scraping code from window.js
let popupWindow;
function openWindow() {
  // open window and assign the WindowProxy object to popupWindow
  popupWindow = window.open('../html/window.html', 'scraper_window', params);
  // once the window is loaded, add a listeners
  popupWindow.onload = function () {
    // try to prevent user from closing the window
    popupWindow.addEventListener('beforeunload', function(event) {
      event.preventDefault();
      event.returnValue = 'Are you sure? Closing the popup window will prevent the extension from working.';
    });
    // if the user closes the window, tell the user how to reopen it
    popupWindow.addEventListener('unload', function(event) {
      alert('The popup window was closed. Please reopen the extension to get it back.');
    });
  }
}

document.getElementById('submit-btn').addEventListener('click', send); // When user submits, send the form data

// sends a message containing the form data from the extension popup window
function send() {
  popupWindow.focus(); // keep the popupWindow appear above the parent window.
  bc.postMessage([document.getElementById('urlFormInput').value, document.getElementById('depth-input').value, document.getElementById('omit-imgs').checked]);
}

document.querySelector('#go-to-options').addEventListener('click', function() {
  console.log('Opening options')
  chrome.runtime.openOptionsPage();
});
