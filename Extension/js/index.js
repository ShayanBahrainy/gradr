const NUM_DIGITS = 6;

let current_email;

let CONNECTED;

function submitEmailCode() {
    let email_code = "";
    for (let i = 1; i <= NUM_DIGITS; i++) {
        const digit_element = document.getElementById("digit-" + i);
        if (parseInt(digit_element.value) == NaN) return;
        
        email_code += digit_element.value;
    }

    chrome.runtime.sendMessage({type:"submit_code", code: email_code, email: current_email}, (response) => {
        if (response.result == "AUTHENTICATED") {
            document.getElementById("verify-code").classList.toggle("invisible");
        }
        else {
            document.getElementById("verify-code-error").value = response.result;
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
        }
        else {
            document.getElementById("login-button").classList.toggle("invisible");
        }

        const gpa = await chrome.runtime.sendMessage({type: "fetch_gpa"});
        if (gpa != null) {
            document.querySelector(".gpa-display").innerText = "GPA: " + gpa.unweighted + "/" + gpa.weighted;
            document.querySelector(".gpa-display").classList.remove("invisible");
        }
    }

    document.getElementById("login-button").addEventListener("click", function () {
        chrome.tabs.create({url: "https://portals.veracross.com/oakwood/login/"});
    })

    document.getElementById("classes-button").addEventListener("click", function () {
        openPage("html/classes.html");
    })

    for (const element of document.getElementsByClassName("digit")) {
        element.addEventListener("input", function (ev) {
            let direction = 1;
            if (ev.target.value.length == 0) direction = -1;

            const num = parseInt(element.id.split('-')[1]);

            if (num == 6) {
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
                document.getElementById("email-code-label").innerText = `Please enter the code sent to ${current_email}`;
                document.getElementById("verify-code").classList.toggle("invisible"); //Turn on verify code menu
                document.getElementById("login-button").classList.toggle("invisible"); //Turn off "Login With Veracross" screen
            }
            else if (response.result == "Failure" && response.reason == "LOGIN_NEEDED") {
                console.error("Authentication attempted before Veracross login!");
            };
        })
    }
    else if (data["authenticationKey"] == undefined && data["lastAuthenticated"] && now - 10 * 60 < data["lastAuthenticated"]) {
        console.log("Resuming authentication session...")
        current_email = (await chrome.storage.local.get(["lastEmail"]))["lastEmail"];
        document.getElementById("email-code-label").innerText = `Please enter the code sent to ${current_email}`;
        document.getElementById("verify-code").classList.toggle("invisible");
    }

})