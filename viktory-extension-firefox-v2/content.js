console.log("Hello content.");

// Append script to GamesByEmail.
(function(){
    const script = document.createElement('script');
    script.src = browser.runtime.getURL('script.js');
    (document.head || document.documentElement).appendChild(script);
}()
);
