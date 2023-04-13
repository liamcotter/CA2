let canvas;
let context;
let request_id;
let xhttp;

let fps = 30;
let fpsInterval = 1000 / fps; // the denominator is frames-per-second, milliseconds
let tperFrame = 1 / fps; // seconds
let now;
let then = Date.now();

let carHeight = 470;
let carWidth = 226;
let s_X = 20;
let s_Y = s_X * (carHeight / carWidth);
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
    p: { x: 700, y: 0 }, // starting pos
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
let drone_body = new Image();
let drone_prop = new Image();
let invisLogo = new Image();

let prop_dir = 0;
let density = 20; // number of objects per 1000 pixels
let minY;
let maxY;
let score = 0;
let enemy; // enemy is a line for now, y value
let prev_vel = { x: 0, y: 0 };
let static_objects = [];
let powerups = [];
let powerupTypes = ["invisible"];
let invisibleFrameTimer;
let invisible;
let gameStarted = false;
let pause = false;
let color = "green";
let cX;
let cY;
document.addEventListener("DOMContentLoaded", init, false);

function init() {
    canvas = document.querySelector("canvas");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight - 60;
    context = canvas.getContext("2d");
    window.addEventListener("keydown", activate, false);
    window.addEventListener("keyup", deactivate, false);
    canvas.addEventListener("click", click, false);
    centreLocY = canvas.height / 2;
    enemy = canvas.height;
    minY = -1000;
    maxY = enemy + canvas.height;
    for (let i = 0; i < density * 1.6; i++) {
        let b = {
            xPos: randint(0, canvas.width),
            yPos: randint(-1000, canvas.height),
            rot: randint(0, 360) * Math.PI / 180,
            xSize: randint(10, 100),
            ySize: randint(10, 30),
        };
        b = addCoordInfo(b);
        static_objects.push(b);
    }
    load_assets([
        { "var": carImage, "url": "static/car.png" },
        { "var": drone_body, "url": "static/drone_body.png" },
        { "var": drone_prop, "url": "static/propellor.png" },
        { "var": invisLogo, "url": "static/invis.png" }
    ], draw);
}

function draw() {
    if (!gameStarted) {
        request_id = window.requestAnimationFrame(draw);
        context.fillStyle = "rgba(0, 0, 0, 0.5)";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = "white";
        context.font = "20px Calibri";
        context.fillText("Press space to start", canvas.width / 2, canvas.height / 2);
        cX = canvas.width/2 - 100;
        cY = canvas.height/2;
        let radius = 80;
        for (let angle = 0; angle < 360; angle++) {
            let hue = angle;
            let gradient = context.createRadialGradient(cX, cY, 0, cX, cY, radius);
            gradient.addColorStop(0, 'white');
            gradient.addColorStop(1, `hsl(${hue}, 100%, 50%)`);
            context.fillStyle = gradient;
            context.beginPath();
            context.moveTo(cX, cY);
            context.arc(cX, cY, radius, angle * Math.PI / 180, (angle + 1) * Math.PI / 180);
            context.closePath();
            context.fill();
        }
        carAddCoordInfo()
        context.translate(cX + 150, cY - 50);
        context.shadowColor = color;
        context.shadowBlur = 10;
        context.shadowOffsetX = -1000;
        context.shadowOffsetY = 0;
        context.fillRect(1000, 0, Car.size.y, Car.size.x);
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.shadowColor = "transparent";
        context.fillStyle = "red";
        let scaleCar = carHeight / Car.size.y;
        context.translate(cX + 150, cY - 50 + Car.size.x);
        context.rotate(-90 * Math.PI / 180);
        context.drawImage(carImage, 0, 0, carWidth, carHeight, 0, 0, carWidth / scaleCar, carHeight / scaleCar);
        context.setTransform(1, 0, 0, 1, 0, 0);

    } else if (pause) {
        request_id = window.requestAnimationFrame(draw);
        context.fillStyle = "rgba(0, 0, 0, 0.5)";
        //context.fillRect(0.4 * canvas.width, 0.4 *  canvas.height, canvas.width/5, canvas.height/5);
        context.fillStyle = "white";
        context.font = "20px Calibri";
        context.textAlign = "center";
        context.fillText("Paused", canvas.width / 2, canvas.height / 2);
        context.fillText("Press escape to resume", canvas.width / 2, canvas.height / 2 + 50);
        context.textAlign = "left";
    } else {
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
        turn();
        drive();
        collide();
        position_drawCar();
        draw_objects();
        enemy_events();
        add_future_objects();
        delete_objects();
        score = Math.max(score, -Car.p.y);
        if (invisibleFrameTimer > 0) {
            invisibleFrameTimer--;
        }
        context.fillStyle = "white";
        context.fillText("Score: " + Math.round(score), 10, 30);
    }
}


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
    let oldx = Car.v.x;
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
    if (invisibleFrameTimer === 0) {
        invisible = false;
    }
    let usually_collided = false;
    if (!invisible) {
        for (let obj of static_objects) {
            // https://youtu.be/fHOLQJo0FjQ?t=1165 adapted formulas, but using this general method for line segment intersections
            let point = collisionCheck(Car, obj);
            if (point !== false) {
                usually_collided = true;
            }
            if (point !== false && invisibleFrameTimer === -1) {
                collided = true;
                usually_collided = true;
                Car.v = vScale(vNeg(prev_vel), 0.3); // reverse of the latest valid velocity, but 70% momentum lost
                if (vMag(Car.v) < 1) {
                    Car.v = vScale(Car.v, 2.5);
                }
            }
        }
        if (usually_collided === false) {
            invisibleFrameTimer = -1; // -1 means not active
        }
    }
    for (let obj of powerups) {
        if (overlapping(Car, obj) && obj.type === "invisible") {
            invisible = true;
            invisibleFrameTimer = 60; // 60 frames = 2s
            powerups = powerups.filter(item => item !== obj);
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


function overlapping(car, obj) {
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
    // check if any of the car's corners are inside the object
    for (let corner of car_rect) {
        if ((corner.x > obj.xPos && corner.x < obj.xPos + obj.size) && (corner.y > obj.yPos && corner.y < obj.yPos + obj.size)) {
            return true;
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

    context.fillStyle = "blue";
    context.translate(Car.p.x, centreLocY); // center canvas on car
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
    drawCarStyle(Car.p.x, centreLocY, Car.dir, Car.size);
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
        context.translate(obj.xPos, obj.yPos - cameraY + centreLocY);
        context.rotate(obj.rot);
        context.shadowColor = "red";
        context.shadowBlur = 5;
        context.shadowOffsetX = 0;
        context.shadowOffsetY = 0;
        context.fillRect(0, 0, obj.xSize, obj.ySize);
        context.shadowColor = "transparent";
        context.setTransform(1, 0, 0, 1, 0, 0);
    }
    for (let obj of powerups) {
        context.fillStyle = "white";
        context.translate(obj.xPos, obj.yPos - cameraY + centreLocY);
        context.shadowColor = "white";
        context.shadowBlur = 5;
        context.shadowOffsetX = 0;
        context.shadowOffsetY = 0;
        context.drawImage(invisLogo, 0, 0, obj.size, obj.size)
        context.shadowColor = "transparent";
        context.setTransform(1, 0, 0, 1, 0, 0);
    }
}

function enemy_events() {
    context.beginPath();
    let enemy_screen_loc = enemy - cameraY + centreLocY;
    context.shadowColor = "red";
    context.shadowBlur = 1;
    context.shadowOffsetX = 0;
    context.shadowOffsetY = -500;
    for (let i = 0; i < canvas.width; i += 50) {
        draw_drone(enemy_screen_loc - 10, i);
    }
    context.shadowColor = "transparent";
    //console.log("Enemy, real loc: " + enemy);
    //console.log("CameraY " + cameraY);
    //console.log("Screen loc: " + (enemy - cameraY + centreLocY));
    context.strokeStyle = "orange";
    context.stroke();
    if (enemy < Math.max(Car.corner.c1.y, Car.corner.c2.y, Car.corner.c3.y, Car.corner.c4.y)) {
        stop();
    }
    context.setTransform(1, 0, 0, 1, 0, 0);
    maxY = enemy + canvas.height / 2; // lowest point visible is the point one canvas.height below the enemy (when enemy at top)
    // enemy and car speeds up as you go further. Car is sped up by increase the engine power
    if (maxY < 0) {
        enemy -= 1 * (Math.log(-maxY));
        Car.engine = 100000 * Math.log(-maxY) / 8;
        //console.log(1/8 * (Math.log(-maxY)));
    } else {
        enemy -= 5;
    }
}

function draw_drone(sprite_draw_line, xoffset) {
    sprite_draw_line += 500
    let drone_size = 40;
    let prop_loc = drone_size * 0.23;
    let prop_size = drone_size / 3;
    context.drawImage(drone_body, xoffset, sprite_draw_line, drone_size, drone_size);
    // 4 propellers
    prop_dir = prop_dir + (20 * Math.PI / 180);

    context.translate(xoffset + prop_loc, sprite_draw_line + prop_loc);
    context.rotate(prop_dir);
    context.drawImage(drone_prop, -prop_size / 2, -prop_size / 2, prop_size, prop_size);
    context.setTransform(1, 0, 0, 1, 0, 0);

    context.translate(xoffset + prop_loc, sprite_draw_line + drone_size - prop_loc);
    context.rotate(-prop_dir);
    context.drawImage(drone_prop, -prop_size / 2, -prop_size / 2, prop_size, prop_size);
    context.setTransform(1, 0, 0, 1, 0, 0);

    context.translate(xoffset + drone_size - prop_loc, sprite_draw_line + prop_loc);
    context.rotate(-prop_dir);
    context.drawImage(drone_prop, -prop_size / 2, -prop_size / 2, prop_size, prop_size);
    context.setTransform(1, 0, 0, 1, 0, 0);

    context.translate(xoffset + drone_size - prop_loc, sprite_draw_line + drone_size - prop_loc);
    context.rotate(prop_dir);
    context.drawImage(drone_prop, -prop_size / 2, -prop_size / 2, prop_size, prop_size);
    context.setTransform(1, 0, 0, 1, 0, 0);
}

function add_future_objects() {
    add_obstacles();
    add_powerups();

}

function add_obstacles() {
    if (Car.p.y < minY + 500) {
        for (let k = 0; k < density; k++) {
            let b = {
                xPos: randint(canvas.width / 4, 3 * canvas.width / 4),
                yPos: randint(minY - 1000, minY),
                rot: randint(0, 360) * Math.PI / 180,
                xSize: randint(10, 60),
                ySize: randint(10, 30),
            };
            b = addCoordInfo(b);
            static_objects.push(b);
        }
    }
}

function add_powerups() {
    if (Car.p.y < minY + 500) {
        for (let k = 0; k < density * 0.1; k++) {
            let b = {
                xPos: randint(0, canvas.width),
                yPos: randint(minY - 1000, minY),
                type: powerupTypes[randint(0, powerupTypes.length - 1)],
                size: 20 // draw size
            };
            powerups.push(b);
        }
        minY = minY - 1000;
    }
}

function delete_objects() {
    static_objects = static_objects.filter(item => item.yPos < maxY);
    powerups = powerups.filter(item => item.yPos < maxY);
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
    } else if (key === "Escape") {
        pause = !pause;
    } else if (key === " ") {
        gameStarted = true;
        canvas.removeEventListener("click", click);
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

function click(event) {
    // modified from https://stackoverflow.com/questions/55677/how-do-i-get-the-coordinates-of-a-mouse-click-on-a-canvas-element
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // convert x, y to polar coordinates
    const dx = x - cX;
    const dy = y - cY;
    const angle = Math.atan2(dy, dx);
    const radius = Math.sqrt(dx * dx + dy * dy);

    let hue = angle * 180 / Math.PI;
    if (hue < 0) {
        hue += 360;
    }
    let saturation;
    if (radius > 80)  {
        saturation = 1;
    } else {
        saturation = radius / 80;
    }
    color = `hsl(${hue}, ${saturation * 100}%, 50%)`;
}

function randint(min, max) {
    return Math.round(Math.random() * (max - min)) + min;
}

function stop() {
    // game over screen
    //context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "rgba(0, 0, 0, 0.5)";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "white";
    context.font = "30px Arial";
    context.fillText("Game Over", canvas.width / 2 - 100, canvas.height / 2);
    context.font = "20px Arial";
    let scoreString = "Score: " + Math.round(score);
    context.fillText(scoreString, canvas.width / 2 - 100, canvas.height / 2 + 50);
    window.cancelAnimationFrame(request_id);
    window.removeEventListener("keydown", activate);
    window.removeEventListener("keyup", deactivate);
    let data = new FormData();
    data.append("score", score);
    xhttp = new XMLHttpRequest();
    xhttp.addEventListener("readystatechange", handle_response, false);
    xhttp.open("POST", "/score", true);
    xhttp.send(data);
}


function handle_response() {
    if (xhttp.readyState === 4 && xhttp.status === 200) {
        if (xhttp.responseText === "Success") {
            console.log("Score was saved successfully")
        }
    }
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