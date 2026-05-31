"use strict";

const tyreModel = require("../models/tyreModel");
const calcLapTimeWithWear = tyreModel.calcLapTimeWithWear;
const getTrackDegFactor = tyreModel.getTrackDegFactor;
const BASE_COMPOUNDS = tyreModel.BASE_COMPOUNDS;

//  Test configuration
var TEST_CONFIG = {
  degradation: "High",
  temperature: 25,
  baseLapTime: 90.0,
  fuelLoad: 0,
  totalLaps: 40
};

console.log("\n=== TYRE MODEL TEST REPORT ===");
console.log("Config: Deg=" + TEST_CONFIG.degradation + ", Temp=" + TEST_CONFIG.temperature + "C\n");

// ---------------------------------------------------
//   Calculate track degradation factor
// --------------------------------------------------- 
var degFactor = getTrackDegFactor(TEST_CONFIG);
console.log("Calculated Deg Factor: " + degFactor.toFixed(3) + "x");
console.log("(This multiplier is applied to the base wear curve)\n");


var compounds = ["Soft", "Medium", "Hard"];
var headerRow = "Lap | " + compounds.map(function(c) { return c.padEnd(18); }).join(" | ");
console.log(headerRow);
console.log("-".repeat(headerRow.length));

// Generate lap-by-lap wear penalties
for (var lap = 1; lap <= TEST_CONFIG.totalLaps; lap++) {
  var row = [String(lap).padStart(3)];

  compounds.forEach(function(comp) {
    var result = calcLapTimeWithWear({
      compound: comp,
      age: lap,
      baseLapTime: TEST_CONFIG.baseLapTime,
      baseOffset: BASE_COMPOUNDS[comp].baseOffset,
      totalLaps: 100,
      lapGlobal: lap,
      fuelLoadKg: 0,
      fuelPerKgBenefit: 0,
      trackDegFactor: degFactor,
      maxStintLap: 50,
      rejectThresholdSec: 999
    });

    var wearOnly = result.time - TEST_CONFIG.baseLapTime - BASE_COMPOUNDS[comp].baseOffset;
    row.push(String(wearOnly.toFixed(3) + "s").padEnd(18));
  });

  console.log(row.join(" | "));
}