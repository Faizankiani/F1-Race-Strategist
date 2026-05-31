// chart variables to store the 3 charts

var chartLap = null;
var chartFuel = null;
var chartTyre = null;

// this function registers the annotation plugin
// I had to add this because pit lines werent showing up
function setupPlugin() {
    if (window.ChartAnnotation) {
        window.Chart.register(window.ChartAnnotation);
    } else if (window["chartjs-plugin-annotation"]) {
        window.Chart.register(window["chartjs-plugin-annotation"]);
    }
}

// makes the options for each chart
// yLabel is what shows on y axis, title is the chart title
function getChartOptions(yLabel, title) {
    var options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false
            },
            title: {
                display: true,
                text: title,
                color: "#e9e9e9",
                font: {
                    size: 14
                }
            },
            tooltip: {},
            annotation: {
                annotations: {}
            }
        },
        scales: {
            x: {
                title: {
                    display: true,
                    text: "Lap"
                }
            },
            y: {
                title: {
                    display: true,
                    text: yLabel
                }
            }
        }
    };
    return options;
}

// this creates the 3 charts if they dont exist yet
export function ensureCharts() {
    setupPlugin();

    // create lap time chart
    if (chartLap == null) {
        var c1 = document.getElementById("lapChart");
        if (c1 != null) {
            chartLap = new window.Chart(c1, {
                type: "line",
                data: {
                    labels: [],
                    datasets: []
                },
                options: getChartOptions("Lap Time (s)", "Lap Time Evolution")
            });
        }
    }

    // create fuel chart
    if (chartFuel == null) {
        var c2 = document.getElementById("fuelChart");
        if (c2 != null) {
            chartFuel = new window.Chart(c2, {
                type: "line",
                data: {
                    labels: [],
                    datasets: []
                },
                options: getChartOptions("Fuel Load (kg)", "Fuel Mass")
            });
        }
    }

    // create tyre chart
    if (chartTyre == null) {
        var c3 = document.getElementById("tyreChart");
        if (c3 != null) {
            chartTyre = new window.Chart(c3, {
                type: "line",
                data: {
                    labels: [],
                    datasets: []
                },
                options: getChartOptions("Tyre Wear (s penalty)", "Tyre Degradation")
            });
        }
    }
}

// adds vertical lines where pit stops happen
function getPitLines(pitArray) {
    var result = {};

    if (!Array.isArray(pitArray)) {
        return result;
    }

    for (var i = 0; i < pitArray.length; i++) {
        var lap = pitArray[i];
        var keyName = "pit_" + i + "_" + lap;

        result[keyName] = {
            type: "line",
            xMin: lap,
            xMax: lap,
            borderColor: "rgba(255,154,60,0.9)",
            borderWidth: 2,
            label: {
                enabled: true,
                content: "Pit",
                backgroundColor: "rgba(255,154,60,0.15)",
                color: "#111",
                position: "start"
            },
            scaleID: "x"
        };
    }

    return result;
}

// main function to update all charts with new strategy data
export function renderStrategyCharts(strategy) {
    ensureCharts();

    // check everything exists before doing anything
    if (strategy == null) return;
    if (chartLap == null) return;
    if (chartFuel == null) return;
    if (chartTyre == null) return;

    var series = strategy.lapSeries;
    if (!series) {
        series = [];
    }

    // pull out the data i need from each lap
    var lapLabels = [];
    var lapTimes = [];
    var fuelLoads = [];
    var tyreWears = [];

    for (var i = 0; i < series.length; i++) {
        lapLabels.push(series[i].lap);
        lapTimes.push(series[i].time);
        fuelLoads.push(series[i].fuelLoad);
        tyreWears.push(series[i].tyrePenalty);
    }

    // store pit laps so i can check them later
    var pitLapsArray = strategy.pitLaps || [];
    var pitLapNumbers = [];
    for (var j = 0; j < pitLapsArray.length; j++) {
        pitLapNumbers.push(Number(pitLapsArray[j]));
    }

    // get the fastest lap number if there is one
    var fastestLap = -1;
    if (strategy.fastestLap && strategy.fastestLap.lapNumber) {
        fastestLap = strategy.fastestLap.lapNumber;
    }

    // figure out point size for each dot on the chart
    function getPointSize(ctx) {
        var lap = lapLabels[ctx.dataIndex];
        if (lap == fastestLap) {
            return 5;
        }
        if (pitLapNumbers.indexOf(lap) !== -1) {
            return 3;
        }
        return 0;
    }

    // figure out point color
    function getPointColor(ctx) {
        var lap = lapLabels[ctx.dataIndex];
        if (lap == fastestLap) {
            return "#d8b4fe";
        }
        return "#ff9a3c";
    }

    // get the pit stop lines
    var pitLines = getPitLines(strategy.pitLaps || []);

    // update lap time chart
    chartLap.data.labels = lapLabels;
    chartLap.data.datasets = [{
        label: "Lap Time (s)",
        data: lapTimes,
        borderColor: "#1976d2",
        backgroundColor: "rgba(25,118,210,0.2)",
        tension: 0.3,
        fill: false,
        pointRadius: getPointSize,
        pointBackgroundColor: getPointColor,
        pointBorderColor: getPointColor,
        pointHoverRadius: 6
    }];
    if (chartLap.options.plugins.annotation) {
        chartLap.options.plugins.annotation.annotations = pitLines;
    }
    chartLap.update();

    // update fuel chart
    chartFuel.data.labels = lapLabels;
    chartFuel.data.datasets = [{
        label: "Fuel Load (kg)",
        data: fuelLoads,
        borderColor: "#2e7d32",
        backgroundColor: "rgba(46,125,50,0.2)",
        tension: 0.3,
        fill: false,
        pointRadius: getPointSize,
        pointBackgroundColor: getPointColor,
        pointBorderColor: getPointColor,
        pointHoverRadius: 6
    }];
    if (chartFuel.options.plugins.annotation) {
        chartFuel.options.plugins.annotation.annotations = pitLines;
    }
    chartFuel.update();

    // update tyre chart
    chartTyre.data.labels = lapLabels;
    chartTyre.data.datasets = [{
        label: "Tyre Wear (s penalty)",
        data: tyreWears,
        borderColor: "#c62828",
        backgroundColor: "rgba(198,40,40,0.2)",
        tension: 0.3,
        fill: false,
        pointRadius: getPointSize,
        pointBackgroundColor: getPointColor,
        pointBorderColor: getPointColor,
        pointHoverRadius: 6
    }];
    if (chartTyre.options.plugins.annotation) {
        chartTyre.options.plugins.annotation.annotations = pitLines;
    }
    chartTyre.update();
}