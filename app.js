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

// Rope breaking rotation detection (left/right only)
let rotationExceeds46 = false;  // Track if rotation exceeds 46°
let rotation46StartTime = null;  // When rotation first exceeded 46°
let rotation46Duration = 500;  // 0.5 seconds (500ms) required to break rope

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
const squaresPerColumn = 6;  // Reduced from 15 to avoid too many squares on screen

// Slot machine physics (horizontal movement)
let columnBaseSpeed = [1.4, 1.75, 2.1, 1.54];  // Reduced by 30% from [2, 2.5, 3, 2.2]
let columnCurrentSpeed = [1.4, 1.75, 2.1, 1.54];  // Current speed (changes during flip)
let isFlipping = false;
let flipStartTime = 0;
let flipAccelDuration = 300;  // 0.3 seconds acceleration
let flipPeakDuration = 500;  // 0.5 seconds at peak speed
let flipDecelDuration = 1300;  // 1.3 seconds deceleration (extended 30%)
let detectionDelayAfterFlip = 1400;  // 1.4 seconds after flip starts

// Slot machine game mechanics
let firstFlipTriggered = false;  // Track if first flip has occurred
let detectionWindowActive = false;  // Is the 1.3s detection window active
let detectionWindowStartTime = null;  // When detection window started
let detectionWindowDuration = 1300;  // 1.3 seconds
let lockedColumns = [false, false, false, false];  // Which columns are locked in place
let matchCount = 0;  // How many columns are matched
let currentGroup = null;  // Current group type: 'fish' or 'lego'

// Full match completion
let fullMatchComplete = false;  // All 4 fish matched
let showDownArrow = false;  // Show down arrow prompt
let arrowAnimationTime = null;  // Arrow animation timer
let arrowAnimationInterval = 1300;  // 1.3 seconds

// Fish combination animation
let fishCombineAnimationActive = false;
let fishCombineStartTime = null;
let fishCombineDuration = 1500;  // 1.5 seconds
let fishPartBodies = [];  // Physics bodies for fish parts during animation

// Complete fish
let completeFishBody = null;
let completeFishImage = null;
let isDraggingFish = false;
let dragOffset = { x: 0, y: 0 };

// Fish images for slot machine
let fishHeadImage = null;
let fishBody1Image = null;
let fishBody2Image = null;
let fishTailImage = null;

// Lego person images for slot machine
let legoHairImage = null;
let legoHeadImage = null;
let legoBodyImage = null;
let legoLegsImage = null;

// Complete images
let completeLegoImage = null;

// Load images for horizontal mode
function loadImages() {
    cardboardImage = new Image();
    cardboardImage.src = '纸板1.png';  // Changed to 纸板1.png
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

    // Load fish images for slot machine
    fishHeadImage = new Image();
    fishHeadImage.src = '鱼头.png';
    fishHeadImage.onload = () => console.log('Fish head image loaded');

    fishBody1Image = new Image();
    fishBody1Image.src = '鱼身体1.png';
    fishBody1Image.onload = () => console.log('Fish body 1 image loaded');

    fishBody2Image = new Image();
    fishBody2Image.src = '鱼身体2.png';
    fishBody2Image.onload = () => console.log('Fish body 2 image loaded');

    fishTailImage = new Image();
    fishTailImage.src = '鱼尾巴.png';
    fishTailImage.onload = () => console.log('Fish tail image loaded');

    // Load lego person images
    legoHairImage = new Image();
    legoHairImage.src = '乐高头发.png';
    legoHairImage.onload = () => console.log('Lego hair image loaded');

    legoHeadImage = new Image();
    legoHeadImage.src = '乐高头.png';
    legoHeadImage.onload = () => console.log('Lego head image loaded');

    legoBodyImage = new Image();
    legoBodyImage.src = '乐高身体.png';
    legoBodyImage.onload = () => console.log('Lego body image loaded');

    legoLegsImage = new Image();
    legoLegsImage.src = '乐高下半身.png';
    legoLegsImage.onload = () => console.log('Lego legs image loaded');

    // Load complete images
    completeFishImage = new Image();
    completeFishImage.src = '完整的鱼.png';
    completeFishImage.onload = () => {
        console.log('✓ Complete fish image loaded successfully');
        console.log('Fish image dimensions:', completeFishImage.width, 'x', completeFishImage.height);
    };
    completeFishImage.onerror = () => {
        console.error('✗ Failed to load complete fish image: 完整的鱼.png');
    };

    completeLegoImage = new Image();
    completeLegoImage.src = '乐高人.png';
    completeLegoImage.onload = () => {
        console.log('✓ Complete lego image loaded successfully');
        console.log('Lego image dimensions:', completeLegoImage.width, 'x', completeLegoImage.height);
    };
    completeLegoImage.onerror = () => {
        console.error('✗ Failed to load complete lego image: 乐高人.png');
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
        updateFishCombineAnimation();
        updateCompleteFish();
    });

    // Request motion permission for iOS
    requestMotionPermission();

    // Handle window resize
    window.addEventListener('resize', handleResize);

    // Add mouse/touch event listeners for fish dragging
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('touchstart', handleTouchStart);
    canvas.addEventListener('touchmove', handleTouchMove);
    canvas.addEventListener('touchend', handleTouchEnd);
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
    window.addEventListener('devicemotion', handleMotion);
}

// Handle device motion (acceleration) for down swipe detection
let lastAccelerationY = 0;
function handleMotion(event) {
    if (!event.acceleration) return;

    const accelY = event.acceleration.y || 0;

    // Detect downward swipe when full match is complete
    if (fullMatchComplete && !completeFishBody && !fishCombineAnimationActive) {
        // Detect strong downward acceleration (phone swiped down)
        const accelChange = accelY - lastAccelerationY;

        // Threshold for downward swipe (negative Y is down in device coordinates)
        if (accelChange < -10) {  // Strong downward acceleration
            console.log('Down swipe detected! Combining fish parts...');
            combineFishParts();
        }
    }

    lastAccelerationY = accelY;
}

// Handle device orientation with medium sensitivity
function handleOrientation(event) {
    const gamma = event.gamma || 0;
    const beta = event.beta || 0;
    const alpha = event.alpha || 0;

    // Detect left/right rotation exceeding 46° for rope breaking (only when cardboard exists and rope not broken)
    if (cardboardBody && !isOffscreen) {
        // Only check gamma (left/right tilt), not beta (pitch)
        const leftRightRotation = Math.abs(gamma);
        const exceeds46 = leftRightRotation > 46;

        if (exceeds46) {
            // Start timer if just exceeded 46°
            if (!rotation46StartTime) {
                rotation46StartTime = Date.now();
                console.log('Left/right rotation exceeded 46° - starting 0.5s timer for rope break');
            }

            // Check if 0.5 seconds have passed
            const elapsed = Date.now() - rotation46StartTime;
            if (elapsed >= rotation46Duration && !isOffscreen) {
                // Trigger rope break
                isOffscreen = true;
                breakRope();
                console.log('Left/right rotation held >46° for 0.5s - rope breaking!');
            }
        } else {
            // Reset timer if rotation falls below 46°
            if (rotation46StartTime) {
                rotation46StartTime = null;
                console.log('Left/right rotation dropped below 46° - timer reset');
            }
        }
    }

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
    // Calculate dimensions (scaled up by 39.15% from 214x80: 1.21 * 1.15 = 1.3915)
    const cardboardWidth = 298;  // 214 * 1.3915 = 297.78
    const cardboardHeight = 111;  // 80 * 1.3915 = 111.32

    // Position at vertical midpoint, horizontal edge
    const sideMidpointY = canvas.height / 2;  // Middle of screen height

    // Store which side we're dropping from
    imageDropFromLeft = dropFromLeft;

    // Calculate total extension including grip on the left
    const gripW = cardboardWidth * 0.8;  // 238.4
    const overlapAmount = cardboardWidth * 0.06;  // 6% overlap
    const totalLeftExtension = gripW - overlapAmount;  // How far grip extends left of cardboard

    // Start position - far enough offscreen to hide grip image too
    imageStartX = dropFromLeft ? -totalLeftExtension - 50 : canvas.width + cardboardWidth/2 + 50;

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

    // Calculate current X position (horizontal movement toward center)
    const currentX = imageStartX + (imageFinalX - imageStartX) * easedProgress;

    // Update body position
    Body.setPosition(imageCardboardBody, {
        x: currentX,
        y: imageCardboardBody.position.y  // Y stays constant
    });

    // Calculate if all images are fully visible on screen
    const cardboardWidth = 298;
    const cardboardHeight = 111;
    const gripW = cardboardWidth * 0.8;  // 238.4
    const overlapAmount = cardboardWidth * 0.06;

    // Grip is aligned with LEFT side of cardboard
    const gripCenterX = -cardboardWidth / 2 - gripW / 2 + overlapAmount;

    // Calculate absolute positions of all image edges
    const leftmostEdge = currentX + gripCenterX - gripW / 2;  // Grip's left edge
    const rightmostEdge = currentX + cardboardWidth / 2;       // Cardboard's right edge

    // Check if all images are fully visible
    const fullyVisible = leftmostEdge >= 0 && rightmostEdge <= canvas.width;

    // Stop animation when all images are fully visible OR time complete
    if (fullyVisible || progress >= 1) {
        imageRevealStartTime = null;
        console.log('Image reveal complete - all images fully visible on screen');
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

    // Draw slot machine rows (if active) - horizontal movement
    if (slotMachineActive && columns.length > 0 && !fishCombineAnimationActive) {
        ctx.save();

        columns.forEach((column, rowIdx) => {
            // Draw each square in the row
            column.squares.forEach(square => {
                // Only draw if square is visible on screen
                if (square.x + square.size > 0 && square.x < canvas.width) {
                    const squareY = column.y + (column.height - square.size) / 2;

                    // Draw gray square background
                    ctx.fillStyle = square.color;
                    ctx.fillRect(square.x, squareY, square.size, square.size);

                    // Add subtle border for depth
                    ctx.strokeStyle = '#666666';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(square.x, squareY, square.size, square.size);

                    // Draw part image if this square has one
                    if (square.hasPart && square.partImage && square.partImage.complete) {
                        ctx.drawImage(
                            square.partImage,
                            square.x,
                            squareY,
                            square.size,
                            square.size
                        );
                    }
                }
            });
        });

        // Draw center line (中奖线) - visual indicator
        if (firstFlipTriggered) {
            const centerX = canvas.width / 2;
            const totalHeight = canvas.height * 0.9;
            const verticalOffset = (canvas.height - totalHeight) / 2;

            ctx.strokeStyle = detectionWindowActive ? 'rgba(255, 215, 0, 0.8)' : 'rgba(255, 255, 255, 0.3)';
            ctx.lineWidth = 3;
            ctx.setLineDash(detectionWindowActive ? [] : [10, 5]);  // Solid when detecting, dashed otherwise
            ctx.beginPath();
            ctx.moveTo(centerX, verticalOffset);
            ctx.lineTo(centerX, verticalOffset + totalHeight);
            ctx.stroke();
            ctx.setLineDash([]);  // Reset dash
        }

        ctx.restore();
    }

    // Draw fish parts during combination animation
    if (fishCombineAnimationActive && fishPartBodies.length > 0) {
        ctx.save();

        fishPartBodies.forEach(part => {
            if (part.image && part.image.complete) {
                const partX = part.body.position.x;
                const partY = part.body.position.y;
                const partSize = 121.5;

                // Draw fish part image with rotation
                ctx.save();
                ctx.translate(partX, partY);
                ctx.rotate(part.body.angle);
                ctx.drawImage(
                    part.image,
                    -partSize / 2,
                    -partSize / 2,
                    partSize,
                    partSize
                );
                ctx.restore();
            }
        });

        ctx.restore();
    }

    // Draw down arrow prompt when full match complete
    if (showDownArrow && !completeFishBody) {
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;

        // Animate arrow up and down
        const elapsed = Date.now() - arrowAnimationTime;
        const cycleTime = elapsed % arrowAnimationInterval;
        const animProgress = cycleTime / arrowAnimationInterval;
        const bounce = Math.sin(animProgress * Math.PI * 2) * 20;

        // Draw arrow
        ctx.save();
        ctx.fillStyle = 'rgba(255, 215, 0, 0.9)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 3;

        const arrowY = centerY + bounce;
        const arrowSize = 60;

        // Draw arrow shape (pointing down)
        ctx.beginPath();
        ctx.moveTo(centerX, arrowY + arrowSize);  // Bottom point
        ctx.lineTo(centerX - arrowSize/2, arrowY);  // Top left
        ctx.lineTo(centerX - arrowSize/4, arrowY);  // Inner left
        ctx.lineTo(centerX - arrowSize/4, arrowY - arrowSize/2);  // Shaft left
        ctx.lineTo(centerX + arrowSize/4, arrowY - arrowSize/2);  // Shaft right
        ctx.lineTo(centerX + arrowSize/4, arrowY);  // Inner right
        ctx.lineTo(centerX + arrowSize/2, arrowY);  // Top right
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Draw text prompt
        ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';  // Black color
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Swipe Down!', centerX, arrowY - arrowSize);

        ctx.restore();
    }

    // Draw complete object (fish or lego) with shadow
    if (completeFishBody) {
        ctx.save();

        const objX = completeFishBody.position.x;
        const objY = completeFishBody.position.y;
        const objWidth = 300;
        const objHeight = 200;

        // Draw shadow
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(objX, objY + objHeight/2 + 20, objWidth/2, 30, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Select correct complete image based on current group
        const completeImage = currentGroup === 'fish' ? completeFishImage : completeLegoImage;

        // Draw complete image (or fallback placeholder)
        ctx.translate(objX, objY);
        ctx.rotate(completeFishBody.angle);

        if (completeImage && completeImage.complete) {
            // Draw actual image
            ctx.drawImage(
                completeImage,
                -objWidth / 2,
                -objHeight / 2,
                objWidth,
                objHeight
            );
        } else {
            // Draw fallback placeholder if image not loaded
            ctx.fillStyle = currentGroup === 'fish' ? 'rgba(0, 100, 200, 0.8)' : 'rgba(255, 200, 0, 0.8)';
            ctx.fillRect(-objWidth / 2, -objHeight / 2, objWidth, objHeight);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.lineWidth = 3;
            ctx.strokeRect(-objWidth / 2, -objHeight / 2, objWidth, objHeight);

            // Draw text
            ctx.fillStyle = 'white';
            ctx.font = 'bold 24px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(currentGroup === 'fish' ? 'FISH' : 'LEGO', 0, 0);

            console.warn(`Complete ${currentGroup} image not loaded yet`);
        }

        ctx.restore();
    }

    // Draw image-based cardboard (no rotation, display images as-is) - TOPMOST LAYER
    if (imageCardboardBody && imagesLoaded) {
        ctx.save();
        ctx.translate(imageCardboardBody.position.x, imageCardboardBody.position.y);
        ctx.rotate(imageCardboardBody.angle);

        const cardboardWidth = 298;  // Scaled up by 39.15% (1.21 * 1.15)
        const cardboardHeight = 111;  // Scaled up by 39.15%

        // No rotation - display images in their original orientation

        // Layer 1: Draw cardboard image (bottom layer)
        if (cardboardImage && cardboardImage.complete) {
            ctx.drawImage(
                cardboardImage,
                -cardboardWidth / 2,   // x: center horizontally
                -cardboardHeight / 2,  // y: center vertically
                cardboardWidth,        // width
                cardboardHeight        // height
            );
        }

        // Layer 2: Draw phone image on top (middle layer, scaled 70%)
        if (phoneImage && phoneImage.complete) {
            const phoneW = cardboardWidth * 0.7;   // 208.6
            const phoneH = cardboardHeight * 0.7;  // 77.7
            ctx.drawImage(
                phoneImage,
                -phoneW / 2,  // Center horizontally
                -phoneH / 2,  // Center vertically
                phoneW,
                phoneH
            );
        }

        // Layer 3: Draw grip image (aligned with LEFT side, 6% overlap)
        if (gripImage && gripImage.complete) {
            const gripW = cardboardWidth * 0.8;   // 238.4
            const gripH = cardboardHeight * 0.8;  // 88.8

            // Calculate 6% overlap (based on cardboard WIDTH since aligned horizontally)
            const overlapAmount = cardboardWidth * 0.06;  // 17.88

            // Cardboard left edge is at x = -cardboardWidth / 2 = -149
            // Grip should be positioned to the left with 6% overlap
            // Grip center X = cardboard_left_edge - grip_half_width + overlap
            const gripCenterX = -cardboardWidth / 2 - gripW / 2 + overlapAmount;

            ctx.drawImage(
                gripImage,
                gripCenterX,     // Position with 6% overlap at left side
                -gripH / 2,      // Center vertically (aligned with cardboard midpoint)
                gripW,
                gripH
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

// Check if elements are offscreen (for cleanup and image trigger)
function checkOffscreen() {
    const activeBody = cardboardBody || imageCardboardBody;
    if (!activeBody) return;

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

    // Check if cardboard has exited screen completely (for image trigger)
    // Use simple position-based detection for far offscreen
    const completelyOffscreen =
        activeBody.position.y > canvas.height + 500 ||
        activeBody.position.y < -500 ||
        activeBody.position.x > canvas.width + 500 ||
        activeBody.position.x < -500;

    // Auto-trigger image mode when text cardboard completely exits (no rotation detection needed)
    if (completelyOffscreen && !textCardboardExitTime && !pendingImageTrigger && imagesLoaded) {
        textCardboardExitTime = Date.now();
        pendingImageTrigger = true;
        console.log('Text cardboard completely exited screen - will trigger images in 1 second');
    }

    // Remove everything when very far offscreen (after image animation would have completed)
    const veryFarOffscreen =
        activeBody.position.y > canvas.height + 2000 ||
        activeBody.position.y < -2000 ||
        activeBody.position.x > canvas.width + 2000 ||
        activeBody.position.x < -2000;

    if (veryFarOffscreen) {
        removeAllElements();
    }
}

// Break the rope (disconnect cardboard from rope and start fade animation)
function breakRope() {
    console.log('Rope broke! Starting 0.1s fade animation - cardboard thrown by momentum');

    // Start rope fade animation
    ropeBreakStartTime = Date.now();

    // Start image trigger timer (1 second after rope breaks)
    textCardboardExitTime = Date.now();
    pendingImageTrigger = true;
    console.log('Rope broken - will trigger image mode in 1 second');

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

// Initialize slot machine rows with gray squares (horizontal movement)
function initializeSlotMachine() {
    columns = [];
    const totalHeight = canvas.height * 0.9;  // Use 9/10 of screen height
    const rowHeight = totalHeight / numColumns;  // Divide into 4 rows
    const verticalOffset = (canvas.height - totalHeight) / 2;  // Center vertically
    const squareSize = 121.5;  // Enlarged by 8% from 112.5 (112.5 * 1.08 = 121.5)
    const squareGap = 25;   // Increased gap for larger squares

    console.log('Slot machine initialized with BOTH fish and lego groups');

    // Image assignments per row (from bottom to top):
    // For fish group:
    // hulie1 (row 0, bottom) -> 鱼尾巴 (fishTail)
    // hulie2 (row 1) -> 鱼身体2 (fishBody2)
    // hulie3 (row 2) -> 鱼身体1 (fishBody1)
    // hulie4 (row 3, top) -> 鱼头 (fishHead)

    // For lego group:
    // hulie1 (row 0, bottom) -> 乐高头发 (legoHair)
    // hulie2 (row 1) -> 乐高头 (legoHead)
    // hulie3 (row 2) -> 乐高身体 (legoBody)
    // hulie4 (row 3, top) -> 乐高下半身 (legoLegs)

    const fishImageMap = [
        { type: 'fishTail', image: fishTailImage, group: 'fish' },
        { type: 'fishBody2', image: fishBody2Image, group: 'fish' },
        { type: 'fishBody1', image: fishBody1Image, group: 'fish' },
        { type: 'fishHead', image: fishHeadImage, group: 'fish' }
    ];

    const legoImageMap = [
        { type: 'legoHair', image: legoHairImage, group: 'lego' },
        { type: 'legoHead', image: legoHeadImage, group: 'lego' },
        { type: 'legoBody', image: legoBodyImage, group: 'lego' },
        { type: 'legoLegs', image: legoLegsImage, group: 'lego' }
    ];

    for (let row = 0; row < numColumns; row++) {
        const column = {
            y: verticalOffset + row * rowHeight,  // Y position of this row (centered)
            height: rowHeight,   // Height of this row
            squares: [],
            baseSpeed: columnBaseSpeed[row],
            currentSpeed: columnBaseSpeed[row],
            peakSpeed: columnBaseSpeed[row] * 8,  // 8x base speed when flipped (more obvious effect)
            acceleration: 0,
            rowIndex: row
        };

        // Create initial squares for this row (moving horizontally from left to right)
        // Start far left of viewport so generation is not visible
        // Randomly insert part images from BOTH groups
        for (let i = 0; i < squaresPerColumn; i++) {
            // Randomly decide if this square has a part and which group (33% chance for part)
            const hasPart = Math.random() < 0.33;
            let partGroup = null;
            let partType = null;
            let partImage = null;

            if (hasPart) {
                // Randomly select fish or lego group (50/50)
                const isFish = Math.random() < 0.5;
                if (isFish) {
                    partGroup = 'fish';
                    partType = fishImageMap[row].type;
                    partImage = fishImageMap[row].image;
                } else {
                    partGroup = 'lego';
                    partType = legoImageMap[row].type;
                    partImage = legoImageMap[row].image;
                }
            }

            column.squares.push({
                x: i * (squareSize + squareGap) - canvas.width,  // Start one full screen width to the left
                size: squareSize,
                color: '#888888',  // Gray color
                hasPart: hasPart,
                partType: partType,
                partGroup: partGroup,
                partImage: partImage  // Store image reference directly in square
            });
        }

        columns.push(column);
    }
}

// Update slot machine animation (horizontal movement)
function updateSlotMachine() {
    if (!slotMachineActive) return;

    // Update flip physics if flipping
    if (isFlipping) {
        updateFlipPhysics();
    }

    // Check if we're in detection window during deceleration
    if (detectionWindowActive) {
        checkMatchingInWindow();
    }

    // Update each row
    columns.forEach((column, rowIndex) => {
        // Only move if column is not locked
        if (!lockedColumns[rowIndex]) {
            // Move squares to the right
            column.squares.forEach(square => {
                square.x += column.currentSpeed;
            });

            // Check if any square went off right edge, regenerate at left
            column.squares.forEach((square, idx) => {
                if (square.x > canvas.width + square.size) {
                    // Find the leftmost square in this row
                    let leftmostX = Infinity;
                    column.squares.forEach(s => {
                        if (s.x < leftmostX) {
                            leftmostX = s.x;
                        }
                    });

                    // Place this square to the left of the leftmost square
                    square.x = leftmostX - (square.size + 25);

                    // Randomly regenerate parts from BOTH groups
                    // Increase probability if partial matches exist
                    const partProbability = matchCount >= 2 ? 0.5 : 0.33;
                    square.hasPart = Math.random() < partProbability;

                    if (square.hasPart) {
                        // Randomly select fish or lego group (50/50)
                        const isFish = Math.random() < 0.5;
                        const fishImageMap = [
                            { type: 'fishTail', image: fishTailImage, group: 'fish' },
                            { type: 'fishBody2', image: fishBody2Image, group: 'fish' },
                            { type: 'fishBody1', image: fishBody1Image, group: 'fish' },
                            { type: 'fishHead', image: fishHeadImage, group: 'fish' }
                        ];
                        const legoImageMap = [
                            { type: 'legoHair', image: legoHairImage, group: 'lego' },
                            { type: 'legoHead', image: legoHeadImage, group: 'lego' },
                            { type: 'legoBody', image: legoBodyImage, group: 'lego' },
                            { type: 'legoLegs', image: legoLegsImage, group: 'lego' }
                        ];

                        if (isFish) {
                            square.partGroup = 'fish';
                            square.partType = fishImageMap[rowIndex].type;
                            square.partImage = fishImageMap[rowIndex].image;
                        } else {
                            square.partGroup = 'lego';
                            square.partType = legoImageMap[rowIndex].type;
                            square.partImage = legoImageMap[rowIndex].image;
                        }
                    } else {
                        square.partType = null;
                        square.partGroup = null;
                        square.partImage = null;
                    }
                }
            });
        }
    });
}

// Trigger slot machine flip (when phone flips forward)
function triggerSlotMachineFlip() {
    if (isFlipping) return;  // Already flipping

    isFlipping = true;
    flipStartTime = Date.now();

    // Mark first flip as triggered
    if (!firstFlipTriggered) {
        firstFlipTriggered = true;
        console.log('First flip triggered! Game mechanics activated.');
    } else {
        console.log('Subsequent flip triggered!');
    }

    // Add random variation to each column's response
    // Skip locked columns
    const hasMatches = matchCount >= 2;
    columns.forEach((column, idx) => {
        // Skip locked columns
        if (lockedColumns[idx]) return;

        let variation = 0.8 + Math.random() * 0.4;  // 0.8 to 1.2 multiplier

        // If we have partial matches, slightly adjust speed variation to favor alignment
        if (hasMatches) {
            variation = 0.9 + Math.random() * 0.2;  // Tighter variation for better matching
        }

        column.peakSpeed = column.baseSpeed * 8 * variation;  // 8x for more obvious effect
    });

    console.log('Slot machine flip accelerating...');
}

// Update flip physics (acceleration, peak, deceleration)
function updateFlipPhysics() {
    const elapsed = Date.now() - flipStartTime;
    const totalDuration = flipAccelDuration + flipPeakDuration + flipDecelDuration;

    if (elapsed > totalDuration) {
        // Flip complete, return to base speed
        isFlipping = false;
        detectionWindowActive = false;  // Close detection window
        columns.forEach((column, idx) => {
            if (!lockedColumns[idx]) {
                column.currentSpeed = column.baseSpeed;
            }
        });
        console.log('Flip complete - returned to base speed');
        return;
    }

    const decelStart = flipAccelDuration + flipPeakDuration;
    const inDecelPhase = elapsed >= decelStart;

    // Start detection window 1.4 seconds after flip (during deceleration phase)
    if (elapsed >= detectionDelayAfterFlip && !detectionWindowActive && firstFlipTriggered && !fullMatchComplete) {
        detectionWindowActive = true;
        detectionWindowStartTime = Date.now();
        console.log('Detection window started (1.3s) at 1.4s after flip - checking for matches...');
    }

    columns.forEach((column, idx) => {
        // Skip locked columns
        if (lockedColumns[idx]) {
            column.currentSpeed = 0;  // Locked columns don't move
            return;
        }

        if (elapsed < flipAccelDuration) {
            // Acceleration phase (0 to 0.3s) - ease-out quad
            const progress = elapsed / flipAccelDuration;
            const eased = 1 - Math.pow(1 - progress, 2);
            column.currentSpeed = column.baseSpeed + (column.peakSpeed - column.baseSpeed) * eased;

        } else if (elapsed < decelStart) {
            // Peak phase (0.3s to 0.8s) - maintain peak speed
            column.currentSpeed = column.peakSpeed;

        } else {
            // Deceleration phase (0.8s to 1.8s) - ease-out cubic
            const decelProgress = (elapsed - decelStart) / flipDecelDuration;
            const eased = 1 - Math.pow(1 - decelProgress, 3);
            column.currentSpeed = column.peakSpeed - (column.peakSpeed - column.baseSpeed) * eased;
        }
    });
}

// Check for matching symbols in the detection window
function checkMatchingInWindow() {
    // Check if detection window has expired
    if (!detectionWindowStartTime) return;

    const elapsed = Date.now() - detectionWindowStartTime;
    if (elapsed > detectionWindowDuration) {
        detectionWindowActive = false;
        detectionWindowStartTime = null;
        console.log('Detection window closed - no match found');
        return;
    }

    // Find which symbol is at the center line (中奖线) for each column
    const centerX = canvas.width / 2;
    const symbolsAtCenter = [];

    columns.forEach((column, idx) => {
        if (lockedColumns[idx]) {
            // Already locked, use the locked symbol
            symbolsAtCenter.push({
                columnIndex: idx,
                partType: column.partType,
                partGroup: column.partGroup,
                locked: true
            });
            return;
        }

        // Find the square closest to center line
        let closestSquare = null;
        let minDistance = Infinity;

        column.squares.forEach(square => {
            const squareCenter = square.x + square.size / 2;
            const distance = Math.abs(squareCenter - centerX);
            if (distance < minDistance) {
                minDistance = distance;
                closestSquare = square;
            }
        });

        if (closestSquare && closestSquare.hasPart) {
            symbolsAtCenter.push({
                columnIndex: idx,
                partType: closestSquare.partType,
                partGroup: closestSquare.partGroup,
                square: closestSquare,
                locked: false
            });
        } else {
            symbolsAtCenter.push({
                columnIndex: idx,
                partType: null,
                partGroup: null,
                locked: false
            });
        }
    });

    // Check for matches - look for fish group or lego group
    const fishSymbols = symbolsAtCenter.filter(s => s.partGroup === 'fish');
    const legoSymbols = symbolsAtCenter.filter(s => s.partGroup === 'lego');

    // Determine which group has more matches
    let matchingSymbols = [];
    let matchedGroup = null;

    if (fishSymbols.length >= 2 && fishSymbols.length >= legoSymbols.length) {
        matchingSymbols = fishSymbols;
        matchedGroup = 'fish';
    } else if (legoSymbols.length >= 2) {
        matchingSymbols = legoSymbols;
        matchedGroup = 'lego';
    }

    const unlockedMatchingSymbols = matchingSymbols.filter(s => !s.locked);

    // If we found at least 2 symbols (same group), trigger match
    // Must include at least one unlocked column to trigger new match
    if (matchingSymbols.length >= 2 && unlockedMatchingSymbols.length >= 1) {
        const newMatchCount = matchingSymbols.length;

        // Only trigger if this is actually a new/better match
        if (newMatchCount > matchCount) {
            console.log(`Match detected! ${newMatchCount} ${matchedGroup} symbols aligned!`);

            // Update current group to matched group
            currentGroup = matchedGroup;

            // Lock the newly matched columns at center
            matchingSymbols.forEach(symbol => {
                if (!symbol.locked) {
                    lockColumnAtCenter(symbol.columnIndex, symbol.partGroup);
                }
            });

            // Update match count
            matchCount = newMatchCount;

            // Close detection window after successful match
            detectionWindowActive = false;
            detectionWindowStartTime = null;

            // Play match animation
            if (matchCount === 4) {
                playFullMatchAnimation();
            } else {
                playPartialMatchAnimation(matchingSymbols.map(s => s.columnIndex));
            }
        }
    }
}

// Lock a column at the center line
function lockColumnAtCenter(columnIndex, partGroup) {
    const column = columns[columnIndex];
    const centerX = canvas.width / 2;

    // Find the part square closest to center that matches the group
    let targetSquare = null;
    let minDistance = Infinity;

    column.squares.forEach(square => {
        if (square.hasPart && square.partGroup === partGroup) {
            const squareCenter = square.x + square.size / 2;
            const distance = Math.abs(squareCenter - centerX);
            if (distance < minDistance) {
                minDistance = distance;
                targetSquare = square;
            }
        }
    });

    if (targetSquare) {
        // Calculate offset needed to center this square
        const squareCenter = targetSquare.x + targetSquare.size / 2;
        const offset = centerX - squareCenter;

        // Adjust all squares in this column
        column.squares.forEach(square => {
            square.x += offset;
        });

        console.log(`Column ${columnIndex} locked at center with ${targetSquare.partType} (${partGroup})`);
    } else {
        console.warn(`No ${partGroup} part found in column ${columnIndex} to lock`);
    }

    // Lock this column
    lockedColumns[columnIndex] = true;
    column.currentSpeed = 0;
}

// Play partial match animation (2-3 columns matched)
function playPartialMatchAnimation(matchedIndices) {
    console.log(`Partial match animation for columns: ${matchedIndices.join(', ')}`);
    // TODO: Add visual effects (highlight, scale, particles)
    // TODO: Play sound effect
}

// Play full match animation (all 4 columns matched)
function playFullMatchAnimation() {
    console.log('FULL MATCH! All 4 fish parts aligned! 🎉');
    fullMatchComplete = true;
    showDownArrow = true;
    arrowAnimationTime = Date.now();
    console.log('Show down arrow prompt - waiting for user to swipe down');
}

// Combine parts into complete object (fish or lego)
function combineFishParts() {
    console.log(`Combining ${currentGroup} parts...`);

    if (!currentGroup) {
        console.error('No current group set! Cannot combine parts.');
        return;
    }

    // Hide down arrow
    showDownArrow = false;

    // Start combination animation
    fishCombineAnimationActive = true;
    fishCombineStartTime = Date.now();

    // Create physics bodies for each locked part at their current positions
    const centerX = canvas.width / 2;
    const partSize = 121.5;  // Same as square size

    fishPartBodies = [];

    columns.forEach((column, idx) => {
        if (!lockedColumns[idx]) {
            console.warn(`Column ${idx} is not locked, skipping`);
            return;
        }

        // Find the locked square at center for this column
        let lockedSquare = null;
        column.squares.forEach(square => {
            if (square.hasPart && square.partGroup === currentGroup) {
                const squareCenter = square.x + square.size / 2;
                if (Math.abs(squareCenter - centerX) < 10) {  // Within 10px of center
                    lockedSquare = square;
                }
            }
        });

        if (!lockedSquare) {
            console.warn(`No locked ${currentGroup} square found in column ${idx}`);
            return;
        }

        const partY = column.y + column.height / 2;
        const partImage = lockedSquare.partImage;

        // Create physics body for this part
        const partBody = Bodies.rectangle(
            centerX,
            partY,
            partSize,
            partSize,
            {
                density: 0.002,
                friction: 0.5,
                frictionAir: 0.08,
                restitution: 0.6,  // Bouncy for spring effect
                render: { fillStyle: 'transparent' }
            }
        );

        Composite.add(engine.world, partBody);

        fishPartBodies.push({
            body: partBody,
            image: partImage,
            type: lockedSquare.partType,
            index: idx
        });

        console.log(`Created physics body for ${lockedSquare.partType} at column ${idx}`);

        // Apply downward force to hulie3, hulie2, hulie1 (indices 2, 1, 0)
        if (idx === 0 || idx === 1 || idx === 2) {
            const downwardForce = 0.008;
            Body.applyForce(partBody, partBody.position, {
                x: 0,
                y: downwardForce
            });
            console.log(`Applied downward force to ${lockedSquare.partType}`);
        }
    });

    console.log(`${currentGroup} parts created (${fishPartBodies.length} bodies) - starting combination animation...`);
}

// Update fish combination animation
function updateFishCombineAnimation() {
    if (!fishCombineAnimationActive) return;

    const elapsed = Date.now() - fishCombineStartTime;
    const progress = Math.min(elapsed / fishCombineDuration, 1);

    // Apply spring force to pull all parts toward center
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    fishPartBodies.forEach(part => {
        const dx = centerX - part.body.position.x;
        const dy = centerY - part.body.position.y;

        // Spring force - stronger as time progresses
        const springStrength = 0.0001 * (1 + progress * 2);
        const forceX = dx * springStrength;
        const forceY = dy * springStrength;

        Body.applyForce(part.body, part.body.position, {
            x: forceX,
            y: forceY
        });

        // Add damping to prevent too much oscillation
        Body.setVelocity(part.body, {
            x: part.body.velocity.x * 0.95,
            y: part.body.velocity.y * 0.95
        });
    });

    // Log progress periodically
    if (Math.floor(progress * 10) !== Math.floor((progress - 0.01) * 10)) {
        console.log(`Combination animation progress: ${Math.floor(progress * 100)}%`);
    }

    // When animation completes, create complete object
    if (progress >= 1) {
        console.log('Animation complete! Calling finishFishCombination...');
        finishFishCombination();
    }
}

// Finish fish combination - create complete object
function finishFishCombination() {
    console.log(`Combination animation complete - creating complete ${currentGroup}!`);

    // Remove fish part bodies
    fishPartBodies.forEach(part => {
        Composite.remove(engine.world, part.body);
    });
    fishPartBodies = [];

    // Hide slot machine
    slotMachineActive = false;
    fishCombineAnimationActive = false;

    // Create complete object body at center
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const objWidth = 300;
    const objHeight = 200;

    completeFishBody = Bodies.rectangle(
        centerX,
        centerY,
        objWidth,
        objHeight,
        {
            density: 0.001,
            friction: 0.8,
            restitution: 0.3,
            render: { fillStyle: 'transparent' }
        }
    );

    Composite.add(engine.world, completeFishBody);

    // Check image loading status
    const completeImage = currentGroup === 'fish' ? completeFishImage : completeLegoImage;
    console.log(`Complete ${currentGroup} created at (${centerX}, ${centerY})`);
    console.log(`Image loaded: ${completeImage && completeImage.complete ? 'YES' : 'NO'}`);
    console.log(`completeFishBody exists: ${completeFishBody ? 'YES' : 'NO'}`);
}

// Update complete fish interaction
function updateCompleteFish() {
    if (!completeFishBody) return;

    // Check if fish fell off screen
    if (completeFishBody.position.y > canvas.height + 200) {
        console.log('Fish fell off screen - resetting game...');
        resetGame();
    }
}

// Reset entire game
function resetGame() {
    console.log('Resetting game to initial state...');

    // Remove complete fish
    if (completeFishBody) {
        Composite.remove(engine.world, completeFishBody);
        completeFishBody = null;
    }

    // Remove fish part bodies if any
    if (fishPartBodies.length > 0) {
        fishPartBodies.forEach(part => {
            Composite.remove(engine.world, part.body);
        });
        fishPartBodies = [];
    }

    // Reset all game state
    fullMatchComplete = false;
    showDownArrow = false;
    firstFlipTriggered = false;
    detectionWindowActive = false;
    detectionWindowStartTime = null;
    lockedColumns = [false, false, false, false];
    matchCount = 0;
    isFlipping = false;
    isDraggingFish = false;
    fishCombineAnimationActive = false;
    fishCombineStartTime = null;
    currentGroup = null;  // Reset group selection

    // Restart slot machine
    slotMachineActive = true;
    slotMachineStartTime = Date.now();
    initializeSlotMachine();

    console.log('Game reset complete - slot machine restarted');
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

// Mouse and touch event handlers for fish dragging
function handleMouseDown(e) {
    if (!completeFishBody) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const dx = mouseX - completeFishBody.position.x;
    const dy = mouseY - completeFishBody.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < 150) {
        isDraggingFish = true;
        dragOffset.x = dx;
        dragOffset.y = dy;
        Body.setStatic(completeFishBody, true);
    }
}

function handleMouseMove(e) {
    if (!isDraggingFish || !completeFishBody) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    Body.setPosition(completeFishBody, {
        x: mouseX - dragOffset.x,
        y: mouseY - dragOffset.y
    });
}

function handleMouseUp(e) {
    if (!isDraggingFish || !completeFishBody) return;

    isDraggingFish = false;
    Body.setStatic(completeFishBody, false);
    Body.setVelocity(completeFishBody, { x: 0, y: 0 });
}

function handleTouchStart(e) {
    if (!completeFishBody) return;
    e.preventDefault();

    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const touchX = touch.clientX - rect.left;
    const touchY = touch.clientY - rect.top;

    const dx = touchX - completeFishBody.position.x;
    const dy = touchY - completeFishBody.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < 150) {
        isDraggingFish = true;
        dragOffset.x = dx;
        dragOffset.y = dy;
        Body.setStatic(completeFishBody, true);
    }
}

function handleTouchMove(e) {
    if (!isDraggingFish || !completeFishBody) return;
    e.preventDefault();

    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const touchX = touch.clientX - rect.left;
    const touchY = touch.clientY - rect.top;

    Body.setPosition(completeFishBody, {
        x: touchX - dragOffset.x,
        y: touchY - dragOffset.y
    });
}

function handleTouchEnd(e) {
    if (!isDraggingFish || !completeFishBody) return;
    e.preventDefault();

    isDraggingFish = false;
    Body.setStatic(completeFishBody, false);
    Body.setVelocity(completeFishBody, { x: 0, y: 0 });
}

// Start the application
window.addEventListener('load', init);
