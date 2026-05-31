import { renderStrategyCharts } from "./charts.js";

// Turns a numeric time (in seconds) into a readable hh:mm:ss.ms
export function formatTime(totalSeconds) {
    if (totalSeconds == null || !isFinite(totalSeconds)) {
        return "—";
    }

    // Split seconds into components
    const fullSeconds = Math.floor(totalSeconds);
    const ms = Math.round((totalSeconds - fullSeconds) * 1000);
    const secs = fullSeconds % 60;
    const mins = Math.floor(fullSeconds / 60) % 60;
    const hrs = Math.floor(fullSeconds / 3600);

    // simple helper to left-pad
    const pad = (num, digits = 2) => {
        return String(num).padStart(digits, "0");
    };

    // Hours are only shown if non-zero
    const hrPart = hrs > 0 ? pad(hrs) + ":" : "";

    return `${hrPart}${pad(mins)}:${pad(secs)}.${pad(ms, 3)}`;
}

// Builds "Lap X–Y: Compound" lines for each stint. 
export function buildStintSchedule(strategy) {
    if (!strategy || !Array.isArray(strategy.stints)) {
        return [];
    }

    let lapStart = 1;
    const result = [];

    strategy.stints.forEach(stint => {
        // Sometimes the backend gives .laps, sometimes only lapTimes[]
        let stintLength = 0;
        if (stint.laps) {
            stintLength = stint.laps;
        } else if (Array.isArray(stint.lapTimes)) {
            stintLength = stint.lapTimes.length;
        }

        if (!stintLength) {
            return;
        }

        const lapEnd = lapStart + stintLength - 1;
        const compoundName = stint.compound || stint.tyre || "Tyre";

        result.push(`Lap ${lapStart}–${lapEnd}: ${compoundName}`);

        lapStart = lapEnd + 1;
    });

    return result;
}

// Just updates the text near the top that explains the strategy state.
export function setStrategyStatus(msg) {
    const el = document.getElementById("strategyStatus");
    if (el) {
        el.textContent = msg || "";
    }
}


// -------------------------------------------------------------
// Renders all strategy cards (1 stop, 2 stops, 3 stops).
// bestByStops - object keyed by stop count (1,2,3)
// overallBest - whichever strategy is considered globally best
// currentStops - the one currently selected/highlighted
// onSelect - callback when a card is clicked
// -------------------------------------------------------------
export function renderStrategyCards(bestByStops, overallBest, currentStops, onSelect) {
    const container = document.getElementById("strategyCards");
    if (!container) return;

    container.innerHTML = "";

    // Only show counts that actually exist in the results
    const stopCounts = [1, 2, 3].filter(n => bestByStops && bestByStops[n]);

    if (stopCounts.length === 0) {
        setStrategyStatus("No strategies found. Try adjusting inputs.");
        return;
    }

    setStrategyStatus(""); // Clear status if we have results


    stopCounts.forEach(stops => {
        const s = bestByStops[stops];

        // Determine whether this one is currently selected
        const isSelected = (currentStops === stops);

        // Some strategies might actually do a different number of stops
        let actualStopsText = "";
        if (s.actualStops != null && s.actualStops !== stops) {
            const label = `Actual: ${s.actualStops} stop${s.actualStops === 1 ? "" : "s"}`;
            actualStopsText = `<span class="pill">${label}</span>`;
        }

        // Whether this strategy is the absolute best over everything
        const isOptimal =
            overallBest &&
            (overallBest.targetStops === stops || overallBest.actualStops === stops);

        const pitList = s.pitLaps || [];
        const scheduleText = buildStintSchedule(s);

        // Fastest lap display
        let flText = "";
        if (s.fastestLap) {
            flText =
                `<div class="sub-meta">
                    <span class="fl-icon"></span>
                    Fastest Lap:
                    <strong>${s.fastestLap.time.toFixed(3)}s</strong>
                    (L${s.fastestLap.lapNumber}, ${s.fastestLap.compound})
                 </div>`;
        }

        // Build a card element
        const card = document.createElement("div");
        card.className = "strategy-card" + (isSelected ? " selected" : "");

        card.innerHTML = `
            <div class="title">
                <div>${stops} stop${stops === 1 ? "" : "s"}</div>
                <div>
                    <span class="pill">Pit laps: ${pitList.length ? pitList.join(", ") : "—"}</span>
                    ${actualStopsText}
                    ${isOptimal ? `<span class="pill opt">Optimal</span>` : ""}
                </div>
            </div>

            <div class="meta">
                <div>Total time:
                    <strong>${formatTime(s.totalTime)}</strong>
                </div>
            </div>

            ${flText}

            <div class="schedule">
                ${scheduleText.map(seg => `<span class="seg">${seg}</span>`).join("")}
            </div>
        `;

        // Clicking a card should update selection + charts
        card.addEventListener("click", () => {
            onSelect(stops, s, card);
        });

        container.appendChild(card);
    });
}