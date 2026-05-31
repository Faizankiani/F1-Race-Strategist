"use strict";

//  This file generates and evaluates race strategies.

//    Tyre performance definitions

var tyreData = {
  soft:   { baseOffset: -0.35, wearBase: 0.035, wearGrowth: 0.020, maxLaps: 22 },
  medium: { baseOffset:  0.00, wearBase: 0.020, wearGrowth: 0.010, maxLaps: 28 },
  hard:   { baseOffset:  0.25, wearBase: 0.015, wearGrowth: 0.005, maxLaps: 38 }
};

var MIN_STINT = 8;

//   Safe number parsing helper

function toNumber(value, fallback) {
  var n = Number(value);

  if (Number.isFinite(n)) {
    return n;
  }

  return fallback;
}

//   Lap time calculation

function calculateLapTime(lapIndex, stintLap, compound, params) {

  var compKey = String(compound || "").toLowerCase();
  var tyre = tyreData[compKey];

  if (!tyre) {
    throw new Error("Unknown compound: " + compound);
  }

  var baseLapTime = toNumber(params.baseLapTime, 0);
  var fuelPerKgBenefit = toNumber(params.fuelPerKgBenefit, 0.005);
  var initialFuel = toNumber(params.initialFuel, 0);

  var wearTerm =
    (tyre.wearBase * stintLap) +
    (tyre.wearGrowth * Math.pow(stintLap, 1.7));

  var fuelBenefit =
    fuelPerKgBenefit * (initialFuel - lapIndex);

  var lapTime =
    baseLapTime +
    tyre.baseOffset +
    wearTerm -
    fuelBenefit;

  return lapTime;
}

//   Generate possible pit stop combinations 

function generatePitCombos(totalLaps, stopCount) {

  var results = [];

  // 1 stop
  if (stopCount === 1) {

    var min1 = MIN_STINT;
    var max1 = totalLaps - MIN_STINT;

    for (var i = min1; i <= max1; i++) {
      results.push([i]);
    }

    return results;
  }

  // 2 stops
  if (stopCount === 2) {

    var min2 = MIN_STINT;
    var max2 = totalLaps - 2 * MIN_STINT;

    for (var i2 = min2; i2 <= max2; i2++) {

      var jMin = i2 + MIN_STINT;
      var jMax = totalLaps - MIN_STINT;

      for (var j = jMin; j <= jMax; j++) {
        results.push([i2, j]);
      }
    }

    return results;
  }

  // 3 stops
  if (stopCount === 3) {

    var min3 = MIN_STINT;
    var max3 = totalLaps - 3 * MIN_STINT;

    for (var a = min3; a <= max3; a++) {

      var bMin = a + MIN_STINT;
      var bMax = totalLaps - 2 * MIN_STINT;

      for (var b = bMin; b <= bMax; b++) {

        var cMin = b + MIN_STINT;
        var cMax = totalLaps - MIN_STINT;

        for (var c = cMin; c <= cMax; c++) {
          results.push([a, b, c]);
        }
      }
    }

    return results;
  }

  return results;
}

//   Convert pit laps to stint ranges

function stintsFromPits(totalLaps, pitLaps) {

  var stints = [];
  var start = 1;

  for (var i = 0; i < pitLaps.length; i++) {

    var pitLap = pitLaps[i];

    stints.push({
      from: start,
      to: pitLap
    });

    start = pitLap + 1;
  }

  stints.push({
    from: start,
    to: totalLaps
  });

  return stints;
}

//   Generate all tyre compound combinations


function generateTyreAssignments(stintCount) {

  var keys = Object.keys(tyreData);
  var results = [];

  function build(current, depth) {

    if (depth === stintCount) {

      // Ensure at least two different compounds
      var unique = {};
      for (var i = 0; i < current.length; i++) {
        unique[current[i]] = true;
      }

      if (Object.keys(unique).length >= 2) {
        results.push(current.slice());
      }

      return;
    }

    for (var k = 0; k < keys.length; k++) {
      current.push(keys[k]);
      build(current, depth + 1);
      current.pop();
    }
  }

  build([], 0);

  return results;
}


//   Validate stint lengths against tyre limits 

function validateStintsWithCompounds(stints, compounds) {

  if (stints.length !== compounds.length) {
    return false;
  }

  for (var i = 0; i < stints.length; i++) {

    var length =
      stints[i].to - stints[i].from + 1;

    if (length < MIN_STINT) {
      return false;
    }

    var tyre = tyreData[compounds[i]];

    if (!tyre) {
      return false;
    }

    if (length > tyre.maxLaps) {
      return false;
    }
  }

  return true;
}



//   Simulate full race

function evaluateStrategy(params, pitLaps, compounds) {

  var totalLaps = toNumber(params.totalLaps, 0);
  var pitStopLoss = toNumber(params.pitStopLoss, 0);

  if (!Number.isFinite(totalLaps) || totalLaps <= 0) {
    return null;
  }

  if (!Array.isArray(pitLaps)) {
    return null;
  }

  var stintRanges = stintsFromPits(totalLaps, pitLaps);

  if (!validateStintsWithCompounds(stintRanges, compounds)) {
    return null;
  }

  var totalTime = 0;
  var lapTimes = [];

  var stintIndex = 0;
  var currentStint = stintRanges[0];
  var stintLap = 0;

  for (var lap = 1; lap <= totalLaps; lap++) {

    if (lap === currentStint.from) {
      stintLap = 1;
    } else {
      stintLap += 1;
    }

    var compound = compounds[stintIndex];

    var lapTime =
      calculateLapTime(lap, stintLap, compound, params);

    lapTimes.push(Number(lapTime.toFixed(3)));

    totalTime += lapTime;

    if (lap === currentStint.to) {

      if (stintIndex < stintRanges.length - 1) {
        totalTime += pitStopLoss;
      }

      stintIndex += 1;

      if (stintIndex < stintRanges.length) {
        currentStint = stintRanges[stintIndex];
      }

      stintLap = 0;
    }
  }

  // Format stints for frontend
  var formattedStints = [];

  for (var s = 0; s < stintRanges.length; s++) {

    var name = String(compounds[s]);
    var formattedName =
      name.charAt(0).toUpperCase() +
      name.slice(1).toLowerCase();

    formattedStints.push({
      from: stintRanges[s].from,
      to: stintRanges[s].to,
      compound: formattedName
    });
  }

  return {
    totalTime: Number(totalTime.toFixed(3)),
    pitLaps: pitLaps.slice(),
    stints: formattedStints,
    lapTimes: lapTimes
  };
}

//  Optimise for specific stop count

function optimiseForStopCount(params, stopCount) {

  var totalLaps = toNumber(params.totalLaps, 0);

  if (!Number.isFinite(totalLaps) || totalLaps < 1) {
    throw new Error("totalLaps must be > 0");
  }

  var pitCombos = generatePitCombos(totalLaps, stopCount);

  if (pitCombos.length === 0) {
    return null;
  }

  var stintCount = stopCount + 1;
  var tyreCombos = generateTyreAssignments(stintCount);

  var best = null;

  for (var p = 0; p < pitCombos.length; p++) {

    var pits = pitCombos[p];
    var stintRanges = stintsFromPits(totalLaps, pits);

    for (var t = 0; t < tyreCombos.length; t++) {

      var compounds = tyreCombos[t];

      if (!validateStintsWithCompounds(stintRanges, compounds)) {
        continue;
      }

      var result =
        evaluateStrategy(params, pits, compounds);

      if (!result) {
        continue;
      }

      if (!best || result.totalTime < best.totalTime) {
        best = result;
      }
    }
  }

  return best;
}

//   Top-level optimiser

function optimiseStrict(params) {

  var best = null;

  for (var stops = 1; stops <= 3; stops++) {

    var candidate =
      optimiseForStopCount(params, stops);

    if (!candidate) {
      continue;
    }

    if (!best || candidate.totalTime < best.totalTime) {
      best = candidate;
    }
  }

  if (!best) {
    throw new Error("No valid strategy found");
  }

  return best;
}


module.exports = {
  tyreData: tyreData,
  calculateLapTime: calculateLapTime,
  generatePitCombos: generatePitCombos,
  evaluateStrategy: evaluateStrategy,
  optimiseForStopCount: optimiseForStopCount,
  optimiseStrict: optimiseStrict
};