interval = setInterval(requesting, 1000*60);
let xhttp;

function requesting() {
    xhttp = new XMLHttpRequest();
    xhttp.addEventListener("readystatechange", handle_response, false);
    xhttp.open("GET", "/leaderboard_update", true);
    xhttp.send();
}

function handle_response() {
    if (xhttp.readyState == 4 && xhttp.status == 200) {
        html_table = xhttp.responseText;
        let table = document.querySelector("main table");
        // insert html snippet into table
        table.innerHTML = html_table;
    }
}