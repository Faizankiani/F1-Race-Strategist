"use strict";

// testing the strategy generator to see if it works
// prints out the lap data for the best strategy it finds

var strategyModule = require("../models/strategyGenerator");
var generateStrategies = strategyModule.generateStrategies;

// test config i am using
var config = {
  totalLaps: "57",
  baseLapTime: "95.2",
  fuelLoad: "110",
  pitStopLoss: "21.5",
  trackLength: "5.4",
  degradation: "Low",
  temperature: "20",
  totalRainfall: "0",
  outLapPenalty: "2.0"
};

console.log("testing with this config:");
console.log(config);


// run the strategy generator
var result = generateStrategies(config);

// check if anything came back
if (!result || !result.best) {
  console.error("nothing came back from generateStrategies");
  process.exit(1);
}

// try to get the 2 stop strategy first
var strategy = null;

if (result.best["2"]) {
  strategy = result.best["2"];
} else {
  strategy = result.overallBest;
}

if (strategy == null) {
  console.error("could not find a valid strategy");
  process.exit(1);
}


// print out the strategy info
console.log("\n=== STRATEGY LAP DATA ===");
console.log("Stops: " + strategy.stops);

// build the stints string manually
var stintSummary = "";
for (var i = 0; i < strategy.stints.length; i++) {
  var s = strategy.stints[i];
  stintSummary = stintSummary + s.compound + " (" + s.laps + " laps)";

  // add arrow between stints but not after the last one
  if (i < strategy.stints.length - 1) {
    stintSummary = stintSummary + " -> ";
  }
}

console.log("Stints: " + stintSummary);
console.log("Total Time: " + strategy.totalTime.toFixed(3) + "s");


// print lap by lap table
console.log("\nLap | Time (s) | Fuel (kg) | Wear (s)");
console.log("----|----------|-----------|---------");

for (var j = 0; j < strategy.lapSeries.length; j++) {
  var lap = strategy.lapSeries[j];

  // pad each value so the columns line up
  var lapStr = String(lap.lap);
  while (lapStr.length < 3) {
    lapStr = " " + lapStr;
  }

  var timeStr = lap.time.toFixed(3);
  while (timeStr.length < 8) {
    timeStr = " " + timeStr;
  }

  var fuelStr = lap.fuelLoad.toFixed(2);
  while (fuelStr.length < 9) {
    fuelStr = " " + fuelStr;
  }

  var wearStr = lap.tyrePenalty.toFixed(3);
  while (wearStr.length < 8) {
    wearStr = " " + wearStr;
  }

  console.log(lapStr + " | " + timeStr + " | " + fuelStr + " | " + wearStr);
}