// this file handles tyre wear and lap time calculations for each compound

// performance offset for each tyre type when brand new
var BASE_COMPOUNDS = {
  Soft: { baseOffset: -0.75 },
  Medium: { baseOffset: 0.0 },
  Hard: { baseOffset: 0.25 },
  Intermediate: { baseOffset: 2.0 },
  Wet: { baseOffset: 5.0 }
};


// wear numbers for each tyre compound
var WEAR_PARAMS = {
  Soft: {
    linear: 0.08,
    wearStart: 6,
    beta: 0.10,
    gamma: 0.20,
    cliffStart: 16,
    cliffBeta: 0.20,
    cliffGamma: 0.25
  },
  Medium: {
    linear: 0.05,
    wearStart: 10,
    beta: 0.08,
    gamma: 0.18,
    cliffStart: 24,
    cliffBeta: 0.14,
    cliffGamma: 0.22
  },
  Hard: {
    linear: 0.025,
    wearStart: 16,
    beta: 0.05,
    gamma: 0.15,
    cliffStart: 38,
    cliffBeta: 0.08,
    cliffGamma: 0.18
  },
  Intermediate: {
    linear: 0.06,
    wearStart: 8,
    beta: 0.08,
    gamma: 0.18,
    cliffStart: 20,
    cliffBeta: 0.14,
    cliffGamma: 0.22
  },
  Wet: {
    linear: 0.03,
    wearStart: 12,
    beta: 0.05,
    gamma: 0.14,
    cliffStart: 28,
    cliffBeta: 0.10,
    cliffGamma: 0.18
  }
};


// works out how much the track conditions affect tyre wear
function getEnvDegFactor(config) {

  if (!config) {
    return 1.0;
  }

  var degradationLevel = config.degradation || "Medium";
  degradationLevel = String(degradationLevel).toLowerCase();

  var temperature = Number(config.temperature);

  if (isNaN(temperature)) {
    temperature = 20;
  }

  var factor = 1.0;

  if (degradationLevel === "high") {
    factor = 1.5;
  } else if (degradationLevel === "low") {
    factor = 0.7;
  } else {
    factor = 1.0;
  }

  // hotter track = more tyre wear
  if (temperature >= 30) {
    factor = factor * 1.1;
  }
  if (temperature >= 35) {
    factor = factor * 1.15;
  }
  if (temperature >= 40) {
    factor = factor * 1.2;
  }

  // clamp the factor so it doesnt go crazy
  if (factor < 0.5) {
    factor = 0.5;
  }
  if (factor > 2.5) {
    factor = 2.5;
  }

  return factor;
}


// calculates how many seconds of penalty the tyre wear adds
function tyreWearPenalty(compound, stintLapAge, trackDegFactor, maxStintLap) {

  var params = WEAR_PARAMS[compound];

  if (!params) {
    return 0;
  }

  var age = stintLapAge;

  if (age < 1) {
    age = 1;
  }

  var totalWearPenalty = 0;

  // normal wear that builds up every lap
  totalWearPenalty = params.linear * age;

  // extra wear after the tyre gets past its good phase
  if (age > params.wearStart) {
    var expPart = Math.exp(params.gamma * (age - params.wearStart)) - 1;
    totalWearPenalty = totalWearPenalty + (params.beta * expPart);
  }

  // tyre cliff - wear goes up a lot here
  if (age > params.cliffStart) {
    var cliffExp = Math.exp(params.cliffGamma * (age - params.cliffStart)) - 1;
    totalWearPenalty = totalWearPenalty + (params.cliffBeta * cliffExp);
  }

  // extra penalty if we go way over the max stint length
  if (age > maxStintLap) {
    var overLimit = age - maxStintLap;
    var extraPenalty = Math.pow(1.25, overLimit) * 5;
    totalWearPenalty = totalWearPenalty + extraPenalty;
  }

  return totalWearPenalty * trackDegFactor;
}


// lighter fuel load = faster lap times
function fuelAdvantage(fuelBurnedKg, fuelPerKgBenefit) {

  var safeFuel = fuelBurnedKg;

  if (safeFuel < 0) {
    safeFuel = 0;
  }

  return fuelPerKgBenefit * safeFuel;
}


// works out the actual lap time including tyre wear and fuel effects
function calcLapTimeWithWear(options) {

  if (!options) {
    return { time: 0, wearPenalty: 0, invalid: true };
  }

  // pull everything out of options
  var compound = options.compound;
  var age = options.age;
  var baseLapTime = options.baseLapTime;
  var baseOffset = options.baseOffset;
  var totalLaps = options.totalLaps;
  var lapGlobal = options.lapGlobal;
  var fuelLoadKg = options.fuelLoadKg;
  var fuelPerKgBenefit = options.fuelPerKgBenefit;
  var trackDegFactor = options.trackDegFactor;
  var maxStintLap = options.maxStintLap;
  var rejectThresholdSec = options.rejectThresholdSec;
  var outLapPenalty = options.outLapPenalty;

  // default baseOffset to 0 if not given
  if (!baseOffset) {
    baseOffset = 0;
  }

  var burnPerLap = 0;

  if (totalLaps > 0) {
    burnPerLap = fuelLoadKg / totalLaps;
  }

  var burnedKg = burnPerLap * (lapGlobal - 1);

  var fuelGain = fuelAdvantage(burnedKg, fuelPerKgBenefit);

  var wearPenalty = tyreWearPenalty(compound, age, trackDegFactor, maxStintLap);

  var isTooSlow = false;

  if (wearPenalty > rejectThresholdSec) {
    isTooSlow = true;
  }

  var warmupPenalty = 0;

  // first lap on new tyres is always a bit slower
  if (age === 1) {
    warmupPenalty = outLapPenalty;
  }

  var lapTime = baseLapTime + baseOffset + wearPenalty + warmupPenalty - fuelGain;

  // if tyre is completely dead just set time to infinity
  if (isTooSlow === true) {
    lapTime = Number.POSITIVE_INFINITY;
  }

  return {
    time: lapTime,
    wearPenalty: wearPenalty,
    invalid: isTooSlow
  };
}


module.exports = {
  BASE_COMPOUNDS: BASE_COMPOUNDS,
  WEAR_PARAMS: WEAR_PARAMS,
  getTrackDegFactor: getEnvDegFactor,
  tyreWearPenalty: tyreWearPenalty,
  calcLapTimeWithWear: calcLapTimeWithWear
};