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
let lastAlpha = 0;

// Phone flip detection for slot machine interaction
let lastPitch = 0;
let flipDetectionThreshold = 30;  // Degrees of pitch change to trigger flip
let flipCooldown = 500;  // 500ms cooldown between flips
let lastFlipTime = 0;

// Images for horizontal mode
let cardboardImage = null;
let phoneImage = null;
let gripImage = null;  // 握东西.png
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

// Image reveal animation (horizontal movement from side to center)
let imageRevealStartTime = null;
let imageRevealDuration = 2000;  // 2 seconds
let imageStartX = 0;  // Will be set based on side edge
let imageFinalX = 0;  // Will be calculated (screen center)
let imageDropFromLeft = false;  // Track which side images drop from

// Rope breaking fade animation
let ropeBreakStartTime = null;
let ropeFadeDuration = 100;  // 0.1 seconds (100ms)
let ropeOpacity = 1.0;  // Current rope opacity

// Text cardboard exit tracking for delayed image trigger
let textCardboardExitTime = null;
let imageTriggerDelay = 1000;  // 1 second delay after text cardboard exits
let pendingImageTrigger = false;  // Track if we're waiting to trigger images

// Slot machine columns (starts 1 second after image cardboard appears)
let slotMachineActive = false;
let slotMachineStartTime = null;
let slotMachineDelay = 1000;  // 1 second after image appears
let columns = [];  // Array of 4 columns
const numColumns = 4;
const squaresPerColumn = 15;  // Enough squares for seamless infinite scroll

// Slot machine physics
let columnBaseSpeed = [2, 2.5, 3, 2.2];  // Base scrolling speed for each column (pixels/frame)
let columnCurrentSpeed = [2, 2.5, 3, 2.2];  // Current speed (changes during flip)
let isFlipping = false;
let flipStartTime = 0;
let flipAccelDuration = 300;  // 0.3 seconds acceleration
let flipPeakDuration = 500;  // 0.5 seconds at peak speed
let flipDecelDuration = 1000;  // 1 second deceleration

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

    gripImage = new Image();
    gripImage.src = '握东西.png';
    gripImage.onload = () => {
        console.log('Grip image loaded');
        checkImagesLoaded();
    };
    gripImage.onerror = () => {
        console.error('Failed to load grip image');
    };
}

function checkImagesLoaded() {
    if (cardboardImage.complete && phoneImage.complete && gripImage.complete) {
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
        updateImageRevealAnimation();
        updateRopeFade();
        checkDelayedImageTrigger();
        checkSlotMachineStart();
        updateSlotMachine();
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
    const gamma = event.gamma || 0;
    const beta = event.beta || 0;
    const alpha = event.alpha || 0;

    // Detect phone flip motion for slot machine (only when slot machine is active)
    if (slotMachineActive) {
        // Calculate pitch angle (forward/backward tilt)
        const pitch = beta;

        // Detect rapid forward flip (positive pitch change)
        const pitchChange = pitch - lastPitch;
        const now = Date.now();

        // Trigger flip if: rapid forward motion, not currently flipping, cooldown expired
        if (pitchChange > flipDetectionThreshold && !isFlipping && (now - lastFlipTime) > flipCooldown) {
            triggerSlotMachineFlip();
            lastFlipTime = now;
        }

        lastPitch = pitch;
    }

    // Apply gravity physics to text cardboard (only when it exists)
    if (cardboardBody && !isOffscreen) {
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

    lastGamma = gamma;
    lastBeta = beta;
    lastAlpha = alpha;
}

// Trigger horizontal mode - drop image-based cardboard (auto-triggered after text exits)
function triggerHorizontalMode() {
    console.log('Horizontal mode triggered! Showing images from center...');

    // Verify images are actually loaded
    if (!cardboardImage || !phoneImage || !gripImage ||
        !cardboardImage.complete || !phoneImage.complete || !gripImage.complete) {
        console.error('Images not properly loaded. Cannot trigger horizontal mode.');
        console.log('Cardboard image:', cardboardImage ? 'exists' : 'missing');
        console.log('Phone image:', phoneImage ? 'exists' : 'missing');
        console.log('Grip image:', gripImage ? 'exists' : 'missing');
        return;
    }

    // Remove existing text-based cardboard (if any)
    if (cardboardBody) {
        Composite.remove(engine.world, cardboardBody);
        cardboardBody = null;
    }

    // Reset flags
    isStableAtPosition = false;
    isOffscreen = false;
    isImageMode = true;  // Enable image mode - no rope, just images

    // Images appear at screen center (no side preference)
    const dropFromLeft = Math.random() > 0.5;  // Random side for variety

    console.log('Creating image display at center');
    console.log('Image mode enabled - no rope, 2-second reveal');

    // Start reveal animation
    imageRevealStartTime = Date.now();
    createImageCardboard(dropFromLeft);

    // Start slot machine 1 second after image appears
    slotMachineStartTime = Date.now();
}

// Create image display (no rope, images slide horizontally from side to center)
function createImageCardboard(dropFromLeft) {
    // Calculate dimensions (scaled up by 21% from 214x80)
    // Note: After 90° rotation, width and height are swapped visually
    const cardboardWidth = 259;  // 214 * 1.21 = 258.94
    const cardboardHeight = 97;  // 80 * 1.21 = 96.8

    // Position at vertical midpoint, horizontal edge
    const sideMidpointY = canvas.height / 2;  // Middle of screen height

    // Start position (at side edge)
    imageStartX = dropFromLeft ? -cardboardHeight : canvas.width + cardboardHeight;  // Start offscreen (use height since rotated)

    // Final position (screen center)
    imageFinalX = canvas.width / 2;

    // Create a static body (no physics, just for rendering position)
    imageCardboardBody = Bodies.rectangle(
        imageStartX,  // Start offscreen at side
        sideMidpointY,  // At vertical midpoint
        cardboardWidth,
        cardboardHeight,
        {
            isStatic: true,  // No physics
            render: { fillStyle: 'transparent' }
        }
    );

    Composite.add(engine.world, imageCardboardBody);

    console.log('Image display created: starting from x=' + imageStartX + ' to ' + imageFinalX + ', at y=' + sideMidpointY);
}

// Update image reveal animation (2 seconds horizontal slide from side to center)
function updateImageRevealAnimation() {
    if (!imageRevealStartTime || !imageCardboardBody) return;

    const elapsed = Date.now() - imageRevealStartTime;
    const progress = Math.min(elapsed / imageRevealDuration, 1);  // 0 to 1

    // Ease out cubic for smooth deceleration (starts fast, slows down at end)
    const easedProgress = 1 - Math.pow(1 - progress, 3);

    // Calculate current X position (horizontal movement)
    const currentX = imageStartX + (imageFinalX - imageStartX) * easedProgress;

    // Update body position
    Body.setPosition(imageCardboardBody, {
        x: currentX,
        y: imageCardboardBody.position.y  // Y stays constant
    });

    // Stop animation when complete
    if (progress >= 1) {
        imageRevealStartTime = null;
        console.log('Image reveal animation complete - images at screen center');
    }
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

    // Draw rope as very smooth Catmull-Rom spline with fade effect
    if (ropeBodies.length > 2 && ropeOpacity > 0) {
        ctx.save();
        ctx.globalAlpha = ropeOpacity;  // Apply fade opacity

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

        ctx.restore();
    }

    // Draw rope-to-cardboard connection (with fade effect)
    if (ropeOpacity > 0) {
        ctx.save();
        ctx.globalAlpha = ropeOpacity;

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

        ctx.restore();
    }

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

    // Draw image-based cardboard (rotated 90° right with grip image)
    if (imageCardboardBody && imagesLoaded) {
        ctx.save();
        ctx.translate(imageCardboardBody.position.x, imageCardboardBody.position.y);
        ctx.rotate(imageCardboardBody.angle);

        const cardboardWidth = 259;  // Scaled up by 21%
        const cardboardHeight = 97;  // Scaled up by 21%

        // Rotate 90° clockwise (Math.PI / 2)
        ctx.rotate(Math.PI / 2);

        // After rotation, dimensions swap visually
        // Draw shadow (subtle) - now rotated
        ctx.save();
        ctx.translate(3, 3);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
        ctx.fillRect(-cardboardHeight / 2, -cardboardWidth / 2, cardboardHeight, cardboardWidth);
        ctx.restore();

        // Layer 1: Draw cardboard image (bottom layer, rotated)
        if (cardboardImage && cardboardImage.complete) {
            ctx.drawImage(
                cardboardImage,
                -cardboardHeight / 2,
                -cardboardWidth / 2,
                cardboardHeight,
                cardboardWidth
            );
        }

        // Layer 2: Draw phone image on top (middle layer, rotated, scaled 70%)
        if (phoneImage && phoneImage.complete) {
            const phoneW = cardboardHeight * 0.7;
            const phoneH = cardboardWidth * 0.7;
            ctx.drawImage(
                phoneImage,
                -phoneW / 2,
                -phoneH / 2,
                phoneW,
                phoneH
            );
        }

        // Layer 3: Draw grip image (top layer, rotated, 6% overlap)
        // Grip bottom overlaps with cardboard top, both center-aligned
        if (gripImage && gripImage.complete) {
            // Get natural image dimensions or use cardboard size as reference
            const gripW = cardboardHeight * 0.8;  // Reasonable size for grip
            const gripH = cardboardWidth * 0.8;

            // Calculate 6% overlap: grip bottom overlaps with cardboard top
            // cardboardTop is at -cardboardWidth/2
            // grip should be positioned so its bottom (gripH/2) overlaps by 6%
            const overlapAmount = cardboardHeight * 0.06;

            // Position grip so its bottom edge overlaps with cardboard top edge
            const gripY = -cardboardWidth / 2 - gripH / 2 + overlapAmount;

            ctx.drawImage(
                gripImage,
                -gripW / 2,  // Center horizontally
                gripY,       // Position with 6% overlap
                gripW,
                gripH
            );
        }

        ctx.restore();
    }

    // Draw slot machine columns (if active)
    if (slotMachineActive && columns.length > 0) {
        ctx.save();

        columns.forEach((column, colIdx) => {
            // Draw each square in the column
            column.squares.forEach(square => {
                // Only draw if square is visible on screen
                if (square.y + square.size > 0 && square.y < canvas.height) {
                    ctx.fillStyle = square.color;
                    ctx.fillRect(
                        column.x + (column.width - square.size) / 2,  // Center in column
                        square.y,
                        square.size,
                        square.size
                    );

                    // Add subtle border for depth
                    ctx.strokeStyle = '#666666';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(
                        column.x + (column.width - square.size) / 2,
                        square.y,
                        square.size,
                        square.size
                    );
                }
            });
        });

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

    // Use 1320px as horizontal screen boundary (iPhone 16 Pro Max reference)
    const horizontalBoundary = 1320;

    // Count how many corners are within horizontal boundaries (0 to 1320px)
    // Only check X coordinates (left/right edges), ignore Y (top/bottom)
    let cornersWithinHorizontalBounds = 0;
    worldCorners.forEach(corner => {
        if (corner.x >= 0 && corner.x <= horizontalBoundary) {
            cornersWithinHorizontalBounds++;
        }
    });

    // Break rope when 2 or fewer corners are within horizontal bounds
    // (meaning 2 or more corners are outside left/right edges)
    const mostlyOffscreen = cornersWithinHorizontalBounds <= 2;

    // Break rope when 2+ corners outside horizontal bounds (left/right edges)
    if (mostlyOffscreen && !isOffscreen && isStableAtPosition) {
        isOffscreen = true;
        breakRope();
        console.log('Rope broke! 2+ corners outside 1320px horizontal boundary - rope fading, cardboard thrown by momentum.');
    }

    // Track when cardboard completely exits horizontal screen (all 4 corners outside left/right bounds)
    const completelyOffscreen = cornersWithinHorizontalBounds === 0;

    // Auto-trigger image mode when text cardboard completely exits horizontally (no rotation detection needed)
    if (completelyOffscreen && !textCardboardExitTime && !pendingImageTrigger && imagesLoaded) {
        textCardboardExitTime = Date.now();
        pendingImageTrigger = true;
        console.log('Text cardboard completely exited 1320px horizontal boundary - will trigger images in 1 second');
    }

    // Remove everything when far offscreen (after image animation would have completed)
    const farOffscreen =
        activeBody.position.y > canvas.height + 1000 ||
        activeBody.position.y < -1000 ||
        activeBody.position.x > horizontalBoundary + 1000 ||
        activeBody.position.x < -1000;

    if (farOffscreen) {
        removeAllElements();
    }
}

// Break the rope (disconnect cardboard from rope and start fade animation)
function breakRope() {
    console.log('Rope broke! Starting 0.1s fade animation - cardboard thrown by momentum');

    // Start rope fade animation
    ropeBreakStartTime = Date.now();

    // Remove all constraints (so cardboard flies free with momentum)
    allConstraints.forEach(constraint => {
        Composite.remove(engine.world, constraint);
    });
    allConstraints = [];

    // Don't remove rope bodies yet - they'll fade out over 0.1s
    console.log('Constraints removed - cardboard flying with momentum, rope fading out');
}

// Update rope fade animation
function updateRopeFade() {
    if (!ropeBreakStartTime) return;

    const elapsed = Date.now() - ropeBreakStartTime;
    const progress = Math.min(elapsed / ropeFadeDuration, 1);  // 0 to 1

    // Linear fade from 1.0 to 0.0
    ropeOpacity = 1.0 - progress;

    // When fade complete, remove rope bodies completely
    if (progress >= 1) {
        ropeBodies.forEach(body => {
            Composite.remove(engine.world, body);
        });
        ropeBodies = [];
        ropeBreakStartTime = null;
        ropeOpacity = 0;
        console.log('Rope fade complete - rope removed from scene');
    }
}

// Check if it's time to trigger image mode (1 second after text cardboard exits)
function checkDelayedImageTrigger() {
    if (!pendingImageTrigger || !textCardboardExitTime) return;

    const elapsed = Date.now() - textCardboardExitTime;

    if (elapsed >= imageTriggerDelay) {
        pendingImageTrigger = false;
        console.log('1 second elapsed - triggering image mode now!');
        triggerHorizontalMode();
    }
}

// Check if it's time to start slot machine (1 second after image appears)
function checkSlotMachineStart() {
    if (slotMachineActive || !slotMachineStartTime) return;

    const elapsed = Date.now() - slotMachineStartTime;

    if (elapsed >= slotMachineDelay) {
        slotMachineActive = true;
        initializeSlotMachine();
        console.log('Slot machine activated! 4 columns scrolling...');
    }
}

// Initialize slot machine columns with gray squares
function initializeSlotMachine() {
    columns = [];
    const columnWidth = canvas.width / numColumns;
    const squareSize = 40;  // Size of each gray square
    const squareGap = 10;   // Gap between squares

    for (let col = 0; col < numColumns; col++) {
        const column = {
            x: col * columnWidth,
            width: columnWidth,
            squares: [],
            baseSpeed: columnBaseSpeed[col],
            currentSpeed: columnBaseSpeed[col],
            peakSpeed: columnBaseSpeed[col] * 4,  // 4x base speed when flipped
            acceleration: 0
        };

        // Create initial squares for this column
        for (let i = 0; i < squaresPerColumn; i++) {
            column.squares.push({
                y: i * (squareSize + squareGap) - squareSize * 2,  // Start above viewport
                size: squareSize,
                color: '#888888'  // Gray color
            });
        }

        columns.push(column);
    }
}

// Update slot machine animation
function updateSlotMachine() {
    if (!slotMachineActive) return;

    // Update flip physics if flipping
    if (isFlipping) {
        updateFlipPhysics();
    }

    // Update each column
    columns.forEach((column, colIndex) => {
        // Move squares down
        column.squares.forEach(square => {
            square.y += column.currentSpeed;
        });

        // Check if any square went off bottom, regenerate at top
        column.squares.forEach((square, idx) => {
            if (square.y > canvas.height + square.size) {
                // Find the highest square in this column
                let highestY = -Infinity;
                column.squares.forEach(s => {
                    if (s.y < highestY || highestY === -Infinity) {
                        highestY = s.y;
                    }
                });

                // Place this square above the highest square
                square.y = highestY - (square.size + 10);
            }
        });
    });
}

// Trigger slot machine flip (when phone flips forward)
function triggerSlotMachineFlip() {
    if (isFlipping) return;  // Already flipping

    isFlipping = true;
    flipStartTime = Date.now();

    console.log('Slot machine flip triggered! Accelerating...');

    // Add random variation to each column's response
    columns.forEach((column, idx) => {
        const variation = 0.8 + Math.random() * 0.4;  // 0.8 to 1.2 multiplier
        column.peakSpeed = column.baseSpeed * 4 * variation;
    });
}

// Update flip physics (acceleration, peak, deceleration)
function updateFlipPhysics() {
    const elapsed = Date.now() - flipStartTime;
    const totalDuration = flipAccelDuration + flipPeakDuration + flipDecelDuration;

    if (elapsed > totalDuration) {
        // Flip complete, return to base speed
        isFlipping = false;
        columns.forEach((column, idx) => {
            column.currentSpeed = column.baseSpeed;
        });
        console.log('Flip complete - returned to base speed');
        return;
    }

    columns.forEach((column, idx) => {
        if (elapsed < flipAccelDuration) {
            // Acceleration phase (0 to 0.3s) - ease-out quad
            const progress = elapsed / flipAccelDuration;
            const eased = 1 - Math.pow(1 - progress, 2);
            column.currentSpeed = column.baseSpeed + (column.peakSpeed - column.baseSpeed) * eased;

        } else if (elapsed < flipAccelDuration + flipPeakDuration) {
            // Peak phase (0.3s to 0.8s) - maintain peak speed
            column.currentSpeed = column.peakSpeed;

        } else {
            // Deceleration phase (0.8s to 1.8s) - ease-out cubic
            const decelStart = flipAccelDuration + flipPeakDuration;
            const decelProgress = (elapsed - decelStart) / flipDecelDuration;
            const eased = 1 - Math.pow(1 - decelProgress, 3);
            column.currentSpeed = column.peakSpeed - (column.peakSpeed - column.baseSpeed) * eased;
        }
    });
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
