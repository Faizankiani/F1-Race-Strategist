// This function calculates lap times assuming the driver never pits.

function calculateLapTimes(raceConfiguration, modelParameters) {

  // Make sure modelParameters exists so we don’t get errors
  if (!modelParameters) {
    modelParameters = {};
  }

  // Convert frontend string inputs into numbers
  var numberOfLaps = parseInt(raceConfiguration.totalLaps, 10);
  var baseLapTimeSeconds = Number(raceConfiguration.baseLapTime);
  var initialFuelLoadKg = Number(raceConfiguration.fuelLoad);

  // If lap count is invalid, return an empty array
  if (isNaN(numberOfLaps) || numberOfLaps <= 0) {
    return [];
  }

  // If base lap time is invalid, return zero lap times
  if (isNaN(baseLapTimeSeconds) || baseLapTimeSeconds <= 0) {
    var zeroedLaps = [];
    for (var i = 0; i < numberOfLaps; i++) {
      zeroedLaps.push(0);
    }
    return zeroedLaps;
  }

  // Default tyre degradation values
  var degradationBase = 0.05;
  var degradationGrowthFactor = 0.03;

  if (modelParameters.tyreWearBaseSec !== undefined) {
    degradationBase = Number(modelParameters.tyreWearBaseSec);
  }

  if (modelParameters.tyreWearGrowth !== undefined) {
    degradationGrowthFactor = Number(modelParameters.tyreWearGrowth);
  }

  // Default fuel benefit per kg burned
  var timeGainPerKgOfFuel = 0.005;

  if (modelParameters.fuelPerKgBenefit !== undefined) {
    timeGainPerKgOfFuel = Number(modelParameters.fuelPerKgBenefit);
  } else if (modelParameters.fuelPerKgPenalty !== undefined) {
    timeGainPerKgOfFuel = Number(modelParameters.fuelPerKgPenalty);
  }

  // Calculate fuel burned per lap
  var fuelBurnPerLapInKg = 0;

  if (numberOfLaps > 0) {
    fuelBurnPerLapInKg = initialFuelLoadKg / numberOfLaps;
  }

  var calculatedLapTimes = [];

  // Go through each lap one by one
  for (var currentLapNumber = 1; currentLapNumber <= numberOfLaps; currentLapNumber++) {

    // -------------------------------
    // 1. Calculate tyre wear penalty
    // -------------------------------

    var timeLostToTyreWear = 0;

    if (degradationGrowthFactor === 0) {
      // Simple linear degradation
      timeLostToTyreWear = degradationBase * currentLapNumber;
    } else {
      // Slightly compounding degradation
      var growthMultiplier = 1 + degradationGrowthFactor;

      // Instead of using a compact formula,
      // we calculate the exponential part step by step
      var exponentialFactor = Math.pow(growthMultiplier, currentLapNumber);

      timeLostToTyreWear =
        degradationBase * (exponentialFactor - 1) / degradationGrowthFactor;
    }

    // -------------------------------
    // 2. Calculate fuel benefit
    // -------------------------------

    var lapsCompletedPreviously = currentLapNumber - 1;
    var totalFuelBurnedSoFar = fuelBurnPerLapInKg * lapsCompletedPreviously;

    var timeGainedFromFuel =
      timeGainPerKgOfFuel * totalFuelBurnedSoFar;

    // -------------------------------
    // 3. Final lap time calculation
    // -------------------------------

    var finalLapTime =
      baseLapTimeSeconds + timeLostToTyreWear - timeGainedFromFuel;

    // Round to 3 decimal places
    var roundedLapTime = Number(finalLapTime.toFixed(3));

    calculatedLapTimes.push(roundedLapTime);
  }

  return calculatedLapTimes;
}

module.exports = {
  calculateLapTimes: calculateLapTimes
};