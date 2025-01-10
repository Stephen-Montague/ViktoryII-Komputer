console.log("Hey, welcome. Just a note from the developer of the Viktory II Komputer. \n\
If you've come to view the loading code, please click on 'Sources' above. \n\
If you'd like to see game code, right-click on the game page and click 'Inspect' then find the Sources tab there. \n\
If you'd like to see game code before anything loads, you can find the folder for this extension, something like... \n\
C:\\Users\\[UserName]\\AppData\\Local\\Google\\Chrome\\User Data\\Default\\Extensions\\[ExtensionId]\\script.js \n\
Have a good one.");

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
    const audioURL = chrome.runtime.getURL('sound/');
    chrome.scripting.executeScript({
        target : {tabId : targetTabId},
        func: addAudioSource,
        args: [audioURL],
        world : "MAIN"
    });  

    chrome.scripting.executeScript({
        target : {tabId : targetTabId},
        files : [ "script.js" ],
        world : "MAIN"
    });  
}

function addAudioSource(url)
{
    window.komputerSoundPath = url;
}
