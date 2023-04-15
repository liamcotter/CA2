let canvas;
let context;
let request_id;

let fps = 30;
let fpsInterval = 1000 / fps; // the denominator is frames-per-second, milliseconds
let tperFrame = 1 / fps; // seconds
let now;
let then = Date.now();

let drone = {
    p: { x: 200, y: 200 }, // starting pos
    v: { x: 0, y: 0 },
    a: { x: 0, y: 0 },
    dir : 0,
    size : {x: 0, y: 0}
}

let drone_body = new Image();
let drone_prop = new Image();
let email_logo = new Image();
let logo_size = {
    x : 671,
    y : 384
};
let prop_dir = 0;
let color = "red";
let mouse = { x: 0, y: 0 };
document.addEventListener("DOMContentLoaded", init, false);

function init() {
    canvas = document.querySelector("canvas");
    context = canvas.getContext("2d");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight-50;
    canvas.addEventListener("mousemove", follow);
    load_assets([
        { "var": drone_body, "url": "static/drone_body.png" },
        { "var": drone_prop, "url": "static/propeller.png" },
        { "var": email_logo, "url": "static/email_logo.png"}
    ], draw);
}

function draw() {
    request_id = window.requestAnimationFrame(draw);
    let now = Date.now();
    let elapsed = now - then;
    if (elapsed <= fpsInterval) {
        return;
    }
    then = now - (elapsed % fpsInterval);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "black";
    context.fillRect(0, 0, canvas.width, canvas.height);
    // use existing coords if no mouse moves
    let dir = vSub(mouse, drone.p);
    dir = vScale(dir, 2);
    drone.v = vScale(drone.v, 1/100);
    drone.v = vAdd(drone.v, dir);
    drone.p = vAdd(drone.p, vScale(drone.v, tperFrame));


    let s = 500;
    let logo_draw_size = {
        x : s,
        y : s * (logo_size.y / logo_size.x)
    }
    context.drawImage(email_logo, canvas.width/2 - logo_draw_size.x/2, canvas.height/2 - logo_draw_size.y/2, logo_draw_size.x, logo_draw_size.y);
    draw_drone();
}



function follow(event) {
    // get cursor location from canvas
    let rect = canvas.getBoundingClientRect();
    let x = event.clientX - rect.left;
    let y = event.clientY - rect.top;
    mouse = { x: x, y: y};
}

function draw_drone() {
    context.save();
    context.translate(drone.p.x, drone.p.y);

    let drone_size = 40;
    let true_prop_loc = drone_size * 0.27;
    let prop_size = drone_size / 3;
    context.drawImage(drone_body, -drone_size/2, -drone_size/2, drone_size, drone_size);
    context.setTransform(1, 0, 0, 1, 0, 0);
    // 4 propellers
    prop_dir = prop_dir + (20 * Math.PI / 180);
    // prop 1-4
    context.translate(drone.p.x + true_prop_loc, drone.p.y + true_prop_loc);
    context.rotate(prop_dir);
    context.drawImage(drone_prop, -prop_size / 2, -prop_size / 2, prop_size, prop_size);
    context.setTransform(1, 0, 0, 1, 0, 0);

    context.translate(drone.p.x + true_prop_loc, drone.p.y - true_prop_loc);
    context.rotate(-prop_dir);
    context.drawImage(drone_prop, -prop_size / 2, -prop_size / 2, prop_size, prop_size);
    context.setTransform(1, 0, 0, 1, 0, 0);

    context.translate(drone.p.x - true_prop_loc, drone.p.y + true_prop_loc);
    context.rotate(-prop_dir);
    context.drawImage(drone_prop, -prop_size / 2, -prop_size / 2, prop_size, prop_size);
    context.setTransform(1, 0, 0, 1, 0, 0);

    context.translate(drone.p.x - true_prop_loc, drone.p.y - true_prop_loc);
    context.rotate(prop_dir);
    context.drawImage(drone_prop, -prop_size / 2, -prop_size / 2, prop_size, prop_size);
    context.setTransform(1, 0, 0, 1, 0, 0);

    context.restore();
}
// vector math functions, for cleaner code
function vAdd(v1, v2) {
    return {
        x: v1.x + v2.x,
        y: v1.y + v2.y
    };
}

function vSub(v1, v2) {
    return {
        x: v1.x - v2.x,
        y: v1.y - v2.y
    };
}

function vNeg(v) { // Negation
    return {
        x: -v.x,
        y: -v.y
    };
}

function vMag(v) { // Magnitude
    return Math.sqrt(v.x * v.x + v.y * v.y);
}

function vScale(v, k) {
    return {
        x: k * v.x,
        y: k * v.y
    };
}

function randint(min, max) {
    return Math.round(Math.random() * (max - min)) + min;
}

function load_assets(assets, callback) {
    let num_assets = assets.length;
    let loaded = function () {
        num_assets = num_assets - 1;
        if (num_assets === 0) {
            callback();
        }
    };
    for (let asset of assets) {
        let element = asset.var;
        if (element instanceof HTMLImageElement) {
            element.addEventListener("load", loaded, false);
        }
        else if (element instanceof HTMLAudioElement) {
            element.addEventListener("canplaythrough", loaded, false);
        }
        element.src = asset.url;
    }
}