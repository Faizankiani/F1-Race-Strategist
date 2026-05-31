// Import required helper modules
import { $ } from './dom.js';
import { apiFetch } from './api.js';
import { validateAll as validateAllFields, validateField as validateOneField } from './validation.js';
import { renderStrategyCharts } from './charts.js';
import { renderStrategyCards, setStrategyStatus } from './strategies.js';
import { initConfigModalBindings } from './modal.js';
import { setRaceSetupTitle, currentLoadedConfigName, isPopulatingForm, setCurrentLoadedConfigName } from './state.js';


// ---------------------------------------------------
//   Loading Spinner Helpers
// --------------------------------------------------- 

// Show loading overlay with optional message
function showLoadingSpinner(messageText) {
  var overlay = document.getElementById('loadingOverlay');
  var text = document.getElementById('loadingText');

  if (text && messageText) {
    text.textContent = messageText;
  }

  if (overlay) {
    overlay.classList.remove('hidden');
  }
}

// Hide loading overlay
function hideLoadingSpinner() {
  var overlay = document.getElementById('loadingOverlay');
  if (overlay) {
    overlay.classList.add('hidden');
  }
}


// ---------------------------------------------------
//  Backend Connection Test
// --------------------------------------------------- 

var testButton = $("testBtn");

if (testButton) {
  testButton.addEventListener("click", async function () {

    var output = $("output");
    if (output) {
      output.textContent = "Testing...";
    }

    try {
      var response = await apiFetch("/api/hello");

      if (!response.ok) {
        throw new Error("HTTP " + response.status);
      }

      var data = await response.json();

      if (output) {
        output.textContent = data && data.message ? data.message : "OK";
      }

    } catch (error) {
      console.error(error);

      if (output) {
        output.textContent = "Error connecting to backend.";
      }
    }

  });
}


// ---------------------------------------------------
//   Main Application Logic
// --------------------------------------------------- 

var raceForm = $("raceForm");

if (raceForm) {

  // Validate one field
  function validateSingleField(fieldId) {
    validateOneField(fieldId);
  }

  // Validate entire form
  function validateAll() {
    return validateAllFields();
  }

  // When user types in form
  raceForm.addEventListener("input", function (event) {

    var target = event.target;

    if (target && target.id) {
      validateSingleField(target.id);
    }

    // If user edits a loaded preset, reset title
    if (!isPopulatingForm && currentLoadedConfigName) {
      setCurrentLoadedConfigName(null);
      setRaceSetupTitle();
    }
  });

  // When dropdown or change event happens
  raceForm.addEventListener("change", function (event) {

    var target = event.target;

    if (target && target.id) {
      validateSingleField(target.id);
    }

    if (!isPopulatingForm && currentLoadedConfigName) {
      setCurrentLoadedConfigName(null);
      setRaceSetupTitle();
    }
  });


  // ---------------------------------------------------
  //  Render Basic Lap Results
  // --------------------------------------------------- 

  function renderResultsOutput(laps) {

    var resultsArea = $("resultsOutput");
    if (!resultsArea) return;

    if (!laps || laps.length === 0) {
      resultsArea.textContent = "No laps returned.";
      return;
    }

    var total = laps.length;
    var min = laps[0];
    var max = laps[0];
    var sum = 0;

    // Calculate min, max and average manually
    for (var i = 0; i < laps.length; i++) {
      var lapTime = laps[i];

      if (lapTime < min) min = lapTime;
      if (lapTime > max) max = lapTime;

      sum += lapTime;
    }

    var avg = sum / total;

    var previewCount = total > 10 ? 10 : total;
    var previewText = "";

    for (var j = 0; j < previewCount; j++) {
      previewText += "Lap " + (j + 1) + ": " + laps[j].toFixed(3) + "s\n";
    }

    resultsArea.textContent =
      "Total laps: " + total + "\n" +
      "Min: " + min.toFixed(3) + "s  " +
      "Max: " + max.toFixed(3) + "s  " +
      "Avg: " + avg.toFixed(3) + "s\n\n" +
      "First " + previewCount + " laps:\n" +
      previewText + "\n" +
      "All laps:\n" +
      JSON.stringify(laps);
  }


  // ---------------------------------------------------
  //  Strategy Handling
  // --------------------------------------------------- 

  var strategiesByStops = {};
  var recommendedStops = null;
  var currentStops = null;
  var overallBestRef = null;

  function onSelectStops(stops, strategy, cardElement) {

    currentStops = stops;

    // Update chart
    renderStrategyCharts(strategy);

    // Re-render strategy cards
    renderStrategyCards(strategiesByStops, overallBestRef, currentStops, onSelectStops);

    // Small visual feedback effect
    if (cardElement) {
      cardElement.style.transform = "scale(0.99)";
      setTimeout(function () {
        cardElement.style.transform = "";
      }, 120);
    }
  }


  async function fetchAndRenderStrategies(config) {

    setStrategyStatus("Optimising strategies...");
    showLoadingSpinner("Optimising strategies...");

    try {
      var response = await apiFetch("/api/generate-strategies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config || {})
      });

      if (!response.ok) {
        throw new Error("HTTP " + response.status);
      }

      var data = await response.json();

      strategiesByStops = data.best || {};
      recommendedStops = data.overallBest ? data.overallBest.stops : null;
      overallBestRef = data.overallBest || null;
      currentStops = recommendedStops;

      renderStrategyCards(strategiesByStops, overallBestRef, currentStops, onSelectStops);

      var defaultStrategy = null;

      if (overallBestRef) {
        defaultStrategy = overallBestRef;

      } else if (strategiesByStops[currentStops]) {
        defaultStrategy = strategiesByStops[currentStops];

      } else if (strategiesByStops[3]) {
        defaultStrategy = strategiesByStops[3];

      } else if (strategiesByStops[2]) {
        defaultStrategy = strategiesByStops[2];

      } else if (strategiesByStops[1]) {
        defaultStrategy = strategiesByStops[1];
      }

      renderStrategyCharts(defaultStrategy);

      if (!defaultStrategy) {
        setStrategyStatus("No valid strategies found for these inputs.");
      }

    } catch (error) {
      console.error("Failed to fetch strategies", error);
      setStrategyStatus("Failed to fetch strategies. Is the backend running?");
    } finally {
      hideLoadingSpinner();
    }
  }


  // ---------------------------------------------------
  //  Form Submission
  // ---------------------------------------------------

  raceForm.addEventListener("submit", async function (event) {

    event.preventDefault();

    var errors = validateAll();
    var hasErrors = Object.keys(errors).length > 0;
    var results = $("resultsOutput");

    if (hasErrors) {
      alert("Cannot run simulation: Please correct the highlighted fields.");
      if (results) {
        results.textContent = "Please correct the highlighted fields.";
      }
      return;
    }

    // Build config object from form
    var raceConfig = {
      totalLaps: $("totalLaps").value,
      trackLength: $("trackLength").value,
      fuelLoad: $("fuelLoad").value,
      degradation: $("degradation").value,
      totalRainfall: $("totalRainfall").value,
      temperature: $("temperature").value,
      baseLapTime: $("baseLapTime").value,
      pitStopLoss: $("pitStopLoss").value
    };

    try {

      showLoadingSpinner("Saving and calculating...");

      // Save config first
      var saveResponse = await apiFetch("/api/race-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(raceConfig)
      });

      if (!saveResponse.ok) {
        throw new Error("HTTP " + saveResponse.status);
      }

      var saveData = await saveResponse.json();

      window.raceConfig = saveData.saved || raceConfig;

      if (results) {
        results.textContent = "Calculating lap times...";
      }

      // Calculate laps
      var calcResponse = await apiFetch("/api/calculate-laps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(window.raceConfig)
      });

      if (!calcResponse.ok) {
        throw new Error("HTTP " + calcResponse.status);
      }

      var calcData = await calcResponse.json();

      if (!calcData || !calcData.ok) {
        throw new Error("Calculation failed");
      }

      renderResultsOutput(calcData.laps || []);

      // Generate strategies
      await fetchAndRenderStrategies(window.raceConfig);

    } catch (error) {

      console.error("Simulation failed", error);

      if (results) {
        results.textContent = "Failed to run simulation.";
      }

    } finally {
      hideLoadingSpinner();
    }

  });

}


// ---------------------------------------------------
//   Initialise Modal System
// --------------------------------------------------- 

function init() {
  initConfigModalBindings();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}