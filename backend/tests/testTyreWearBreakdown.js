"use strict";

//    Tyre Wear Model Breakdown Test

var tyreModel = require("../models/tyreModel");

var WEAR_PARAMS = tyreModel.WEAR_PARAMS;
var tyreWearPenalty = tyreModel.tyreWearPenalty;
var getTrackDegFactor = tyreModel.getTrackDegFactor;

//   Test Setup
var TEST_CONFIG = {
    degradation: "Low",
    temperature: 20
};

var COMPOUND = "Soft";
var MAX_LAPS = 57;
var MAX_STINT_LAP = 35;

// Calculate track degradation multiplier once
var degFactor = getTrackDegFactor(TEST_CONFIG);

// Basic test info output
console.log("\n--- Tyre Model Breakdown Test ---");
console.log("Compound: " + COMPOUND);
console.log("Configuration: Degradation='" + TEST_CONFIG.degradation + "', Temp=" + TEST_CONFIG.temperature);
console.log("Calculated Track Deg Factor: " + degFactor);
console.log("Params for " + COMPOUND + ":", WEAR_PARAMS[COMPOUND]);
console.log("Note: wearStart=" + WEAR_PARAMS[COMPOUND].wearStart + 
            ", cliffStart=" + WEAR_PARAMS[COMPOUND].cliffStart);
console.log("---------------------------------------------------\n");

//   Function: Calculate wear components
function getWearComponents(compound, lapAge, factor) {

    var params = WEAR_PARAMS[compound];

    // Ensure lap age is never below 1
    var age = lapAge;
    if (age < 1) {
        age = 1;
    }

   
    //   1) Linear base wear. This applies from lap 1 onward
   
    var linearBase = params.linear * age;
    
    //   2) Exponential curve section. Activates after wearStart
    
    var curveTerm = 0;

    if (age > params.wearStart) {
        curveTerm = params.beta *
            (Math.exp(params.gamma * (age - params.wearStart)) - 1);
    }

    //   3) Cliff section. Activates after cliffStart
    
    var cliffTerm = 0;

    if (age > params.cliffStart) {
        cliffTerm = params.cliffBeta *
            (Math.exp(params.cliffGamma * (age - params.cliffStart)) - 1);
    }
    
    //   4) Extra penalty beyond max stint. This prevents unrealistic long stints
    
    var maxStintTerm = 0;

    if (age > MAX_STINT_LAP) {
        maxStintTerm = Math.pow(1.25, age - MAX_STINT_LAP) * 5;
    }
    
    //   Combine everything
    
    var rawTotal = linearBase + curveTerm + cliffTerm + maxStintTerm;

    // Apply track degradation multiplier
    var totalWear = rawTotal * factor;

    return {
        lap: lapAge,
        totalWear: totalWear,
        linearBase: linearBase,
        curveTerm: curveTerm,
        cliffTerm: cliffTerm,
        degFactorUsed: factor
    };
}

// Run Full Lap Simulation

var tableData = [];
var params = WEAR_PARAMS[COMPOUND];

// Key laps for deeper inspection
var keyLaps = [
    1,
    5,
    params.wearStart,
    params.wearStart + 1,
    10,
    params.cliffStart,
    params.cliffStart + 1
];


for (var lap = 1; lap <= MAX_LAPS; lap++) {

    // Manual rebuild of wear calculation
    var manual = getWearComponents(COMPOUND, lap, degFactor);

    // Production function result
    var productionValue = tyreWearPenalty(COMPOUND, lap, degFactor, MAX_STINT_LAP);

    // Compare both values for safety
    var difference = Math.abs(manual.totalWear - productionValue);

    if (difference > 0.000001) {
        console.warn(
            "WARNING: Mismatch at lap " + lap +
            ". Test=" + manual.totalWear +
            ", Prod=" + productionValue +
            ", Diff=" + difference
        );
    }

    // Store row for console table
    tableData.push({
        lap: manual.lap,
        totalWear: manual.totalWear.toFixed(6),
        linearBase: manual.linearBase.toFixed(6),
        curveTerm: manual.curveTerm.toFixed(6),
        cliffTerm: manual.cliffTerm.toFixed(6),
        degFactor: manual.degFactorUsed
    });

    //   Extra breakdown for key laps only
    if (keyLaps.indexOf(lap) !== -1) {

        console.log("\n[Lap " + lap + " Analysis]");
        console.log("Total Wear: " + manual.totalWear.toFixed(6) + "s");

        console.log(" - Linear Base: " + manual.linearBase.toFixed(6) +
                    " (linear=" + params.linear + " * age " + lap + ")");

        if (lap > params.wearStart) {
            console.log(" - Curve Part:  " + manual.curveTerm.toFixed(6) +
                        " (ACTIVE: age > wearStart)");
        } else {
            console.log(" - Curve Part:  0.000000 (inactive)");
        }

        if (lap > params.cliffStart) {
            console.log(" - Cliff Part:  " + manual.cliffTerm.toFixed(6) +
                        " (ACTIVE: age > cliffStart)");
        } else {
            console.log(" - Cliff Part:  0.000000 (inactive)");
        }
    }
}

//   Final Table Output
console.log("\n\n=== LAP-BY-LAP BREAKDOWN (" + COMPOUND + ") ===");
console.table(tableData);