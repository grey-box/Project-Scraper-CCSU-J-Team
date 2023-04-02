// Create a context menu item
chrome.contextMenus.create({
  id: 'contextMenuGreyBox',
  title: 'Download Page - Grey Box',
  contexts: ['page', 'selection', 'all'],
});

chrome.contextMenus.onClicked.addListener(function(info, tab) {
  chrome.tabs.sendMessage(tab.id, {greeting: "downloadPage"}, function(response) {
    // Handle the response from the content script
    console.log("Sent to content script")
    console.log("response from content script");
    console.log(response)
  });
});


chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log('received message from content script')
  console.log(request)
  if (request.message.command === "downloadURLBlob") {
    console.log("received download url blob in background script:");
    console.log(request.message.content)
    sendResponse({ message: "background script received download content from background script!" });

    
    console.log("background downloading content");
    chrome.downloads.download({
        url: request.message.content,
        filename: "scrapedWebsites.zip",
        saveAs:true,
    })
    then(() => console.log("im done"))
    .catch(console.error)
  }
});