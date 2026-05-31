// helper file for sending requests to the backend

// checking if the app is running on local machine or not
var runningLocally = false;

if (typeof window !== "undefined") {
    if (window.location.protocol === "file:") {
        // opened by double clicking the html file
        runningLocally = true;
    } else {
        var thePort = window.location.port;

        if (thePort === "5173" || thePort === "5174" || thePort === "4173" || thePort === "4174") {
            runningLocally = true;
        }
    }
}

// if someone set a backend url manually we use that
var manualBase = "";
if (typeof window !== "undefined" && window.__BACKEND_BASE__) {
    manualBase = window.__BACKEND_BASE__;
}

// store the backend url once we find it so we dont search again
var savedBase = null;


// this function tries different ports to find where the backend is
async function findBackend() {

    // already found it before so just return it
    if (savedBase !== null) {
        return savedBase;
    }

    // user set their own url so use that
    if (manualBase !== "") {
        savedBase = manualBase;
        return savedBase;
    }

    // if not running locally then backend and frontend are on same server
    // so we dont need a full url
    if (runningLocally === false) {
        savedBase = "";
        return savedBase;
    }

    // list of ports to check
    var portsToTry = [
        5500, 5501, 5502, 5503, 5504, 5505, 5506, 5507, 5508, 5509, 5510,
        5000, 5001, 5002, 5003, 5004, 5005, 5006, 5007, 5008, 5009, 5010
    ];

    console.log("looking for backend on these ports:", portsToTry);

    // go through each port and test it
    for (var i = 0; i < portsToTry.length; i++) {
        var port = portsToTry[i];
        var testUrl = "http://localhost:" + port + "/api/hello";

        try {
            // using abort controller so it doesnt hang forever
            var controller = new AbortController();
            var timer = setTimeout(function() {
                controller.abort();
            }, 500);

            var res = await fetch(testUrl, { signal: controller.signal });
            clearTimeout(timer);

            if (res.ok) {
                console.log("found backend at port:", port);
                savedBase = "http://localhost:" + port;
                return savedBase;
            }

        } catch (err) {
            // nothing on this port, just move on
        }
    }

    // didnt find anything so just use empty string
    console.warn("couldnt find backend, using relative path");
    savedBase = "";
    return savedBase;
}


// this is the main function i use to call the api
// it wraps fetch so i dont have to worry about the url every time
export async function apiFetch(endpoint, options) {

    // options might not be passed in so set a default
    if (options === undefined) {
        options = {};
    }

    var base = await findBackend();

    // make sure the endpoint has a slash at the start
    var cleanEndpoint = endpoint;
    if (endpoint[0] !== "/") {
        cleanEndpoint = "/" + endpoint;
    }

    // combine base url and endpoint
    var fullUrl = "";
    if (base !== "") {
        fullUrl = base + cleanEndpoint;
    } else {
        fullUrl = cleanEndpoint;
    }

    try {
        var response = await fetch(fullUrl, options);
        return response;
    } catch (err) {
        console.error("fetch failed for url:", fullUrl);
        console.error(err);
        throw err;
    }
}