const { BASE_COMPOUNDS, WEAR_PARAMS, getTrackDegFactor, calcLapTimeWithWear } = require('./tyreModel');

// just use base compounds if nothing else is given
const DEFAULT_COMPOUNDS = BASE_COMPOUNDS;

// this function gets info about a tyre compound
function getTyreInfo(compound) {
  // make sure its a string and capitalise first letter
  var c = String(compound);
  if (!compound) {
    c = 'Medium';
  }

  var firstLetter = c.charAt(0).toUpperCase();
  var rest = c.slice(1).toLowerCase();
  var key = firstLetter + rest;

  // get the base and wear data, default to medium if not found
  var base = BASE_COMPOUNDS[key];
  if (!base) {
    base = BASE_COMPOUNDS.Medium;
  }

  var wear = WEAR_PARAMS[key];
  if (!wear) {
    wear = WEAR_PARAMS.Medium;
  }

  // add a small buffer so tyres can last a bit longer if needed
  var maxUsefulLaps = wear.cliffStart + 5;

  return {
    key: key,
    baseOffset: base.baseOffset,
    maxUsefulLaps: maxUsefulLaps
  };
}

// fuel burns off every lap so heavier car = slower lap
var fuelPerKgBenefit = 0.014;

// each stint needs at least this many laps otherwise its not valid
var MIN_STINT = 3;

// calculates how long a single lap takes
function calculateLapTime(lapNumber, stintLap, compound, params, currentFuelKg) {
  var info = getTyreInfo(compound);

  // safety check
  if (!info) {
    return Infinity;
  }

  var baseLapTime = Number(params.baseLapTime);
  if (!baseLapTime) baseLapTime = 0;

  var totalLaps = Number(params.totalLaps);
  if (!totalLaps) totalLaps = 0;

  var trackDeg = Number(params.trackDegFactor);
  if (!trackDeg) trackDeg = 1.0;

  var outLap = Number(params.outLapPenalty);
  if (!outLap) outLap = 0;

  var maxStint = Number(info.maxUsefulLaps);
  if (!maxStint) maxStint = 40;

  var result = calcLapTimeWithWear({
    compound: info.key,
    age: stintLap,
    baseLapTime: baseLapTime,
    baseOffset: info.baseOffset,
    totalLaps: totalLaps,
    lapGlobal: lapNumber,
    fuelLoadKg: currentFuelKg,
    fuelPerKgBenefit: fuelPerKgBenefit,
    trackDegFactor: trackDeg,
    maxStintLap: maxStint,
    rejectThresholdSec: 999,
    outLapPenalty: outLap,
  });

  return result.time;
}

// work out all the possible pit stop lap combinations
function generatePitCombos(totalLaps, stopCount) {
  var results = [];

  // one stop - loop through all possible pit laps
  if (stopCount === 1) {
    var iMin = MIN_STINT;
    var iMax = totalLaps - MIN_STINT;
    for (var i = iMin; i <= iMax; i++) {
      results.push([i]);
    }
    return results;
  }

  // two stops - two nested loops
  if (stopCount === 2) {
    var iMin = MIN_STINT;
    var iMax = totalLaps - 2 * MIN_STINT;
    for (var i = iMin; i <= iMax; i++) {
      var jMin = i + MIN_STINT;
      var jMax = totalLaps - MIN_STINT;
      for (var j = jMin; j <= jMax; j++) {
        results.push([i, j]);
      }
    }
    return results;
  }

  // three stops - three nested loops
  if (stopCount === 3) {
    var iMin = MIN_STINT;
    var iMax = totalLaps - 3 * MIN_STINT;
    for (var i = iMin; i <= iMax; i++) {
      var jMin = i + MIN_STINT;
      var jMax = totalLaps - 2 * MIN_STINT;
      for (var j = jMin; j <= jMax; j++) {
        var kMin = j + MIN_STINT;
        var kMax = totalLaps - MIN_STINT;
        for (var k = kMin; k <= kMax; k++) {
          results.push([i, j, k]);
        }
      }
    }
    return results;
  }

  return results;
}

// converts pit stop laps into stint ranges
// e.g. pit on lap 20 and 40 out of 60 = [1-20], [21-40], [41-60]
function stintsFromPits(totalRaceLaps, pitStopLapNumbers) {
  var stintRanges = [];
  var currentStartLap = 1;

  for (var i = 0; i < pitStopLapNumbers.length; i++) {
    var pitLap = pitStopLapNumbers[i];

    var newStint = {
      from: currentStartLap,
      to: pitLap
    };
    stintRanges.push(newStint);

    // next stint starts after the pit stop
    currentStartLap = pitLap + 1;
  }

  // add the last stint up to end of race
  stintRanges.push({
    from: currentStartLap,
    to: totalRaceLaps
  });

  return stintRanges;
}

// generate all the different compound combos we could use
function generateTyreAssignments(numberOfStints, allowedCompoundsList) {
  var availableCompounds = allowedCompoundsList;
  if (!availableCompounds) {
    availableCompounds = Object.keys(BASE_COMPOUNDS);
  }

  var validAssignments = [];

  // recursive function to try every combination
  function buildAssignmentRecursive(currentStintIndex, currentAssignmentList) {

    // done - assigned a tyre to all stints
    if (currentStintIndex === numberOfStints) {

      // check the 2 compound rule (drivers must use at least 2 different tyres)
      var uniqueCompounds = [];
      for (var x = 0; x < currentAssignmentList.length; x++) {
        if (uniqueCompounds.indexOf(currentAssignmentList[x]) === -1) {
          uniqueCompounds.push(currentAssignmentList[x]);
        }
      }

      if (uniqueCompounds.length >= 2) {
        // valid combo, save a copy
        var copy = [];
        for (var y = 0; y < currentAssignmentList.length; y++) {
          copy.push(currentAssignmentList[y]);
        }
        validAssignments.push(copy);
      }
      return;
    }

    // try each compound for this stint
    for (var compoundIndex = 0; compoundIndex < availableCompounds.length; compoundIndex++) {
      var compoundName = availableCompounds[compoundIndex];

      currentAssignmentList.push(compoundName);

      // go to next stint
      buildAssignmentRecursive(currentStintIndex + 1, currentAssignmentList);

      // remove last added so we can try the next one
      currentAssignmentList.pop();
    }
  }

  // kick things off from stint 0
  buildAssignmentRecursive(0, []);

  return validAssignments;
}

// check if a tyre can survive a stint of this length
function validateStintLength(stintLengthLaps, compoundName) {
  var tyreInfo = getTyreInfo(compoundName);

  if (!tyreInfo) {
    return false;
  }

  // tyre is ok if the stint is within its max life
  if (stintLengthLaps <= tyreInfo.maxUsefulLaps) {
    return true;
  }
  return false;
}

// check every stint in the strategy is actually possible
function validateStintsWithCompounds(stintRanges, compoundAssignments) {
  if (stintRanges.length !== compoundAssignments.length) {
    return false;
  }

  for (var i = 0; i < stintRanges.length; i++) {
    var stintDuration = stintRanges[i].to - stintRanges[i].from + 1;

    // cant have a too short stint
    if (stintDuration < MIN_STINT) {
      return false;
    }

    // check the tyre can last this long
    var assignedCompound = compoundAssignments[i];
    var isValid = validateStintLength(stintDuration, assignedCompound);
    if (!isValid) {
      return false;
    }
  }

  // all good
  return true;
}

// simulate the full race for a given strategy and return the total time
function evaluateStrictStrategy(raceParams, pitStops, compoundChoices) {
  var totalLaps = Number(raceParams.totalLaps);
  if (!totalLaps) totalLaps = 0;

  var timeLostInPit = Number(raceParams.pitStopLoss);
  if (!timeLostInPit) timeLostInPit = 0;

  var timeLostOutLap = Number(raceParams.outLapPenalty);
  if (!timeLostOutLap) timeLostOutLap = 0;

  var trackDegFactor = getTrackDegFactor(raceParams);

  // basic checks
  if (!totalLaps || totalLaps <= 0) return null;
  if (!Array.isArray(pitStops)) return null;

  // convert pit laps to stints
  var stintRanges = stintsFromPits(totalLaps, pitStops);

  // make sure the strategy is physically possible
  var isOk = validateStintsWithCompounds(stintRanges, compoundChoices);
  if (!isOk) {
    return null;
  }

  var raceLapTimes = [];
  var totalRaceTime = 0;
  var currentStintIndex = 0;
  var currentStintObject = stintRanges[0];
  var lapsDrivenInStint = 0;

  var startFuel = Number(raceParams.initialFuel);
  if (!startFuel) startFuel = 0;

  var fuelBurnPerLap = 0;
  if (totalLaps > 0) {
    fuelBurnPerLap = startFuel / totalLaps;
  }

  // loop through every lap one by one
  for (var currentLap = 1; currentLap <= totalLaps; currentLap++) {

    // track how many laps into this stint we are
    if (currentLap === currentStintObject.from) {
      lapsDrivenInStint = 1;
    } else {
      lapsDrivenInStint = lapsDrivenInStint + 1;
    }

    var compKey = compoundChoices[currentStintIndex];
    var currentFuelKg = startFuel - fuelBurnPerLap * (currentLap - 1);
    if (currentFuelKg < 0) currentFuelKg = 0;

    // get the lap time
    var lapParams = {
      baseLapTime: raceParams.baseLapTime,
      totalLaps: raceParams.totalLaps,
      outLapPenalty: timeLostOutLap,
      trackDegFactor: trackDegFactor
    };
    var t = calculateLapTime(currentLap, lapsDrivenInStint, compKey, lapParams, currentFuelKg);

    raceLapTimes.push(t);
    totalRaceTime = totalRaceTime + t;

    // pit stop happens at end of this stint
    if (currentLap === currentStintObject.to) {
      if (currentStintIndex < stintRanges.length - 1) {
        totalRaceTime = totalRaceTime + timeLostInPit;
      }
      currentStintIndex = currentStintIndex + 1;

      if (stintRanges[currentStintIndex]) {
        currentStintObject = stintRanges[currentStintIndex];
      }

      lapsDrivenInStint = 0;
    }
  }

  // build the stint summaries
  var stintsOut = [];
  for (var s = 0; s < stintRanges.length; s++) {
    var r = stintRanges[s];
    var stintLapSlice = raceLapTimes.slice(r.from - 1, r.to);
    var stintTotal = 0;
    for (var x = 0; x < stintLapSlice.length; x++) {
      stintTotal = stintTotal + stintLapSlice[x];
    }
    var numLaps = r.to - r.from + 1;
    var avgTime = 0;
    if (numLaps > 0) {
      avgTime = stintTotal / numLaps;
    }

    stintsOut.push({
      from: r.from,
      to: r.to,
      compound: compoundChoices[s],
      laps: numLaps,
      lapTime: avgTime
    });
  }

  return {
    valid: true,
    totalTime: totalRaceTime,
    lapTimes: raceLapTimes,
    stints: stintsOut
  };
}

// takes the raw result and adds more detail for the UI
function buildStrictStrategy(strictResult, config) {
  if (!strictResult) return null;

  var totalLaps = parseInt(config.totalLaps, 10);
  if (!totalLaps) totalLaps = 0;

  var baseLapTime = Number(config.baseLapTime);
  if (!baseLapTime) baseLapTime = 0;

  var fuelLoadKg = Number(config.fuelLoad);
  if (!fuelLoadKg) fuelLoadKg = 0;

  var fuelBurnPerLap = 0;
  if (totalLaps > 0) {
    fuelBurnPerLap = fuelLoadKg / totalLaps;
  }

  var trackDegFactor = getTrackDegFactor(config);

  var outLapPenalty = Number(config.outLapPenalty);
  if (!outLapPenalty) outLapPenalty = 0;

  var lapSeries = [];
  var stints = [];
  var fastest = null;

  // go through each stint
  for (var sIdx = 0; sIdx < strictResult.stints.length; sIdx++) {
    var st = strictResult.stints[sIdx];
    var compName = st.compound;
    var info = getTyreInfo(compName);
    var laps = st.to - st.from + 1;

    var stintLapTimes = [];
    var stintTyrePenalties = [];
    var stintFuelLoads = [];

    for (var i = 1; i <= laps; i++) {
      var lapNumber = st.from + i - 1;
      var currentFuel = fuelLoadKg - fuelBurnPerLap * (lapNumber - 1);
      if (currentFuel < 0) currentFuel = 0;

      var outPenalty = 0;
      if (i === 1) {
        outPenalty = outLapPenalty;
      }

      var lapResult = calcLapTimeWithWear({
        compound: info.key,
        age: i,
        baseLapTime: baseLapTime,
        baseOffset: info.baseOffset,
        totalLaps: totalLaps,
        lapGlobal: lapNumber,
        fuelLoadKg: currentFuel,
        fuelPerKgBenefit: fuelPerKgBenefit,
        trackDegFactor: trackDegFactor,
        maxStintLap: Number.MAX_SAFE_INTEGER,
        rejectThresholdSec: 999,
        outLapPenalty: outPenalty
      });

      var timeRounded = Number(lapResult.time.toFixed(3));
      var wearRounded = Number(lapResult.wearPenalty.toFixed(3));
      var fuelRounded = Number(currentFuel.toFixed(3));

      stintLapTimes.push(timeRounded);

      if (lapResult.wearPenalty) {
        stintTyrePenalties.push(lapResult.wearPenalty);
      } else {
        stintTyrePenalties.push(0);
      }

      stintFuelLoads.push(currentFuel);

      lapSeries.push({
        lap: lapNumber,
        time: timeRounded,
        tyrePenalty: wearRounded,
        fuelLoad: fuelRounded,
        compound: compName,
        stintIndex: sIdx,
        stintLap: i
      });
    }

    // add up total stint time
    var stintTime = 0;
    for (var t = 0; t < stintLapTimes.length; t++) {
      stintTime = stintTime + stintLapTimes[t];
    }

    var avgStintLapTime = 0;
    if (laps > 0) {
      avgStintLapTime = stintTime / laps;
    }

    // check if this is the fastest stint so far
    if (fastest === null || avgStintLapTime < fastest.avg) {
      fastest = {
        avg: avgStintLapTime,
        compound: compName,
        laps: laps,
        sIdx: sIdx
      };
    }

    stints.push({
      compound: compName,
      laps: laps,
      from: st.from,
      to: st.to,
      lapTimes: stintLapTimes,
      tyrePenalties: stintTyrePenalties,
      fuelLoads: stintFuelLoads,
      totalTime: stintTime,
      avgLapTime: avgStintLapTime
    });
  }

  // find fastest single lap in whole race
  var fastestLap = null;
  for (var l = 0; l < lapSeries.length; l++) {
    var lap = lapSeries[l];
    if (!fastestLap || lap.time < fastestLap.time) {
      fastestLap = {
        time: lap.time,
        lapNumber: lap.lap,
        compound: lap.compound,
        stintLap: lap.stintLap
      };
    }
  }

  return {
    valid: true,
    totalTime: strictResult.totalTime,
    lapTimes: strictResult.lapTimes,
    stints: stints,
    lapSeries: lapSeries,
    fastestStint: fastest,
    fastestLap: fastestLap,
    stops: strictResult.pitLaps ? strictResult.pitLaps.length : 0,
    pitLaps: strictResult.pitLaps || []
  };
}

// use dynamic programming to find the best pit strategy for a given number of stops
function optimiseForStopCount(params, stopCount, allowedCompounds) {
  var totalLaps = parseInt(params.totalLaps, 10);
  if (!Number.isFinite(totalLaps) || totalLaps < 1) {
    throw new Error('totalLaps must be > 0');
  }

  var numStints = stopCount + 1;
  var initialFuel = Number(params.initialFuel);
  var fuelBurnPerLap = 0;
  if (totalLaps > 0) {
    fuelBurnPerLap = initialFuel / totalLaps;
  }

  var pitStopLoss = Number(params.pitStopLoss);

  // cache stint costs so we dont recalculate them
  var stintCostCache = {};

  function getStintCost(startLap, length, compound) {
    var key = startLap + '-' + length + '-' + compound;

    if (stintCostCache[key] !== undefined) {
      return stintCostCache[key];
    }

    var info = getTyreInfo(compound);

    // impossible stint
    if (!info || length < MIN_STINT || length > info.maxUsefulLaps) {
      stintCostCache[key] = Infinity;
      return Infinity;
    }

    var time = 0;

    // add up all lap times in this stint
    for (var i = 1; i <= length; i++) {
      var lapGlobal = startLap + i - 1;

      if (lapGlobal > totalLaps) {
        time = Infinity;
        break;
      }

      var currentFuelKg = initialFuel - fuelBurnPerLap * (lapGlobal - 1);
      if (currentFuelKg < 0) currentFuelKg = 0;

      var t = calculateLapTime(lapGlobal, i, compound, params, currentFuelKg);
      time = time + t;
    }

    stintCostCache[key] = time;
    return time;
  }

  // setup the dp table
  // dp[stintIndex][endLap][compound] = best time info
  var dp = [];
  for (var n = 0; n <= numStints; n++) {
    var row = [];
    for (var m = 0; m <= totalLaps; m++) {
      row.push(null);
    }
    dp.push(row);
  }

  // fill in the first stint (base cases)
  for (var lap = 1; lap <= totalLaps; lap++) {
    if (lap < MIN_STINT) continue;

    for (var ci = 0; ci < allowedCompounds.length; ci++) {
      var comp = allowedCompounds[ci];
      var cost = getStintCost(1, lap, comp);
      if (cost === Infinity) continue;

      if (!dp[1][lap]) dp[1][lap] = {};

      dp[1][lap][comp] = {
        uniform: { cost: cost, prevEnd: 0, prevComp: null },
        diverse: null // cant have 2 compounds in 1 stint
      };
    }
  }

  // fill in the rest of the stints
  for (var k = 2; k <= numStints; k++) {
    var minEnd = k * MIN_STINT;

    for (var lap = minEnd; lap <= totalLaps; lap++) {
      var maxPrev = lap - MIN_STINT;
      var minPrev = (k - 1) * MIN_STINT;

      for (var prev = maxPrev; prev >= minPrev; prev--) {
        if (!dp[k - 1][prev]) continue;

        for (var ci = 0; ci < allowedCompounds.length; ci++) {
          var currComp = allowedCompounds[ci];
          var segCost = getStintCost(prev + 1, lap - prev, currComp);
          if (segCost === Infinity) continue;

          var transitionCost = segCost + pitStopLoss;
          var prevDataVars = dp[k - 1][prev];

          // try all the previous compounds
          for (var prevComp in prevDataVars) {
            var entry = prevDataVars[prevComp];
            if (!entry) continue;

            // coming from a single compound history
            if (entry.uniform) {
              var newCost = entry.uniform.cost + transitionCost;
              var isNowDiverse = (currComp !== prevComp);
              var type = isNowDiverse ? 'diverse' : 'uniform';

              if (!dp[k][lap]) dp[k][lap] = {};
              if (!dp[k][lap][currComp]) dp[k][lap][currComp] = { uniform: null, diverse: null };

              var bestSoFar = dp[k][lap][currComp][type];
              if (!bestSoFar || newCost < bestSoFar.cost) {
                dp[k][lap][currComp][type] = {
                  cost: newCost,
                  prevEnd: prev,
                  prevComp: prevComp
                };
              }
            }

            // coming from a diverse history (already used 2 compounds)
            if (entry.diverse) {
              var newCost = entry.diverse.cost + transitionCost;

              if (!dp[k][lap]) dp[k][lap] = {};
              if (!dp[k][lap][currComp]) dp[k][lap][currComp] = { uniform: null, diverse: null };

              var bestSoFar = dp[k][lap][currComp].diverse;
              if (!bestSoFar || newCost < bestSoFar.cost) {
                dp[k][lap][currComp].diverse = {
                  cost: newCost,
                  prevEnd: prev,
                  prevComp: prevComp
                };
              }
            }
          }
        }
      }
    }
  }

  // find the best valid result
  var bestTime = Infinity;
  var bestEndState = null;
  var bestFinalComp = null;
  var bestType = null;

  var finalStates = dp[numStints][totalLaps];

  if (finalStates) {
    for (var comp in finalStates) {
      var entry = finalStates[comp];
      if (!entry) continue;

      // wet tyres dont need the 2 compound rule
      var isWet = (comp === 'Intermediate' || comp === 'Wet');

      var candidates = [];
      if (entry.diverse) {
        candidates.push({ cost: entry.diverse.cost, prevEnd: entry.diverse.prevEnd, prevComp: entry.diverse.prevComp, type: 'diverse' });
      }
      if (entry.uniform && isWet) {
        candidates.push({ cost: entry.uniform.cost, prevEnd: entry.uniform.prevEnd, prevComp: entry.uniform.prevComp, type: 'uniform' });
      }

      for (var ci = 0; ci < candidates.length; ci++) {
        var cand = candidates[ci];
        if (cand.cost < bestTime) {
          bestTime = cand.cost;
          bestEndState = cand;
          bestFinalComp = comp;
          bestType = cand.type;
        }
      }
    }
  }

  if (bestTime === Infinity || !bestEndState) return null;

  // trace back through the dp table to find the actual stints
  var compounds = [];
  var pitLaps = [];

  var currStep = bestEndState;
  var currComp = bestFinalComp;
  var currType = bestType;
  var currEnd = totalLaps;

  for (var k = numStints; k >= 1; k--) {
    compounds.unshift(currComp);

    var prevEnd = currStep.prevEnd;
    var prevComp = currStep.prevComp;

    if (k > 1) {
      pitLaps.unshift(prevEnd);
    }

    if (k > 1) {
      var prevEntry = dp[k - 1][prevEnd][prevComp];
      var costTransition = getStintCost(prevEnd + 1, currEnd - prevEnd, currComp) + pitStopLoss;
      var expectedPrevCost = currStep.cost - costTransition;

      // figure out which path was used
      if (prevEntry.uniform && Math.abs(prevEntry.uniform.cost - expectedPrevCost) < 1e-6) {
        currType = 'uniform';
        currStep = prevEntry.uniform;
      } else if (prevEntry.diverse && Math.abs(prevEntry.diverse.cost - expectedPrevCost) < 1e-6) {
        currType = 'diverse';
        currStep = prevEntry.diverse;
      } else {
        // fallback for floating point weirdness
        var isDiff = (currComp !== prevComp);
        if (isDiff && prevEntry.uniform && Math.abs(prevEntry.uniform.cost - expectedPrevCost) < 1e-6) {
          currType = 'uniform';
          currStep = prevEntry.uniform;
        } else {
          currType = 'diverse';
          currStep = prevEntry.diverse;
        }
      }
    }

    currEnd = prevEnd;
    currComp = prevComp;
  }

  return evaluateStrictStrategy(params, pitLaps, compounds);
}

// main function - finds best 1 stop, 2 stop and 3 stop strategies
function generateStrictStrategies(config) {
  var totalLaps = parseInt(config.totalLaps, 10);

  if (!Number.isFinite(totalLaps) || totalLaps <= 0) {
    // cant do anything without valid lap count
    return {
      best: {},
      overallBest: null,
      meta: { error: 'Invalid totalLaps' }
    };
  }

  var totalRain = Number(config.totalRainfall);
  if (!totalRain) totalRain = 0;

  var avgRainPerLap = totalRain / Math.max(1, totalLaps);

  // pick tyre types based on how much rain there is
  var allowedCompounds;
  if (avgRainPerLap < 0.5) {
    allowedCompounds = ['Soft', 'Medium', 'Hard'];
  } else if (avgRainPerLap < 0.8) {
    allowedCompounds = ['Intermediate'];
  } else if (avgRainPerLap < 3.5) {
    allowedCompounds = ['Intermediate', 'Wet'];
  } else {
    allowedCompounds = ['Wet'];
  }

  var params = {
    totalLaps: totalLaps,
    baseLapTime: Number(config.baseLapTime) || 0,
    pitStopLoss: Number(config.pitStopLoss) || 0,
    initialFuel: Number(config.fuelLoad) || 0,
    fuelPerKgBenefit: fuelPerKgBenefit,
    trackDegFactor: getTrackDegFactor(config),
    outLapPenalty: Number(config.outLapPenalty) || 0
  };

  var bestByStops = {};

  // try 1, 2 and 3 stop strategies
  var stopOptions = [1, 2, 3];
  for (var s = 0; s < stopOptions.length; s++) {
    var stopCount = stopOptions[s];
    var strictResult = null;

    try {
      var dpParams = {
        totalLaps: totalLaps,
        baseLapTime: Number(config.baseLapTime) || 0,
        pitStopLoss: Number(config.pitStopLoss) || 0,
        initialFuel: Number(config.fuelLoad) || 0,
        fuelPerKgBenefit: fuelPerKgBenefit,
        trackDegFactor: getTrackDegFactor(config),
        outLapPenalty: Number(config.outLapPenalty) || 0
      };

      strictResult = optimiseForStopCount(dpParams, stopCount, allowedCompounds);
    } catch (err) {
      // skip if this stop count doesnt work
    }

    if (!strictResult) continue;

    // work out which laps the pit stops happen
    var pitLapsList = [];
    for (var i = 0; i < strictResult.stints.length - 1; i++) {
      pitLapsList.push(strictResult.stints[i].to);
    }
    strictResult.pitLaps = pitLapsList;

    // add full details to the result
    var decorated = buildStrictStrategy({
      pitLaps: strictResult.pitLaps || [],
      stints: strictResult.stints,
      totalTime: strictResult.totalTime,
      lapTimes: strictResult.lapTimes
    }, config);

    if (!decorated) continue;

    decorated.actualStops = stopCount;
    decorated.targetStops = stopCount;

    bestByStops[stopCount] = decorated;
  }

  // figure out which stop count gave the fastest overall race
  var overallBest = null;
  var stopKeys = Object.keys(bestByStops);
  for (var i = 0; i < stopKeys.length; i++) {
    var st = bestByStops[stopKeys[i]];
    if (!overallBest || st.totalTime < overallBest.totalTime) {
      overallBest = st;
    }
  }

  return {
    best: bestByStops,
    overallBest: overallBest,
    meta: {
      algorithm: 'strict-exhaustive',
      variants: Object.keys(bestByStops).length
    }
  };
}

// wrapper to keep things simple
function generateStrategies(config, options) {
  var strictResult = generateStrictStrategies(config);
  return strictResult;
}

module.exports = {
  getTyreInfo,
  calculateLapTime,
  generatePitCombos,
  stintsFromPits,
  generateTyreAssignments,
  validateStintLength,
  validateStintsWithCompounds,
  evaluateStrictStrategy,
  DEFAULT_COMPOUNDS,
  buildStrictStrategy,
  generateStrategies,
  generatePitCombos,
  generateTyreAssignments,
  evaluateStrictStrategy,
  generateStrictStrategies
};