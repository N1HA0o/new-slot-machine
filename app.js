// Matter.js module aliases
const { Engine, Render, Runner, Bodies, Composite, Constraint, Body, Events } = Matter;

// Configuration
const config = {
    line1: 'TURN',
    line2: 'HORIZONTAL',
    letterSpacing: 6,
    lineSpacing: 20,
    ropeSegments: 60,
    ropeStiffness: 0.35,
    ropeDamping: 0.08,
    letterSize: 45,
    startY: 80,
    ropeLength: 180
};

// Ransom note style fonts and colors
const letterStyles = [
    { font: 'Arial Black', color: '#0a0a0a' },
    { font: 'Georgia', color: '#1a1a1a' },
    { font: 'Times New Roman', color: '#050505' },
    { font: 'Courier New', color: '#2a2a2a' },
    { font: 'Impact', color: '#151515' },
    { font: 'Verdana', color: '#0f0f0f' },
    { font: 'Palatino', color: '#1f1f1f' },
    { font: 'Arial', color: '#080808' }
];

// Old paper colors
const paperColors = [
    '#f9f7f1', '#faf8f0', '#f5f3e8', '#fefcf5',
    '#f8f6ed', '#fbf9f2', '#f7f5ea', '#fcfaf3',
    '#f6f4e9', '#fdfbf4', '#f4f2e7', '#fefdf8'
];

// Global variables
let engine, render, runner;
let canvas, ctx;
let textBodies = [];
let ropeBodies = [];
let allConstraints = [];
let isOffscreen = false;

// Device orientation tracking
let lastGamma = 0;
let lastBeta = 0;

// Store letter visual properties
let letterVisuals = new Map();

// Initialize the application
function init() {
    canvas = document.getElementById('canvas');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    ctx = canvas.getContext('2d');

    // Create engine
    engine = Engine.create();
    engine.gravity.y = 0.6;
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

// Handle device orientation with reduced sensitivity
function handleOrientation(event) {
    if (isOffscreen) return;

    const gamma = event.gamma || 0;
    const beta = event.beta || 0;

    // Much smoother transitions
    const smoothFactor = 0.1;
    const smoothGamma = lastGamma + (gamma - lastGamma) * smoothFactor;
    const smoothBeta = lastBeta + (beta - lastBeta) * smoothFactor;

    lastGamma = smoothGamma;
    lastBeta = smoothBeta;

    // Reduced sensitivity for more natural interaction
    const maxTilt = 60;
    const gravityStrength = 0.45;

    engine.gravity.x = (smoothGamma / maxTilt) * gravityStrength;
    engine.gravity.y = Math.max(0.3, Math.abs(smoothBeta / maxTilt) * gravityStrength);
}

// Create single rope with two-line text at the end
function createRopeWithText() {
    const centerX = canvas.width / 2;
    const startY = config.startY;

    // Create single vertical rope
    const segmentHeight = config.ropeLength / config.ropeSegments;

    for (let i = 0; i < config.ropeSegments; i++) {
        const y = startY + i * segmentHeight;
        const segment = Bodies.circle(centerX, y, 1.5, {
            density: 0.0008,
            friction: 0.15,
            frictionAir: 0.02,
            restitution: 0.05,
            render: {
                fillStyle: '#b8b8b8',
                strokeStyle: '#a0a0a0',
                lineWidth: 0.5
            }
        });

        ropeBodies.push(segment);
        Composite.add(engine.world, segment);

        // Connect segments with very soft constraints
        if (i > 0) {
            const constraint = Constraint.create({
                bodyA: ropeBodies[i - 1],
                bodyB: segment,
                length: segmentHeight,
                stiffness: config.ropeStiffness,
                damping: config.ropeDamping,
                render: {
                    strokeStyle: '#a8a8a8',
                    lineWidth: 1.2
                }
            });
            allConstraints.push(constraint);
            Composite.add(engine.world, constraint);
        }

        // Pin the first segment (top of rope)
        if (i === 0) {
            const pin = Constraint.create({
                pointA: { x: centerX, y: startY },
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

    // Get the end of the rope
    const ropeEnd = ropeBodies[ropeBodies.length - 1];

    // Create two lines of text
    createTextLine(config.line1, ropeEnd, 0);
    createTextLine(config.line2, ropeEnd, 1);
}

// Create a line of text attached to rope
function createTextLine(text, ropeEnd, lineIndex) {
    const letters = text.split('');
    const fontSize = config.letterSize;

    // Calculate total width for centering
    let totalWidth = 0;
    letters.forEach(letter => {
        totalWidth += measureLetterWidth(letter, fontSize) + config.letterSpacing;
    });
    totalWidth -= config.letterSpacing; // Remove last spacing

    const centerX = canvas.width / 2;
    const startX = centerX - totalWidth / 2;
    const lineY = ropeEnd.position.y + 40 + lineIndex * (fontSize + config.lineSpacing);

    let currentX = startX;
    const lineBodies = [];

    letters.forEach((letter, index) => {
        const letterWidth = measureLetterWidth(letter, fontSize);

        // Random rotation for ransom note effect
        const randomAngle = (Math.random() - 0.5) * 0.15;

        const letterBody = Bodies.rectangle(
            currentX + letterWidth / 2,
            lineY,
            letterWidth + 10,
            fontSize + 8,
            {
                density: 0.006,
                friction: 0.4,
                frictionAir: 0.015,
                restitution: 0.05,
                angle: randomAngle,
                chamfer: { radius: 1 },
                render: {
                    fillStyle: '#000000'
                },
                letter: letter,
                lineIndex: lineIndex
            }
        );

        // Store visual properties for this letter
        const styleIndex = Math.floor(Math.random() * letterStyles.length);
        const paperIndex = Math.floor(Math.random() * paperColors.length);
        letterVisuals.set(letterBody.id, {
            font: letterStyles[styleIndex].font,
            color: letterStyles[styleIndex].color,
            paperColor: paperColors[paperIndex],
            rotation: (Math.random() - 0.5) * 0.08
        });

        textBodies.push(letterBody);
        lineBodies.push(letterBody);
        Composite.add(engine.world, letterBody);

        // Connect letters within the line
        if (index > 0) {
            const prevLetter = lineBodies[index - 1];
            const letterConstraint = Constraint.create({
                bodyA: prevLetter,
                bodyB: letterBody,
                length: config.letterSpacing,
                stiffness: 0.25,
                damping: 0.08,
                render: {
                    visible: false
                }
            });
            allConstraints.push(letterConstraint);
            Composite.add(engine.world, letterConstraint);
        }

        // Connect first letter of each line to rope
        if (index === 0) {
            const ropeConstraint = Constraint.create({
                bodyA: ropeEnd,
                bodyB: letterBody,
                length: 35 + lineIndex * (fontSize + config.lineSpacing),
                stiffness: 0.3,
                damping: 0.1,
                render: {
                    strokeStyle: '#a8a8a8',
                    lineWidth: 1.2
                }
            });
            allConstraints.push(ropeConstraint);
            Composite.add(engine.world, ropeConstraint);
        }

        // Also connect middle letter to rope for stability
        if (index === Math.floor(letters.length / 2)) {
            const ropeConstraint = Constraint.create({
                bodyA: ropeEnd,
                bodyB: letterBody,
                length: 35 + lineIndex * (fontSize + config.lineSpacing),
                stiffness: 0.25,
                damping: 0.1,
                render: {
                    strokeStyle: '#a8a8a8',
                    lineWidth: 1.2
                }
            });
            allConstraints.push(ropeConstraint);
            Composite.add(engine.world, ropeConstraint);
        }

        currentX += letterWidth + config.letterSpacing;
    });
}

// Measure individual letter width
function measureLetterWidth(letter, fontSize) {
    ctx.font = `bold ${fontSize}px Arial, sans-serif`;
    return ctx.measureText(letter).width;
}

// Custom drawing for enhanced ransom note effect
function drawCustom() {
    ctx.save();

    // Draw rope as smooth curve
    if (ropeBodies.length > 1) {
        ctx.beginPath();
        ctx.moveTo(ropeBodies[0].position.x, ropeBodies[0].position.y);

        for (let i = 1; i < ropeBodies.length; i++) {
            const curr = ropeBodies[i];
            const prev = ropeBodies[i - 1];

            if (i === 1) {
                ctx.lineTo(curr.position.x, curr.position.y);
            } else {
                // Smooth curve through points
                const midX = (prev.position.x + curr.position.x) / 2;
                const midY = (prev.position.y + curr.position.y) / 2;
                ctx.quadraticCurveTo(prev.position.x, prev.position.y, midX, midY);
            }
        }

        ctx.strokeStyle = '#a8a8a8';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.stroke();
    }

    // Draw rope-to-text connections
    allConstraints.forEach(constraint => {
        if (constraint.render.visible !== false && constraint.bodyA && constraint.bodyB) {
            const isRopeConnection = ropeBodies.includes(constraint.bodyA) && textBodies.includes(constraint.bodyB);
            if (isRopeConnection) {
                ctx.beginPath();
                ctx.moveTo(constraint.bodyA.position.x, constraint.bodyA.position.y);
                ctx.lineTo(constraint.bodyB.position.x, constraint.bodyB.position.y);
                ctx.strokeStyle = '#a8a8a8';
                ctx.lineWidth = 1.2;
                ctx.stroke();
            }
        }
    });

    // Draw letters with ransom note collage effect
    textBodies.forEach(body => {
        ctx.save();
        ctx.translate(body.position.x, body.position.y);
        ctx.rotate(body.angle);

        const letter = body.letter;
        const fontSize = config.letterSize;
        const visual = letterVisuals.get(body.id);

        // Measure letter with specific font
        ctx.font = `bold ${fontSize}px ${visual.font}`;
        const metrics = ctx.measureText(letter);
        const width = metrics.width;
        const height = fontSize;

        const padding = 6;

        // Old paper background with texture
        ctx.fillStyle = visual.paperColor;

        // Slightly irregular rectangle for cut-out effect
        const irregularity = 1;
        ctx.beginPath();
        ctx.moveTo(-width/2 - padding + Math.random() * irregularity, -height/2 - padding);
        ctx.lineTo(width/2 + padding - Math.random() * irregularity, -height/2 - padding + Math.random() * irregularity);
        ctx.lineTo(width/2 + padding, height/2 + padding - Math.random() * irregularity);
        ctx.lineTo(-width/2 - padding + Math.random() * irregularity, height/2 + padding);
        ctx.closePath();
        ctx.fill();

        // Paper texture - subtle noise
        ctx.fillStyle = 'rgba(0, 0, 0, 0.015)';
        for (let i = 0; i < 40; i++) {
            const px = (Math.random() - 0.5) * (width + padding * 2);
            const py = (Math.random() - 0.5) * (height + padding * 2);
            ctx.fillRect(px, py, 1, 1);
        }

        // Aged paper stains (random subtle spots)
        if (Math.random() > 0.5) {
            ctx.fillStyle = 'rgba(139, 119, 101, 0.08)';
            const stainX = (Math.random() - 0.5) * width;
            const stainY = (Math.random() - 0.5) * height;
            ctx.beginPath();
            ctx.arc(stainX, stainY, 3 + Math.random() * 4, 0, Math.PI * 2);
            ctx.fill();
        }

        // Very subtle crumpled paper effect
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.03)';
        ctx.lineWidth = 0.5;
        for (let i = 0; i < 3; i++) {
            const x1 = (Math.random() - 0.5) * width;
            const y1 = (Math.random() - 0.5) * height;
            const x2 = (Math.random() - 0.5) * width;
            const y2 = (Math.random() - 0.5) * height;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        }

        // Slight rotation for each letter
        ctx.rotate(visual.rotation);

        // Draw letter with ransom note font
        ctx.fillStyle = visual.color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `bold ${fontSize}px ${visual.font}`;
        ctx.fillText(letter, 0, 0);

        // Very subtle shadow within letter for depth
        ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
        ctx.fillText(letter, 0.5, 0.5);

        ctx.restore();
    });

    ctx.restore();
}

// Check if elements are offscreen
function checkOffscreen() {
    if (isOffscreen) return;

    const allBodies = [...textBodies, ...ropeBodies];
    const screenMargin = 250;

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
    textBodies.forEach(body => Composite.remove(engine.world, body));
    ropeBodies.forEach(body => Composite.remove(engine.world, body));
    allConstraints.forEach(constraint => Composite.remove(engine.world, constraint));

    textBodies = [];
    ropeBodies = [];
    allConstraints = [];
    letterVisuals.clear();

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
