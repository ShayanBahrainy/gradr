const RESULT_SLOT_COUNT = 5;

function loadSavedClasses() {
    chrome.runtime.sendMessage({type: "load_classes"}, (class_data) => {
        let i = 1;
        for (let data of class_data) {
            if (i == 6) break;            
            const element = document.getElementById("saved-class-" + i);

            _display_saved(element, data);

            i++;
        }

        for (;i<6;i++) {
            document.getElementById("saved-class-" + i).classList.add("invisible");
        }

    })
}

function displayResults(response) {
    const results = response["results"];
    const saved = response["saved"];

    document.getElementById("saved-classes").classList.add("invisible");
    document.getElementById("result-classes").classList.remove("invisible");


    if (results.length == 0) {
        document.getElementById("no-result-message").classList.remove("invisible");
    }
    else {
        document.getElementById("no-result-message").classList.add("invisible");
    }
    let i = 1
    for (let result of results) {
        const element = document.getElementById("result-class-" + i);

        _display_result(element, result, saved);

        i++;
    }


    for (;i<6;i++) {
        document.getElementById("result-class-" + i).classList.add("invisible");
    }
}

function _display_result(element, result, saved) {
    element.classList.remove("invisible");

    element.dataset.id = result["id"];

    element.querySelector(".left-group > .class-name").innerHTML = result["name"];
    element.querySelector(".left-group > .teacher-name").innerHTML = result["teacher_name"];
    element.querySelector(".right-group > .subinfo > .average-percent").innerHTML = result["numeric"] + "%";
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
    
    element.querySelector(".left-group > .class-name").innerHTML = data["name"];
    element.querySelector(".left-group > .teacher-name").innerHTML = data["teacher_name"];
    element.querySelector(".right-group > .subinfo > .average-percent").innerHTML = data["numeric"] + "%";
    element.querySelector(".right-group > .subinfo > .people-count").innerHTML = data["sample_count"] + (data["sample_count"] == 1 ? " person" : " people") + " reporting...";
    element.querySelector(".right-group .average-letter").innerHTML = data["letter"];

    element.dataset.id = data["id"];
}

function search(searchElement) {
    if (searchElement.value.trim() === '') {
        document.getElementById("saved-classes").classList.remove("invisible");
        document.getElementById("result-classes").classList.add("invisible");
        document.getElementById("no-result-message").classList.add("invisible");
        return;
    };

    chrome.runtime.sendMessage({type: "search", query: searchElement.value.trim()}, displayResults);
}

function saveClass(ev) {
    chrome.runtime.sendMessage({type: "save_class", id: ev.target.closest(".class").dataset.id});

    const clss = ev.target.closest(".class");

    clss.querySelector(".right-group > .buttons-holder > .add-button").classList.add("invisible");
    clss.querySelector(".right-group > .buttons-holder > .remove-button").classList.remove("invisible");
    
    setTimeout(loadSavedClasses, 200);
}

function removeClass(ev) {
    chrome.runtime.sendMessage({type: "remove_class", id: ev.target.closest(".class").dataset.id});
    
    const clss = ev.target.closest(".class");

    clss.querySelector(".right-group > .buttons-holder > .add-button").classList.remove("invisible");
    clss.querySelector(".right-group > .buttons-holder > .remove-button").classList.add("invisible");

    setTimeout(loadSavedClasses, 200);
}

function openPage(page) {
    chrome.runtime.sendMessage({type:"open_page", page:page}, function (response) {
        if (response["result"] == "close") {
            window.close();
        }
    })
}

function toggleRemove(ev) {
    const element = ev.target;
    
    console.log(element);
}

document.addEventListener("DOMContentLoaded", () => {
    let timer
    document.getElementById('search-field').addEventListener("input", (ev) => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(search, 500, ev.target);
    })

    document.getElementById('back-button').addEventListener("click", () => {
        openPage('html/index.html');
    })

    document.addEventListener("contextmenu", (ev) => {
        //ev.preventDefault();
        document.getElementById("context-menu").style.left = `${ev.pageX}px`;
        document.getElementById("context-menu").style.top = `${ev.pageY}px`;

        document.getElementById("context-menu").classList.remove("invisible");

        let isClass = false;
        for (let element of document.elementsFromPoint(ev.pageX, ev.pageY)) {
            if (element.classList.contains("class"))  {
                isClass = true;
                document.getElementById("context-down").dataset.id = element.dataset.id;
                document.getElementById("context-up").dataset.id = element.dataset.id;
                document.getElementById("context-delete").dataset.id = element.dataset.id;
            }
        }

        if (!isClass) {
            document.querySelectorAll(".class-only").forEach((el) => {el.classList.add("grey-out")});
        }
        else {
            document.querySelectorAll(".class-only").forEach((el) => {el.classList.remove("grey-out")});

        }

    });

    document.addEventListener("click", (ev) => {
        const elements = document.elementsFromPoint(ev.pageX, ev.pageY);

        for (let el of elements) {
            if (el.classList.contains("context-menu")) return;
        }

        document.getElementById("context-menu").classList.add("invisible");
    })

    document.getElementById("context-refresh").addEventListener("click", () => {location=location})
    document.getElementById("context-delete").addEventListener("click", function() {
        chrome.runtime.sendMessage({type: "remove_class", id: this.dataset.id});
        setTimeout(loadSavedClasses, 200);
    });

    document.getElementById("context-up").addEventListener("click", function () {
        chrome.runtime.sendMessage({type: "up_class", id: this.dataset.id});

        const saved_classes = document.getElementById("saved-classes");
        const classes = saved_classes.children;

        for (let i = 0; i < classes.length; i++) {
            if (classes[i].dataset.id == this.dataset.id) {
                if (i > 0) {
                    saved_classes.insertBefore(classes[i], classes[i - 1]);
                    break;
                }
            }
        }
    });

    document.getElementById("context-down").addEventListener("click", function(){
        console.log(this);
        chrome.runtime.sendMessage({type: "down_class", id: this.dataset.id});

        const saved_classes = document.getElementById("saved-classes");
        const classes = saved_classes.children;

        for (let i = 0; i < classes.length; i++) {
            if (classes[i].dataset.id == this.dataset.id) {
                if (i < classes.length - 1 && !classes[i + 1].classList.contains("invisible")) {
                    saved_classes.insertBefore(classes[i], classes[i + 1].nextSibling);
                    break;
                }
            }
        }
    })

    for (let i = 1; i < 6; i++) {
        const element = document.getElementById("result-class-"+i);
        element.querySelector(".buttons-holder > .add-button").addEventListener("click", saveClass);
        element.querySelector(".buttons-holder > .remove-button").addEventListener("click", removeClass);
        element.addEventListener("dblclick", toggleRemove);
    }
    loadSavedClasses();
})