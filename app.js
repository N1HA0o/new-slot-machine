// Matter.js module aliases
const { Engine, Render, Runner, Bodies, Composite, Constraint, Mouse, MouseConstraint, Body, Events } = Matter;

// Configuration
const config = {
    text: 'TURN HORIZONTAL',
    letterSpacing: 8,
    ropeSegments: 30,
    ropeStiffness: 0.8,
    ropeDamping: 0.01,
    letterSize: 40,
    startY: 150
};

// Global variables
let engine, render, runner;
let canvas, ctx;
let textBodies = [];
let ropeBodies = [];
let allConstraints = [];
let gravity = { x: 0, y: 1 };
let isOffscreen = false;

// Device orientation tracking
let lastGamma = 0;
let lastBeta = 0;

// Initialize the application
function init() {
    canvas = document.getElementById('canvas');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    ctx = canvas.getContext('2d');

    // Create engine
    engine = Engine.create();
    engine.gravity.y = 1;
    engine.gravity.x = 0;

    // Create renderer
    render = Render.create({
        canvas: canvas,
        engine: engine,
        options: {
            width: canvas.width,
            height: canvas.height,
            wireframes: false,
            background: '#ffffff'
        }
    });

    // Create runner
    runner = Runner.create();
    Runner.run(runner, engine);

    // Create the physics elements
    createRopeWithText();

    // Custom rendering
    Events.on(render, 'afterRender', drawCustom);
    Render.run(render);

    // Check if elements go off screen
    Events.on(engine, 'afterUpdate', checkOffscreen);

    // Request motion permission for iOS
    requestMotionPermission();

    // Handle window resize
    window.addEventListener('resize', handleResize);
}

// Request motion sensor permission (iOS 13+)
function requestMotionPermission() {
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
        const btn = document.getElementById('permissionBtn');
        btn.style.display = 'block';
        btn.addEventListener('click', () => {
            DeviceMotionEvent.requestPermission()
                .then(response => {
                    if (response === 'granted') {
                        btn.style.display = 'none';
                        addMotionListeners();
                    }
                })
                .catch(console.error);
        });
    } else {
        addMotionListeners();
    }
}

// Add motion event listeners
function addMotionListeners() {
    window.addEventListener('deviceorientation', handleOrientation);
}

// Handle device orientation
function handleOrientation(event) {
    if (isOffscreen) return;

    const gamma = event.gamma || 0; // Left to right tilt (-90 to 90)
    const beta = event.beta || 0;   // Front to back tilt (-180 to 180)

    // Smooth the values
    const smoothFactor = 0.3;
    const smoothGamma = lastGamma + (gamma - lastGamma) * smoothFactor;
    const smoothBeta = lastBeta + (beta - lastBeta) * smoothFactor;

    lastGamma = smoothGamma;
    lastBeta = smoothBeta;

    // Update gravity based on orientation
    const maxTilt = 45;
    const gravityStrength = 1;

    engine.gravity.x = (smoothGamma / maxTilt) * gravityStrength;
    engine.gravity.y = Math.max(0.2, (smoothBeta / maxTilt) * gravityStrength);
}

// Create rope and text
function createRopeWithText() {
    const centerX = canvas.width / 2;
    const startY = config.startY;

    // Create rope segments (soft, silk-like rope)
    const ropeLength = 100;
    const segmentWidth = ropeLength / config.ropeSegments;

    for (let i = 0; i < config.ropeSegments; i++) {
        const x = centerX + (i - config.ropeSegments / 2) * segmentWidth;
        const segment = Bodies.circle(x, startY - 50, 2, {
            density: 0.001,
            friction: 0.1,
            restitution: 0.1,
            render: {
                fillStyle: '#cccccc',
                strokeStyle: '#999999',
                lineWidth: 1
            }
        });

        ropeBodies.push(segment);
        Composite.add(engine.world, segment);

        // Connect segments with soft constraints
        if (i > 0) {
            const constraint = Constraint.create({
                bodyA: ropeBodies[i - 1],
                bodyB: segment,
                length: segmentWidth,
                stiffness: config.ropeStiffness,
                damping: config.ropeDamping,
                render: {
                    strokeStyle: '#999999',
                    lineWidth: 1.5
                }
            });
            allConstraints.push(constraint);
            Composite.add(engine.world, constraint);
        }

        // Pin the first segment
        if (i === 0) {
            const pin = Constraint.create({
                pointA: { x: x, y: startY - 50 },
                bodyB: segment,
                length: 0,
                stiffness: 1,
                render: {
                    visible: false
                }
            });
            allConstraints.push(pin);
            Composite.add(engine.world, pin);
        }
    }

    // Create text letters
    const letters = config.text.split('');
    const fontSize = config.letterSize;
    const totalWidth = measureTextWidth(letters, fontSize);
    let currentX = centerX - totalWidth / 2;

    letters.forEach((letter, index) => {
        if (letter === ' ') {
            currentX += fontSize * 0.5;
            return;
        }

        const letterWidth = measureLetterWidth(letter, fontSize);
        const letterBody = Bodies.rectangle(
            currentX + letterWidth / 2,
            startY,
            letterWidth,
            fontSize,
            {
                density: 0.008,
                friction: 0.3,
                restitution: 0.1,
                chamfer: { radius: 2 },
                render: {
                    fillStyle: '#000000'
                },
                letter: letter
            }
        );

        textBodies.push(letterBody);
        Composite.add(engine.world, letterBody);

        // Connect to rope (attach to the end of rope)
        const attachPoint = ropeBodies[ropeBodies.length - 1];
        const constraint = Constraint.create({
            bodyA: attachPoint,
            bodyB: letterBody,
            pointA: { x: 0, y: 0 },
            pointB: { x: 0, y: -fontSize / 2 },
            length: 10,
            stiffness: 0.4,
            damping: 0.05,
            render: {
                strokeStyle: '#999999',
                lineWidth: 1.5
            }
        });
        allConstraints.push(constraint);
        Composite.add(engine.world, constraint);

        // Connect letters to each other
        if (index > 0 && letters[index - 1] !== ' ') {
            const prevLetter = textBodies[textBodies.length - 2];
            const letterConstraint = Constraint.create({
                bodyA: prevLetter,
                bodyB: letterBody,
                length: config.letterSpacing,
                stiffness: 0.3,
                damping: 0.05,
                render: {
                    visible: false
                }
            });
            allConstraints.push(letterConstraint);
            Composite.add(engine.world, letterConstraint);
        }

        currentX += letterWidth + config.letterSpacing;
    });
}

// Measure text width
function measureTextWidth(letters, fontSize) {
    let width = 0;
    letters.forEach(letter => {
        if (letter === ' ') {
            width += fontSize * 0.5;
        } else {
            width += measureLetterWidth(letter, fontSize) + config.letterSpacing;
        }
    });
    return width;
}

// Measure individual letter width
function measureLetterWidth(letter, fontSize) {
    ctx.font = `bold ${fontSize}px Arial, sans-serif`;
    return ctx.measureText(letter).width;
}

// Custom drawing for collage effect
function drawCustom() {
    ctx.save();

    // Draw rope
    ropeBodies.forEach(segment => {
        ctx.beginPath();
        ctx.arc(segment.position.x, segment.position.y, 2, 0, Math.PI * 2);
        ctx.fillStyle = '#888888';
        ctx.fill();
    });

    // Draw rope connections
    allConstraints.forEach(constraint => {
        if (constraint.render.visible !== false && constraint.bodyA && constraint.bodyB) {
            ctx.beginPath();
            const posA = constraint.bodyA.position;
            const posB = constraint.bodyB.position;
            ctx.moveTo(posA.x, posA.y);
            ctx.lineTo(posB.x, posB.y);
            ctx.strokeStyle = '#999999';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        } else if (constraint.pointA && constraint.bodyB) {
            ctx.beginPath();
            ctx.moveTo(constraint.pointA.x, constraint.pointA.y);
            ctx.lineTo(constraint.bodyB.position.x, constraint.bodyB.position.y);
            ctx.strokeStyle = '#999999';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }
    });

    // Draw letters with collage effect
    textBodies.forEach(body => {
        ctx.save();
        ctx.translate(body.position.x, body.position.y);
        ctx.rotate(body.angle);

        // Collage style letter rendering
        const letter = body.letter;
        const fontSize = config.letterSize;

        // Create multiple paper textures for each letter
        ctx.font = `bold ${fontSize}px Arial, sans-serif`;
        const metrics = ctx.measureText(letter);
        const width = metrics.width;
        const height = fontSize;

        // Paper background with slight variations
        const paperColors = [
            '#f5f5f0', '#faf9f5', '#f8f8f3', '#fcfcf8', '#f0f0eb'
        ];
        const colorIndex = letter.charCodeAt(0) % paperColors.length;

        ctx.fillStyle = paperColors[colorIndex];
        ctx.fillRect(-width / 2 - 4, -height / 2 - 2, width + 8, height + 4);

        // Draw letter
        ctx.fillStyle = '#1a1a1a';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(letter, 0, 0);

        // Add subtle paper texture (tiny random dots)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.02)';
        for (let i = 0; i < 20; i++) {
            const px = (Math.random() - 0.5) * width;
            const py = (Math.random() - 0.5) * height;
            ctx.fillRect(px, py, 1, 1);
        }

        // Slight border for cut-out effect
        ctx.strokeStyle = '#d0d0d0';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(-width / 2 - 4, -height / 2 - 2, width + 8, height + 4);

        ctx.restore();
    });

    ctx.restore();
}

// Check if elements are offscreen
function checkOffscreen() {
    if (isOffscreen) return;

    const allBodies = [...textBodies, ...ropeBodies];
    const screenMargin = 200; // Extra margin to ensure complete disappearance

    const allOffscreen = allBodies.every(body => {
        return body.position.y > canvas.height + screenMargin ||
               body.position.y < -screenMargin ||
               body.position.x > canvas.width + screenMargin ||
               body.position.x < -screenMargin;
    });

    if (allOffscreen) {
        isOffscreen = true;
        removeAllElements();
    }
}

// Remove all elements
function removeAllElements() {
    // Remove all bodies
    textBodies.forEach(body => Composite.remove(engine.world, body));
    ropeBodies.forEach(body => Composite.remove(engine.world, body));
    allConstraints.forEach(constraint => Composite.remove(engine.world, constraint));

    // Clear arrays
    textBodies = [];
    ropeBodies = [];
    allConstraints = [];

    console.log('All elements removed - text has disappeared');
}

// Handle window resize
function handleResize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    render.canvas.width = canvas.width;
    render.canvas.height = canvas.height;
    render.options.width = canvas.width;
    render.options.height = canvas.height;
}

// Start the application
window.addEventListener('load', init);
