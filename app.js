// Matter.js module aliases
const { Engine, Render, Runner, Bodies, Composite, Constraint, Body, Events } = Matter;

// Configuration
const config = {
    line1: 'TURN',
    line2: 'HORIZONTALLY',
    letterSpacing: 6,
    lineSpacing: 20,
    ropeSegments: 40,
    ropeStiffness: 1.0,  // Completely rigid - no stretch
    ropeDamping: 0.5,  // Higher damping for smoother rope motion
    letterSize: 26,  // Scaled down by 12% from 29 (29 * 0.88 = 25.52)
    letterSizeLine2: 22,  // Scaled down by 12% from 25 (25 * 0.88 = 22)
    startY: -80,  // Rope starts above screen (invisible anchor)
    ropeLength: 217,  // Shortened by 5% from 228 (228 * 0.95 = 216.6)
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
let isStableAtPosition = false;  // Track if cardboard has stabilized at 52% position

// Device orientation tracking
let lastGamma = 0;
let lastBeta = 0;

// Horizontal rotation detection
let horizontalStartTime = null;
let isHorizontal = false;
let hasTriggeredHorizontal = false;

// Images for horizontal mode
let cardboardImage = null;
let phoneImage = null;
let imagesLoaded = false;

// Store letter visual properties for rendering
let letterVisuals = [];

// Drop animation
let dropAnimationStartTime = null;
let isDropping = true;

// Image-based physics objects
let imageCardboardBody = null;
let imageRopeBodies = [];
let imageConstraints = [];
let isImageMode = false;  // Track if we're in image mode (rope never breaks)

// Load images for horizontal mode
function loadImages() {
    cardboardImage = new Image();
    cardboardImage.src = '纸板.png';
    cardboardImage.onload = () => {
        console.log('Cardboard image loaded');
        checkImagesLoaded();
    };
    cardboardImage.onerror = () => {
        console.error('Failed to load cardboard image');
    };

    phoneImage = new Image();
    phoneImage.src = '手与手机.png';
    phoneImage.onload = () => {
        console.log('Phone image loaded');
        checkImagesLoaded();
    };
    phoneImage.onerror = () => {
        console.error('Failed to load phone image');
    };
}

function checkImagesLoaded() {
    if (cardboardImage.complete && phoneImage.complete) {
        imagesLoaded = true;
        console.log('All images loaded successfully');
    }
}

// Initialize the application
function init() {
    canvas = document.getElementById('canvas');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    ctx = canvas.getContext('2d');

    // Load images for horizontal mode
    loadImages();

    // Create engine
    engine = Engine.create();
    engine.gravity.y = 1;  // Standard gravity
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

    // Check if elements go off screen and enforce position limits
    Events.on(engine, 'afterUpdate', () => {
        checkOffscreen();
        enforcePositionLimits();
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

// Handle device orientation with medium sensitivity
function handleOrientation(event) {
    if (isOffscreen) return;

    const gamma = event.gamma || 0;
    const beta = event.beta || 0;

    // Check for horizontal rotation (phone turned sideways > 75 degrees)
    // Use gamma for landscape detection (more accurate)
    const isPhoneHorizontal = Math.abs(gamma) > 75 || Math.abs(beta) > 75;

    // Trigger horizontal mode IMMEDIATELY when rotated > 75 degrees (no waiting, no rope break required)
    if (isPhoneHorizontal && !hasTriggeredHorizontal && imagesLoaded) {
        hasTriggeredHorizontal = true;
        console.log('Horizontal rotation >75° detected - triggering image cardboard immediately!');
        triggerHorizontalMode();
    }

    // Smooth transitions for natural movement (increased 8% for better response)
    const smoothFactor = 0.135;  // Increased from 0.125 (8% more responsive)
    const smoothGamma = lastGamma + (gamma - lastGamma) * smoothFactor;
    const smoothBeta = lastBeta + (beta - lastBeta) * smoothFactor;

    lastGamma = smoothGamma;
    lastBeta = smoothBeta;

    // Increased sensitivity by 8% for more reactive physics
    const maxTilt = 50;
    const gravityStrength = 0.675;  // Increased from 0.625 (8% stronger)

    engine.gravity.x = (smoothGamma / maxTilt) * gravityStrength;
    engine.gravity.y = Math.max(0.5, Math.abs(smoothBeta / maxTilt) * gravityStrength + 0.5);
}

// Trigger horizontal mode - drop image-based cardboard
function triggerHorizontalMode() {
    console.log('Horizontal mode triggered! Dropping image cardboard...');

    // Verify images are actually loaded
    if (!cardboardImage || !phoneImage || !cardboardImage.complete || !phoneImage.complete) {
        console.error('Images not properly loaded. Cannot trigger horizontal mode.');
        console.log('Cardboard image:', cardboardImage ? 'exists' : 'missing');
        console.log('Phone image:', phoneImage ? 'exists' : 'missing');
        return;
    }

    // Remove existing text-based cardboard
    if (cardboardBody) {
        Composite.remove(engine.world, cardboardBody);
        cardboardBody = null;
    }

    // Reset stability flag for new cardboard
    isStableAtPosition = false;
    isOffscreen = false;
    isImageMode = true;  // Enable image mode - rope will never break

    // Determine which side is higher based on gamma (tilt left/right)
    // Positive gamma = tilted right, so left side is higher
    // Negative gamma = tilted left, so right side is higher
    const dropFromLeft = lastGamma > 0;

    console.log('Creating image cardboard from', dropFromLeft ? 'LEFT' : 'RIGHT', 'side');
    console.log('Image mode enabled - rope will never break');
    createImageCardboard(dropFromLeft);
}

// Create cardboard with images (drops from left or right edge, hangs at midpoint)
function createImageCardboard(dropFromLeft) {
    // Calculate dimensions (scaled up by 21% from 214x80)
    const cardboardWidth = 259;  // 214 * 1.21 = 258.94
    const cardboardHeight = 97;  // 80 * 1.21 = 96.8

    // Rope hangs from side edge at screen MIDPOINT (middle height)
    const sideMidpointY = canvas.height / 2;  // Middle of the screen height
    const ropeX = dropFromLeft ? 50 : canvas.width - 50;  // 50px from left or right edge

    // Create vertical rope from side midpoint
    const ropeLength = 217;  // Match main rope length
    const ropeSegments = 40;
    const segmentHeight = ropeLength / ropeSegments;

    // Create rope segments vertically downward from midpoint
    for (let i = 0; i < ropeSegments; i++) {
        const x = ropeX;  // All segments at same X position (vertical rope)
        const y = sideMidpointY + i * segmentHeight;  // Start from midpoint, go down

        const segment = Bodies.circle(x, y, 1, {
            density: 10,
            friction: 0.1,
            frictionAir: 0.01,
            restitution: 0.3,
            inertia: Infinity,
            render: {
                fillStyle: '#b8b8b8',
                strokeStyle: '#a0a0a0',
                lineWidth: 0.5
            }
        });

        imageRopeBodies.push(segment);
        Composite.add(engine.world, segment);

        // Connect rope segments
        if (i > 0) {
            const constraint = Constraint.create({
                bodyA: imageRopeBodies[i - 1],
                bodyB: segment,
                length: segmentHeight,
                stiffness: 1,
                damping: 0.5,
                render: { visible: false }
            });
            constraint.breakingForce = Infinity;
            imageConstraints.push(constraint);
            Composite.add(engine.world, constraint);
        }

        // Pin the first segment to the side midpoint
        if (i === 0) {
            const pin = Constraint.create({
                pointA: { x: ropeX, y: sideMidpointY },  // Fixed at side midpoint
                bodyB: segment,
                length: 0,
                stiffness: 1,
                render: { visible: false }
            });
            pin.breakingForce = Infinity;
            imageConstraints.push(pin);
            Composite.add(engine.world, pin);
        }
    }

    // Create cardboard at the end of rope
    const ropeEnd = imageRopeBodies[imageRopeBodies.length - 1];
    const cardboardY = ropeEnd.position.y + 60;

    imageCardboardBody = Bodies.rectangle(
        ropeX,  // Same X as rope (directly below)
        cardboardY,
        cardboardWidth,
        cardboardHeight,
        {
            density: 0.004,
            friction: 0.3,
            frictionAir: 0.015,
            restitution: 0.25,
            chamfer: { radius: 3 },
            render: { fillStyle: 'transparent' }  // Transparent background
        }
    );

    Composite.add(engine.world, imageCardboardBody);

    // Connect cardboard to rope end
    const pendulumConstraint = Constraint.create({
        bodyA: ropeEnd,
        bodyB: imageCardboardBody,
        pointB: { x: 0, y: -cardboardHeight / 2 + 10 },
        length: 15,
        stiffness: 1,
        damping: 0.5,
        render: { strokeStyle: '#a8a8a8', lineWidth: 1.5 }
    });
    pendulumConstraint.breakingForce = Infinity;
    imageConstraints.push(pendulumConstraint);
    Composite.add(engine.world, pendulumConstraint);

    console.log('Image cardboard created: rope at x=' + ropeX + ', midpoint y=' + sideMidpointY);
}

// Create single rope with cardboard at the end
function createRopeWithText() {
    const centerX = canvas.width / 2;
    const startY = config.startY;  // Above screen

    // Start position for drop animation (way above screen for fast drop)
    const dropStartY = -600;

    // Calculate cardboard dimensions (scaled down by 12% from 243x91)
    const cardboardWidth = 214;  // 243 * 0.88 = 213.84
    const cardboardHeight = 80;  // 91 * 0.88 = 80.08

    // Pre-generate letter visual properties
    generateLetterVisuals();

    // Create single vertical rope
    const segmentHeight = config.ropeLength / config.ropeSegments;

    for (let i = 0; i < config.ropeSegments; i++) {
        const y = dropStartY + i * segmentHeight;  // Start from drop position
        const segment = Bodies.circle(centerX, y, 1, {
            density: 10,  // Very heavy rope to hold cardboard
            friction: 0.1,
            frictionAir: 0.01,
            restitution: 0.3,  // Add bounce for rebound effect
            inertia: Infinity,  // Prevent rotation
            render: {
                fillStyle: '#b8b8b8',
                strokeStyle: '#a0a0a0',
                lineWidth: 0.5
            }
        });

        ropeBodies.push(segment);
        Composite.add(engine.world, segment);

        // Set initial downward velocity for all rope segments (except the pinned one)
        if (i > 0) {
            Body.setVelocity(segment, { x: 0, y: 15 });  // Fast initial drop
        }

        // Connect segments with absolutely rigid constraints (no stretch at all)
        if (i > 0) {
            const constraint = Constraint.create({
                bodyA: ropeBodies[i - 1],
                bodyB: segment,
                length: segmentHeight,
                stiffness: 1,  // Maximum stiffness - completely rigid
                damping: 0.5,  // Higher damping to prevent twitching
                render: {
                    strokeStyle: '#a8a8a8',
                    lineWidth: 1.2,
                    visible: false
                }
            });
            // Force constraint to never break
            constraint.breakingForce = Infinity;
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
            // Force pin to never break
            pin.breakingForce = Infinity;
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
            density: 0.004,  // Light enough to be held by rope
            friction: 0.3,
            frictionAir: 0.015,
            restitution: 0.25,  // Add bounce for rebound effect
            chamfer: { radius: 3 },
            render: {
                fillStyle: '#f5f3e8'
            }
        }
    );

    Composite.add(engine.world, cardboardBody);

    // Set initial downward velocity for dramatic drop effect
    Body.setVelocity(cardboardBody, { x: 0, y: 15 });  // Fast downward speed

    // Connect cardboard to rope end with absolutely rigid pendulum constraint
    const pendulumConstraint = Constraint.create({
        bodyA: ropeEnd,
        bodyB: cardboardBody,
        pointB: { x: 0, y: -cardboardHeight / 2 + 10 },  // Connect near top of cardboard
        length: 15,
        stiffness: 1,  // Completely rigid - no stretch
        damping: 0.5,  // Higher damping for smoother motion
        render: {
            strokeStyle: '#a8a8a8',
            lineWidth: 1.5
        }
    });
    // Force constraint to never break
    pendulumConstraint.breakingForce = Infinity;
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

        const cardboardWidth = 214;  // Scaled down by 12%
        const cardboardHeight = 80;  // Scaled down by 12%

        // Pseudo-3D: Draw subtle shadow first (depth effect)
        ctx.save();
        ctx.translate(3, 3);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
        ctx.fillRect(-cardboardWidth / 2, -cardboardHeight / 2, cardboardWidth, cardboardHeight);
        ctx.restore();

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

        // Pseudo-3D: Add subtle edge lighting (top-left lighter, bottom-right darker)
        // Top edge highlight
        const topGradient = ctx.createLinearGradient(0, -cardboardHeight / 2, 0, -cardboardHeight / 2 + 8);
        topGradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
        topGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = topGradient;
        ctx.fillRect(-cardboardWidth / 2, -cardboardHeight / 2, cardboardWidth, 8);

        // Left edge highlight
        const leftGradient = ctx.createLinearGradient(-cardboardWidth / 2, 0, -cardboardWidth / 2 + 8, 0);
        leftGradient.addColorStop(0, 'rgba(255, 255, 255, 0.2)');
        leftGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = leftGradient;
        ctx.fillRect(-cardboardWidth / 2, -cardboardHeight / 2, 8, cardboardHeight);

        // Bottom edge shadow
        const bottomGradient = ctx.createLinearGradient(0, cardboardHeight / 2 - 6, 0, cardboardHeight / 2);
        bottomGradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
        bottomGradient.addColorStop(1, 'rgba(0, 0, 0, 0.12)');
        ctx.fillStyle = bottomGradient;
        ctx.fillRect(-cardboardWidth / 2, cardboardHeight / 2 - 6, cardboardWidth, 6);

        // Right edge shadow
        const rightGradient = ctx.createLinearGradient(cardboardWidth / 2 - 6, 0, cardboardWidth / 2, 0);
        rightGradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
        rightGradient.addColorStop(1, 'rgba(0, 0, 0, 0.12)');
        ctx.fillStyle = rightGradient;
        ctx.fillRect(cardboardWidth / 2 - 6, -cardboardHeight / 2, 6, cardboardHeight);

        // Draw border
        ctx.strokeStyle = '#d8d6d0';
        ctx.lineWidth = 1;
        ctx.strokeRect(-cardboardWidth / 2, -cardboardHeight / 2, cardboardWidth, cardboardHeight);

        // Draw letters on cardboard
        drawLettersOnCardboard(cardboardWidth, cardboardHeight);

        ctx.restore();
    }

    // Draw image-based rope if exists
    if (imageRopeBodies.length > 2) {
        ctx.beginPath();
        ctx.moveTo(imageRopeBodies[0].position.x, imageRopeBodies[0].position.y);

        for (let i = 0; i < imageRopeBodies.length - 1; i++) {
            const p0 = imageRopeBodies[Math.max(0, i - 1)];
            const p1 = imageRopeBodies[i];
            const p2 = imageRopeBodies[i + 1];
            const p3 = imageRopeBodies[Math.min(imageRopeBodies.length - 1, i + 2)];

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

    // Draw image-based cardboard
    if (imageCardboardBody && imagesLoaded) {
        ctx.save();
        ctx.translate(imageCardboardBody.position.x, imageCardboardBody.position.y);
        ctx.rotate(imageCardboardBody.angle);

        const cardboardWidth = 259;  // Scaled up by 21%
        const cardboardHeight = 97;  // Scaled up by 21%

        // Draw shadow (subtle)
        ctx.save();
        ctx.translate(3, 3);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
        ctx.fillRect(-cardboardWidth / 2, -cardboardHeight / 2, cardboardWidth, cardboardHeight);
        ctx.restore();

        // Draw cardboard image (no background, just the image)
        if (cardboardImage && cardboardImage.complete) {
            ctx.drawImage(
                cardboardImage,
                -cardboardWidth / 2,
                -cardboardHeight / 2,
                cardboardWidth,
                cardboardHeight
            );
        }

        // Draw phone image on top (scaled up 21%)
        if (phoneImage && phoneImage.complete) {
            const phoneWidth = cardboardWidth * 0.7;
            const phoneHeight = cardboardHeight * 0.7;
            ctx.drawImage(
                phoneImage,
                -phoneWidth / 2,
                -phoneHeight / 2,
                phoneWidth,
                phoneHeight
            );
        }

        ctx.restore();
    }

    ctx.restore();
}

// Draw ransom note style letters on cardboard
function drawLettersOnCardboard(cardboardWidth, cardboardHeight) {
    const fontSize = config.letterSize;
    const fontSize2 = config.letterSizeLine2;
    const line1 = config.line1;
    const line2 = config.line2;

    // Line 1: "TURN"
    drawTextLine(line1, 0, -22, 0, fontSize);

    // Line 2: "HORIZONTALLY" (smaller font)
    drawTextLine(line2, line1.length, 22, 1, fontSize2);
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

        // Realistic scissor-cut edges with variation
        const seed = visualOffset + i + lineIndex * 100;
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
                ctx.moveTo(corner[0], corner[1]);
            }

            // Random edge style for each side
            const edgeType = Math.floor(Math.sin(seed + j * 7) * 3);

            if (edgeType === 0 || edgeType === -1) {
                // Straight cut edge (40% chance)
                ctx.lineTo(nextCorner[0], nextCorner[1]);
            } else if (edgeType === 1) {
                // Slightly wavy edge (30% chance)
                const steps = 3;
                for (let s = 1; s <= steps; s++) {
                    const t = s / steps;
                    const x = corner[0] + (nextCorner[0] - corner[0]) * t;
                    const y = corner[1] + (nextCorner[1] - corner[1]) * t;
                    const wobble = Math.sin(seed + j * 3 + s) * 1;
                    ctx.lineTo(x + wobble, y + wobble);
                }
            } else {
                // Torn/notched edge with small cuts (30% chance)
                const steps = 4;
                for (let s = 1; s <= steps; s++) {
                    const t = s / steps;
                    const x = corner[0] + (nextCorner[0] - corner[0]) * t;
                    const y = corner[1] + (nextCorner[1] - corner[1]) * t;

                    // Small random notch
                    if (s === 2 && Math.sin(seed + j * 5) > 0.3) {
                        const notchSize = 2;
                        const perpX = -(nextCorner[1] - corner[1]) / Math.sqrt((nextCorner[0] - corner[0])**2 + (nextCorner[1] - corner[1])**2);
                        const perpY = (nextCorner[0] - corner[0]) / Math.sqrt((nextCorner[0] - corner[0])**2 + (nextCorner[1] - corner[1])**2);
                        ctx.lineTo(x + perpX * notchSize, y + perpY * notchSize);
                    } else {
                        ctx.lineTo(x, y);
                    }
                }
            }
        });

        ctx.closePath();
        ctx.fill();

        // Pseudo-3D: Add subtle shadow to letter paper (slightly offset)
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
        ctx.shadowBlur = 3;
        ctx.shadowOffsetX = 1.5;
        ctx.shadowOffsetY = 1.5;
        ctx.fillStyle = visual.paperColor;
        ctx.fill();
        ctx.restore();

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

        // Pseudo-3D: Draw letter with subtle depth
        // Shadow layer for depth
        ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `bold ${fontSize}px ${visual.font}`;
        ctx.fillText(letter, 0.8, 0.8);

        // Main letter
        ctx.fillStyle = visual.color;
        ctx.fillText(letter, 0, 0);

        // Subtle highlight on top-left for 3D effect
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.fillText(letter, -0.3, -0.3);

        ctx.restore();

        currentX += width + config.letterSpacing;
    }
}

// Enforce position limits - minimal constraint, allows free swinging offscreen
function enforcePositionLimits() {
    const activeBody = cardboardBody || imageCardboardBody;
    if (!activeBody) return;

    // Preferred Y position (57% down from top)
    const preferredY = canvas.height * 0.57;

    // Check if cardboard has stabilized at preferred position
    if (!isStableAtPosition) {
        const distanceFromPreferred = Math.abs(activeBody.position.y - preferredY);
        const velocity = Math.sqrt(activeBody.velocity.x ** 2 + activeBody.velocity.y ** 2);

        // Consider stable if within 20px of preferred position and moving slowly
        if (distanceFromPreferred < 20 && velocity < 2) {
            isStableAtPosition = true;
            console.log('Cardboard stabilized at 57% position - rope breaking now enabled');
        }
    }

    // Apply extremely weak centering force only when very far down (allows complete freedom to swing)
    if (activeBody.position.y > preferredY + 100) {
        const overshoot = activeBody.position.y - (preferredY + 100);

        // Extremely weak restoring force - barely noticeable, allows free swinging offscreen
        const restoreForce = overshoot * 0.00005;  // Much weaker to allow offscreen swinging
        Body.applyForce(activeBody, activeBody.position, {
            x: 0,
            y: -restoreForce
        });
    }
}

// Check if elements are offscreen
function checkOffscreen() {
    const activeBody = cardboardBody || imageCardboardBody;
    if (!activeBody) return;

    // Only check for rope breaking if cardboard has stabilized at 57% position
    if (!isStableAtPosition) {
        return; // Don't break rope during initial drop
    }

    // If in image mode, rope NEVER breaks - skip all breaking logic
    if (isImageMode) {
        // Still remove if extremely far offscreen
        const veryFarOffscreen =
            activeBody.position.y > canvas.height + 1000 ||
            activeBody.position.y < -1000 ||
            activeBody.position.x > canvas.width + 1000 ||
            activeBody.position.x < -1000;

        if (veryFarOffscreen) {
            removeAllElements();
        }
        return; // Don't break rope in image mode
    }

    // Cardboard dimensions
    const cardboardWidth = 214;  // Scaled down by 12%
    const cardboardHeight = 80;  // Scaled down by 12%
    const halfWidth = cardboardWidth / 2;
    const halfHeight = cardboardHeight / 2;

    // Calculate cardboard edges (accounting for rotation)
    const angle = activeBody.angle;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    // Get the four corners of the cardboard
    const corners = [
        { x: -halfWidth, y: -halfHeight },
        { x: halfWidth, y: -halfHeight },
        { x: halfWidth, y: halfHeight },
        { x: -halfWidth, y: halfHeight }
    ];

    // Transform corners to world coordinates
    const worldCorners = corners.map(corner => ({
        x: activeBody.position.x + corner.x * cos - corner.y * sin,
        y: activeBody.position.y + corner.x * sin + corner.y * cos
    }));

    // Check if 3/4 or more of cardboard is offscreen (count visible corners)
    let visibleCorners = 0;
    worldCorners.forEach(corner => {
        if (corner.x >= 0 && corner.x <= canvas.width &&
            corner.y >= 0 && corner.y <= canvas.height) {
            visibleCorners++;
        }
    });

    // Break rope when 1 or fewer corners are visible (3/4 or more is offscreen)
    const mostlyOffscreen = visibleCorners <= 1;

    // Break rope when 3/4+ of cardboard is offscreen and has been stabilized
    if (mostlyOffscreen && !isOffscreen && isStableAtPosition) {
        isOffscreen = true;
        breakRope();
        console.log('Rope broke! 3/4 of cardboard is offscreen - rope and cardboard disappearing.');
    }

    // Remove everything when far offscreen
    const farOffscreen =
        activeBody.position.y > canvas.height + 500 ||
        activeBody.position.y < -500 ||
        activeBody.position.x > canvas.width + 500 ||
        activeBody.position.x < -500;

    if (farOffscreen) {
        removeAllElements();
    }
}

// Break the rope (disconnect cardboard from rope and remove rope completely)
function breakRope() {
    console.log('Rope broke! Removing rope and cardboard is flying away...');

    // Remove all constraints
    allConstraints.forEach(constraint => {
        Composite.remove(engine.world, constraint);
    });
    allConstraints = [];

    // Remove all rope bodies (make rope disappear completely)
    ropeBodies.forEach(body => {
        Composite.remove(engine.world, body);
    });
    ropeBodies = [];

    console.log('Rope has completely disappeared');
}

// Remove all elements
function removeAllElements() {
    if (cardboardBody) {
        Composite.remove(engine.world, cardboardBody);
        cardboardBody = null;
    }

    if (imageCardboardBody) {
        Composite.remove(engine.world, imageCardboardBody);
        imageCardboardBody = null;
    }

    ropeBodies.forEach(body => Composite.remove(engine.world, body));
    allConstraints.forEach(constraint => Composite.remove(engine.world, constraint));
    imageRopeBodies.forEach(body => Composite.remove(engine.world, body));
    imageConstraints.forEach(constraint => Composite.remove(engine.world, constraint));

    ropeBodies = [];
    allConstraints = [];
    imageRopeBodies = [];
    imageConstraints = [];
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
