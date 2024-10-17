console.log("Hello world.")

chrome.action.onClicked.addListener(tab => 
    {
        loadScript(tab.id);
    }
);

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => 
    {
        if (tab.url.includes("http://gamesbyemail.com/Games/Viktory2")) 
        { 
            loadScript(tabId);
        }
    }
);

async function loadScript(targetTabId) 
{
    chrome.scripting.executeScript({
        target : {tabId : targetTabId},
        files : [ "script.js" ],
        world : "MAIN"
    });  
}
