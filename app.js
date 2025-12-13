// Matter.js module aliases
const { Engine, Render, Runner, Bodies, Composite, Constraint, Body, Events } = Matter;

// Configuration
const config = {
    line1: 'TURN',
    line2: 'HORIZONTAL',
    letterSpacing: 6,
    lineSpacing: 20,
    ropeSegments: 35,
    ropeStiffness: 0.999,  // Almost completely rigid - only 2% stretch
    ropeDamping: 0.2,
    letterSize: 45,
    startY: 120,  // Position to hang text in upper-center area
    ropeLength: 120,
    dropAnimationDuration: 1200  // Drop animation duration in ms
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
let rotationConstraints = [];  // Constraints to keep text horizontal
let isOffscreen = false;

// Device orientation tracking
let lastGamma = 0;
let lastBeta = 0;

// Store letter visual properties
let letterVisuals = new Map();

// Drop animation
let dropAnimationStartTime = null;
let isDropping = true;

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

    // Start drop animation
    dropAnimationStartTime = Date.now();

    // Custom rendering
    Events.on(render, 'afterRender', drawCustom);
    Render.run(render);

    // Check if elements go off screen and handle rotation constraint
    Events.on(engine, 'afterUpdate', () => {
        checkOffscreen();
        updateRotationConstraints();
    });

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

    // Very smooth transitions for natural movement
    const smoothFactor = 0.06;
    const smoothGamma = lastGamma + (gamma - lastGamma) * smoothFactor;
    const smoothBeta = lastBeta + (beta - lastBeta) * smoothFactor;

    lastGamma = smoothGamma;
    lastBeta = smoothBeta;

    // Very low sensitivity for gentle, natural interaction
    const maxTilt = 75;
    const gravityStrength = 0.3;

    engine.gravity.x = (smoothGamma / maxTilt) * gravityStrength;
    engine.gravity.y = Math.max(0.4, Math.abs(smoothBeta / maxTilt) * gravityStrength + 0.4);
}

// Create single rope with two-line text at the end
function createRopeWithText() {
    const centerX = canvas.width / 2;
    const startY = config.startY;

    // Start position for drop animation (high above screen)
    const dropStartY = -300;

    // Create single vertical rope
    const segmentHeight = config.ropeLength / config.ropeSegments;

    for (let i = 0; i < config.ropeSegments; i++) {
        const y = dropStartY + i * segmentHeight;  // Start from drop position
        const segment = Bodies.circle(centerX, y, 1.2, {
            density: 0.0003,  // Even lighter for minimal stretch
            friction: 0.1,
            frictionAir: 0.03,
            restitution: 0.01,
            render: {
                fillStyle: '#b8b8b8',
                strokeStyle: '#a0a0a0',
                lineWidth: 0.5
            }
        });

        ropeBodies.push(segment);
        Composite.add(engine.world, segment);

        // Connect segments with very stiff constraints to prevent stretching
        if (i > 0) {
            const constraint = Constraint.create({
                bodyA: ropeBodies[i - 1],
                bodyB: segment,
                length: segmentHeight,
                stiffness: config.ropeStiffness,
                damping: config.ropeDamping,
                render: {
                    strokeStyle: '#a8a8a8',
                    lineWidth: 1.2,
                    visible: false
                }
            });
            allConstraints.push(constraint);
            Composite.add(engine.world, constraint);
        }

        // Pin the first segment (top of rope) - this stays fixed at final position
        if (i === 0) {
            const pin = Constraint.create({
                pointA: { x: centerX, y: startY },  // Fixed point at final position
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
                density: 0.003,  // Even lighter
                friction: 0.5,
                frictionAir: 0.025,
                restitution: 0.01,
                angle: 0,  // Start horizontal
                chamfer: { radius: 1 },
                render: {
                    fillStyle: '#000000'
                },
                letter: letter,
                lineIndex: lineIndex,
                initialRotation: randomAngle  // Store for visual rotation only
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

        // Connect letters within the line (softer connections)
        if (index > 0) {
            const prevLetter = lineBodies[index - 1];
            const letterConstraint = Constraint.create({
                bodyA: prevLetter,
                bodyB: letterBody,
                length: config.letterSpacing,
                stiffness: 0.4,
                damping: 0.12,
                render: {
                    visible: false
                }
            });
            allConstraints.push(letterConstraint);
            Composite.add(engine.world, letterConstraint);
        }

        // Connect first letter of each line to rope (stiff connection)
        if (index === 0) {
            const ropeConstraint = Constraint.create({
                bodyA: ropeEnd,
                bodyB: letterBody,
                length: 35 + lineIndex * (fontSize + config.lineSpacing),
                stiffness: 0.6,
                damping: 0.15,
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
                stiffness: 0.5,
                damping: 0.15,
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

// Update rotation constraints to keep text mostly horizontal
function updateRotationConstraints() {
    if (isOffscreen) return;

    textBodies.forEach(body => {
        // Calculate allowed rotation based on gravity strength
        const totalGravity = Math.sqrt(engine.gravity.x ** 2 + engine.gravity.y ** 2);

        // Only allow 2-3 degrees of rotation, and only when gravity is strong
        const maxRotation = 0.05;  // ~2.86 degrees
        const gravityThreshold = 0.5;

        let targetAngle = 0;

        if (totalGravity > gravityThreshold) {
            // Allow slight tilt only during strong shaking
            const tiltAmount = Math.atan2(engine.gravity.x, engine.gravity.y);
            targetAngle = Math.max(-maxRotation, Math.min(maxRotation, tiltAmount * 0.3));
        }

        // Strongly constrain rotation
        const currentAngle = body.angle;
        const angleDiff = targetAngle - currentAngle;

        // Apply strong rotational constraint
        Body.setAngularVelocity(body, body.angularVelocity * 0.7);  // Damping

        if (Math.abs(angleDiff) > 0.001) {
            Body.setAngle(body, currentAngle + angleDiff * 0.15);
        }
    });
}

// Custom drawing for enhanced ransom note effect
function drawCustom() {
    ctx.save();

    // Draw rope as very smooth Catmull-Rom spline
    if (ropeBodies.length > 2) {
        ctx.beginPath();

        // Start from first point
        ctx.moveTo(ropeBodies[0].position.x, ropeBodies[0].position.y);

        // Use Catmull-Rom spline for ultra-smooth rope
        for (let i = 0; i < ropeBodies.length - 1; i++) {
            const p0 = ropeBodies[Math.max(0, i - 1)];
            const p1 = ropeBodies[i];
            const p2 = ropeBodies[i + 1];
            const p3 = ropeBodies[Math.min(ropeBodies.length - 1, i + 2)];

            // Draw smooth curve between p1 and p2
            const steps = 8;
            for (let t = 0; t <= steps; t++) {
                const s = t / steps;
                const s2 = s * s;
                const s3 = s2 * s;

                const x = 0.5 * (
                    (2 * p1.position.x) +
                    (-p0.position.x + p2.position.x) * s +
                    (2 * p0.position.x - 5 * p1.position.x + 4 * p2.position.x - p3.position.x) * s2 +
                    (-p0.position.x + 3 * p1.position.x - 3 * p2.position.x + p3.position.x) * s3
                );

                const y = 0.5 * (
                    (2 * p1.position.y) +
                    (-p0.position.y + p2.position.y) * s +
                    (2 * p0.position.y - 5 * p1.position.y + 4 * p2.position.y - p3.position.y) * s2 +
                    (-p0.position.y + 3 * p1.position.y - 3 * p2.position.y + p3.position.y) * s3
                );

                ctx.lineTo(x, y);
            }
        }

        ctx.strokeStyle = '#aaaaaa';
        ctx.lineWidth = 1.8;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
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

    // Draw letters with enhanced ransom note collage effect
    textBodies.forEach((body, index) => {
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

        const padding = 7;

        // Seed random generator for consistent texture per letter
        const seed = body.id;

        // Old paper background with realistic texture
        ctx.fillStyle = visual.paperColor;

        // Irregular cut-out edges (like scissors or torn from magazine)
        const edgeVariation = 1.5;
        ctx.beginPath();
        const corners = [
            [-width/2 - padding, -height/2 - padding],
            [width/2 + padding, -height/2 - padding],
            [width/2 + padding, height/2 + padding],
            [-width/2 - padding, height/2 + padding]
        ];

        // Create irregular path
        corners.forEach((corner, i) => {
            const nextCorner = corners[(i + 1) % corners.length];
            if (i === 0) {
                ctx.moveTo(
                    corner[0] + (Math.sin(seed + i) * edgeVariation),
                    corner[1] + (Math.cos(seed + i) * edgeVariation)
                );
            }

            // Slightly wavy edges
            const midX = (corner[0] + nextCorner[0]) / 2;
            const midY = (corner[1] + nextCorner[1]) / 2;
            const wobble = Math.sin(seed + i * 2) * 1.5;

            ctx.quadraticCurveTo(
                corner[0] + Math.cos(seed + i) * edgeVariation,
                corner[1] + Math.sin(seed + i) * edgeVariation,
                midX + wobble,
                midY + wobble
            );
        });
        ctx.closePath();
        ctx.fill();

        // Multi-layer paper texture for realism

        // Layer 1: Fine grain (like newsprint)
        ctx.fillStyle = 'rgba(100, 90, 80, 0.02)';
        for (let i = 0; i < 60; i++) {
            const angle = Math.sin(seed + i) * Math.PI * 2;
            const dist = Math.cos(seed + i * 2) * width/2;
            const px = Math.cos(angle) * dist;
            const py = Math.sin(angle) * dist;
            ctx.fillRect(px, py, 0.8, 0.8);
        }

        // Layer 2: Fiber patterns (like old paper fibers)
        ctx.strokeStyle = 'rgba(80, 70, 60, 0.04)';
        ctx.lineWidth = 0.3;
        for (let i = 0; i < 5; i++) {
            const x1 = (Math.sin(seed + i * 0.5) - 0.5) * width;
            const y1 = (Math.cos(seed + i * 0.7) - 0.5) * height;
            const x2 = x1 + Math.sin(seed + i) * 15;
            const y2 = y1 + Math.cos(seed + i) * 15;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        }

        // Layer 3: Age stains (like coffee or time)
        const stainCount = Math.floor(Math.abs(Math.sin(seed)) * 3);
        for (let i = 0; i < stainCount; i++) {
            ctx.fillStyle = 'rgba(139, 119, 101, 0.06)';
            const stainX = Math.sin(seed + i * 1.3) * width * 0.4;
            const stainY = Math.cos(seed + i * 1.7) * height * 0.4;
            const stainRadius = 4 + Math.abs(Math.sin(seed + i)) * 6;

            const gradient = ctx.createRadialGradient(stainX, stainY, 0, stainX, stainY, stainRadius);
            gradient.addColorStop(0, 'rgba(139, 119, 101, 0.1)');
            gradient.addColorStop(1, 'rgba(139, 119, 101, 0)');
            ctx.fillStyle = gradient;

            ctx.beginPath();
            ctx.arc(stainX, stainY, stainRadius, 0, Math.PI * 2);
            ctx.fill();
        }

        // Layer 4: Subtle creases and folds
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.025)';
        ctx.lineWidth = 0.4;
        for (let i = 0; i < 2; i++) {
            const x1 = Math.sin(seed + i * 2) * width * 0.5;
            const y1 = -height/2 - padding;
            const x2 = Math.cos(seed + i * 2) * width * 0.5;
            const y2 = height/2 + padding;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        }

        // Layer 5: Very subtle yellowing gradient (old paper effect)
        const yellowGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(width, height));
        yellowGradient.addColorStop(0, 'rgba(255, 248, 220, 0)');
        yellowGradient.addColorStop(1, 'rgba(245, 235, 200, 0.03)');
        ctx.fillStyle = yellowGradient;
        ctx.fillRect(-width/2 - padding, -height/2 - padding, width + padding * 2, height + padding * 2);

        // Add visual rotation for collage effect (on top of physics rotation)
        const initialRotation = body.initialRotation || 0;
        ctx.rotate(initialRotation);

        // Draw letter with ransom note font
        ctx.fillStyle = visual.color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `bold ${fontSize}px ${visual.font}`;
        ctx.fillText(letter, 0, 0);

        // Very subtle print texture on letter
        ctx.fillStyle = 'rgba(0, 0, 0, 0.03)';
        ctx.fillText(letter, 0.3, 0.3);

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
