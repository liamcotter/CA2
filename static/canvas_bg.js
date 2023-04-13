let canvas;
let context;
let request_id;

let fps = 30;
let fpsInterval = 1000 / fps; // the denominator is frames-per-second, milliseconds
let tperFrame = 1 / fps; // seconds
let now;
let then = Date.now();

let carHeight = 470;
let carWidth = 226;
let s_X = 20;
let s_Y = s_X * (carHeight / carWidth);

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
    size: { x: s_X, y: s_Y },
}

let carImage = new Image();
let density = 10;
let prev_vel = { x: 0, y: 0 };
let static_objects = [];
let color = "red";
document.addEventListener("DOMContentLoaded", init, false);

function init() {
    canvas = document.querySelector("canvas");
    context = canvas.getContext("2d");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight-50;
    // https://stackoverflow.com/questions/1114465/getting-mouse-location-in-canvas
    canvas.addEventListener("mousemove", turn, false);
    for (let i = 0; i < density; i++) {
        let b = {
            xPos: randint(0, canvas.width),
            yPos: randint(0, canvas.height),
            rot: randint(0, 360) * Math.PI / 180,
            xSize: randint(10, 100),
            ySize: randint(10, 30),
        };
        b = addCoordInfo(b);
        static_objects.push(b);
    }
    load_assets([
        { "var": carImage, "url": "static/car.png" }
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
    drive();
    collide();
    position_drawCar();
    draw_objects();
}

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

function turn(event) {
    // get cursor location from canvas
    let rect = canvas.getBoundingClientRect();
    let x = event.clientX - rect.left;
    let y = event.clientY - rect.top;

    Car.turnDir =  randint(0, 30) * Math.PI / 180;
    console.log(Car.turnDir);
    let L = AXLE_LENGTH; // distance between imaginary axles determine the turning radius
    let r = L / Math.sin(Car.turnDir); // radius of turning circle
    let angVel = vMag(Car.v) / r; // angular velocity in rad / s
    let turn = angVel / fps; // 30 FPS so divide angVel by 30 to get radians per frame
    // turn is the angle change in radians
    Car.dir = Car.dir + turn; // new direction
    let oldx = Car.v.x;
    // but also we need to change the direction of the car's velocity to point towards the new direction
    Car.v.x = (Car.v.x * Math.cos(turn)) - (Car.v.y * Math.sin(turn));
    Car.v.y = (oldx * Math.sin(turn)) + (Car.v.y * Math.cos(turn));
}

function drive() {
    let u = { // Unit vector in direction of car
        x: Math.cos(Car.dir),
        y: Math.sin(Car.dir)
    };
    Car.t = vScale(u, Car.engine); // traction

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
}

function collide() {
    // for each other object
    let collided = false;
    for (let obj of static_objects) {
        // https://youtu.be/fHOLQJo0FjQ?t=1165 adapted formulas, but using this general method for line segment intersections
        let point = collisionCheck(Car, obj);
        if (point !== false) {
            collided = true;
            Car.v = vScale(vNeg(prev_vel), 0.3); // reverse of the latest valid velocity, but 70% momentum lost
            if (vMag(Car.v) < 1) {
                Car.v = vScale(Car.v, 2.5);
            }
        }
    }

    let car_rect = [
        {
            x: Car.corner.c1.x,
            y: Car.corner.c1.y
        },
        {
            x: Car.corner.c2.x,
            y: Car.corner.c2.y
        },
        {
            x: Car.corner.c3.x,
            y: Car.corner.c3.y
        },
        {
            x: Car.corner.c4.x,
            y: Car.corner.c4.y
        }
    ];

    // left border
    for (let corner of car_rect) {
        if (Car.p.x < 0 + Car.size.y) {
            Car.v.x = 0;
            Car.p.x = Car.size.y;
        }
        // right border
        if (Car.p.x + Car.size.y > canvas.width) {
            Car.v.x = 0;
            Car.p.x = canvas.width - Car.size.y;
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
    carAddCoordInfo();

    context.fillStyle = "blue";
    context.translate(Car.p.x, Car.p.y); // center canvas on car
    context.rotate(Car.dir); // rotate car

    // original coordinates, we draw an object off screen to cast a shadow/glow on the car
    let x = 3000 * Math.cos(Car.dir);
    let y = 3000 * Math.sin(Car.dir);
    context.shadowColor = color;
    context.shadowBlur = 10;
    context.shadowOffsetX = -x;
    context.shadowOffsetY = -y;
    context.fillRect(3000, 0, Car.size.y, Car.size.x);

    context.setTransform(1, 0, 0, 1, 0, 0);
    context.shadowColor = "transparent";
    context.fillStyle = "red";
    drawCarStyle(Car.p.x, Car.p.y, Car.dir, Car.size);
}

function drawCarStyle(centreX, centreY, rot, size) {
    context.translate(centreX, centreY);
    // public domain under creative commons licence
    // https://looneybits.itch.io/2d-race-cars
    // draw carImage onto canvas at the given rotation
    let scaleCar = carHeight / size.y;
    context.rotate(-90 * Math.PI / 180 + rot);
    context.drawImage(carImage, 0, 0, carWidth, carHeight, -size.x, 0, carWidth / scaleCar, carHeight / scaleCar);
    context.setTransform(1, 0, 0, 1, 0, 0);
}

function draw_objects() {
    for (let obj of static_objects) {
        context.fillStyle = "black";
        context.translate(obj.xPos, obj.yPos);
        context.rotate(obj.rot);
        context.shadowColor = "red";
        context.shadowBlur = 5;
        context.shadowOffsetX = 0;
        context.shadowOffsetY = 0;
        context.fillRect(0, 0, obj.xSize, obj.ySize);
        context.shadowColor = "transparent";
        context.setTransform(1, 0, 0, 1, 0, 0);
    }
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