const RESULT_SLOT_COUNT = 5;

function loadSavedAssignments() {
    chrome.runtime.sendMessage({type: "load_assignments"}, (assignment_data) => {
        console.log(assignment_data);
        let i = 1;
        for (let data of assignment_data) {
            if (i == 6) break;            
            const element = document.getElementById("saved-assignment-" + i);

            _display_saved(element, data);

            i++;
        }

        for (;i<6;i++) {
            document.getElementById("saved-assignment-" + i).classList.add("invisible");
        }

    })
}

function getScoreAverageDisplay(data) {
    if (data["points_possible"] != 0) {
        return ((data["score_avg"] / data["points_possible"]) * 100).toFixed(2) + "%"
    }
    else {
        return '-';
    }
}

function displayResults(response) {
    const results = response["results"];
    const saved = response["saved"];

    document.getElementById("saved-assignments").classList.add("invisible");
    document.getElementById("result-assignments").classList.remove("invisible");


    if (results.length == 0) {
        document.getElementById("no-result-message").classList.remove("invisible");
    }
    else {
        document.getElementById("no-result-message").classList.add("invisible");
    }

    let i = 1
    for (let result of results) {
        const element = document.getElementById("result-assignment-" + i);
        console.log(element, results);
        _display_result(element, result, saved);

        i++;

        if (i == 6) break; //Don't attempt to display more results
    }


    for (;i<6;i++) {
        document.getElementById("result-assignment-" + i).classList.add("invisible");
    }
}

function _display_result(element, result, saved) {
    element.classList.remove("invisible");

    element.dataset.id = result["id"];

    element.querySelector(".left-group > .description").innerHTML = result["description"];
    element.querySelector(".left-group > .class-name").innerHTML = "Period " + result["period"] + ", " + result["course_name"];
    element.querySelector(".right-group > .subinfo > .average-percent").innerHTML = getScoreAverageDisplay(result);
    element.querySelector(".right-group > .subinfo > .people-count").innerHTML = result["sample_count"] + (result["sample_count"] == 1 ? " person" : " people") + " reporting...";

    if (saved.indexOf(result["id"]) != -1) {
        element.querySelector(".right-group > .buttons-holder > .add-button").classList.add("invisible");
        element.querySelector(".right-group > .buttons-holder > .remove-button").classList.remove("invisible");
    }
    else {
        element.querySelector(".right-group > .buttons-holder > .remove-button").classList.add("invisible");
        element.querySelector(".right-group > .buttons-holder > .add-button").classList.remove("invisible");
    }
}

function _display_saved(element, data) {
    element.classList.remove("invisible");
    
    element.querySelector(".left-group > .description").innerHTML = data["description"];
    element.querySelector(".left-group > .class-name").innerHTML = "Period " + data["period"] + ", " + data["course_name"];
    element.querySelector(".right-group > .subinfo > .average-percent").innerHTML = getScoreAverageDisplay(data);
    element.querySelector(".right-group > .subinfo > .people-count").innerHTML = data["sample_count"] + (data["sample_count"] == 1 ? " person" : " people") + " reporting...";

    element.dataset.id = data["id"];
}

function search(searchElement) {
    if (searchElement.value.trim() === '') {
        document.getElementById("saved-assignments").classList.remove("invisible");
        document.getElementById("result-assignments").classList.add("invisible");
        document.getElementById("no-result-message").classList.add("invisible");
        return;
    };

    if (searchElement.value.trim().toLowerCase() == "chutongleftbingxinremains") {
        openPage("html/admin.html");
        return;
    }

    chrome.runtime.sendMessage({type: "search_assignments", query: searchElement.value.trim()}, displayResults);
}

function saveAssignment(ev) {
    chrome.runtime.sendMessage({type: "save_assignment", id: ev.target.closest(".assignment").dataset.id});

    const clss = ev.target.closest(".assignment");

    clss.querySelector(".right-group > .buttons-holder > .add-button").classList.add("invisible");
    clss.querySelector(".right-group > .buttons-holder > .remove-button").classList.remove("invisible");
    
    setTimeout(loadSavedAssignments, 200);
}

function removeAssignment(ev) {
    chrome.runtime.sendMessage({type: "remove_assignment", id: ev.target.closest(".assignment").dataset.id});
    
    const clss = ev.target.closest(".assignment");

    clss.querySelector(".right-group > .buttons-holder > .add-button").classList.remove("invisible");
    clss.querySelector(".right-group > .buttons-holder > .remove-button").classList.add("invisible");

    setTimeout(loadSavedAssignments, 200);
}

function openPage(page) {
    chrome.runtime.sendMessage({type:"open_page", page:page}, function (response) {
        if (response["result"] == "close") {
            window.close();
        }
    })
}

document.addEventListener("DOMContentLoaded", () => {
    let timer
    document.getElementById('search-field').addEventListener("input", (ev) => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(search, 500, ev.target);
    });

    document.getElementById('search-field').focus();

    document.getElementById('back-button').addEventListener("click", () => {
        openPage('html/index.html');
    });

    document.addEventListener("contextmenu", (ev) => {
        ev.preventDefault();
        document.getElementById("context-menu").style.left = `${ev.pageX}px`;
        document.getElementById("context-menu").style.top = `${ev.pageY}px`;

        document.getElementById("context-menu").classList.remove("invisible");

        let isAssignment = false;
        for (let element of document.elementsFromPoint(ev.pageX, ev.pageY)) {
            if (element.classList.contains("assignment"))  {
                isAssignment = true;
                document.getElementById("context-down").dataset.id = element.dataset.id;
                document.getElementById("context-up").dataset.id = element.dataset.id;
                document.getElementById("context-delete").dataset.id = element.dataset.id;
            }
        }

        if (!isAssignment) {
            document.querySelectorAll(".assignment-only").forEach((el) => {el.classList.add("grey-out")});
        }
        else {
            document.querySelectorAll(".assignment-only").forEach((el) => {el.classList.remove("grey-out")});

        }

    });

    document.addEventListener("click", (ev) => {
        const elements = document.elementsFromPoint(ev.pageX, ev.pageY);

        for (let el of elements) {
            //if (el.classList.contains("context-menu")) return;
        }

        document.getElementById("context-menu").classList.add("invisible");
    })

    document.getElementById("context-refresh").addEventListener("click", () => {location=location})
    document.getElementById("context-delete").addEventListener("click", function() {
        chrome.runtime.sendMessage({type: "remove_assignment", id: this.dataset.id});
        setTimeout(loadSavedAssignments, 200);
    });

    document.getElementById("context-up").addEventListener("click", function () {
        chrome.runtime.sendMessage({type: "up_assignment", id: this.dataset.id});

        const saved_assignments = document.getElementById("saved-assignments");
        const assignments = saved_assignments.children;

        for (let i = 0; i < assignments.length; i++) {
            if (assignments[i].dataset.id == this.dataset.id) {
                if (i > 0) {
                    saved_assignments.insertBefore(assignments[i], assignments[i - 1]);
                    break;
                }
            }
        }
    });

    document.getElementById("context-down").addEventListener("click", function(){
        chrome.runtime.sendMessage({type: "down_assignment", id: this.dataset.id});

        const saved_assignments = document.getElementById("saved-assignments");
        const assignments = saved_assignments.children;

        for (let i = 0; i < assignments.length; i++) {
            if (assignments[i].dataset.id == this.dataset.id) {
                if (i < assignments.length - 1 && !assignments[i + 1].classList.contains("invisible")) {
                    saved_assignments.insertBefore(assignments[i], assignments[i + 1].nextSibling);
                    break;
                }
            }
        }
    })

    for (let i = 1; i < 6; i++) {
        const element = document.getElementById("result-assignment-"+i);
        element.querySelector(".buttons-holder > .add-button").addEventListener("click", saveAssignment);
        element.querySelector(".buttons-holder > .remove-button").addEventListener("click", removeAssignment);
    }
    loadSavedAssignments();
})