"use strict";

// this is the main server file

var express = require("express");
var cors = require("cors");
var path = require("path");
var fs = require("fs");
var http = require("http");

// setup express
var app = express();

// needed so the frontend can talk to the backend
app.use(cors());

// so we can read json from requests
app.use(express.json());


// simple logger so i can see whats happening in the console
app.use(function(req, res, next) {
    try {
        var now = new Date().toISOString();
        console.log(now + " | " + req.method + " " + req.originalUrl);
    } catch (err) {
        // dont crash if logging breaks
    }
    next();
});


// check if we should serve the frontend files from here
var distDir = path.join(__dirname, "..", "frontend", "dist");
var serveFrontendFromBackend = false;

if (process.env.SERVE_FRONTEND === "1") {
    var distExists = fs.existsSync(distDir);
    if (distExists) {
        serveFrontendFromBackend = true;
    }
}


// basic health check so i know the server is alive
app.get("/api/hello", function(req, res) {
    res.json({ message: "Backend is working!" });
});


// bring in the modules we need
var calculateLapTimes = require("./models/calculateLapTimes").calculateLapTimes;
var generateStrategies = require("./models/strategyGenerator").generateStrategies;

var configStore = require("./models/configStore");
var dbSaveConfig = configStore.saveConfig;
var dbListConfigs = configStore.listConfigs;
var dbGetConfig = configStore.getConfig;
var dbDeleteConfig = configStore.deleteConfig;


// validate and accept race config
app.post("/api/race-config", function(req, res) {

    var configData = req.body;
    if (!configData) {
        configData = {};
    }

    // these fields must be there otherwise we cant do anything
    var requiredFields = [
        "totalLaps",
        "trackLength",
        "fuelLoad",
        "degradation",
        "temperature",
        "baseLapTime",
        "pitStopLoss"
    ];

    var missing = [];

    for (var i = 0; i < requiredFields.length; i++) {
        var key = requiredFields[i];
        var hasKey = (key in configData);
        if (!hasKey) {
            missing.push(key);
        }
    }

    // handle old weather field just in case
    var hasRainfall = ("totalRainfall" in configData);
    var hasWeather = ("weather" in configData);

    if (!hasRainfall && hasWeather) {
        if (configData.weather === "Wet") {
            configData.totalRainfall = 50;
        } else {
            configData.totalRainfall = 0;
        }
    }

    if (missing.length > 0) {
        return res.status(400).json({
            error: "Missing fields",
            missing: missing
        });
    }

    res.status(201).json({
        ok: true,
        saved: configData
    });
});


// calculate lap times without pit stops
app.post("/api/calculate-laps", function(req, res) {

    var configData = req.body;

    // make sure something was sent
    if (!configData || Object.keys(configData).length === 0) {
        return res.status(400).json({ error: "No race config available" });
    }

    try {
        var queryOptions = req.query;
        if (!queryOptions) queryOptions = {};

        var lapTimes = calculateLapTimes(configData, queryOptions);
        res.json({ ok: true, laps: lapTimes });

    } catch (err) {
        console.error("Error in calculate-laps:", err);
        res.status(500).json({ error: "Failed to calculate laps" });
    }
});


// generate the pit strategies
app.post("/api/generate-strategies", function(req, res) {

    var configData = req.body;

    if (!configData || Object.keys(configData).length === 0) {
        return res.status(400).json({ error: "No race config available" });
    }

    try {
        var results = generateStrategies(configData, {});

        res.json({
            ok: true,
            best: results.best,
            overallBest: results.overallBest
        });

    } catch (err) {
        console.error("Error in generate-strategies:", err);
        res.status(500).json({ error: "Failed to generate strategies" });
    }
});


// save a config to the store
app.post("/api/configs", function(req, res) {

    var body = req.body;
    if (!body) body = {};

    var name = body.name;
    var config = body.config;

    // name is required
    if (!name || typeof name !== "string" || name.trim() === "") {
        return res.status(400).json({ error: "Name is required" });
    }

    // config object is required too
    if (!config || typeof config !== "object") {
        return res.status(400).json({ error: "Config object is required" });
    }

    try {
        var saved = dbSaveConfig(name.trim(), config);
        res.status(201).json({ ok: true, saved: saved });

    } catch (err) {
        // if the name already exists send a conflict error
        if (err && err.code === "EEXIST") {
            return res.status(409).json({
                error: "A config with that name already exists"
            });
        }

        console.error("Failed to save config:", err);
        res.status(500).json({ error: "Failed to save config" });
    }
});


// get all saved configs
app.get("/api/configs", function(req, res) {

    try {
        var items = dbListConfigs();
        res.json({ ok: true, items: items });
    } catch (err) {
        console.error("Failed to list configs:", err);
        res.status(500).json({ error: "Failed to list configs" });
    }
});


// get one specific config by name
app.get("/api/configs/:name", function(req, res) {

    var name = req.params.name;

    if (!name) {
        return res.status(400).json({ error: "Name required" });
    }

    try {
        var item = dbGetConfig(name);

        // return 404 if it doesnt exist
        if (!item) {
            return res.status(404).json({ error: "Not found" });
        }

        res.json({ ok: true, item: item });

    } catch (err) {
        console.error("Failed to get config:", err);
        res.status(500).json({ error: "Failed to get config" });
    }
});


// delete a config by name
app.delete("/api/configs/:name", function(req, res) {

    var name = req.params.name;

    if (!name) {
        return res.status(400).json({ error: "Name required" });
    }

    try {
        var deleted = dbDeleteConfig(name);

        if (!deleted) {
            return res.status(404).json({ error: "Not found" });
        }

        res.json({ ok: true, deleted: true });

    } catch (err) {
        console.error("Failed to delete config:", err);
        res.status(500).json({ error: "Failed to delete config" });
    }
});


// serve frontend files if the flag is set
if (serveFrontendFromBackend) {

    app.use(express.static(distDir));

    // any page that isnt an api route just gets the index.html
    app.get("*", function(req, res) {
        res.sendFile(path.join(distDir, "index.html"));
    });

} else {

    // if not serving frontend just block random routes
    app.use(function(req, res, next) {

        var isApiRoute = req.path && req.path.indexOf("/api") === 0;
        if (isApiRoute) {
            return next();
        }

        var isGet = req.method && req.method.toUpperCase() === "GET";
        if (isGet) {
            return res.status(204).end();
        }

        res.status(404).end();
    });
}


// work out which port to use
var requestedPort = null;
if (process.env.PORT) {
    requestedPort = Number(process.env.PORT);
}

var BASE_PORT = 5500;
if (requestedPort && requestedPort > 0) {
    BASE_PORT = requestedPort;
}

// fallback tries other ports if the one we want is taken
var fallbackEnabled = false;
if (process.env.PORT_FALLBACK && process.env.PORT_FALLBACK !== "0") {
    fallbackEnabled = true;
}

var fallbackAttempts = 0;
if (fallbackEnabled) {
    fallbackAttempts = 20;
}


// start the server, try next port if current one is busy
function startServer(startPort, triesLeft) {

    var port = startPort;
    var server = http.createServer(app);

    function attemptListen() {
        server.listen(port);
    }

    server.on("listening", function() {
        var address = server.address();
        console.log("Backend running on port " + address.port);
    });

    server.on("error", function(err) {

        // port is taken, try the next one
        if (err && err.code === "EADDRINUSE" && triesLeft > 0) {
            console.warn("Port " + port + " in use, trying " + (port + 1));
            port = port + 1;
            triesLeft = triesLeft - 1;
            setTimeout(attemptListen, 50);
            return;
        }

        // ran out of ports to try
        if (err && err.code === "EADDRINUSE") {
            console.error("Port already in use. Enable PORT_FALLBACK or choose another PORT.");
            process.exit(1);
        }

        // dont have permission to use this port
        if (err && err.code === "EACCES") {
            console.error("Permission denied for port " + port + ". Use a port > 1024.");
            process.exit(1);
        }

        throw err;
    });

    attemptListen();
}


startServer(BASE_PORT, fallbackAttempts);