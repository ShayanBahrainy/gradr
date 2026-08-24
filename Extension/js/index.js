const NUM_DIGITS = 6;

let current_email;

let CONNECTED;

function submitEmailCode() {
    let email_code = "";
    for (let i = 1; i <= NUM_DIGITS; i++) {
        const digit_element = document.getElementById("digit-" + i);
        if (isNaN(parseInt(digit_element.value))) return;
        
        email_code += digit_element.value;
    }

    document.getElementById("verify-code-error").innerText = "";

    chrome.runtime.sendMessage({type:"submit_code", code: email_code, email: current_email}, (response) => {
        if (response.result == "AUTHENTICATED") {
            document.getElementById("verify-screen").classList.add("invisible");
            document.getElementById("front-menu").classList.remove("invisible");
        }
        else {
            document.getElementById("verify-code-error").innerText = response.result;
        }
    });

}

function openPage(page) {
    chrome.runtime.sendMessage({type:"open_page", page:page}, function (response) {
        if (response["result"] == "close") {
            window.close();
        }
    })
}

async function checkConnection() {
    const connected = await chrome.runtime.sendMessage({type: "check_connection"});
    
    CONNECTED = connected;

    if (connected) {
        document.querySelector(".connected-icon").classList.remove("invisible");
        document.querySelector(".disconnected-icon").classList.add("invisible");
    }
    else {
        document.querySelector(".disconnected-icon").classList.remove("invisible");
        document.querySelector(".connected-icon").classList.add("invisible");
    }

    setTimeout(checkConnection, 60 * 1000);
}

window.addEventListener("DOMContentLoaded", async function () {

    await checkConnection();

    if (CONNECTED) {
        const response = await chrome.runtime.sendMessage({type:"check_authentication"});
        if (response.result) {
            document.getElementById("front-menu").classList.toggle("invisible");

            const gpa = await chrome.runtime.sendMessage({type: "fetch_gpa"});
            if (gpa != null) {
                document.querySelector(".gpa-display").innerText = "GPA: " + gpa.unweighted + "/" + gpa.weighted;
                document.querySelector(".gpa-display").classList.remove("invisible");
            }
        }
        else {
            document.getElementById("front-page").classList.toggle("invisible");
        }
    }

    document.getElementById("login-button").addEventListener("click", function () {
        chrome.tabs.create({url: "https://portals.veracross.com/oakwood/login/"});
    })

    document.getElementById("classes-button").addEventListener("click", function () {
        openPage("html/classes.html");
    })

    document.getElementById("assignments-button").addEventListener("click", function () {
        openPage("html/assignments.html");
    })

    document.querySelector(".privacy-policy").addEventListener("click", function () {
        chrome.runtime.sendMessage({type: "privacy_policy"});
    })


    for (let i = 1; i <= NUM_DIGITS; i++) {
        if (i == 1) {
            document.getElementById("digit-" + i).addEventListener("paste", function (ev) {
                ev.preventDefault();

                const paste = ev.clipboardData.getData("text/plain").trim();
                if (paste.length == NUM_DIGITS) {
                    for (let j = 1; j <= NUM_DIGITS; j++) {
                        document.getElementById("digit-" + j).value = paste[j - 1];
                    }
                    document.getElementById("digit-" + NUM_DIGITS).focus();
                    submitEmailCode();
                }
            })
        }
        else {
            document.getElementById("digit-" + i).addEventListener("paste", function (ev) {
                ev.preventDefault();
            })
        }
    }

    for (const element of document.getElementsByClassName("digit")) {
        element.addEventListener("input", function (ev) {
            if (ev.target.value == "") return;
            let direction = 1;
            if (ev.target.value.length == 0) direction = -1;

            const num = parseInt(element.id.split('-')[1]);

            if (num == NUM_DIGITS) {
                submitEmailCode();
            }

            document.getElementById('digit-' + Math.max(0, Math.min(num + direction, NUM_DIGITS))).focus();
        })
    }


    const data = await chrome.storage.local.get(["authenticationKey", "lastAuthenticated"]);
    const now = Date.now() / 1000;

    //Recover authentication if its less than 10 minutes ago
    //So the user can close and reopen the extension as needed.
    if (data["authenticationKey"] == undefined && !(data["lastAuthenticated"] != undefined && now - 10 * 60 < data["lastAuthenticated"])) {
        console.log("Creating new authentication session...")
        chrome.runtime.sendMessage({type:"begin_authentication"}, (response) => {
            if (response.result == "Success") {
                current_email = response.email;
                document.getElementById("email-code-label").innerHTML = `please enter the code from <span>${current_email}</span>`;
                document.getElementById("verify-screen").classList.remove("invisible"); //Turn on verify code menu
                document.getElementById("front-page").classList.add("invisible"); //Turn off front login screen
            }
            else if (response.result == "Failure" && response.reason == "LOGIN_NEEDED") {
                console.error("Authentication attempted before Veracross login!");
            };
        })
    }
    else if (data["authenticationKey"] == undefined && data["lastAuthenticated"] && now - 10 * 60 < data["lastAuthenticated"]) {
        console.log("Resuming authentication session...")
        current_email = (await chrome.storage.local.get(["lastEmail"]))["lastEmail"];
        document.getElementById("email-code-label").innerHTML = `please enter the code from <span>${current_email}</span>`;
        document.getElementById("verify-screen").classList.remove("invisible");
        document.getElementById("front-page").classList.add("invisible");
    }

})