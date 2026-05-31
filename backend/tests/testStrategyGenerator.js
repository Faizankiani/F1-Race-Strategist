"use strict";

//  This file tests the strategy generator.

var strategyModule = require("../models/strategyGenerator");
var tyreModel = require("../models/tyreModel");

var generatePitCombos = strategyModule.generatePitCombos;
var generateTyreAssignments = strategyModule.generateTyreAssignments;
var evaluateStrictStrategy = strategyModule.evaluateStrictStrategy;
var tyreData = strategyModule.tyreData;

var getTrackDegFactor = tyreModel.getTrackDegFactor;


// ---------------------------------------------------
//   Test configuration
// --------------------------------------------------- 

var CONFIG = {
  totalLaps: 57,
  baseLapTime: 90,
  pitStopLoss: 20,
  fuelLoad: 110,
  degradation: "Medium",
  temperature: 25
};


console.log("\n=== STRATEGY GENERATOR TEST REPORT ===");
console.log(
  "Config: " +
  CONFIG.totalLaps +
  " Laps, Deg=" +
  CONFIG.degradation +
  ", Temp=" +
  CONFIG.temperature +
  "C\n"
);


var strategies = [];
var strategyId = 0;


// ---------------------------------------------------
//   Generate all strategies
// --------------------------------------------------- 

var stopOptions = [1, 2, 3];

for (var sIndex = 0; sIndex < stopOptions.length; sIndex++) {

  var stops = stopOptions[sIndex];

  var pitCombos =
    generatePitCombos(CONFIG.totalLaps, stops);

  var tyreCombos =
    generateTyreAssignments(stops + 1);

  for (var p = 0; p < pitCombos.length; p++) {

    var pits = pitCombos[p];

    for (var t = 0; t < tyreCombos.length; t++) {

      var compounds = tyreCombos[t];

      var params = {
        totalLaps: CONFIG.totalLaps,
        baseLapTime: CONFIG.baseLapTime,
        pitStopLoss: CONFIG.pitStopLoss,
        initialFuel: CONFIG.fuelLoad,
        fuelPerKgBenefit: 0.005,
        trackDegFactor: getTrackDegFactor(CONFIG)
      };

      var result =
        evaluateStrictStrategy(params, pits, compounds);

      // ---------------------------
      //  Build stint breakdown
      // ---------------------------

      var stints = [];
      var startLap = 1;

      for (var i = 0; i < pits.length; i++) {

        stints.push({
          from: startLap,
          to: pits[i],
          compound: compounds[i]
        });

        startLap = pits[i] + 1;
      }

      stints.push({
        from: startLap,
        to: CONFIG.totalLaps,
        compound: compounds[compounds.length - 1]
      });


      // ---------------------------
      //   Validation checks
      // --------------------------- 

      // Check distinct compounds
      var compoundTracker = {};
      for (var c = 0; c < compounds.length; c++) {
        compoundTracker[compounds[c]] = true;
      }

      var distinctCount =
        Object.keys(compoundTracker).length;

      var compoundsOk =
        distinctCount >= 2;

      var stintOk = true;
      var lapsOk = true;
      var totalLapsCovered = 0;

      for (var x = 0; x < stints.length; x++) {

        var stint = stints[x];

        var length =
          stint.to - stint.from + 1;

        totalLapsCovered += length;

        var compData =
          tyreData[String(stint.compound).toLowerCase()];

        if (length < 8) {
          stintOk = false;
        }

        if (compData &&
            compData.maxUsefulLaps &&
            length > compData.maxUsefulLaps) {
          stintOk = false;
        }
      }

      if (totalLapsCovered !== CONFIG.totalLaps) {
        lapsOk = false;
      }

      strategies.push({
        id: strategyId,
        stops: stops,
        stints: stints,
        compounds: compounds,
        lapsOk: lapsOk,
        stintOk: stintOk,
        compoundsOk: compoundsOk,
        valid: result !== null && compoundsOk
      });

      strategyId += 1;
    }
  }
}


console.log(
  "Total strategies generated: " +
  strategies.length +
  "\n"
);


// ---------------------------------------------------
// Table formatting
// --------------------------------------------------- 

var headers = [
  "ID",
  "Stops",
  "Stints",
  "Compounds",
  "Laps OK",
  "Stint OK",
  "Comp OK"
];

var colWidths = [4, 6, 40, 20, 8, 9, 8];

function pad(str, width) {

  var text = String(str);

  while (text.length < width) {
    text = text + " ";
  }

  if (text.length > width) {
    text = text.slice(0, width);
  }

  return text;
}


// Print header row
var headerLine = "";
for (var h = 0; h < headers.length; h++) {
  headerLine += pad(headers[h], colWidths[h]) + " ";
}
console.log(headerLine);


// Print separator
var separator = "";
for (var w = 0; w < colWidths.length; w++) {
  var dashLine = "";
  for (var d = 0; d < colWidths[w]; d++) {
    dashLine += "-";
  }
  separator += dashLine + " ";
}
console.log(separator);


// ---------------------------------------------------
//   Print first 50 strategies
// --------------------------------------------------- 

var maxToShow = 50;

for (var i2 = 0;
     i2 < strategies.length && i2 < maxToShow;
     i2++) {

  var s = strategies[i2];

  var stintStr = "";
  for (var si = 0; si < s.stints.length; si++) {

    var st = s.stints[si];

    stintStr +=
      st.from +
      "-" +
      st.to +
      " " +
      st.compound.charAt(0);

    if (si < s.stints.length - 1) {
      stintStr += ", ";
    }
  }

  var compStr = "";
  for (var ci = 0; ci < s.compounds.length; ci++) {

    compStr += s.compounds[ci];

    if (ci < s.compounds.length - 1) {
      compStr += ", ";
    }
  }

  var line =
    pad(s.id, colWidths[0]) + " " +
    pad(s.stops, colWidths[1]) + " " +
    pad(stintStr, colWidths[2]) + " " +
    pad(compStr, colWidths[3]) + " " +
    pad(s.lapsOk, colWidths[4]) + " " +
    pad(s.stintOk, colWidths[5]) + " " +
    pad(s.compoundsOk, colWidths[6]);

  console.log(line);
}

if (strategies.length > maxToShow) {
  console.log("... (more strategies hidden) ...");
}


// ---------------------------------------------------
//  Summary statistics
// --------------------------------------------------- 

var invalidSingle = 0;
var invalidStint = 0;
var invalidLaps = 0;
var validCount = 0;

for (var z = 0; z < strategies.length; z++) {

  var strat = strategies[z];

  if (!strat.compoundsOk) {
    invalidSingle += 1;
  }

  if (!strat.stintOk) {
    invalidStint += 1;
  }

  if (!strat.lapsOk) {
    invalidLaps += 1;
  }

  if (strat.valid) {
    validCount += 1;
  }
}


console.log("\nSummary:");
console.log("Valid Strategies:          " + validCount);
console.log("Invalid (Single Compound): " + invalidSingle);
console.log("Invalid (Stint Length):    " + invalidStint);
console.log("Invalid (Lap Coverage):    " + invalidLaps);
console.log("------------------------------------------------");