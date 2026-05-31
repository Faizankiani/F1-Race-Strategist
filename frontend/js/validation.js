// helper functions for reading and checking user inputs

// converts a value to a whole number
export function integer(value) {
    var cleaned = String(value).trim();
    var number = parseInt(cleaned, 10);

    if (isNaN(number)) {
        return NaN;
    }
    return number;
}

// converts a value to a decimal number
export function decimal(value) {
    var cleaned = String(value).trim();
    var number = parseFloat(cleaned);

    if (isNaN(number)) {
        return NaN;
    }
    return number;
}


// shows a red error message under an input field
export function showError(inputElement, message) {
    inputElement.classList.add("input-error");

    var next = inputElement.nextElementSibling;
    var errorBox;

    // reuse existing error box if its already there
    if (next != null && next.classList != null && next.classList.contains("error-text")) {
        errorBox = next;
    } else {
        // make a new one and insert it after the input
        errorBox = document.createElement("div");
        errorBox.className = "error-text";
        inputElement.insertAdjacentElement("afterend", errorBox);
    }

    // sometimes duplicates appear so remove them
    var check = errorBox.nextElementSibling;
    while (check != null && check.classList != null && check.classList.contains("error-text")) {
        var removeMe = check;
        check = check.nextElementSibling;
        removeMe.remove();
    }

    errorBox.textContent = message;
}

// clears error message and red styling from an input
export function clearError(inputElement) {
    inputElement.classList.remove("input-error");

    var next = inputElement.nextElementSibling;
    while (next != null && next.classList != null && next.classList.contains("error-text")) {
        var removeMe = next;
        next = next.nextElementSibling;
        removeMe.remove();
    }
}


// returns all the validation rules for each input field
export function getFieldValidators() {
    return {
        totalLaps: function(el) {
            var raw = el.value;

            if (raw.trim() === "") {
                return "Total Laps is required";
            }

            var num = integer(raw);

            if (isNaN(num)) {
                return "Total Laps must be an integer";
            }
            if (num < 10 || num > 100) {
                return "Total Laps must be 10-100";
            }
            return "";
        },

        trackLength: function(el) {
            var raw = el.value;

            if (raw.trim() === "") {
                return "Track Length is required";
            }

            var num = decimal(raw);

            if (isNaN(num)) {
                return "Track Length must be a number";
            }
            if (num < 1.0 || num > 50.0) {
                return "Track Length must be 1.0-50.0 km";
            }
            return "";
        },

        fuelLoad: function(el) {
            var raw = el.value;

            if (raw.trim() === "") {
                return "Fuel Load is required";
            }

            var num = integer(raw);

            if (isNaN(num)) {
                return "Fuel Load must be an integer";
            }
            if (num < 10 || num > 150) {
                return "Fuel Load must be 10-150";
            }
            return "";
        },

        degradation: function(el) {
            var value = el.value;

            if (!value) {
                return "Degradation is required";
            }

            // manually check each valid option
            if (value !== "Low" && value !== "Medium" && value !== "High") {
                return "Invalid Degradation";
            }

            return "";
        },

        totalRainfall: function(el) {
            var raw = el.value.trim();

            // this field is optional so empty is fine
            if (raw === "") {
                return "";
            }

            var num = decimal(raw);

            if (isNaN(num)) {
                return "Total Rainfall must be a number";
            }
            if (num < 0) {
                return "Total Rainfall cannot be negative";
            }
            if (num > 1000) {
                return "Total Rainfall is unrealistically high";
            }

            return "";
        },

        temperature: function(el) {
            var raw = el.value;

            if (raw.trim() === "") {
                return "Temperature is required";
            }

            var num = integer(raw);

            if (isNaN(num)) {
                return "Temperature must be an integer";
            }
            if (num < -10 || num > 50) {
                return "Temperature must be -10 to 50°C";
            }

            return "";
        },

        baseLapTime: function(el) {
            var raw = el.value;

            if (raw.trim() === "") {
                return "Base Lap Time is required";
            }

            var num = integer(raw);

            if (isNaN(num)) {
                return "Base Lap Time must be an integer";
            }
            if (num < 30 || num > 150) {
                return "Base Lap Time must be 30-150s";
            }

            return "";
        },

        pitStopLoss: function(el) {
            var raw = el.value;

            if (raw.trim() === "") {
                return "Pit Stop Loss is required";
            }

            var num = integer(raw);

            if (isNaN(num)) {
                return "Pit Stop Loss must be an integer";
            }
            if (num < 10 || num > 60) {
                return "Pit Stop Loss must be 10-60s";
            }

            return "";
        }
    };
}


// validates one field by its id
export function validateField(id) {
    var el = document.getElementById(id);
    var validators = getFieldValidators();

    if (el == null || validators[id] == null) {
        return "";
    }

    var result = validators[id](el);

    if (result) {
        showError(el, result);
    } else {
        clearError(el);
    }

    return result;
}


// validates all fields at once and returns any errors
export function validateAll() {
    var validators = getFieldValidators();
    var ids = Object.keys(validators);
    var errors = {};

    for (var i = 0; i < ids.length; i++) {
        var id = ids[i];
        var msg = validateField(id);
        if (msg) {
            errors[id] = msg;
        }
    }

    return errors;
}