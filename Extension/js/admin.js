document.addEventListener("DOMContentLoaded", function () {
    chrome.runtime.sendMessage({type: "get_viewers"}, function (viewers) {
        document.querySelector(".viewers-value").innerText = viewers;
    });

    chrome.runtime.sendMessage({type: "get_contributors"}, function (contributors) {
        document.querySelector(".contributors-value").innerText = contributors;
    });

    document.querySelector(".invitation-button").addEventListener("click", function () {
        const email = document.querySelector('.invitation-input').value;

        const title = prompt('Title the invite (50 chars): ');

        const body = prompt('Body of the invite: ');

        const confirmation = confirm('Are you sure you would like to send this invite to ' + email + `? 
           Title: ${title}
           Body: ${body} 
        `);

        if (confirmation) {
            chrome.runtime.sendMessage({type: "send_invite", title: title, body: body, email: email});
        }
    });

    document.querySelector(".deletion-button").addEventListener("click", function () {
        const email = document.querySelector('.deletion-input').value;

        const confirmation = confirm(`Are you sure you would like to send a deletion request to ${email}?`);

        if (confirmation) {
            console.log(2)
            chrome.runtime.sendMessage({type: "send_deletion", email: email}, function (result) {
                console.log(1)
                if (result["result"] == "Success") alert('The deletion request was created, successfully.')
                else alert(result["message"]);
            });
        }
    })


});