/* 
- make game
*/

let canvas;
let context;
let request_id;

let fps = 30;
let fpsInterval = 1000 / fps; // the denominator is frames-per-second, milliseconds
let tperFrame = 1/fps; // seconds
let now;
let then = Date.now();


let moveLeft = false;
let moveRight = false;
let moveFor = false;
let moveBack = false;

let cameraY = 0; // only vertical change in view
// offset to draw the objects by.
let centreLocY; // without this, everything will be based off of the top of the canvas (y = 0);
// this puts it half way

// Pinning units on real-world quantities make changes to the physics easier
let DRAG = 1; // drag constant
let RES = 100; // friction with ground;
let AXLE_LENGTH = 20; // determines turning radius
// https://asawicki.info/Mirror/Car%20Physics%20for%20Games/Car%20Physics%20for%20Games.html

let Car = {
    p: { x: 200, y: 200 }, // starting pos
    v: { x: 0, y: 0 }, // velocities
    engine: 100000, //EngineForce, power
    t: { x: 0, y: 0 }, // traction
    dir: 315 * Math.PI / 180, // direction in radians
    turnDir: 0, // direction of "steering", usually a small enough angle bewteen -30 and + 30
    drag: { x: 0, y: 0 }, // drag of the car, dependant on DRAG and velocity
    rr: { x: 0, y: 0 }, // ground friction, dependant on RES and velocity (rr = rolling resistance)
    a: 0, // acceleration, dependant on drag, rr, t + constants
    corner: {
        c1: { x: 0, y: 0 },
        c2: { x: 0, y: 0 },
        c3: { x: 0, y: 0 },
        c4: { x: 0, y: 0 }
    },
    size: { x: 10, y: 20 },
}

let density = 20; // number of objects per 1000 pixels
let enemy; // enemy is a line for now, y value
let prev_vel = { x: 0, y: 0 };
let static_objects = [];

document.addEventListener("DOMContentLoaded", init, false);

function init() {
    canvas = document.querySelector("canvas");
    context = canvas.getContext("2d");
    window.addEventListener("keydown", activate, false);
    window.addEventListener("keyup", deactivate, false);
    centreLocY = canvas.height/2;
    enemy = canvas.height;
    for (let i = 0; i < density; i++) {
        let b = {
            xPos: randint(canvas.width/4, 3*canvas.width/4),
            yPos: randint(-500, canvas.height),
            rot: randint(0, 360) * Math.PI / 180,
            xSize: randint(10, 60),
            ySize: randint(10, 30),
        };
        b = addCoordInfo(b);
        static_objects.push(b);
    }
    draw();
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
    turn();
    drive();
    collide();
    position_drawCar();
    draw_objects();
    enemy_events();
    add_future_objects();
}
/* text
let angle = Math.atan2(Car.v.y, Car.v.x);
let backwards = "";
if (Math.abs((angle + Math.PI) - (Car.dir + (999999999999 * Math.PI)) % (2 * Math.PI)) > 0.1) {
    backwards = "-";
}

context.fillText(backwards + vMag(Car.v) + " m/s", 10, 30);
context.fillText(Car.dir, 10, 150);
context.fillText((Car.dir + (9999 * Math.PI)) % (2 * Math.PI) + " rad", 10, 50);
context.fillText(angle + Math.PI + " rad", 10, 70);
context.fillText(Car.p.x + " x", 10, 90);
context.fillText(Car.p.y + " y", 10, 110);
//context.fillText(Car.rr.x + " x " + Car.rr.y + " y rr", 10, 130);
//context.fillText(Car.drag.x +  " x " + Car.drag.y + " y drag", 10, 150);
//context.fillText(Car.t.x + " x " + Car.t.y + " y t", 10, 170);
context.setTransform(1, 0, 0, 1, 0, 0);
*/

// add coords to object from the "drawing coords". x, y, xSize, ySize, rotation -> 4 corners + centre
function addCoordInfo(b) {
    b.rot = -b.rot;
    b.c1 = { x: b.xPos, y: b.yPos };
    b.c2 = {
        x: b.xPos + Math.cos(b.rot) * b.xSize,
        y: b.yPos - Math.sin(b.rot) * b.xSize
    }
    b.c3 = {
        x: b.xPos + Math.cos(b.rot) * b.xSize + Math.sin(b.rot) * b.ySize,
        y: b.yPos - Math.sin(b.rot) * b.xSize + Math.cos(b.rot) * b.ySize
    }
    b.c4 = {
        x: b.xPos + Math.sin(b.rot) * b.ySize,
        y: b.yPos + Math.cos(b.rot) * b.ySize
    }

    b.centre = {
        x: (b.c1.x + b.c3.x) / 2,
        y: (b.c1.y + b.c3.y) / 2
    };
    b.rot = -b.rot;
    return b;
}

function carAddCoordInfo() {
    Car.dir = -Car.dir + (90 * Math.PI / 180);
    Car.corner.c1 = {
        x: Car.p.x,
        y: Car.p.y
    };
    Car.corner.c2 = {
        x: Car.p.x - Math.cos(Car.dir) * Car.size.x,
        y: Car.p.y + Math.sin(Car.dir) * Car.size.x
    }
    Car.corner.c3 = {
        x: Car.p.x - Math.cos(Car.dir) * Car.size.x + Math.sin(Car.dir) * Car.size.y,
        y: Car.p.y + Math.sin(Car.dir) * Car.size.x + Math.cos(Car.dir) * Car.size.y
    }
    Car.corner.c4 = {
        x: Car.p.x + Math.sin(Car.dir) * Car.size.y,
        y: Car.p.y + Math.cos(Car.dir) * Car.size.y
    }
    Car.dir = -(Car.dir - (90 * Math.PI / 180));

}

// turning code
function turn() {
    let dir;
    if (moveBack) { //forward or reverse, as the velocity is absolute direction
        dir = -1;
    } else {
        dir = 1;
    } // flip left-right turning when reversing so that you continue at the same turning arc

    if (moveRight) {
        Car.turnDir = dir * 20 * Math.PI / 180;
    } else if (moveLeft) {
        Car.turnDir = dir * -20 * Math.PI / 180;
    } else {
        Car.turnDir = 0;
    }
    let L = AXLE_LENGTH; // distance between imaginary axles determine the turning radius
    let r = L / Math.sin(Car.turnDir); // radius of turning circle
    let angVel = vMag(Car.v) / r; // angular velocity in rad / s
    let turn = angVel / fps; // 30 FPS so divide angVel by 30 to get radians per frame
    // turn is the angle change in radians
    Car.dir = Car.dir + turn; // new direction
    let oldx = Car.v.x
    // but also we need to change the direction of the car's velocity to point towards the new direction
    Car.v.x = (Car.v.x * Math.cos(turn)) - (Car.v.y * Math.sin(turn));
    Car.v.y = (oldx * Math.sin(turn)) + (Car.v.y * Math.cos(turn));
}

// longitudanal forces
function drive() {
    if (moveFor) {
        let u = { // Unit vector in direction of car
            x: Math.cos(Car.dir),
            y: Math.sin(Car.dir)
        };
        Car.t = vScale(u, Car.engine); // traction
    } else if (moveBack) {
        let u = { // Unit vector in opposite direction of car
            x: -Math.cos(Car.dir),
            y: -Math.sin(Car.dir)
        };
        Car.t = vScale(u, 0.6 * Car.engine); // traction, not full speed in reverse
    } else {
        Car.t = { x: 0, y: 0 }; // no engine power
    }

    Car.drag = vScale(Car.v, (-DRAG * vMag(Car.v))); // drag
    Car.rr = vScale(Car.v, -RES); // ground resistance
    // so the total forward force is the sum of the three. drag and rr are already negative by their formula
    let f = vAdd(vAdd(Car.t, Car.drag), Car.rr);
    Car.a = vScale(f, 0.003) // f = ma, a = f/m, m = 333kg for example
    Car.v = vAdd(Car.v, vScale(Car.a, tperFrame)); //  v = v + dt * a, where dt is the smallest time interval, time of the fpsInterval (1/30 s)
    // stop when very slow
    if (vMag(Car.v) < 1) {
        Car.v.x = 0;
        Car.v.y = 0;
    }
    // additional friction only when not using the engine - makes the car slow down quicker while not affecting acceleration
    if (!moveBack && !moveFor) {
        Car.v = vScale(Car.v, 0.96); // -4% speed every frame for no engine power
    }
}

// collision loops
function collide() {
    // for each other object
    let collided = false;
    for (let obj of static_objects) {
        // https://youtu.be/fHOLQJo0FjQ?t=1165 adapted formulas, but using this general method for line segment intersections
        let point = collisionCheck(Car, obj);
        if (point !== false) {
            collided = true;
            Car.v = vScale(vNeg(prev_vel), 0.4); // reverse of the latest valid velocity, but 70% momentum lost
            if (vMag(Car.v) < 1) {
                Car.v = vScale(Car.v, 2.5);
            }
        }
    }
    if (collided === false) {
        if (vMag(Car.v) > 1) {
            prev_vel = Car.v; // update latest valid velocity
        }
    }
}

// Check for collisions
function collisionCheck(car, obj) {
    // Checks collision bewteen Car and static object
    let car_rect = [
        {
            x: car.corner.c1.x,
            y: car.corner.c1.y
        },
        {
            x: car.corner.c2.x,
            y: car.corner.c2.y
        },
        {
            x: car.corner.c3.x,
            y: car.corner.c3.y
        },
        {
            x: car.corner.c4.x,
            y: car.corner.c4.y
        }
    ];
    let obj_rect = [
        {
            x: obj.c1.x,
            y: obj.c1.y
        },
        {
            x: obj.c2.x,
            y: obj.c2.y
        },
        {
            x: obj.c3.x,
            y: obj.c3.y
        },
        {
            x: obj.c4.x,
            y: obj.c4.y
        }
    ];
    // check all edges (total 4x4 = 16 checks max)
    for (let i = 0; i < 4; i++) {
        let p1 = car_rect[i];
        let p2 = car_rect[(i + 1) % 4];

        for (let j = 0; j < 4; j++) {
            let q1 = obj_rect[j];
            let q2 = obj_rect[(j + 1) % 4];

            let point = intersectingLineSegment(p1, p2, q1, q2);
            if (point !== false) { // checks for line intersection using endpoints. false = not intersecting, otherwise returns a point I may use
                return point;
            }
        }
    }
    // else, return false
    return false;
}

function intersectingLineSegment(p1, p2, q1, q2) {
    // https://youtu.be/7Ik2vowGcU0?t=1751 adapted formulas in addition to the others mentioned
    let denominator = (q2.y - q1.y) * (p2.x - p1.x) - (q2.x - q1.x) * (p2.y - p1.y);
    if (denominator === 0) {
        return false; // can't divide by zero, so bad
    }
    // some magic to do with solving linear equations using Cramer's rule
    let t = ((q2.x - q1.x) * (p1.y - q1.y) - (q2.y - q1.y) * (p1.x - q1.x)) / denominator;
    let intersection = {
        x: p1.x + t * (p2.x - p1.x),
        y: p1.y + t * (p2.y - p1.y)
    };
    // Check if the intersection point lies within the bounds of both line segments, in a rather manual way
    if (t >= 0 && t <= 1
        && intersection.x >= Math.min(p1.x, p2.x) && intersection.x <= Math.max(p1.x, p2.x)
        && intersection.y >= Math.min(p1.y, p2.y) && intersection.y <= Math.max(p1.y, p2.y)
        && intersection.x >= Math.min(q1.x, q2.x) && intersection.x <= Math.max(q1.x, q2.x)
        && intersection.y >= Math.min(q1.y, q2.y) && intersection.y <= Math.max(q1.y, q2.y)) {
        return intersection;
    }
    return false; // no intersection
}

function position_drawCar() {
    Car.p = vAdd(Car.p, vScale(Car.v, tperFrame)); // p = p + dt * v, integrating again to go from accel -> velocity -> displacement
    cameraY = Car.p.y;
    carAddCoordInfo();
    context.fillStyle = "red";
    context.translate(Car.p.x, centreLocY); // center canvas on car
    context.rotate(Car.dir); // rotate car
    context.fillRect(0, 0, Car.size.y, Car.size.x); // draw car. It's from 0,0 so only the shape is rotated and the coordinates are not.
    context.setTransform(1, 0, 0, 1, 0, 0);
}

function draw_objects() {
    for (let obj of static_objects) {
        context.fillStyle = "green";
        context.translate(obj.xPos, obj.yPos - cameraY + centreLocY);
        context.rotate(obj.rot);
        context.fillRect(0, 0, obj.xSize, obj.ySize);
        context.setTransform(1, 0, 0, 1, 0, 0);
    }
}

function enemy_events() {
    context.beginPath();
    context.moveTo(0, enemy - cameraY + centreLocY);
    context.lineTo(1000, enemy - cameraY + centreLocY);
    //console.log("Enemy, real loc: " + enemy);
    //console.log("CameraY " + cameraY);
    //console.log("Screen loc: " + (enemy - cameraY + centreLocY));
    context.strokeStyle = "orange";
    context.stroke();
    if (enemy < Math.max(Car.corner.c1.y, Car.corner.c2.y, Car.corner.c3.y, Car.corner.c4.y)) {
        stop();
    }
    context.setTransform(1, 0, 0, 1, 0, 0);
    enemy -= 5;
}

function add_future_objects() {

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

function vDot(v1, v2) {
    return v1.x * v2.x + v1.y * v2.y
}

function vCross(v1, v2) {
    return {
        x: v1.x * v2.y - v1.y * v2.x,
        y: v1.y * v2.x - v1.x * v2.y
    };
}

// buttons
function activate(event) {
    let key = event.key;
    if (key === "ArrowLeft") {
        moveLeft = true;
    } else if (key === "ArrowRight") {
        moveRight = true;
    } else if (key === "ArrowUp") {
        moveFor = true;
    } else if (key === "ArrowDown") {
        moveBack = true;
    }
}

function deactivate(event) {
    let key = event.key;
    if (key === "ArrowLeft") {
        moveLeft = false;
    } else if (key === "ArrowRight") {
        moveRight = false;
    } else if (key === "ArrowUp") {
        moveFor = false;
    } else if (key === "ArrowDown") {
        moveBack = false;
    }
}

function randint(min, max) {
    return Math.round(Math.random() * (max - min)) + min;
}

function stop() {
    window.cancelAnimationFrame(request_id);
    window.removeEventListener("keydown", activate);
    window.removeEventListener("keyup", deactivate);
}