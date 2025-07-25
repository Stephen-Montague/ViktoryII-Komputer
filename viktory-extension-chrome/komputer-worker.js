/* global chrome */

console.log("Hey, welcome. Just a note from the developer of the Viktory II Komputer. \n\
If you've come to view the loading code, please click on 'Sources' above. \n\
If you'd like to see game code, right-click on the game page and click 'Inspect' then find the Sources tab there. \n\
If you'd like to see game code before anything loads, you can find the folder for this extension, something like... \n\
C:\\Users\\[UserName]\\AppData\\Local\\Google\\Chrome\\User Data\\Default\\Extensions\\[ExtensionId]\\komputer-main.js \n\
Have a good one.");


chrome.action.onClicked.addListener(tab => 
    {
        console.log("Loading Viktory II Nations as requested.")
        loadScript(tab.id);
    }
);


chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => 
    {
        if (changeInfo.status === "complete" && tab.url &&
        (tab.url.includes("http://gamesbyemail.com/Games/Viktory2") || tab.url.includes("http://www.gamesbyemail.com/Games/Viktory2#Preview")))
        {
            console.log("Loading Viktory II Nations for GamesByEmail."); 
            loadScript(tabId);
        }
    }
);

async function loadScript(targetTabId) 
{
    const audioURL = chrome.runtime.getURL('sound/');
    chrome.scripting.executeScript({
        target : {tabId : targetTabId},
        func: addAudioSource,
        args: [audioURL],
        world : "MAIN"
    });  

    const imageURL = chrome.runtime.getURL('img/');
    chrome.scripting.executeScript({
        target : {tabId : targetTabId},
        func: addImageSource,
        args: [imageURL],
        world : "MAIN"
    });  

    const styleURL = chrome.runtime.getURL('');
    chrome.scripting.executeScript({
        target : {tabId : targetTabId},
        func: addStyleSource,
        args: [styleURL],
        world : "MAIN"
    });  

    chrome.scripting.executeScript({
        target : {tabId : targetTabId},
        files : [ "komputer-main.js" ],
        world : "MAIN"
    });  
}

function addAudioSource(url)
{
    window.KomputerSoundPath = url;
}

function addImageSource(url)
{
    window.KomputerImagePath = url;
}

function addStyleSource(url)
{
    window.KomputerStyle = url;
}
