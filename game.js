// change displayed angle
// fix sliding wo/power

let canvas;
let context;
let request_id;

let fpsInterval = 1000 / 30; // the denominator is frames-per-second
let now;
let then = Date.now();


let moveLeft = false;
let moveRight = false;
let moveFor = false;
let moveBack = false;

let centerX = 200;
let centerY = 200;

// Pinning units on real-world quantities make changes to the physics easier
let DRAG = 0.4; // drag constant
let RES = 100; //12.8;
// https://asawicki.info/Mirror/Car%20Physics%20for%20Games/Car%20Physics%20for%20Games.html

let Car = {
    p : {x : 200, y : 200}, // starting pos
    v : {x : 0, y : 0}, // velocities
    engine : 100000, //EngineForce, power
    t : {x : 0, y : 0}, // traction
    dir : 20 * Math.PI /180, // direction in radians
    turnDir : 0, // direction of "steering", usually a small enough angle bewteen -30 and + 30
    drag : {x : 0, y : 0}, // drag of the car, dependant on DRAG and velocity
    rr : {x : 0, y : 0}, // ground friction, dependant on RES and velocity (rr = rolling resistance)
    a : 0, // acceleration, dependant on drag, rr, t + constants
    corner : {
        c1 : { x : 0, y : 0},
        c2 : { x : 0, y : 0},
        c3 : { x : 0, y : 0},
        c4 : { x : 0, y : 0}
    },
    size : {
        x : 10,
        y : 20
    }
}


let static_objects = [];

let b = {
    xPos : 500,
    yPos : 310,
    rot : -15*Math.PI / 180,
    xSize : 30,
    ySize : 70,
};
b = addCoordInfo(b);

static_objects.push(b);

document.addEventListener("DOMContentLoaded", init, false);


function init() {
    canvas = document.querySelector("canvas");
    context = canvas.getContext("2d");
    window.addEventListener("keydown", activate, false);
    window.addEventListener("keyup", deactivate, false);

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
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.strokeStyle = "Blue";
    context.beginPath();
    context.moveTo(1000, 0);
    context.lineTo(1000,2000);
    context.strokeStyle = "Blue";
    context.stroke();
    // new direction
    if (moveRight) {
        Car.turnDir = 20 * Math.PI /180;
    } else if (moveLeft) {
        Car.turnDir = -20 * Math.PI /180;
    } else {
        Car.turnDir = 0;
    }
    let L = 30; // distance between imaginary axles determine the turning radius
    let r = L / Math.sin(Car.turnDir); // radius of turning circle
    let angVel = vMag(Car.v) / r; // angular velocity in rad / s
    let turn = angVel / 30; // 30 FPS so divide angVel by 30 to get radians per frame
    // turn is the angle change in radians
    Car.dir = Car.dir + turn; // new direction
    let debug_dir = Car.dir + turn;
    // but also we need to change the direction of the car's velocity to point towards the new direction
    Car.v.x = ( Car.v.x * Math.cos( turn ) ) - ( Car.v.y * Math.sin( turn ) );
    Car.v.y = ( Car.v.x * Math.sin( turn ) ) + ( Car.v.y * Math.cos( turn ) );
    
    if (moveFor) {
        let u = { // Unit vector in direction of car
            x : Math.cos(Car.dir),
            y : Math.sin(Car.dir)
        };
        Car.t = vScale(u, Car.engine); // traction
    } else if (moveBack) {
        let u = { // Unit vector in opposite direction of car
            x : -Math.cos(Car.dir),
            y : -Math.sin(Car.dir)
        };
        Car.t = vScale(u, Car.engine); // traction
    } else {
        Car.t = { x : 0, y : 0}; // no engine power
    }

    Car.drag = vScale(Car.v,(-DRAG * vMag(Car.v) ) ); // drag
    Car.rr =  vScale(Car.v, -RES); // ground resistance
    // so the total forward force is the sum of the three. drag and rr are already negative by their formula
    let f = vAdd( vAdd(Car.t, Car.drag) , Car.rr);
    Car.a = vScale(f, 0.005) // f = ma, a = f/m, m = 1000kg for example
    Car.v = vAdd( Car.v, vScale(Car.a, 0.03333333) ); //  v = v + dt * a, where dt is the smallest time interval, time of the fpsInterval (1/30 s)
    // stop when very slow
    if (vMag(Car.v) < 1) {
        Car.v.x = 0;
        Car.v.y = 0;
    }
    if (Car.p.x > 1000) {
        Car.v.x = -0.9* Math.abs(Car.v.x);
    }
    Car.p = vAdd( Car.p, vScale(Car.v, 0.03333333) ); // p = p + dt * v, integrating again to go from accel -> velocity -> displacement
    context.fillStyle = "red";
    context.translate(Car.p.x, Car.p.y) // center canvas on car
    //context.fillRect(0, 0, 10, 10);
    context.rotate(Car.dir); // rotate car
    context.fillRect(0, 0, Car.size.y, Car.size.x); // draw car. It's from 0,0 so only the shape is rotated and the coordinates are not.
    carAddCoordInfo();
    // debug steer dir
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.translate(Car.p.x, Car.p.y);
    context.rotate(debug_dir);
    context.fillStyle = "Green";
   // context.fillRect(20, 5, 20, 1);
    context.setTransform(1, 0, 0, 1, 0, 0);
    // debug vel d
    context.translate(Car.p.x, Car.p.y);
    context.beginPath();
    context.moveTo(0, 0);
    context.lineTo(Car.v.x, Car.v.y);
    context.strokeStyle = "Blue";
    //context.stroke();
    context.setTransform(1, 0, 0, 1, 0, 0);
    // text
    let angle = Math.atan2(Car.v.y, Car.v.x);
    let backwards = "";
    if (Math.abs((angle + Math.PI) - (Car.dir + (999999999999*Math.PI)) % (2*Math.PI)) > 0.1) {
        backwards = "-";
    }

    context.fillText(backwards + vMag(Car.v) + " m/s", 10, 30);
    context.fillText((Car.dir + (9999*Math.PI)) % (2*Math.PI) + " rad", 10, 50);
    context.fillText(angle + Math.PI + " rad", 10, 70);
    context.fillText(Car.p.x + " x", 10, 90);
    context.fillText(Car.p.y + " y", 10, 110);
    //context.fillText(Car.rr.x + " x " + Car.rr.y + " y rr", 10, 130);
    //context.fillText(Car.drag.x +  " x " + Car.drag.y + " y drag", 10, 150);
    //context.fillText(Car.t.x + " x " + Car.t.y + " y t", 10, 170);

    // draw static object
    for (let obj of static_objects) {
        context.translate(obj.xPos, obj.yPos);
        context.rotate(obj.rot);
        context.fillRect(0, 0, obj.xSize, obj.ySize);
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.fillStyle = "red"
        //context.fillRect(obj.c1.x, obj.c1.y, 2, 2);
        //context.fillRect(obj.c2.x, obj.c2.y, 2, 2);
        //context.fillRect(obj.c3.x, obj.c3.y, 2, 2);
        //context.fillRect(obj.c4.x, obj.c4.y, 2, 2);
        //context.fillRect(obj.centre.x, obj.centre.y, 2, 2);
        // https://www.youtube.com/watch?v=fHOLQJo0FjQ
        // https://www.youtube.com/watch?v=7Ik2vowGcU0
    }
    context.setTransform(1, 0, 0, 1, 0, 0);
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

function collisionCheck(car, obj) {
    // Checks collision bewteen Car and Static object

    // if collided, change velocities
    // else, return false and no velocity change
    return true;
}

// add coords to object from the "drawing coords". x, y, xSize, ySize, rotation -> 4 corners + centre
function addCoordInfo(b) {
    b.rot = -b.rot;
    b.c1 = { x : b.xPos, y : b.yPos};
    b.c2 = {
        x : b.xPos + Math.cos(b.rot)*b.xSize,
        y : b.yPos - Math.sin(b.rot)*b.xSize
    }
    b.c3 = {
        x : b.xPos + Math.cos(b.rot) * b.xSize + Math.sin(b.rot) * b.ySize,
        y : b.yPos - Math.sin(b.rot) * b.xSize + Math.cos(b.rot) * b.ySize
    }
    b.c4 = {
        x : b.xPos + Math.sin(b.rot) * b.ySize,
        y : b.yPos + Math.cos(b.rot) * b.ySize
    }

    b.centre = {
        x : (b.c1.x + b.c3.x) / 2,
        y : (b.c1.y + b.c3.y) / 2
    };
    b.rot = -b.rot;
    return b;
}

function carAddCoordInfo() {
    Car.dir = -Car.dir + (90 * Math.PI/180);
    Car.corner.c1 = { 
        x : Car.p.x, 
        y : Car.p.y
    };
    Car.corner.c2 = {
        x : Car.p.x - Math.cos(Car.dir)*Car.size.x,
        y : Car.p.y + Math.sin(Car.dir)*Car.size.x
    }
    Car.corner.c3 = {
        x : Car.p.x - Math.cos(Car.dir) * Car.size.x + Math.sin(Car.dir) * Car.size.y,
        y : Car.p.y + Math.sin(Car.dir) * Car.size.x + Math.cos(Car.dir) * Car.size.y
    }
    Car.corner.c4 = {
        x : Car.p.x + Math.sin(Car.dir) * Car.size.y,
        y : Car.p.y + Math.cos(Car.dir) * Car.size.y
    }
    Car.dir = -(Car.dir - (90 * Math.PI/180));
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = "Green";
    context.fillRect(Car.corner.c1.x, Car.corner.c1.y, 2, 2);
    context.fillRect(Car.corner.c2.x, Car.corner.c2.y, 2, 2);
    context.fillRect(Car.corner.c3.x, Car.corner.c3.y, 2, 2);
    context.fillRect(Car.corner.c4.x, Car.corner.c4.y, 2, 2);
}

// vector math functions, for cleaner code
function vAdd(v1, v2) {
    return  {
        x : v1.x + v2.x,
        y : v1.y + v2.y
    };
}

function vSub(v1, v2) {
    return  {
        x : v1.x - v2.x,
        y : v1.y - v2.y
    };
}

function vNeg(v) { // Negation
    return  {
        x : -v.x,
        y : -v.y
    };
}

function vMag(v) { // Magnitude
    return  Math.sqrt(v.x*v.x + v.y*v.y);
}

function vScale(v, k) {
    return  {
        x : k * v.x,
        y : k * v.y
    };
}