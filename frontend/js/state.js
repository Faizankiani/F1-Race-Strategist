// storing some shared stuff that other files need to use

// default title for the race setup section
export var DEFAULT_RACE_SETUP_TITLE = "Race Setup";

// stores the name of the config that was loaded
// starts as null because nothing is loaded yet
export var currentLoadedConfigName = null;

// this is used to stop validation running when we are filling the form ourselves
export var isPopulatingForm = false;


// updates the config name
export function setCurrentLoadedConfigName(name) {
    currentLoadedConfigName = name;
}


// sets the populating flag to true or false
export function setIsPopulatingForm(flag) {
    // converting to boolean just to be safe
    if (flag) {
        isPopulatingForm = true;
    } else {
        isPopulatingForm = false;
    }
}


// changes the title text above the race setup form
export function setRaceSetupTitle(name) {
    var titleEl = document.getElementById("raceSetupTitle");

    // if element doesnt exist just stop here
    if (titleEl == null) {
        return;
    }

    // check if name is actually a valid string with something in it
    var cleanName = "";
    if (name != null) {
        cleanName = String(name).trim();
    }

    if (cleanName !== "") {
        titleEl.textContent = cleanName;
    } else {
        // nothing valid so use the default title
        titleEl.textContent = DEFAULT_RACE_SETUP_TITLE;
    }
}