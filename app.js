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
let cardboardBody = null;  // Single cardboard body
let ropeBodies = [];
let allConstraints = [];
let isOffscreen = false;

// Device orientation tracking
let lastGamma = 0;
let lastBeta = 0;

// Store letter visual properties for rendering
let letterVisuals = [];

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

    // Check if elements go off screen
    Events.on(engine, 'afterUpdate', () => {
        checkOffscreen();
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

// Create single rope with cardboard at the end
function createRopeWithText() {
    const centerX = canvas.width / 2;
    const startY = config.startY;

    // Start position for drop animation (high above screen)
    const dropStartY = -400;

    // Calculate cardboard dimensions
    const cardboardWidth = 340;
    const cardboardHeight = 140;

    // Pre-generate letter visual properties
    generateLetterVisuals();

    // Create single vertical rope
    const segmentHeight = config.ropeLength / config.ropeSegments;

    for (let i = 0; i < config.ropeSegments; i++) {
        const y = dropStartY + i * segmentHeight;  // Start from drop position
        const segment = Bodies.circle(centerX, y, 1, {
            density: 0.00001,  // Ultra light for minimal stretch
            friction: 0.05,
            frictionAir: 0.01,
            restitution: 0,
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

    // Create cardboard body at the end of rope
    const cardboardY = ropeEnd.position.y + 80;
    cardboardBody = Bodies.rectangle(
        centerX,
        cardboardY,
        cardboardWidth,
        cardboardHeight,
        {
            density: 0.002,
            friction: 0.3,
            frictionAir: 0.02,
            restitution: 0,
            chamfer: { radius: 3 },
            render: {
                fillStyle: '#f5f3e8'
            }
        }
    );

    Composite.add(engine.world, cardboardBody);

    // Connect cardboard to rope end with pendulum-like constraint
    const pendulumConstraint = Constraint.create({
        bodyA: ropeEnd,
        bodyB: cardboardBody,
        pointB: { x: 0, y: -cardboardHeight / 2 + 10 },  // Connect near top of cardboard
        length: 15,
        stiffness: 1,  // Very stiff
        damping: 0.3,
        render: {
            strokeStyle: '#a8a8a8',
            lineWidth: 1.5
        }
    });
    allConstraints.push(pendulumConstraint);
    Composite.add(engine.world, pendulumConstraint);
}

// Generate letter visual properties for rendering on cardboard
function generateLetterVisuals() {
    const allText = config.line1 + config.line2;
    letterVisuals = [];

    for (let i = 0; i < allText.length; i++) {
        const letter = allText[i];
        const styleIndex = Math.floor(Math.random() * letterStyles.length);
        const paperIndex = Math.floor(Math.random() * paperColors.length);

        letterVisuals.push({
            letter: letter,
            font: letterStyles[styleIndex].font,
            color: letterStyles[styleIndex].color,
            paperColor: paperColors[paperIndex],
            rotation: (Math.random() - 0.5) * 0.12
        });
    }
}

// Measure individual letter width
function measureLetterWidth(letter, fontSize) {
    ctx.font = `bold ${fontSize}px Arial, sans-serif`;
    return ctx.measureText(letter).width;
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

    // Draw rope-to-cardboard connection
    allConstraints.forEach(constraint => {
        if (constraint.render.visible !== false && constraint.bodyA && constraint.bodyB) {
            const isRopeConnection = ropeBodies.includes(constraint.bodyA) && constraint.bodyB === cardboardBody;
            if (isRopeConnection) {
                ctx.beginPath();
                ctx.moveTo(constraint.bodyA.position.x, constraint.bodyA.position.y);
                const attachPoint = {
                    x: cardboardBody.position.x + constraint.pointB.x * Math.cos(cardboardBody.angle) - constraint.pointB.y * Math.sin(cardboardBody.angle),
                    y: cardboardBody.position.y + constraint.pointB.x * Math.sin(cardboardBody.angle) + constraint.pointB.y * Math.cos(cardboardBody.angle)
                };
                ctx.lineTo(attachPoint.x, attachPoint.y);
                ctx.strokeStyle = '#a8a8a8';
                ctx.lineWidth = 1.5;
                ctx.stroke();
            }
        }
    });

    // Draw cardboard with ransom note letters
    if (cardboardBody) {
        ctx.save();
        ctx.translate(cardboardBody.position.x, cardboardBody.position.y);
        ctx.rotate(cardboardBody.angle);

        const cardboardWidth = 340;
        const cardboardHeight = 140;

        // Draw cardboard background
        ctx.fillStyle = '#f5f3e8';
        ctx.fillRect(-cardboardWidth / 2, -cardboardHeight / 2, cardboardWidth, cardboardHeight);

        // Add cardboard texture
        ctx.fillStyle = 'rgba(200, 190, 170, 0.03)';
        for (let i = 0; i < 100; i++) {
            const px = (Math.random() - 0.5) * cardboardWidth;
            const py = (Math.random() - 0.5) * cardboardHeight;
            ctx.fillRect(px, py, 1, 1);
        }

        // Draw border
        ctx.strokeStyle = '#d8d6d0';
        ctx.lineWidth = 1;
        ctx.strokeRect(-cardboardWidth / 2, -cardboardHeight / 2, cardboardWidth, cardboardHeight);

        // Draw letters on cardboard
        drawLettersOnCardboard(cardboardWidth, cardboardHeight);

        ctx.restore();
    }

    ctx.restore();
}

// Draw ransom note style letters on cardboard
function drawLettersOnCardboard(cardboardWidth, cardboardHeight) {
    const fontSize = config.letterSize;
    const line1 = config.line1;
    const line2 = config.line2;

    // Line 1: "TURN"
    drawTextLine(line1, 0, -25, 0, fontSize);

    // Line 2: "HORIZONTAL"
    drawTextLine(line2, line1.length, 25, 1, fontSize);
}

// Draw a single line of text with collage effect
function drawTextLine(text, visualOffset, yOffset, lineIndex, fontSize) {
    // Calculate total width
    let totalWidth = 0;
    for (let i = 0; i < text.length; i++) {
        ctx.font = `bold ${fontSize}px ${letterVisuals[visualOffset + i].font}`;
        totalWidth += ctx.measureText(text[i]).width + config.letterSpacing;
    }
    totalWidth -= config.letterSpacing;

    let currentX = -totalWidth / 2;

    for (let i = 0; i < text.length; i++) {
        const letter = text[i];
        const visual = letterVisuals[visualOffset + i];

        ctx.save();

        // Position letter
        ctx.font = `bold ${fontSize}px ${visual.font}`;

        const metrics = ctx.measureText(letter);
        const width = metrics.width;
        const height = fontSize;
        const padding = 7;

        // Position for this letter
        const letterX = currentX + width / 2;
        const letterY = yOffset;

        ctx.translate(letterX, letterY);
        ctx.rotate(visual.rotation);

        // Old paper background with realistic texture
        ctx.fillStyle = visual.paperColor;

        // Irregular cut-out edges
        const seed = visualOffset + i + lineIndex * 100;
        const edgeVariation = 1.5;
        ctx.beginPath();
        const corners = [
            [-width/2 - padding, -height/2 - padding],
            [width/2 + padding, -height/2 - padding],
            [width/2 + padding, height/2 + padding],
            [-width/2 - padding, height/2 + padding]
        ];

        corners.forEach((corner, j) => {
            const nextCorner = corners[(j + 1) % corners.length];
            if (j === 0) {
                ctx.moveTo(
                    corner[0] + (Math.sin(seed + j) * edgeVariation),
                    corner[1] + (Math.cos(seed + j) * edgeVariation)
                );
            }

            const midX = (corner[0] + nextCorner[0]) / 2;
            const midY = (corner[1] + nextCorner[1]) / 2;
            const wobble = Math.sin(seed + j * 2) * 1.5;

            ctx.quadraticCurveTo(
                corner[0] + Math.cos(seed + j) * edgeVariation,
                corner[1] + Math.sin(seed + j) * edgeVariation,
                midX + wobble,
                midY + wobble
            );
        });
        ctx.closePath();
        ctx.fill();

        // Multi-layer paper texture

        // Fine grain
        ctx.fillStyle = 'rgba(100, 90, 80, 0.02)';
        for (let j = 0; j < 60; j++) {
            const angle = Math.sin(seed + j) * Math.PI * 2;
            const dist = Math.cos(seed + j * 2) * width/2;
            const px = Math.cos(angle) * dist;
            const py = Math.sin(angle) * dist;
            ctx.fillRect(px, py, 0.8, 0.8);
        }

        // Fiber patterns
        ctx.strokeStyle = 'rgba(80, 70, 60, 0.04)';
        ctx.lineWidth = 0.3;
        for (let j = 0; j < 5; j++) {
            const x1 = (Math.sin(seed + j * 0.5) - 0.5) * width;
            const y1 = (Math.cos(seed + j * 0.7) - 0.5) * height;
            const x2 = x1 + Math.sin(seed + j) * 15;
            const y2 = y1 + Math.cos(seed + j) * 15;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        }

        // Age stains
        const stainCount = Math.floor(Math.abs(Math.sin(seed)) * 3);
        for (let j = 0; j < stainCount; j++) {
            const stainX = Math.sin(seed + j * 1.3) * width * 0.4;
            const stainY = Math.cos(seed + j * 1.7) * height * 0.4;
            const stainRadius = 4 + Math.abs(Math.sin(seed + j)) * 6;

            const gradient = ctx.createRadialGradient(stainX, stainY, 0, stainX, stainY, stainRadius);
            gradient.addColorStop(0, 'rgba(139, 119, 101, 0.1)');
            gradient.addColorStop(1, 'rgba(139, 119, 101, 0)');
            ctx.fillStyle = gradient;

            ctx.beginPath();
            ctx.arc(stainX, stainY, stainRadius, 0, Math.PI * 2);
            ctx.fill();
        }

        // Draw letter
        ctx.fillStyle = visual.color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `bold ${fontSize}px ${visual.font}`;
        ctx.fillText(letter, 0, 0);

        // Subtle print texture
        ctx.fillStyle = 'rgba(0, 0, 0, 0.03)';
        ctx.fillText(letter, 0.3, 0.3);

        ctx.restore();

        currentX += width + config.letterSpacing;
    }
}

// Check if elements are offscreen
function checkOffscreen() {
    if (isOffscreen || !cardboardBody) return;

    const screenMargin = 250;

    const cardboardOffscreen =
        cardboardBody.position.y > canvas.height + screenMargin ||
        cardboardBody.position.y < -screenMargin ||
        cardboardBody.position.x > canvas.width + screenMargin ||
        cardboardBody.position.x < -screenMargin;

    if (cardboardOffscreen) {
        isOffscreen = true;
        removeAllElements();
    }
}

// Remove all elements
function removeAllElements() {
    if (cardboardBody) {
        Composite.remove(engine.world, cardboardBody);
        cardboardBody = null;
    }

    ropeBodies.forEach(body => Composite.remove(engine.world, body));
    allConstraints.forEach(constraint => Composite.remove(engine.world, constraint));

    ropeBodies = [];
    allConstraints = [];
    letterVisuals = [];

    console.log('All elements removed - cardboard has disappeared');
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
