// --- Firebase Setup & Leaderboard Functions --- 

// Your web app's Firebase configuration (Using provided config)
const firebaseConfig = {
  apiKey: "AIzaSyCLaPyzBSFwceNC3ncbuvB31P1Z4h1zmTw",
  authDomain: "kev-pong.firebaseapp.com",
  projectId: "kev-pong",
  storageBucket: "kev-pong.firebasestorage.app",
  messagingSenderId: "818433206211",
  appId: "1:818433206211:web:79561a2eeac0a424823f76",
  measurementId: "G-P4FN7PGX2T"
};

// Initialize Firebase
let app;
let db;
try {
    app = firebase.initializeApp(firebaseConfig);
    db = firebase.firestore(); // Use compat syntax
} catch (error) {
    console.error("Firebase initialization failed:", error);
    // Handle initialization error (e.g., disable leaderboard features)
}

// Function to save score to Firestore
async function saveScoreToLeaderboard(playerName, score) {
    if (!db) {
        console.error("Firestore not initialized, cannot save score.");
        return;
    }
    try {
        // Use v8/compat syntax: db.collection(...).add(...)
        await db.collection("scores").add({
            name: playerName,
            score: score,
            timeSeconds: Math.floor(gameState.elapsedTimeSeconds), // ADDED: Save elapsed time
            timestamp: firebase.firestore.FieldValue.serverTimestamp() // This compat syntax is correct
        });
    } catch (error) {
        console.error("Error saving score: ", error);
    }
}

// Function to fetch and display leaderboard
async function displayLeaderboard(listElementId, loadingElementId) { // Accept IDs as arguments
    if (!db) {
        console.error("Firestore not initialized, cannot display leaderboard.");
        return; // Or display a message indicating leaderboard is unavailable
    }

    const leaderboardElement = document.getElementById(listElementId); // Use argument ID
    const loadingElement = document.getElementById(loadingElementId); // Use argument ID
    if (!leaderboardElement || !loadingElement) {
        console.error(`Leaderboard elements not found: ${listElementId}, ${loadingElementId}`);
        return;
    }

    leaderboardElement.innerHTML = ''; // Clear previous entries
    loadingElement.style.display = 'block'; // Show loading indicator

    try {
        // Use v8/compat syntax: db.collection(...).orderBy(...).limit(...).get()
        const scoresCollection = db.collection("scores");
        const q = scoresCollection
                      .orderBy("timeSeconds", "asc") // Order by timeSeconds ascending (lower is better)
                      .limit(10); // Limit to top 10

        const querySnapshot = await q.get(); // Use .get() on the query
        
        if (querySnapshot.empty) {
            leaderboardElement.innerHTML = '<li class="no-info">No info yet!</li>'; // Add class
        } else {
            let rank = 0; // Initialize rank counter
            querySnapshot.forEach((doc) => { // The callback only receives 'doc' reliably
                const data = doc.data();
                
                // Format timeSeconds into MM:SS
                const totalSeconds = data.timeSeconds || 0;
                const minutes = Math.floor(totalSeconds / 60);
                const seconds = totalSeconds % 60;
                const formattedTime = 
                    String(minutes).padStart(2, '0') + ':' + 
                    String(seconds).padStart(2, '0');
                
                const listItem = document.createElement('li');
                rank++; // Increment rank for the current item (starts at 1)
                if (rank === 1) {
                    listItem.classList.add('top-score'); // Add class for #1
                }
                // Display Name and Formatted Time
                listItem.textContent = `#${rank}: ${data.name || 'Anon'} - ${formattedTime}`;
                leaderboardElement.appendChild(listItem);
            });
        }
    } catch (error) {
        console.error("Error fetching leaderboard: ", error);
        leaderboardElement.innerHTML = '<li class="no-info">Error loading times.</li>'; // Add class
    } finally {
        loadingElement.style.display = 'none'; // Hide loading indicator
    }
}

// --- End Firebase Setup & Leaderboard Functions ---


// Game state
const gameState = {
    started: false,
    over: false,
    scores: {
        player: 0,
        opponent: 0
    },
    winningScore: 3,    // Changed back from 1 - First to score 3 wins
    elapsedTimeSeconds: 0, // ADDED - Game timer
    currentBallSpeed: 0, // Added to track dynamic speed
    countdown: {
        active: false,
        value: 3,
        lastUpdate: 0
    }
};

// DOM Elements
const playerScoreElement = document.getElementById('player-score');
const opponentScoreElement = document.getElementById('opponent-score');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const gameResultElement = document.getElementById('game-result');
const startButton = document.getElementById('start-button');
const restartButton = document.getElementById('restart-button');

// Add countdown elements to HTML if not present
if (!document.getElementById('countdown')) {
    const countdownContainer = document.createElement('div');
    countdownContainer.id = 'countdown-container';
    countdownContainer.style.position = 'absolute';
    countdownContainer.style.top = '45%';
    countdownContainer.style.left = '50%';
    countdownContainer.style.transform = 'translate(-50%, -50%)';
    countdownContainer.style.textAlign = 'center';
    countdownContainer.style.fontFamily = 'Arial, sans-serif';
    countdownContainer.style.zIndex = '100';
    countdownContainer.style.display = 'none';
    
    // Who scored message
    const scorerElement = document.createElement('div');
    scorerElement.id = 'scorer-message';
    scorerElement.style.fontSize = '32px';
    scorerElement.style.color = '#ffffff';
    scorerElement.style.marginBottom = '20px';
    scorerElement.style.textShadow = '0 0 10px #ff9933';
    countdownContainer.appendChild(scorerElement);
    
    // Countdown number
    const countdownElement = document.createElement('div');
    countdownElement.id = 'countdown';
    countdownElement.style.fontSize = '100px';
    countdownElement.style.color = '#ff6600';
    countdownElement.style.fontWeight = 'bold';
    countdownElement.style.textShadow = '0 0 20px #ff9933';
    countdownContainer.appendChild(countdownElement);
    
    document.getElementById('game-container').appendChild(countdownContainer);
}
const countdownContainer = document.getElementById('countdown-container');
const countdownElement = document.getElementById('countdown');
const scorerElement = document.getElementById('scorer-message');

// Constants
const ARENA_WIDTH = 250;
const ARENA_HEIGHT = 200;  // Increased from 160 for taller playfield
const ARENA_LENGTH = 500;
const BALL_RADIUS = 7;
const PADDLE_WIDTH = 60;   // Increased from 50 for better edge coverage
const PADDLE_HEIGHT = 70;  // Increased from 60 for better edge coverage
const PADDLE_DEPTH = 7;    // Increased from 5 to make paddles thicker
const BALL_SPEED = 180;
const PADDLE_Z_MIN = ARENA_LENGTH / 2 - 40;
const PADDLE_Z_MAX = ARENA_LENGTH / 2;

// Three.js setup
let scene, camera, renderer;
let arena, ball, playerPaddle, opponentPaddle;
let ballVelocity = { x: 0, y: 0, z: 0 };
let lastTimestamp = 0;
let mousePosition = { x: 0, y: 0 };

// Initialize the game
function init() {
    // Create Scene
    scene = new THREE.Scene();
    // scene.background = new THREE.Color(0x1a0500); // REMOVED: We'll set background on HTML body

    // Create Camera - adjust for more natural viewing angle
    camera = new THREE.PerspectiveCamera(
        75, // Increased FOV slightly for wider view
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    const baseZ = 400; // Define a base Z position
    camera.position.set(0, 80, baseZ); // Use baseZ for initial position
    camera.lookAt(0, -40, 0); // Look slightly down to see more of the lower area

    // Create Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); // Added alpha: true
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0); // Set clear color to transparent
    renderer.shadowMap.enabled = true;
    document.getElementById('game-container').appendChild(renderer.domElement);

    // Lighting
    addLighting();

    // Create Arena
    createArena();

    // Create Ball
    createBall();

    // Create Paddles
    createPaddles();

    // Setup for mouse control
    setupMouseControl();
    
    // Enhance the HUD with Kevinity branding
    enhanceHUDWithKevinityBranding();

    // Event listeners (Only add listeners for elements that exist now)
    // REMOVED: startButton.addEventListener('click', startGame); - Added later dynamically
    // REMOVED: restartButton.addEventListener('click', restartGame); - Added later dynamically
    // REMOVED: document.addEventListener('mousemove', onMouseMove); - Redundant, handled by onDocumentMouseMove
    // REMOVED: window.addEventListener('resize', onWindowResize); - Duplicate below

    // Add mouse move listener
    document.addEventListener('mousemove', onDocumentMouseMove, false);

    // Add touch event listeners
    document.addEventListener('touchstart', onDocumentTouchStart, { passive: false });
    document.addEventListener('touchmove', onDocumentTouchMove, { passive: false });

    // Add window resize listener
    window.addEventListener('resize', onWindowResize);

    // Call resize handler once initially to set camera based on initial aspect ratio
    onWindowResize();

    // Start animation loop
    animate(0);
}

function addLighting() {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0xfff0e6, 0.4); // Warm ambient light
    scene.add(ambientLight);

    // Main directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(100, 200, 50);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    // Additional light sources for better visibility
    const fill1 = new THREE.DirectionalLight(0xffd0a0, 0.4); // Warm orange fill light
    fill1.position.set(-100, 100, -50);
    scene.add(fill1);

    const fill2 = new THREE.DirectionalLight(0xffb366, 0.4); // Warmer orange fill light
    fill2.position.set(0, 50, -100);
    scene.add(fill2);
    
    // Add orange-themed colored lights
    const orangeLight = new THREE.PointLight(0xff6600, 0.8, 300); // Bright orange
    orangeLight.position.set(-100, 50, 0);
    scene.add(orangeLight);
    
    const yellowLight = new THREE.PointLight(0xffcc00, 0.6, 300); // Yellow-orange
    yellowLight.position.set(100, 50, 0);
    scene.add(yellowLight);
    
    // Add a subtle pulsing effect to the lights
    orangeLight.userData = { pulsePhase: 0 };
    yellowLight.userData = { pulsePhase: Math.PI }; // Opposite phase
    
    // Store lights for animation
    scene.userData = { pulseLights: [orangeLight, yellowLight] };
}

function createArena() {
    // Create arena walls individually instead of using a single wireframe box
    // This prevents diagonal lines across the faces
    
    // Define the dimensions
    const halfWidth = ARENA_WIDTH / 2;
    const halfHeight = ARENA_HEIGHT / 2;
    const halfLength = ARENA_LENGTH / 2;
    
    // Create each wall as a separate line segment
    const wallEdges = [
        // Front face (4 edges)
        new THREE.Vector3(-halfWidth, -halfHeight, halfLength),
        new THREE.Vector3(halfWidth, -halfHeight, halfLength),
        
        new THREE.Vector3(halfWidth, -halfHeight, halfLength),
        new THREE.Vector3(halfWidth, halfHeight, halfLength),
        
        new THREE.Vector3(halfWidth, halfHeight, halfLength),
        new THREE.Vector3(-halfWidth, halfHeight, halfLength),
        
        new THREE.Vector3(-halfWidth, halfHeight, halfLength),
        new THREE.Vector3(-halfWidth, -halfHeight, halfLength),
        
        // Back face (4 edges)
        new THREE.Vector3(-halfWidth, -halfHeight, -halfLength),
        new THREE.Vector3(halfWidth, -halfHeight, -halfLength),
        
        new THREE.Vector3(halfWidth, -halfHeight, -halfLength),
        new THREE.Vector3(halfWidth, halfHeight, -halfLength),
        
        new THREE.Vector3(halfWidth, halfHeight, -halfLength),
        new THREE.Vector3(-halfWidth, halfHeight, -halfLength),
        
        new THREE.Vector3(-halfWidth, halfHeight, -halfLength),
        new THREE.Vector3(-halfWidth, -halfHeight, -halfLength),
        
        // Connecting edges between front and back (4 edges)
        new THREE.Vector3(-halfWidth, -halfHeight, halfLength),
        new THREE.Vector3(-halfWidth, -halfHeight, -halfLength),
        
        new THREE.Vector3(halfWidth, -halfHeight, halfLength),
        new THREE.Vector3(halfWidth, -halfHeight, -halfLength),
        
        new THREE.Vector3(halfWidth, halfHeight, halfLength),
        new THREE.Vector3(halfWidth, halfHeight, -halfLength),
        
        new THREE.Vector3(-halfWidth, halfHeight, halfLength),
        new THREE.Vector3(-halfWidth, halfHeight, -halfLength)
    ];
    
    // Create geometry from vertices
    const arenaGeometry = new THREE.BufferGeometry();
    arenaGeometry.setFromPoints(wallEdges);
    
    // Create material
    const arenaMaterial = new THREE.LineBasicMaterial({
        color: 0xff6600,
        linewidth: 2,
        opacity: 0.8,
        transparent: true
    });
    
    // Create line segments
    const arenaEdges = new THREE.LineSegments(arenaGeometry, arenaMaterial);
    scene.add(arenaEdges);
    
    // Add center line - make it more visible
    const centerLineGeometry = new THREE.PlaneGeometry(ARENA_WIDTH, ARENA_HEIGHT);
    const centerLineMaterial = new THREE.MeshBasicMaterial({
        color: 0xff9933,
        transparent: true,
        opacity: 0.2,
        side: THREE.DoubleSide
    });
    const centerLine = new THREE.Mesh(centerLineGeometry, centerLineMaterial);
    centerLine.rotation.y = Math.PI / 2;
    scene.add(centerLine);
    
    // Add horizontal guide lines to emphasize vertical space - make them cleaner
    const horizontalLines = [
        { y: ARENA_HEIGHT * 0.3, opacity: 0.1 },
        { y: -ARENA_HEIGHT * 0.3, opacity: 0.1 }
    ];
    
    horizontalLines.forEach(line => {
        const lineGeometry = new THREE.PlaneGeometry(ARENA_WIDTH, 0.5); // Thinner lines
        const lineMaterial = new THREE.MeshBasicMaterial({
            color: 0xffa500,
            transparent: true,
            opacity: line.opacity,
            side: THREE.DoubleSide
        });
        const lineMesh = new THREE.Mesh(lineGeometry, lineMaterial);
        lineMesh.position.set(0, line.y, 0);
        lineMesh.scale.z = ARENA_LENGTH;
        scene.add(lineMesh);
    });
}

function createBall() {
    // Create a more interesting ball with a glow effect
    const ballGeometry = new THREE.SphereGeometry(BALL_RADIUS, 16, 16);
    
    // Inner bright ball
    const ballMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xff7700,
        emissiveIntensity: 0.8,
        roughness: 0.2
    });
    ball = new THREE.Mesh(ballGeometry, ballMaterial);
    ball.castShadow = true;
    scene.add(ball);
    
    // Add outer glow
    const glowGeometry = new THREE.SphereGeometry(BALL_RADIUS * 1.5, 16, 16);
    const glowMaterial = new THREE.MeshBasicMaterial({
        color: 0xff6600,
        transparent: true,
        opacity: 0.4,
        side: THREE.BackSide
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    ball.add(glow); // Add glow as child of ball
    
    // Store glow for animation
    ball.userData = { 
        glow,
        lastTrailTime: 0,
        trailParticles: []
    };

    // Initialize ball velocity
    resetBall();
}

function createPaddles() {
    // Player paddle - clean outline only
    const paddleGroup = new THREE.Group();
    
    // Create base geometry to derive edges from
    const paddleGeometry = new THREE.BoxGeometry(
        PADDLE_WIDTH, 
        PADDLE_HEIGHT, 
        PADDLE_DEPTH
    );
    
    // Create edges geometry (just the 12 edges of the box, no diagonals)
    const edgesGeometry = new THREE.EdgesGeometry(paddleGeometry);
    const edgesMaterial = new THREE.LineBasicMaterial({
        color: 0xff8800,
        linewidth: 2
    });
    
    const paddleEdges = new THREE.LineSegments(edgesGeometry, edgesMaterial);
    paddleGroup.add(paddleEdges);
    
    // Position the whole paddle
    paddleGroup.position.set(0, 0, ARENA_LENGTH / 2 - 10);
    scene.add(paddleGroup);
    
    // For convenience in updating position, store the group as playerPaddle
    playerPaddle = paddleGroup;

    // Opponent paddle - clean outline only
    const opponentPaddleGroup = new THREE.Group();
    
    // Create base geometry to derive edges from
    const opponentPaddleGeometry = new THREE.BoxGeometry(
        PADDLE_WIDTH, 
        PADDLE_HEIGHT, 
        PADDLE_DEPTH
    );
    
    // Create edges geometry (just the 12 edges of the box, no diagonals)
    const opponentEdgesGeometry = new THREE.EdgesGeometry(opponentPaddleGeometry);
    const opponentEdgesMaterial = new THREE.LineBasicMaterial({
        color: 0x88ff00,
        linewidth: 2
    });
    
    const opponentPaddleEdges = new THREE.LineSegments(opponentEdgesGeometry, opponentEdgesMaterial);
    opponentPaddleGroup.add(opponentPaddleEdges);
    
    // Position the whole paddle
    opponentPaddleGroup.position.set(0, 0, -ARENA_LENGTH / 2 + 10);
    scene.add(opponentPaddleGroup);
    
    // For convenience in updating position, store the group as opponentPaddle
    opponentPaddle = opponentPaddleGroup;
}

function setupMouseControl() {
    // We're no longer using the raycaster and mouse plane approach
    // Just set up mouse position tracking - the variables are still declared at the top
    mousePosition = { x: 0, y: 0 };
}

function onMouseMove(event) {
    // Calculate mouse position in normalized device coordinates (-1 to +1)
    mousePosition.x = (event.clientX / window.innerWidth) * 2 - 1;
    mousePosition.y = -(event.clientY / window.innerHeight) * 2 + 1;
}

function updatePlayerPaddlePosition() {
    // Define paddle boundaries (exact edges of arena)
    const maxX = ARENA_WIDTH / 2 - PADDLE_WIDTH / 2;
    const maxY = ARENA_HEIGHT / 2 - PADDLE_HEIGHT / 2;
    
    // Map normalized mouse position to arena dimensions with adjusted sensitivity
    // A divisor closer to 1 makes it more sensitive.
    // Let's use 1.2 for increased responsiveness while maintaining control.
    const sensitivityFactor = 1.2;
    const targetX = mousePosition.x * ARENA_WIDTH / sensitivityFactor;
    const targetY = mousePosition.y * ARENA_HEIGHT / sensitivityFactor;
    
    // Apply position and clamp to the actual maximum allowed range
    playerPaddle.position.x = Math.max(-maxX, Math.min(maxX, targetX));
    playerPaddle.position.y = Math.max(-maxY, Math.min(maxY, targetY));
    
    // Ensure Z position remains constant
    playerPaddle.position.z = ARENA_LENGTH / 2 - 10;
}

function updateOpponentPaddle() {
    try {
        // --- Defensive Checks --- 
        if (!opponentPaddle || !ball || !ball.position || !ballVelocity) {
            console.warn("updateOpponentPaddle called with missing objects");
            return; // Exit early if critical objects are missing
        }

        // Ensure userData object exists
        if (!opponentPaddle.userData) {
            console.warn("Initializing opponentPaddle.userData");
            opponentPaddle.userData = {
                velocityX: 0, velocityY: 0, targetX: 0, targetY: 0,
                lastPrediction: { x: 0, y: 0 }, predictionConfidence: 0,
                isFirstHitAfterServe: false // Initialize flag only here
            };
        }
        
        // Ensure lastPrediction object exists
        if (!opponentPaddle.userData.lastPrediction) {
             console.warn("Initializing opponentPaddle.userData.lastPrediction");
            opponentPaddle.userData.lastPrediction = { x: 0, y: 0 };
        }
        // Ensure lastPrediction properties exist
        if (typeof opponentPaddle.userData.lastPrediction.x === 'undefined') {
             console.warn("Initializing opponentPaddle.userData.lastPrediction.x");
            opponentPaddle.userData.lastPrediction.x = 0;
        }
        if (typeof opponentPaddle.userData.lastPrediction.y === 'undefined') {
             console.warn("Initializing opponentPaddle.userData.lastPrediction.y");
            opponentPaddle.userData.lastPrediction.y = 0;
        }
        // Ensure other properties exist (add default if necessary, but preserve isFirstHitAfterServe)
        if (typeof opponentPaddle.userData.velocityX === 'undefined') opponentPaddle.userData.velocityX = 0;
        if (typeof opponentPaddle.userData.velocityY === 'undefined') opponentPaddle.userData.velocityY = 0;
        if (typeof opponentPaddle.userData.targetX === 'undefined') opponentPaddle.userData.targetX = 0;
        if (typeof opponentPaddle.userData.targetY === 'undefined') opponentPaddle.userData.targetY = 0;
        if (typeof opponentPaddle.userData.predictionConfidence === 'undefined') opponentPaddle.userData.predictionConfidence = 0;
        // Intentionally DO NOT reset isFirstHitAfterServe here unless userData itself was missing
        
        // --- End Defensive Checks ---

        // Store previous position for smoothing
        const prevX = opponentPaddle.position.x;
        const prevY = opponentPaddle.position.y;
        
        // Define paddle boundaries
        const maxX = ARENA_WIDTH / 2 - PADDLE_WIDTH / 2;
        const maxY = ARENA_HEIGHT / 2 - PADDLE_HEIGHT / 2;
        
        // Improved AI for 3D Pong with smoother movement
        let targetX = 0;
        let targetY = 0;
        
        // Ensure we have velocity storage for smooth acceleration
        if (!opponentPaddle.userData) {
            opponentPaddle.userData = {
                velocityX: 0,
                velocityY: 0,
                targetX: 0,
                targetY: 0,
                lastPrediction: { x: 0, y: 0 }, // Initialize lastPrediction with x and y
                predictionConfidence: 0,
                isFirstHitAfterServe: false // Add flag for first hit accuracy
            };
        }
        
        // Only get a new target when the ball is moving toward opponent
        if (ballVelocity.z < 0) {
            // Calculate estimated arrival time and position
            const distanceToOpponent = Math.abs((-ARENA_LENGTH / 2 + 10) - ball.position.z);
            // Prevent division by zero or extremely small values
            const zSpeed = Math.max(1, Math.abs(ballVelocity.z));
            const timeToReach = distanceToOpponent / zSpeed;
            
            // Cap prediction time to prevent extreme values
            const cappedTimeToReach = Math.min(timeToReach, 60);
            
            // Improved prediction model that accounts for bounces
            let predictedX = ball.position.x + ballVelocity.x * cappedTimeToReach;
            let predictedY = ball.position.y + ballVelocity.y * cappedTimeToReach;
            
            // Safety bounds for predictions to avoid NaN
            predictedX = isFinite(predictedX) ? predictedX : 0;
            predictedY = isFinite(predictedY) ? predictedY : 0;
            
            // Check for wall bounces in prediction path (X-axis)
            const timeToXBounce = ballVelocity.x !== 0 ? 
                (Math.sign(ballVelocity.x) * (ARENA_WIDTH / 2 - BALL_RADIUS) - ball.position.x) / ballVelocity.x : Infinity;
            
            if (isFinite(timeToXBounce) && timeToXBounce > 0 && timeToXBounce < cappedTimeToReach) {
                // Ball will bounce off X wall before reaching paddle
                const remainingTime = cappedTimeToReach - timeToXBounce;
                predictedX = Math.sign(ballVelocity.x) * (ARENA_WIDTH / 2 - BALL_RADIUS) - (ballVelocity.x * remainingTime);
            }
            
            // Check for wall bounces in prediction path (Y-axis)
            const timeToYBounce = ballVelocity.y !== 0 ? 
                (Math.sign(ballVelocity.y) * (ARENA_HEIGHT / 2 - BALL_RADIUS) - ball.position.y) / ballVelocity.y : Infinity;
            
            if (isFinite(timeToYBounce) && timeToYBounce > 0 && timeToYBounce < cappedTimeToReach) {
                // Ball will bounce off Y wall before reaching paddle
                const remainingTime = cappedTimeToReach - timeToYBounce;
                predictedY = Math.sign(ballVelocity.y) * (ARENA_HEIGHT / 2 - BALL_RADIUS) - (ballVelocity.y * remainingTime);
            }
            
            // --- REMOVED isFirstHit definition from here --- 

            // Difficulty scaling based on score difference - Made Slightly Harder
            const playerAdvantage = Math.max(0, gameState.scores.player - gameState.scores.opponent);
            const adaptiveDifficulty = Math.min(0.6, 0.35 + (playerAdvantage * 0.025)); // Slightly increased base, scaling, and cap
            
            // Add randomness based on confidence - Significantly Reduced Accuracy
            // --- BUT: No randomness on the first guaranteed hit --- 
            // --- AND: Accuracy NO LONGER degrades with consecutive hits --- 
            const baseRandomness = opponentPaddle.userData.isFirstHitAfterServe ? 0 : (1 - adaptiveDifficulty) * 400; // Directly use the flag here
            // const consecutiveHitPenalty = Math.min(900, (opponentPaddle.userData.consecutiveHits || 0) * 50); // REMOVED
            const randomErrorFactor = baseRandomness; // Simplified - no penalty added
            
            const errorX = (Math.random() - 0.5) * randomErrorFactor;
            const errorY = (Math.random() - 0.5) * randomErrorFactor;
            
            // Store high-confidence predictions to avoid jitter
            if (cappedTimeToReach < 60 && Math.abs(ballVelocity.z) > 1) {
                // Update prediction with smoothing - Slightly Faster Reaction
                // --- BUT: Use less smoothing (more reactive) on the first guaranteed hit --- 
                const smoothFactor = opponentPaddle.userData.isFirstHitAfterServe ? 0.1 : 0.65; // Decreased from 0.7 for slightly faster reaction
                opponentPaddle.userData.lastPrediction.x = 
                    opponentPaddle.userData.lastPrediction.x * (1 - smoothFactor) + 
                    (predictedX + errorX) * smoothFactor;
                
                opponentPaddle.userData.lastPrediction.y = 
                    opponentPaddle.userData.lastPrediction.y * (1 - smoothFactor) + 
                    (predictedY + errorY) * smoothFactor;
                    
                // --- Set maximum confidence on the first hit --- 
                opponentPaddle.userData.predictionConfidence = opponentPaddle.userData.isFirstHitAfterServe ? 1.0 : Math.min(1, opponentPaddle.userData.predictionConfidence + 0.04); // Slightly increased confidence gain from 0.03
            } else {
                // Low confidence in prediction
                opponentPaddle.userData.predictionConfidence = Math.max(0, opponentPaddle.userData.predictionConfidence - 0.05);
            }
            
            // Use the smoothed prediction
            targetX = opponentPaddle.userData.lastPrediction.x;
            targetY = opponentPaddle.userData.lastPrediction.y;
            
            // --- REMOVED Strategic Aiming --- 
            // if (adaptiveDifficulty > 0.8) { 
            //     targetX += (ball.position.x > 0 ? -1 : 1) * PADDLE_WIDTH * 0.25;
            // }
            
            // Ensure target is within bounds
            targetX = Math.max(-maxX, Math.min(maxX, targetX));
            targetY = Math.max(-maxY, Math.min(maxY, targetY));
        } else {
            // Ball moving away - smoothly return to a neutral defensive position
            // Return to neutral position but maintain some tracking of ball's X position
            targetX = ball.position.x * 0.08; // Slightly increased tracking factor from 0.05
            targetY = Math.sin(Date.now() * 0.0005) * ARENA_HEIGHT * 0.1; // Subtle movement
            
            // Gradually lose prediction confidence
            opponentPaddle.userData.predictionConfidence = Math.max(0, opponentPaddle.userData.predictionConfidence - 0.02);
        }
        
        // Prevent NaN or Infinity in target positions
        targetX = isFinite(targetX) ? targetX : 0;
        targetY = isFinite(targetY) ? targetY : 0;
        
        // --- Instant Move for First Hit --- 
        if (opponentPaddle.userData.isFirstHitAfterServe) { // Directly use the flag here
            opponentPaddle.position.x = targetX;
            opponentPaddle.position.y = targetY;
            // Ensure velocity is reset after teleport to avoid overshoot on next frame
            opponentPaddle.userData.velocityX = 0;
            opponentPaddle.userData.velocityY = 0;
        } else {
            // --- Normal Movement Logic (Only if not first hit) --- 
            // Store current target
            opponentPaddle.userData.targetX = targetX;
            opponentPaddle.userData.targetY = targetY;
            
            // Calculate base speed - Massively faster for the first guaranteed hit
            const skillBonus = Math.min(2.5, gameState.scores.player * 0.07); // Slightly increased skill bonus cap and scaling
            const normalBaseMaxSpeed = 1.5 + skillBonus; // Slightly increased base speed from 1.2 to 1.5
            // const baseMaxSpeed = isFirstHit ? 100.0 : normalBaseMaxSpeed; // No longer needed due to teleport
            const baseMaxSpeed = normalBaseMaxSpeed; 
            
            // Apply smooth acceleration with variable maxSpeed based on distance and confidence
            const distX = targetX - opponentPaddle.position.x;
            const distY = targetY - opponentPaddle.position.y;
            const distTotal = Math.sqrt(distX * distX + distY * distY);
            
            // Dynamic speed based on distance (faster when far from target)
            // Use the potentially higher baseMaxSpeed for the first hit
            const dynamicMaxSpeed = Math.min(baseMaxSpeed, 
                baseMaxSpeed * (0.5 + 0.5 * Math.min(1, distTotal / 50)));
            
            // Calculate acceleration based on distance - Massively faster for first hit
            const normalAccelFactor = 0.06; // Slightly increased acceleration from 0.05
            // const accelFactor = isFirstHit ? 5.0 : normalAccelFactor; // No longer needed due to teleport
            const accelFactor = normalAccelFactor; 
            const maxAccel = dynamicMaxSpeed * accelFactor;
            
            // Accelerate in X direction
            const accelX = Math.sign(distX) * Math.min(Math.abs(distX) * 0.1, maxAccel);
            opponentPaddle.userData.velocityX += accelX;
            
            // Accelerate in Y direction
            const accelY = Math.sign(distY) * Math.min(Math.abs(distY) * 0.1, maxAccel);
            opponentPaddle.userData.velocityY += accelY;
            
            // Apply drag to velocities - Less drag for first hit
            const normalDragFactor = 0.14; // Slightly reduced drag from 0.15 for faster response
            // const dragFactor = isFirstHit ? 0.02 : normalDragFactor; // No longer needed due to teleport
            const dragFactor = normalDragFactor; 
            opponentPaddle.userData.velocityX *= (1 - dragFactor);
            opponentPaddle.userData.velocityY *= (1 - dragFactor);
            
            // Prevent NaN or Infinity in velocities
            opponentPaddle.userData.velocityX = isFinite(opponentPaddle.userData.velocityX) ? 
                opponentPaddle.userData.velocityX : 0;
            opponentPaddle.userData.velocityY = isFinite(opponentPaddle.userData.velocityY) ? 
                opponentPaddle.userData.velocityY : 0;
            
            // Cap at max speed
            const currentSpeed = Math.sqrt(
                opponentPaddle.userData.velocityX * opponentPaddle.userData.velocityX + 
                opponentPaddle.userData.velocityY * opponentPaddle.userData.velocityY
            );
            
            if (currentSpeed > dynamicMaxSpeed && currentSpeed > 0) {
                const speedRatio = dynamicMaxSpeed / currentSpeed;
                opponentPaddle.userData.velocityX *= speedRatio;
                opponentPaddle.userData.velocityY *= speedRatio;
            }
            
            // Apply final velocity
            opponentPaddle.position.x += opponentPaddle.userData.velocityX;
            opponentPaddle.position.y += opponentPaddle.userData.velocityY;
        }
        // --- End Movement Logic Branching ---
        
        // Ensure position stays within boundaries (applies after teleport or movement)
        opponentPaddle.position.x = Math.max(-maxX, Math.min(maxX, opponentPaddle.position.x));
        opponentPaddle.position.y = Math.max(-maxY, Math.min(maxY, opponentPaddle.position.y));
    } catch (error) {
        console.error("Error in updateOpponentPaddle:", error);
        // Fallback to simple AI behavior if something goes wrong
        const simpleTargetX = ball.position.x * 0.5;
        const simpleTargetY = ball.position.y * 0.5;
        
        // Move toward target position at a constant speed
        const speed = 3;
        const moveX = Math.sign(simpleTargetX - opponentPaddle.position.x) * Math.min(Math.abs(simpleTargetX - opponentPaddle.position.x), speed);
        const moveY = Math.sign(simpleTargetY - opponentPaddle.position.y) * Math.min(Math.abs(simpleTargetY - opponentPaddle.position.y), speed);
        
        opponentPaddle.position.x += moveX;
        opponentPaddle.position.y += moveY;
        
        // Ensure position stays within boundaries and Z position is fixed
        const maxX = ARENA_WIDTH / 2 - PADDLE_WIDTH / 2;
        const maxY = ARENA_HEIGHT / 2 - PADDLE_HEIGHT / 2;
        opponentPaddle.position.x = Math.max(-maxX, Math.min(maxX, opponentPaddle.position.x));
        opponentPaddle.position.y = Math.max(-maxY, Math.min(maxY, opponentPaddle.position.y));
        opponentPaddle.position.z = -ARENA_LENGTH / 2 + 10;
    }
}

function updateBall(deltaTime) {
    if (!gameState.started || gameState.over) return;
    
    // Store previous position for collision detection and trail
    if (!ball.userData.previousPosition) {
        ball.userData.previousPosition = ball.position.clone();
    } else {
        ball.userData.previousPosition.copy(ball.position);
    }
    
    // Update ball position based on velocity (no gravity in Pong)
    ball.position.x += ballVelocity.x * deltaTime;
    ball.position.y += ballVelocity.y * deltaTime;
    ball.position.z += ballVelocity.z * deltaTime;
    
    // Add trail effect
    updateBallTrail(deltaTime, ball.userData.previousPosition); // Pass previous position
    
    // Animate ball - make it spin
    ball.rotation.x += deltaTime * 2;
    ball.rotation.y += deltaTime * 3;
    
    // Pulse the glow based on ball speed
    if (ball.userData && ball.userData.glow) {
        const speed = Math.sqrt(
            ballVelocity.x * ballVelocity.x + 
            ballVelocity.y * ballVelocity.y + 
            ballVelocity.z * ballVelocity.z
        );
        const normalizedSpeed = speed / BALL_SPEED;
        ball.userData.glow.material.opacity = 0.3 + 0.3 * normalizedSpeed;
    }
    
    // Boundary checks
    checkArenaBoundaries();
    checkPaddleCollisions();
    checkScoring();
}

// Updated function to start the countdown with scorer message
function startCountdown(serveToPlayer, scorerMessage) {
    // Reset ball to center immediately when countdown starts
    // Make sure the ball is brought back to center regardless of how far it went
    ball.position.set(0, 0, 0);
    ballVelocity.x = 0;
    ballVelocity.y = 0;
    ballVelocity.z = 0;
    
    // Clear any existing ball trails
    if (scene.userData.trailParticles && scene.userData.trailParticles.length > 0) {
        // Remove all trail particles from the scene
        scene.userData.trailParticles.forEach(particle => {
            scene.remove(particle);
        });
        // Clear the array
        scene.userData.trailParticles = [];
    }
    
    // Initialize countdown
    gameState.countdown.active = true;
    gameState.countdown.value = 3;
    gameState.countdown.lastUpdate = Date.now();
    gameState.countdown.serveToPlayer = serveToPlayer;
    gameState.countdown.scorerMessage = scorerMessage;
    
    // Show countdown with scorer message
    updateCountdownDisplay();
}

// Function to update the countdown display
function updateCountdownDisplay() {
    if (gameState.countdown.active) {
        // Update countdown number
        countdownElement.textContent = gameState.countdown.value;
        
        // Update scorer message
        scorerElement.textContent = gameState.countdown.scorerMessage;
        
        // Show the container
        countdownContainer.style.display = 'block';
    } else {
        countdownContainer.style.display = 'none';
    }
}

function resetBall(serveToPlayer = false) {
    // Reset ball position to center, use some height variation
    ball.position.set(
        0, 
        (Math.random() - 0.5) * ARENA_HEIGHT * 0.5, // Start at random vertical position
        0
    );
    
    // Reset current speed to base speed
    gameState.currentBallSpeed = BALL_SPEED;

    // More vertical movement in initial direction
    const angleXY = Math.random() * Math.PI * 2;
    const speedXY = gameState.currentBallSpeed * 0.6; // Use currentBallSpeed
    
    ballVelocity.x = Math.cos(angleXY) * speedXY;
    ballVelocity.y = Math.sin(angleXY) * speedXY;
    
    // Z direction based on who to serve toward
    if (serveToPlayer) {
        ballVelocity.z = gameState.currentBallSpeed * 0.8; // Use currentBallSpeed
    } else {
        ballVelocity.z = -gameState.currentBallSpeed * 0.8; // Use currentBallSpeed
    }
    
    // Normalize to maintain constant speed (using currentBallSpeed)
    normalizeVelocity();
    
    // Create serve effect
    createHitEffect(ball.position.clone(), 0xffaa00);
}

function startGame() {
    gameState.started = true;
    gameState.over = false;
    gameState.scores.player = 0;
    gameState.scores.opponent = 0;
    gameState.currentBallSpeed = BALL_SPEED; // Initialize ball speed
    gameState.elapsedTimeSeconds = 0; // Reset timer
    
    // Update score display
    playerScoreElement.textContent = gameState.scores.player;
    opponentScoreElement.textContent = gameState.scores.opponent;
    
    // Show the score container - override !important CSS rule
    const scoreContainer = document.querySelector('.score-container');
    if (scoreContainer) {
        // Using setAttribute to override !important CSS while preserving other styles
        scoreContainer.setAttribute('style', 
            'display: block !important; ' +
            'position: fixed !important; ' +
            'top: 20px !important; ' +
            'left: 0 !important; ' +
            'right: 0 !important; ' +
            'text-align: center !important; ' +
            'z-index: 9999 !important; ' +
            'pointer-events: none !important;'
        );
    }
    
    // Hide start screen - get fresh reference to ensure we hide the enhanced version
    const currentStartScreen = document.getElementById('start-screen');
    if (currentStartScreen) {
        currentStartScreen.style.display = 'none';
    }
    
    // Show the bottom-left overlay during gameplay
    const bottomLeftOverlay = document.querySelector('.bottom-left-overlay');
    if (bottomLeftOverlay) {
        bottomLeftOverlay.style.display = 'block';
    }
    
    // Create background particles for gameplay
    createBackgroundParticles();
    
    // Hide cursor
    document.body.classList.add('game-active');
    
    // Reset ball (defaults to serving opponent first)
    resetBall();

    // Set flag for AI's first hit on initial serve
    if (opponentPaddle.userData) {
        opponentPaddle.userData.isFirstHitAfterServe = true;
    }

    // Show Timer Display
    const timerElement = document.getElementById('timer-display');
    if (timerElement) {
        // timerElement.style.display = 'block'; // Can't override !important
        timerElement.setAttribute('style', 
            'display: block !important; ' +
            'position: fixed !important; ' +
            'top: 20px !important; ' +
            'right: 30px !important; ' +
            'font-family: Arial, sans-serif !important; ' +
            'font-size: 28px !important; ' + 
            'font-weight: bold !important; ' +
            'color: #ff6600 !important; ' + /* Changed back to score color */
            'text-shadow: 0 0 10px rgba(255, 102, 0, 0.5) !important; ' + /* Added score text shadow */
            'background-color: rgba(0, 0, 0, 0.5) !important; ' + 
            'padding: 10px 20px !important; ' + 
            'border-radius: 10px !important; ' + 
            'box-shadow: 0 0 15px rgba(255, 102, 0, 0.5) !important; ' + 
            'z-index: 9999 !important; ' + 
            'pointer-events: none !important; '
        );
        updateTimerDisplay(); // Show initial 00:00
    }
}

function onWindowResize() {
    const aspect = window.innerWidth / window.innerHeight;
    camera.aspect = aspect;

    // Adjust camera FOV and position for portrait vs landscape
    const baseFOV = 75;
    const baseZ = 400;

    if (aspect < 1) { // Portrait or square view
        // Increase FOV slightly and push camera back to fit width
        // Increase the multipliers for a more significant adjustment
        camera.fov = baseFOV * (1 + (1 - aspect) * 0.5); // Increased FOV multiplier from 0.2 to 0.5
        camera.position.z = baseZ + (baseZ * (1 - aspect) * 0.6); // Increased Z multiplier from 0.3 to 0.6
    } else { // Landscape view
        camera.fov = baseFOV;
        camera.position.z = baseZ;
    }

    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate(timestamp) {
    try {
        requestAnimationFrame(animate);
        
        // Calculate time delta
        if (!lastTimestamp) lastTimestamp = timestamp;
        const deltaTime = (timestamp - lastTimestamp) / 1000; // Convert to seconds
        lastTimestamp = timestamp;
        
        // Cap delta time to prevent large jumps
        const cappedDeltaTime = Math.min(deltaTime, 0.1);
        
        // Handle countdown if active
        if (gameState.countdown.active) {
            const now = Date.now();
            const elapsed = now - gameState.countdown.lastUpdate;
            
            // Update countdown every second
            if (elapsed > 1000) {
                gameState.countdown.value--;
                gameState.countdown.lastUpdate = now;
                
                if (gameState.countdown.value > 0) {
                    // Update display
                    updateCountdownDisplay();
                } else {
                    // Countdown finished
                    gameState.countdown.active = false;
                    countdownContainer.style.display = 'none';
                    
                    // Reset the ball with proper serve direction
                    resetBall(gameState.countdown.serveToPlayer);

                    // If serving to opponent, set flag for first hit accuracy
                    if (!gameState.countdown.serveToPlayer && opponentPaddle.userData) {
                        opponentPaddle.userData.isFirstHitAfterServe = true;
                    }
                }
            }
        }
        
        // Update game timer if game is active and not in countdown
        if (gameState.started && !gameState.over && !gameState.countdown.active) {
            gameState.elapsedTimeSeconds += cappedDeltaTime;
            updateTimerDisplay(); // Update display every frame
        }

        // Update player paddle based on mouse position
        updatePlayerPaddlePosition();
        
        // Update opponent paddle (AI)
        if (gameState.started && !gameState.over && !gameState.countdown.active) {
            updateOpponentPaddle();
        }
        
        // Update ball physics (only if not in countdown)
        if (!gameState.countdown.active) {
            updateBall(cappedDeltaTime);
        }
        
        // Animate the pulsing lights
        if (scene.userData && scene.userData.pulseLights) {
            scene.userData.pulseLights.forEach(light => {
                light.userData.pulsePhase += cappedDeltaTime * 3.0;
                const intensity = 0.5 + 0.3 * Math.sin(light.userData.pulsePhase);
                light.intensity = intensity;
            });
        }
        
        // --- REMOVED 3D PARTICLE ANIMATION --- 
        // No longer animating 3D particles
        
        // Limit hit particle processing for performance
        const MAX_HIT_PARTICLES = 100;
        
        // Update hit effect particles with enhanced behavior
        if (scene.userData && scene.userData.hitParticles) {
            // Limit number of processed particles for performance
            const hitParticleCount = Math.min(scene.userData.hitParticles.length, MAX_HIT_PARTICLES);
            const particlesToRemove = [];
            
            for (let i = 0; i < hitParticleCount; i++) {
                const particle = scene.userData.hitParticles[i];
                
                if (!particle || !particle.userData) continue;
                
                // Flash particles have special behavior
                if (particle.userData.isFlash) {
                    particle.userData.lifetime -= cappedDeltaTime * particle.userData.fadeSpeed;
                    particle.material.opacity = Math.max(0, particle.userData.lifetime);
                    
                    // Expand flash
                    const scale = Math.max(0.1, 1 + (1 - particle.userData.lifetime) * 3);
                    particle.scale.set(scale, scale, scale);
                    
                    if (particle.userData.lifetime <= 0) {
                        particlesToRemove.push(particle);
                    }
                    continue;
                }
                
                // Regular spark particles
                // Update position
                particle.position.x += particle.userData.velocity.x * cappedDeltaTime;
                particle.position.y += particle.userData.velocity.y * cappedDeltaTime;
                particle.position.z += particle.userData.velocity.z * cappedDeltaTime;
                
                // Add gravity effect to sparks
                particle.userData.velocity.y -= 60 * cappedDeltaTime; // Gravity
                
                // Slow down with air resistance
                particle.userData.velocity.multiplyScalar(0.92);
                
                // Rotate particles for more dynamic look
                if (particle.userData.rotation) {
                    particle.rotation.x += particle.userData.rotation.x * cappedDeltaTime;
                    particle.rotation.y += particle.userData.rotation.y * cappedDeltaTime;
                    particle.rotation.z += particle.userData.rotation.z * cappedDeltaTime;
                }
                
                // Fade out
                particle.userData.lifetime -= cappedDeltaTime * particle.userData.fadeSpeed;
                if (particle.material) {
                    particle.material.opacity = Math.max(0, particle.userData.lifetime);
                }
                
                // Scale down
                const scaleValue = Math.max(0.1, particle.userData.lifetime * 0.8);
                particle.scale.set(scaleValue, scaleValue, scaleValue);
                
                // Mark for removal if faded out
                if (particle.userData.lifetime <= 0) {
                    particlesToRemove.push(particle);
                }
            }
            
            // Remove expired particles
            particlesToRemove.forEach(particle => {
                scene.remove(particle);
            });
            
            scene.userData.hitParticles = scene.userData.hitParticles.filter(p => 
                !particlesToRemove.includes(p));
                
            // Keep total particles limited to prevent memory issues
            if (scene.userData.hitParticles.length > MAX_HIT_PARTICLES * 2) {
                const extraParticles = scene.userData.hitParticles.length - MAX_HIT_PARTICLES;
                const oldParticles = scene.userData.hitParticles.splice(0, extraParticles);
                oldParticles.forEach(p => scene.remove(p));
            }
        }
        
        // Render scene
        renderer.render(scene, camera);
    } catch (error) {
        console.error("Error in animation loop:", error);
        // Attempt to recover from error by resetting some game state
        try {
            // Ensure game can continue despite errors
            requestAnimationFrame(animate);
            
            // Reset ball if it's causing issues
            if (!gameState.countdown.active) {
                ball.position.set(0, 0, 0);
                ballVelocity.x = 0;
                ballVelocity.y = 0;
                ballVelocity.z = 0;
                
                // Start countdown to reset game flow
                startCountdown(Math.random() > 0.5, "Game reset");
            }
            
            // Render what we can
            renderer.render(scene, camera);
        } catch (recoveryError) {
            console.error("Failed to recover from animation error:", recoveryError);
        }
    }
}

// Enhance start screen when document is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Ensure cursor is initially visible
    document.body.classList.remove('game-active');

    // Set favicon (tab icon) - Create a favicon link element dynamically
    const faviconLink = document.createElement('link');
    faviconLink.rel = 'icon';
    faviconLink.type = 'image/png';
    faviconLink.href = 'image.png'; // Path to Kev's image
    document.head.appendChild(faviconLink);

    // Replace or enhance the basic start screen
    const gameContainer = document.getElementById('game-container');
    const existingStartScreen = document.getElementById('start-screen');
    
    if (existingStartScreen) {
        existingStartScreen.remove(); // Remove basic screen if it exists
    }
    
    // Create enhanced start screen
    const enhancedStartScreen = document.createElement('div');
    enhancedStartScreen.id = 'start-screen';
    enhancedStartScreen.style.position = 'absolute';
    enhancedStartScreen.style.top = '0';
    enhancedStartScreen.style.left = '0';
    enhancedStartScreen.style.width = '100%';
    enhancedStartScreen.style.height = '100%';
    enhancedStartScreen.style.display = 'flex';
    enhancedStartScreen.style.flexDirection = 'column';
    enhancedStartScreen.style.justifyContent = 'center';
    enhancedStartScreen.style.alignItems = 'center';
    enhancedStartScreen.style.background = 'radial-gradient(circle, #3b0c00 0%, #1a0500 100%)'; // Fully opaque
    enhancedStartScreen.style.zIndex = '1000';
    enhancedStartScreen.style.fontFamily = 'Arial, sans-serif';
    enhancedStartScreen.style.color = '#fff';
    enhancedStartScreen.style.textAlign = 'center';
    
    // Create container for main start screen content
    const mainContentContainer = document.createElement('div');
    mainContentContainer.id = 'start-main-content';
    mainContentContainer.style.display = 'flex'; // Use flex to maintain centering
    mainContentContainer.style.flexDirection = 'column';
    mainContentContainer.style.alignItems = 'center';
    mainContentContainer.style.justifyContent = 'center';
    mainContentContainer.style.width = '100%'; // Take full width for centering
    
    // --- Move existing elements into mainContentContainer ---
    
    // Add Kev's image above the title
    const kevImage = document.createElement('img');
    kevImage.src = 'image.png';
    kevImage.alt = 'Kev';
    kevImage.style.width = '120px';
    kevImage.style.height = '120px';
    kevImage.style.borderRadius = '50%'; // Make the image circular
    kevImage.style.border = '3px solid #ff6600'; // Orange border
    kevImage.style.marginBottom = '20px';
    kevImage.style.boxShadow = '0 0 20px rgba(255, 102, 0, 0.7)'; // Add glow effect
    mainContentContainer.appendChild(kevImage); // Add to main container
    
    // Add title with glow effect
    const titleElement = document.createElement('h1');
    titleElement.innerText = 'Kev\'s Pong'; // Changed from KEVINITY PONG
    titleElement.style.fontSize = '72px';
    titleElement.style.fontWeight = 'bold';
    titleElement.style.marginBottom = '10px';
    titleElement.style.color = '#ff6600';
    titleElement.style.textShadow = '0 0 20px rgba(255, 102, 0, 0.7)';
    titleElement.style.letterSpacing = '4px';
    titleElement.style.animation = 'pulse 1.5s infinite alternate';
    mainContentContainer.appendChild(titleElement); // Add to main container
    
    // Add subtitle
    const subtitleElement = document.createElement('h2');
    subtitleElement.innerText = 'Powered by Kevinity AI';
    subtitleElement.style.fontSize = '24px';
    subtitleElement.style.marginBottom = '40px';
    subtitleElement.style.color = '#ff9933';
    subtitleElement.style.fontWeight = 'normal';
    mainContentContainer.appendChild(subtitleElement); // Add to main container
    
    // Add instructions box
    const instructionsContainer = document.createElement('div');
    instructionsContainer.style.background = 'rgba(0,0,0,0.3)';
    instructionsContainer.style.border = '1px solid #ff6600';
    instructionsContainer.style.borderRadius = '10px';
    instructionsContainer.style.padding = '20px';
    instructionsContainer.style.marginBottom = '40px';
    instructionsContainer.style.maxWidth = '500px';
    instructionsContainer.style.boxShadow = '0 0 15px rgba(255, 102, 0, 0.3)';
    
    const instructionsTitle = document.createElement('h3');
    instructionsTitle.innerText = 'HOW TO PLAY';
    instructionsTitle.style.color = '#ff8800';
    instructionsTitle.style.marginBottom = '15px';
    instructionsTitle.style.fontSize = '20px';
    instructionsContainer.appendChild(instructionsTitle);
    
    const instructions = document.createElement('p');
    instructions.innerHTML = '• Move your mouse/finger to control the paddle<br>' +
                           '• Deflect the ball to score points<br>' +
                           '• First to 3 points wins'; // Updated win condition
    instructions.style.textAlign = 'left';
    instructions.style.lineHeight = '1.6';
    instructionsContainer.appendChild(instructions);
    mainContentContainer.appendChild(instructionsContainer); // Add to main container
    
    // Create animated start button
    const buttonElement = document.createElement('button');
    buttonElement.id = 'start-button';
    buttonElement.innerText = 'START GAME';
    buttonElement.style.fontSize = '24px';
    buttonElement.style.padding = '15px 40px';
    buttonElement.style.background = 'linear-gradient(135deg, #ff6600, #ff3300)';
    buttonElement.style.border = 'none';
    buttonElement.style.borderRadius = '30px';
    buttonElement.style.color = 'white';
    buttonElement.style.fontWeight = 'bold';
    buttonElement.style.cursor = 'pointer';
    buttonElement.style.boxShadow = '0 0 20px rgba(255, 102, 0, 0.5)';
    buttonElement.style.transition = 'all 0.2s ease-in-out';
    buttonElement.style.letterSpacing = '1px';
    
    // Floating animation for the button
    buttonElement.style.animation = 'float 2s infinite ease-in-out';
    
    // Hover and active states
    buttonElement.onmouseover = function() {
        this.style.transform = 'scale(1.05)';
        this.style.boxShadow = '0 0 30px rgba(255, 102, 0, 0.8)';
    };
    buttonElement.onmouseout = function() {
        this.style.transform = 'scale(1)';
        this.style.boxShadow = '0 0 20px rgba(255, 102, 0, 0.5)';
    };
    buttonElement.onmousedown = function() {
        this.style.transform = 'scale(0.98)';
    };
    buttonElement.onmouseup = function() {
        this.style.transform = 'scale(1.05)';
    };
    
    mainContentContainer.appendChild(buttonElement); // Add to main container
    
    // Add "View Scores" button below Start Game
    const viewScoresButton = document.createElement('button');
    viewScoresButton.id = 'view-scores-button';
    viewScoresButton.innerText = 'VIEW LEADERBOARD'; // Changed text
    // Style similar to start button but maybe smaller/secondary
    viewScoresButton.style.fontSize = '18px';
    viewScoresButton.style.padding = '10px 25px';
    viewScoresButton.style.background = 'transparent';
    viewScoresButton.style.border = '2px solid #ff6600'; // Outline style
    viewScoresButton.style.borderRadius = '25px';
    viewScoresButton.style.color = '#ff6600'; // Orange text
    viewScoresButton.style.fontWeight = 'bold';
    viewScoresButton.style.cursor = 'pointer';
    viewScoresButton.style.marginTop = '20px'; // Space below start button
    viewScoresButton.style.transition = 'all 0.2s ease-in-out';
    viewScoresButton.style.letterSpacing = '1px';

    viewScoresButton.onmouseover = function() {
        this.style.backgroundColor = 'rgba(255, 102, 0, 0.2)'; // Slight orange background on hover
        this.style.color = '#ffffff'; // White text on hover
    };
    viewScoresButton.onmouseout = function() {
        this.style.backgroundColor = 'transparent';
        this.style.color = '#ff6600';
    };
    mainContentContainer.appendChild(viewScoresButton); // Add to main container

    // Add link to Kevinity.ai
    const kevinityLink = document.createElement('a');
    kevinityLink.href = 'https://kevinity.ai';
    kevinityLink.target = '_blank';
    kevinityLink.innerText = 'Visit Kevinity.ai';
    kevinityLink.style.marginTop = '30px';
    kevinityLink.style.color = '#ff9933';
    kevinityLink.style.textDecoration = 'none';
    kevinityLink.style.fontWeight = 'bold';
    kevinityLink.style.fontSize = '14px';
    kevinityLink.onmouseover = function() {
        this.style.textDecoration = 'underline';
    };
    kevinityLink.onmouseout = function() {
        this.style.textDecoration = 'none';
    };
    mainContentContainer.appendChild(kevinityLink); // Add to main container
    
    // Append the main content container to the enhanced start screen
    enhancedStartScreen.appendChild(mainContentContainer);
    
    // --- End moving elements --- 
    
    // Add Leaderboard section directly to Start Screen (initially hidden)
    const startLeaderboardContainer = document.createElement('div');
    startLeaderboardContainer.className = 'leaderboard-container';
    startLeaderboardContainer.style.marginTop = '5vh'; // Give some space from top
    // startLeaderboardContainer.style.maxHeight = '200px'; // REMOVED fixed height
    // startLeaderboardContainer.style.overflowY = 'auto';  // REMOVED overflow
    startLeaderboardContainer.style.display = 'none'; // Start hidden
    startLeaderboardContainer.style.width = '90%'; // Relative width
    startLeaderboardContainer.style.maxWidth = '450px'; // Max width
    startLeaderboardContainer.style.margin = '5vh auto 0 auto'; // Center horizontally
    startLeaderboardContainer.style.padding = '25px'; // Internal padding
    startLeaderboardContainer.style.background = 'rgba(0, 0, 0, 0.4)'; // Slightly darker background
    startLeaderboardContainer.style.border = '1px solid #ff6600'; // Theme border
    startLeaderboardContainer.style.borderRadius = '15px'; // Rounded corners
    startLeaderboardContainer.style.boxShadow = '0 0 15px rgba(255, 102, 0, 0.3)'; // Subtle glow

    const startLeaderboardTitle = document.createElement('h2');
    startLeaderboardTitle.innerText = 'Leaderboard'; // Changed from Top Scores
    startLeaderboardContainer.appendChild(startLeaderboardTitle);

    const startLeaderboardList = document.createElement('ul');
    startLeaderboardList.id = 'start-leaderboard-list'; // Unique ID
    startLeaderboardContainer.appendChild(startLeaderboardList);

    const startLeaderboardLoading = document.createElement('div');
    startLeaderboardLoading.id = 'start-leaderboard-loading'; // Unique ID
    startLeaderboardLoading.style.display = 'none';
    startLeaderboardLoading.style.color = '#ffaa33';
    // startLeaderboardLoading.innerText = 'Loading...'; // Replace text with spinner
    startLeaderboardLoading.classList.add('loader'); // Add class for styling
    startLeaderboardContainer.appendChild(startLeaderboardLoading);
    
    enhancedStartScreen.appendChild(startLeaderboardContainer); // Add leaderboard container
    
    // Add to game container
    gameContainer.appendChild(enhancedStartScreen);
    
    // Update reference to start button
    const startButton = document.getElementById('start-button');
    startButton.addEventListener('click', startGame);

    // Add touchend listener specifically for mobile tap reliability
    startButton.addEventListener('touchend', function(event) {
        event.preventDefault(); // Prevent potential double event firing (touch then click)
        startGame();
    });

    // Add click listener for the VIEW SCORES button
    viewScoresButton.addEventListener('click', () => {
        const startLeaderboardContainer = document.getElementById('start-screen').querySelector('.leaderboard-container');
        const mainContentContainer = document.getElementById('start-main-content');
        
        if (!startLeaderboardContainer || !mainContentContainer) return; // Safety check

        mainContentContainer.style.display = 'none'; // Hide main content
        startLeaderboardContainer.style.display = 'block'; // Show leaderboard

        // Create and add Back button if it doesn't exist
        if (!document.getElementById('back-to-start-button')) {
            const backButton = document.createElement('button');
            backButton.id = 'back-to-start-button';
            backButton.innerText = 'BACK';
            // Style similarly to View Scores button
            backButton.style.fontSize = '18px';
            backButton.style.padding = '10px 25px';
            backButton.style.background = 'transparent';
            backButton.style.border = '2px solid #ff6600';
            backButton.style.borderRadius = '25px';
            backButton.style.color = '#ff6600';
            backButton.style.fontWeight = 'bold';
            backButton.style.cursor = 'pointer';
            backButton.style.marginTop = '30px'; // Space above button
            backButton.style.transition = 'all 0.2s ease-in-out';
            backButton.style.letterSpacing = '1px';
            backButton.onmouseover = function() { this.style.backgroundColor = 'rgba(255, 102, 0, 0.2)'; this.style.color = '#ffffff'; };
            backButton.onmouseout = function() { this.style.backgroundColor = 'transparent'; this.style.color = '#ff6600'; };
            
            // Add event listener for Back button
            backButton.addEventListener('click', () => {
                startLeaderboardContainer.style.display = 'none'; // Hide leaderboard
                mainContentContainer.style.display = 'flex'; // Show main content (use flex)
                backButton.remove(); // Remove the back button itself
                 // Reset the main button text when going back
                // viewScoresButton.innerText = 'VIEW LEADERBOARD'; // This should be handled by restartGame
            });
             // Add touchend listener for Back button (mobile reliability)
            backButton.addEventListener('touchend', function(event) {
                event.preventDefault(); 
                backButton.click(); // Trigger the click event programmatically
            });
            
            // Insert Back button after the leaderboard content
            startLeaderboardContainer.appendChild(backButton);
        }

        // Fetch leaderboard data ONLY when showing it the first time or if needed
        const startLeaderboardList = document.getElementById('start-leaderboard-list');
        if (!startLeaderboardList || !startLeaderboardList.hasChildNodes() || startLeaderboardList.innerHTML.includes('Error') || startLeaderboardList.innerHTML.includes('No info')) {
             displayLeaderboard('start-leaderboard-list', 'start-leaderboard-loading');
        }
    });

    // Add touchend listener for viewScoresButton (mobile reliability)
    viewScoresButton.addEventListener('touchend', function(event) {
        event.preventDefault(); 
        viewScoresButton.click(); // Trigger the click event programmatically
    });

    // Add CSS animations and leaderboard styles
    const styleElement = document.createElement('style');
    styleElement.textContent = `
        /* ... (existing @keyframes pulse, float, floatParticle) ... */
        
        .leaderboard-container ul {
            list-style: none;
            padding: 0;
            margin: 20px 0 0 0; /* Space below title */
        }
        .leaderboard-container li {
            padding: 12px 8px; /* More padding */
            border-bottom: 1px solid rgba(255, 102, 0, 0.2);
            color: #eee;
            font-size: 17px; /* Slightly larger */
            transition: background-color 0.2s ease;
        }
        .leaderboard-container li:last-child {
            border-bottom: none;
        }
        .leaderboard-container li:hover {
            background-color: rgba(255, 102, 0, 0.1);
        }
        .leaderboard-container li.top-score {
            color: #ffcc66; /* Gold color for #1 */
            font-weight: bold;
        }
        .leaderboard-container li.no-info {
            color: #aaa;
            font-style: italic;
            text-align: center;
            border-bottom: none;
        }
        
        .loader {
            border: 4px solid rgba(255, 170, 51, 0.3); /* Light orange border */
            border-radius: 50%;
            border-top: 4px solid #ffaa33; /* Darker orange top border */
            width: 30px;
            height: 30px;
            animation: spin 1s linear infinite;
            margin: 20px auto; /* Center spinner */
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        /* Ensure Back button has enough space */
        #back-to-start-button {
             margin-top: 40px !important; /* Increase top margin */
        }

        /* Potentially style scrollbar if it appears */
        .leaderboard-container::-webkit-scrollbar {
            width: 8px;
        }
        .leaderboard-container::-webkit-scrollbar-track {
            background: rgba(0,0,0,0.2);
            border-radius: 4px;
        }
        .leaderboard-container::-webkit-scrollbar-thumb {
            background-color: #ff6600;
            border-radius: 4px;
            border: 2px solid transparent; /* Creates padding around thumb */
            background-clip: content-box;
        }
    `;
    document.head.appendChild(styleElement);
});

// Function to display encouraging messages in the chat bubble
function initChatBubbleMessages() {
    // Get the chat bubble and its text element
    const chatBubble = document.querySelector('.chat-bubble');
    const chatBubbleText = document.querySelector('.chat-bubble-text');
    
    if (!chatBubble || !chatBubbleText) return;
    
    // Array of encouraging messages
    const messages = [
        "You got this!",
        "Great shot!",
        "Keep it up!",
        "Nice move!",
        "So close!",
        "You're doing great!",
        "Wow, amazing!",
        "Don't give up!",
        "Incredible save!",
        "That's the spirit!",
        "You're on fire!",
        "Focus, you can win!",
        "Show 'em who's boss!",
        "Kevinity believes in you!",
        "You're a natural!",
        "Just like that!",
        "You're crushing it!",
        "What a play!",
        "One more point!",
        "Stay in the zone!"
    ];
    
    let currentMessageIndex = -1;
    let messageTimer = null;
    let bubbleVisibleTimer = null;
    
    // Function to show a random message
    function showRandomMessage(forceMessage = null) {
        clearTimeout(bubbleVisibleTimer);
        
        // Select a new random message (different from the last one)
        let newIndex;
        if (forceMessage) {
            chatBubbleText.textContent = forceMessage;
        } else {
            do {
                newIndex = Math.floor(Math.random() * messages.length);
            } while (newIndex === currentMessageIndex && messages.length > 1);
            
            currentMessageIndex = newIndex;
            chatBubbleText.textContent = messages[currentMessageIndex];
        }
        
        // Make bubble visible
        chatBubble.classList.add('visible');
        
        // Hide bubble after 3 seconds
        bubbleVisibleTimer = setTimeout(() => {
            chatBubble.classList.remove('visible');
        }, 3000);
    }
    
    // Show messages at random intervals during gameplay
    function scheduleNextMessage() {
        // Random time between 5-15 seconds
        const nextTime = 5000 + Math.random() * 10000;
        
        messageTimer = setTimeout(() => {
            if (gameState.started && !gameState.over && !gameState.countdown.active) {
                showRandomMessage();
            }
            scheduleNextMessage();
        }, nextTime);
    }
    
    // Show special messages on game events
    function setupGameEventMessages() {
        // Custom message when scoring
        const originalCheckScoring = checkScoring;
        checkScoring = function() {
            const playerScoreBefore = gameState.scores.player;
            const opponentScoreBefore = gameState.scores.opponent;
            
            // Call the original function
            originalCheckScoring.call(this);
            
            // Check if player scored
            if (gameState.scores.player > playerScoreBefore) {
                showRandomMessage("Great shot!");
            }
            
            // Check if opponent scored
            if (gameState.scores.opponent > opponentScoreBefore) {
                showRandomMessage("Don't worry, next point is yours!");
            }
        };
        
        // Custom message on paddle hit
        const originalCheckPaddleCollisions = checkPaddleCollisions;
        checkPaddleCollisions = function() {
            // Store ball velocity z direction before collision check
            const zVelocityBefore = ballVelocity.z;
            
            // Call the original function
            originalCheckPaddleCollisions.call(this);
            
            // Check if player paddle hit occurred (z velocity changed from positive to negative)
            if (zVelocityBefore > 0 && ballVelocity.z < 0) {
                // 30% chance to show a message on hit
                if (Math.random() < 0.3) {
                    const hitMessages = ["Nice return!", "Great hit!", "Perfect timing!"];
                    const messageIndex = Math.floor(Math.random() * hitMessages.length);
                    showRandomMessage(hitMessages[messageIndex]);
                }
            }
        };
    }
    
    // Show a welcome message when the game starts
    const originalStartGame = startGame;
    startGame = function() {
        originalStartGame.call(this);
        showRandomMessage("Let's play!");
        
        // Start the message cycle
        scheduleNextMessage();
    };
    
    // Special message when game ends
    const originalCheckGameOver = checkGameOver;
    checkGameOver = function() {
        const wasNotOver = !gameState.over;
        const result = originalCheckGameOver.call(this);
        
        if (result && wasNotOver) {
            clearTimeout(messageTimer);
            
            if (gameState.scores.player > gameState.scores.opponent) {
                showRandomMessage("You won! Amazing job!");
            } else {
                showRandomMessage("You'll get it next time!");
            }
        }
        
        return result;
    };
    
    // Set up game event listeners
    setupGameEventMessages();
}

// Enhance the HUD with Kevinity branding
function enhanceHUDWithKevinityBranding() {
    // Get the score container element
    const scoreContainer = document.querySelector('.score-container');
    if (!scoreContainer) return; // Safety check
    
    // Style the existing score display for better visual appearance
    const scoreDisplay = document.querySelector('.score-display');
    if (scoreDisplay) {
        scoreDisplay.style.fontFamily = 'Arial, sans-serif';
        scoreDisplay.style.fontWeight = 'bold';
        scoreDisplay.style.fontSize = '28px';
        scoreDisplay.style.color = '#ff6600';
        scoreDisplay.style.textShadow = '0 0 10px rgba(255, 102, 0, 0.5)';
    }
    
    // We don't need to create the bottom-left overlay here since it's directly in the HTML
    // Just ensure it has proper styling if needed
    const existingOverlay = document.querySelector('.bottom-left-overlay');
    if (existingOverlay) {
        // Make sure it's visible during gameplay by setting a high z-index
        existingOverlay.style.zIndex = '9999';
        existingOverlay.style.pointerEvents = 'none';
    }
    
    // Setup click handler for Kev's image
    setupKevImageInteraction();
    
    // Initialize chat bubble messages
    initChatBubbleMessages();
}

// Function to set up the Kev image interaction
function setupKevImageInteraction() {
    try {
        const kevImage = document.querySelector('.overlay-image');
        const chatBubble = document.querySelector('.chat-bubble');
        const chatBubbleText = document.querySelector('.chat-bubble-text');
        
        if (!kevImage || !chatBubble || !chatBubbleText) {
            console.warn("Missing elements for Kev image interaction");
            return;
        }
        
        // Override pointer-events for the image specifically
        kevImage.style.pointerEvents = 'auto';
        kevImage.style.cursor = 'pointer';
        
        // Remove any existing click handlers to prevent duplicates
        kevImage.removeEventListener('click', handleKevClick);
        
        // Add click handler
        kevImage.addEventListener('click', handleKevClick);
        
        function handleKevClick() {
            try {
                // Show shake animation
                kevImage.classList.remove('shake'); // Remove if already present
                void kevImage.offsetWidth; // Force reflow to restart animation
                kevImage.classList.add('shake');
                
                // Show "Wzzz..." message
                chatBubbleText.textContent = "Wzzz...";
                chatBubble.classList.add('visible');
                
                // Hide message after 3 seconds
                setTimeout(() => {
                    if (chatBubble) chatBubble.classList.remove('visible');
                }, 3000);
                
                // Remove shake class after animation completes
                setTimeout(() => {
                    if (kevImage) kevImage.classList.remove('shake');
                }, 600);
            } catch (error) {
                console.error("Error in Kev click handler:", error);
            }
        }
    } catch (error) {
        console.error("Error setting up Kev image interaction:", error);
    }
}

// Function to create and update the ball trail
function updateBallTrail(deltaTime, prevPosition) {
    // Don't create trail particles during countdown
    if (gameState.countdown.active) return;
    
    // Create trail particles at regular intervals
    const now = performance.now();
    if (!ball.userData.lastTrailTime) {
        ball.userData.lastTrailTime = now;
    }
    
    // Add a new trail particle every 15ms when the ball is moving
    const trailInterval = 15; // milliseconds
    if (now - ball.userData.lastTrailTime > trailInterval) {
        ball.userData.lastTrailTime = now;
        
        // Calculate speed for color intensity
        const speed = Math.sqrt(
            ballVelocity.x * ballVelocity.x + 
            ballVelocity.y * ballVelocity.y + 
            ballVelocity.z * ballVelocity.z
        );
        const normalizedSpeed = speed / BALL_SPEED;
        
        // Create trail particle at the ball's current position
        const trailGeometry = new THREE.SphereGeometry(BALL_RADIUS * 0.7, 8, 8);
        const trailMaterial = new THREE.MeshBasicMaterial({
            color: new THREE.Color(1.0, 0.4 + (normalizedSpeed * 0.3), 0.0),
            transparent: true,
            opacity: 0.7
        });
        
        const trail = new THREE.Mesh(trailGeometry, trailMaterial);
        trail.position.copy(ball.position);
        
        // Set lifetime and other properties
        trail.userData = {
            creationTime: now,
            lifetime: 300, // milliseconds
            initialScale: 0.8,
            finalScale: 0.1
        };
        
        scene.add(trail);
        
        // Store the trail particle
        if (!scene.userData.trailParticles) {
            scene.userData.trailParticles = [];
        }
        scene.userData.trailParticles.push(trail);
    }
    
    // Update existing trail particles
    if (scene.userData.trailParticles && scene.userData.trailParticles.length > 0) {
        const particlesToRemove = [];
        
        scene.userData.trailParticles.forEach(particle => {
            const age = now - particle.userData.creationTime;
            
            if (age > particle.userData.lifetime) {
                // Mark for removal
                particlesToRemove.push(particle);
            } else {
                // Update opacity and scale based on age
                const lifeRatio = 1 - (age / particle.userData.lifetime);
                particle.material.opacity = lifeRatio * 0.7;
                
                // Scale down as it ages
                const scale = particle.userData.finalScale + 
                    (particle.userData.initialScale - particle.userData.finalScale) * lifeRatio;
                particle.scale.set(scale, scale, scale);
            }
        });
        
        // Remove expired particles
        particlesToRemove.forEach(particle => {
            scene.remove(particle);
            scene.userData.trailParticles =
                scene.userData.trailParticles.filter(p => p !== particle);
        });
    }
}

function checkArenaBoundaries() {
    // Bounce off arena walls (X-axis)
    if (Math.abs(ball.position.x) > ARENA_WIDTH / 2 - BALL_RADIUS) {
        // Create hit effect at the impact point
        const impactPosition = ball.position.clone();
        impactPosition.x = Math.sign(ball.position.x) * (ARENA_WIDTH / 2 - BALL_RADIUS);
        createHitEffect(impactPosition, 0xff6600);
        
        // Bounce logic
        ball.position.x = Math.sign(ball.position.x) * (ARENA_WIDTH / 2 - BALL_RADIUS);
        ballVelocity.x *= -1; // Simple reflection
    }
    
    // Bounce off arena ceiling/floor (Y-axis)
    if (Math.abs(ball.position.y) > ARENA_HEIGHT / 2 - BALL_RADIUS) {
        // Create hit effect at the impact point
        const impactPosition = ball.position.clone();
        impactPosition.y = Math.sign(ball.position.y) * (ARENA_HEIGHT / 2 - BALL_RADIUS);
        createHitEffect(impactPosition, 0xff6600);
        
        // Bounce logic
        ball.position.y = Math.sign(ball.position.y) * (ARENA_HEIGHT / 2 - BALL_RADIUS);
        ballVelocity.y *= -1; // Simple reflection
    }
}

function checkPaddleCollisions() {
    // Ensure previousPosition is initialized
    if (!ball.userData.previousPosition) return;
    
    const paddleHitBuffer = 5; // Increased buffer from 2 to 5 for more forgiving edge hits
    const playerPaddleZPlane = playerPaddle.position.z - PADDLE_DEPTH / 2 - BALL_RADIUS;
    const opponentPaddleZPlane = opponentPaddle.position.z + PADDLE_DEPTH / 2 + BALL_RADIUS;

    // Player paddle collision - Check if ball crossed the paddle plane
    if (ballVelocity.z > 0 && // Moving towards player
        ball.userData.previousPosition.z <= playerPaddleZPlane && // Was behind or on plane
        ball.position.z > playerPaddleZPlane && // Is now in front of plane
        Math.abs(ball.position.x - playerPaddle.position.x) < PADDLE_WIDTH / 2 + BALL_RADIUS + paddleHitBuffer &&
        Math.abs(ball.position.y - playerPaddle.position.y) < PADDLE_HEIGHT / 2 + BALL_RADIUS + paddleHitBuffer) 
    {
        // Bounce direction based on where ball hit the paddle
        const hitPositionX = (ball.position.x - playerPaddle.position.x) / (PADDLE_WIDTH / 2);
        const hitPositionY = (ball.position.y - playerPaddle.position.y) / (PADDLE_HEIGHT / 2);
        
        // Angle the ball based on where it hit the paddle
        ballVelocity.x = gameState.currentBallSpeed * 0.75 * hitPositionX;
        ballVelocity.y = gameState.currentBallSpeed * 0.75 * hitPositionY;
        ballVelocity.z = -gameState.currentBallSpeed; // Reflect Z velocity
        
        // Normalize to maintain constant speed
        normalizeVelocity();
        
        // Adjust ball position to be exactly on the collision plane to prevent tunneling back
        ball.position.z = playerPaddleZPlane;
        
        // Add hit effects
        createHitEffect(ball.position.clone(), 0xff5500);

        // Increase ball speed slightly after hit
        gameState.currentBallSpeed += 10; // Increased speed increment from 5 to 10
        // Optional: Add a max speed cap
        // gameState.currentBallSpeed = Math.min(gameState.currentBallSpeed, BALL_SPEED * 1.5); 
    }
    
    // Opponent paddle collision - Check if ball crossed the paddle plane
    if (ballVelocity.z < 0 && // Moving towards opponent
        ball.userData.previousPosition.z >= opponentPaddleZPlane && // Was in front or on plane
        ball.position.z < opponentPaddleZPlane && // Is now behind plane
        Math.abs(ball.position.x - opponentPaddle.position.x) < PADDLE_WIDTH / 2 + BALL_RADIUS + paddleHitBuffer &&
        Math.abs(ball.position.y - opponentPaddle.position.y) < PADDLE_HEIGHT / 2 + BALL_RADIUS + paddleHitBuffer)
    {
        // Bounce direction based on where ball hit the paddle
        const hitPositionX = (ball.position.x - opponentPaddle.position.x) / (PADDLE_WIDTH / 2);
        const hitPositionY = (ball.position.y - opponentPaddle.position.y) / (PADDLE_HEIGHT / 2);
        
        // Angle the ball based on where it hit the paddle
        ballVelocity.x = gameState.currentBallSpeed * 0.75 * hitPositionX;
        ballVelocity.y = gameState.currentBallSpeed * 0.75 * hitPositionY;
        ballVelocity.z = gameState.currentBallSpeed; // Reflect Z velocity
        
        // Normalize to maintain constant speed
        normalizeVelocity();
        
        // Adjust ball position to be exactly on the collision plane
        ball.position.z = opponentPaddleZPlane;
        
        // Add hit effects
        createHitEffect(ball.position.clone(), 0x55ff00);

        // Reset the first hit flag after the guaranteed hit
        if (opponentPaddle.userData && opponentPaddle.userData.isFirstHitAfterServe) {
            opponentPaddle.userData.isFirstHitAfterServe = false;
        }

        // Increase ball speed slightly after hit
        gameState.currentBallSpeed += 10; // Increased speed increment from 5 to 10
        // Optional: Add a max speed cap
        // gameState.currentBallSpeed = Math.min(gameState.currentBallSpeed, BALL_SPEED * 1.5);
    }
}

// Create a visual effect when ball hits paddle
function createHitEffect(position, color) {
    const particleCount = 25; // Increased particle count for more dramatic effect
    
    // Create particles
    for (let i = 0; i < particleCount; i++) {
        // Use simpler geometry for performance
        const geometry = new THREE.SphereGeometry(1 + Math.random() * 2, 6, 6); // Varied sizes with simpler geometry
        
        // Create a material with a stronger orange glow, regardless of input color
        const sparkColor = (i % 3 === 0) ? 0xffffff : 0xff6600; // Mix in some white sparks
        const material = new THREE.MeshBasicMaterial({
            color: sparkColor,
            transparent: true,
            opacity: 0.9
        });
        
        const particle = new THREE.Mesh(geometry, material);
        particle.position.copy(position);
        
        // More explosive, directional velocity
        const speed = 30 + Math.random() * 70; // Higher speed for more dramatic effect
        const angle = Math.random() * Math.PI * 2;
        const elevation = Math.random() * Math.PI - Math.PI/2;
        
        // Slight bias in direction based on ball velocity
        // This makes sparks fly more in the direction of impact
        const directionBias = 0.7;
        const vx = Math.cos(angle) * Math.cos(elevation);
        const vy = Math.sin(elevation);
        const vz = Math.sin(angle) * Math.cos(elevation);
        
        particle.userData = {
            velocity: new THREE.Vector3(
                vx * speed - (ballVelocity.x * directionBias),
                vy * speed,
                vz * speed - (ballVelocity.z * directionBias)
            ),
            lifetime: 1.0,
            fadeSpeed: 3.0 + Math.random() * 3.0, // Faster fade for memory efficiency
            rotation: new THREE.Vector3(
                Math.random() * 10 - 5,
                Math.random() * 10 - 5,
                Math.random() * 10 - 5
            )
        };
        
        scene.add(particle);
        
        // Store particles for animation and cleanup
        if (!scene.userData.hitParticles) scene.userData.hitParticles = [];
        scene.userData.hitParticles.push(particle);
    }
    
    // Add a flash effect at impact point
    const flashGeometry = new THREE.SphereGeometry(8, 8, 8);
    const flashMaterial = new THREE.MeshBasicMaterial({
        color: 0xffaa00,
        transparent: true,
        opacity: 0.7
    });
    
    const flash = new THREE.Mesh(flashGeometry, flashMaterial);
    flash.position.copy(position);
    flash.userData = {
        lifetime: 1.0,
        fadeSpeed: 8.0, // Very fast fade
        isFlash: true
    };
    
    scene.add(flash);
    scene.userData.hitParticles.push(flash);
    
    // Limit the number of particle systems for memory efficiency
    if (scene.userData.hitParticles.length > 200) {
        // Remove oldest particles if we have too many
        const toRemove = scene.userData.hitParticles.splice(0, 50);
        toRemove.forEach(p => scene.remove(p));
    }
}

// Function to normalize ball velocity to maintain constant speed
function normalizeVelocity() {
    const speed = Math.sqrt(
        ballVelocity.x * ballVelocity.x + 
        ballVelocity.y * ballVelocity.y + 
        ballVelocity.z * ballVelocity.z
    );
    
    if (speed === 0) return; // Avoid division by zero

    ballVelocity.x = (ballVelocity.x / speed) * gameState.currentBallSpeed;
    ballVelocity.y = (ballVelocity.y / speed) * gameState.currentBallSpeed;
    ballVelocity.z = (ballVelocity.z / speed) * gameState.currentBallSpeed;
}

function checkScoring() {
    // Player scores (ball goes past opponent)
    // Reduce sensitivity for player scoring (easier for player)
    if (ball.position.z < -ARENA_LENGTH / 2 - BALL_RADIUS * 2) { // Changed multiplier from 8 back to 2
        gameState.scores.player += 1;
        playerScoreElement.textContent = gameState.scores.player;
        
        if (checkGameOver()) return;
        
        // Start countdown instead of immediately resetting
        startCountdown(true, 'You scored!'); // Serve towards player after countdown
    }
    
    // Opponent scores (ball goes past player)
    // Keep sensitivity high for opponent scoring (harder for player)
    if (ball.position.z > ARENA_LENGTH / 2 + BALL_RADIUS * 8) { // Keep multiplier at 8
        gameState.scores.opponent += 1;
        opponentScoreElement.textContent = gameState.scores.opponent;
        
        if (checkGameOver()) return;
        
        // Start countdown instead of immediately resetting
        startCountdown(false, 'Opponent scored!'); // Serve towards opponent after countdown
    }
}

function checkGameOver() {
    // Check if either player has reached the winning score
    if (gameState.scores.player >= gameState.winningScore || 
        gameState.scores.opponent >= gameState.winningScore) {
        gameState.over = true;
        
        // Create and display enhanced game over screen
        createKevinityGameOverScreen();
        
        // Save score and display leaderboard
        if (gameState.scores.player > gameState.scores.opponent) {
            // Show custom name input modal and save score
            showNameInputModal().then(playerName => {
                if (playerName) {
                    saveScoreToLeaderboard(playerName, gameState.scores.player);
                }
            });
        }
        
        return true;
    }
    
    return false;
}

function createKevinityGameOverScreen() {
    // Remove existing game over screen if it exists
    const existingGameOverScreen = document.getElementById('game-over-screen');
    if (existingGameOverScreen) {
        existingGameOverScreen.remove();
    }
    
    // Hide the bottom-left overlay on game over
    const bottomLeftOverlay = document.querySelector('.bottom-left-overlay');
    if (bottomLeftOverlay) {
        // Using setAttribute to override !important CSS
        bottomLeftOverlay.setAttribute('style', 'display: none !important');
    }
    
    // Hide the score container on game over
    const scoreContainer = document.querySelector('.score-container');
    if (scoreContainer) {
        // Using setAttribute to override !important CSS
        scoreContainer.setAttribute('style', 'display: none !important');
    }
    
    // Hide background particles on game over
    hideBackgroundParticles();
    
    // Show cursor again
    document.body.classList.remove('game-active');
    
    // Create enhanced game over screen
    const kevinityGameOverScreen = document.createElement('div');
    kevinityGameOverScreen.id = 'game-over-screen';
    kevinityGameOverScreen.style.position = 'absolute';
    kevinityGameOverScreen.style.top = '0';
    kevinityGameOverScreen.style.left = '0';
    kevinityGameOverScreen.style.width = '100%';
    kevinityGameOverScreen.style.height = '100%';
    kevinityGameOverScreen.style.display = 'flex';
    kevinityGameOverScreen.style.flexDirection = 'column';
    kevinityGameOverScreen.style.justifyContent = 'center';
    kevinityGameOverScreen.style.alignItems = 'center';
    kevinityGameOverScreen.style.background = 'radial-gradient(circle, #3b0c00 0%, #1a0500 100%)'; // Fully opaque
    kevinityGameOverScreen.style.zIndex = '1000';
    kevinityGameOverScreen.style.fontFamily = 'Arial, sans-serif';
    kevinityGameOverScreen.style.color = '#fff';
    kevinityGameOverScreen.style.textAlign = 'center';
    
    // Add Kev's image at the top
    const kevImage = document.createElement('img');
    kevImage.src = 'image.png';
    kevImage.alt = 'Kev';
    kevImage.style.width = '100px';
    kevImage.style.height = '100px';
    kevImage.style.borderRadius = '50%'; // Make the image circular
    kevImage.style.border = '3px solid #ff6600'; // Orange border
    kevImage.style.marginBottom = '10px';
    kevImage.style.boxShadow = '0 0 15px rgba(255, 102, 0, 0.7)'; // Add glow effect
    kevinityGameOverScreen.appendChild(kevImage);
    
    // Add Kevinity branding at top
    const brandContainer = document.createElement('div');
    brandContainer.style.marginBottom = '10px';
    
    const kevinityLogo = document.createElement('div');
    kevinityLogo.innerHTML = 'KEVINITY.AI';
    kevinityLogo.style.fontSize = '24px';
    kevinityLogo.style.fontWeight = 'bold';
    kevinityLogo.style.color = '#ff9933';
    kevinityLogo.style.letterSpacing = '2px';
    brandContainer.appendChild(kevinityLogo);
    kevinityGameOverScreen.appendChild(brandContainer);
    
    // Game over title
    const gameOverTitle = document.createElement('h1');
    gameOverTitle.innerText = 'GAME OVER';
    gameOverTitle.style.fontSize = '72px';
    gameOverTitle.style.fontWeight = 'bold';
    gameOverTitle.style.color = '#ff6600';
    gameOverTitle.style.textShadow = '0 0 20px rgba(255, 102, 0, 0.7)';
    gameOverTitle.style.letterSpacing = '4px';
    gameOverTitle.style.marginBottom = '20px';
    kevinityGameOverScreen.appendChild(gameOverTitle);
    
    // Game result
    const gameResult = document.createElement('h2');
    gameResult.id = 'game-result';
    
    if (gameState.scores.player > gameState.scores.opponent) {
        gameResult.innerText = 'You Win!';
        gameResult.style.color = '#66ff66';
    } else {
        gameResult.innerText = 'You Lose!';
        gameResult.style.color = '#ff6666';
    }
    
    gameResult.style.fontSize = '48px';
    gameResult.style.marginBottom = '30px';
    gameResult.style.textShadow = '0 0 15px rgba(255, 255, 255, 0.7)';
    kevinityGameOverScreen.appendChild(gameResult);
    
    // Final score display
    const scoreDisplay = document.createElement('div');
    scoreDisplay.style.fontSize = '36px';
    scoreDisplay.style.marginBottom = '40px';
    scoreDisplay.innerHTML = `${gameState.scores.player} : ${gameState.scores.opponent}`;
    kevinityGameOverScreen.appendChild(scoreDisplay);
    
    // Create restart button
    const restartButtonElement = document.createElement('button');
    restartButtonElement.id = 'restart-button';
    restartButtonElement.innerText = 'PLAY AGAIN';
    restartButtonElement.style.fontSize = '24px';
    restartButtonElement.style.padding = '15px 40px';
    restartButtonElement.style.background = 'linear-gradient(135deg, #ff6600, #ff3300)';
    restartButtonElement.style.border = 'none';
    restartButtonElement.style.borderRadius = '30px';
    restartButtonElement.style.color = 'white';
    restartButtonElement.style.fontWeight = 'bold';
    restartButtonElement.style.cursor = 'pointer';
    restartButtonElement.style.boxShadow = '0 0 20px rgba(255, 102, 0, 0.5)';
    restartButtonElement.style.transition = 'all 0.2s ease-in-out';
    restartButtonElement.style.letterSpacing = '1px';
    
    // Button hover and active states
    restartButtonElement.onmouseover = function() {
        this.style.transform = 'scale(1.05)';
        this.style.boxShadow = '0 0 30px rgba(255, 102, 0, 0.8)';
    };
    restartButtonElement.onmouseout = function() {
        this.style.transform = 'scale(1)';
        this.style.boxShadow = '0 0 20px rgba(255, 102, 0, 0.5)';
    };
    restartButtonElement.onmousedown = function() {
        this.style.transform = 'scale(0.98)';
    };
    restartButtonElement.onmouseup = function() {
        this.style.transform = 'scale(1.05)';
    };
    
    kevinityGameOverScreen.appendChild(restartButtonElement);
    
    // Add visit Kevinity.ai link
    const kevinityLink = document.createElement('a');
    kevinityLink.href = 'https://kevinity.ai';
    kevinityLink.target = '_blank';
    kevinityLink.innerText = 'Visit Kevinity.ai';
    kevinityLink.style.marginTop = '30px';
    kevinityLink.style.color = '#ff9933';
    kevinityLink.style.textDecoration = 'none';
    kevinityLink.style.fontWeight = 'bold';
    
    kevinityLink.onmouseover = function() {
        this.style.textDecoration = 'underline';
    };
    kevinityLink.onmouseout = function() {
        this.style.textDecoration = 'none';
    };
    
    kevinityGameOverScreen.appendChild(kevinityLink);
    
    // Add to game container
    document.getElementById('game-container').appendChild(kevinityGameOverScreen);
    
    // Update event listener
    document.getElementById('restart-button').addEventListener('click', restartGame);

    // Hide Timer Display
    const timerElement = document.getElementById('timer-display');
    if (timerElement) {
        // timerElement.style.display = 'none'; // Can't override !important
        timerElement.setAttribute('style', 'display: none !important');
    }
}

function restartGame() {
    // Reset game state flags (but not scores immediately)
    gameState.over = false;
    gameState.started = false; // Mark game as not started
    // gameState.scores.player = 0; // Don't reset scores here
    // gameState.scores.opponent = 0;
    
    // // Update score display // Don't update score display here
    // playerScoreElement.textContent = gameState.scores.player;
    // opponentScoreElement.textContent = gameState.scores.opponent;
    
    // Hide game over screen - get fresh reference to ensure we hide the enhanced version
    const currentGameOverScreen = document.getElementById('game-over-screen');
    if (currentGameOverScreen) {
        currentGameOverScreen.style.display = 'none';
    }

    // Show start screen
    const currentStartScreen = document.getElementById('start-screen');
    if (currentStartScreen) {
        currentStartScreen.style.display = 'flex'; // Use flex to match its original style
    }
    
    // Clear the start screen leaderboard content to force refresh
    const startLeaderboardList = document.getElementById('start-leaderboard-list');
    if (startLeaderboardList) {
        startLeaderboardList.innerHTML = ''; // Clear existing entries
    }
    // Also ensure the container is hidden and back button removed if visible
    const startLeaderboardContainer = document.querySelector('.leaderboard-container'); // Assuming only one on start screen
    const backButton = document.getElementById('back-to-start-button');
    const viewScoresButton = document.getElementById('view-scores-button');
    if (startLeaderboardContainer) {
        startLeaderboardContainer.style.display = 'none';
    }
    if (backButton) {
        backButton.remove();
    }
    if (viewScoresButton) {
        viewScoresButton.innerText = 'VIEW LEADERBOARD'; // Reset button text - Changed text
    }
    const mainContentContainer = document.getElementById('start-main-content');
    if(mainContentContainer) {
        mainContentContainer.style.display = 'flex'; // Ensure main content is visible
    }
    
    // Ensure cursor is visible (should already be handled by game over screen)
    document.body.classList.remove('game-active');
    
    // Ensure score and background particles are hidden (also handled by game over screen)
    const scoreContainer = document.querySelector('.score-container');
    if (scoreContainer) {
        scoreContainer.setAttribute('style', 'display: none !important');
    }
    hideBackgroundParticles();

    // No longer reset ball or hide cursor here
    // // Hide cursor again for the new game
    // document.body.classList.add('game-active');
    // 
    // // Reset ball
    // resetBall();
}

// Function to create and manage background particles during gameplay
function createBackgroundParticles() {
    const container = document.getElementById('background-particles-container');
    if (!container) return;
    
    // Ensure container is visible
    container.style.display = 'block';
    
    // Clear existing particles if any
    container.innerHTML = '';
    
    // Create particles
    const particleCount = 30; // Number of particles
    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'background-particle';
        
        const size = 4 + Math.random() * 8; // Size: 4px to 12px
        particle.style.width = size + 'px';
        particle.style.height = size + 'px';
        
        // Random orange/yellowish color
        particle.style.backgroundColor = `rgba(255, ${100 + Math.floor(Math.random() * 155)}, 0, ${0.2 + Math.random() * 0.5})`;
        
        // Random position
        particle.style.top = Math.random() * 100 + '%';
        particle.style.left = Math.random() * 100 + '%';
        
        // Random animation delay and duration
        particle.style.animationDelay = Math.random() * 8 + 's';
        particle.style.animationDuration = (8 + Math.random() * 10) + 's';
        
        container.appendChild(particle);
    }
}

// Function to stop/hide background particles
function hideBackgroundParticles() {
    const container = document.getElementById('background-particles-container');
    if (container) {
        container.style.display = 'none';
    }
}

// Handle Mouse Movement
function onDocumentMouseMove(event) {
    // Normalize mouse position (-1 to +1 range)
    mousePosition.x = (event.clientX / window.innerWidth) * 2 - 1;
    mousePosition.y = -(event.clientY / window.innerHeight) * 2 + 1;
}

// Handle Touch Start
function onDocumentTouchStart(event) {
    if (event.touches.length === 1) {
        event.preventDefault(); // Prevent scrolling/zooming
        mousePosition.x = (event.touches[0].pageX / window.innerWidth) * 2 - 1;
        mousePosition.y = -(event.touches[0].pageY / window.innerHeight) * 2 + 1;
    }
}

// Handle Touch Move
function onDocumentTouchMove(event) {
    if (event.touches.length === 1) {
        event.preventDefault(); // Prevent scrolling/zooming
        mousePosition.x = (event.touches[0].pageX / window.innerWidth) * 2 - 1;
        mousePosition.y = -(event.touches[0].pageY / window.innerHeight) * 2 + 1;
    }
}

// Function to update the timer display
function updateTimerDisplay() {
    const timerElement = document.getElementById('timer-display');
    if (!timerElement) return;

    const totalSeconds = Math.floor(gameState.elapsedTimeSeconds);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    // Format MM:SS using spans
    const formattedMinutes = String(minutes).padStart(2, '0');
    const formattedSeconds = String(seconds).padStart(2, '0');

    // Update innerHTML with spans for styling
    timerElement.innerHTML = 
        `<span>${formattedMinutes}</span>` +
        `<span class="colon">:</span>` +
        `<span>${formattedSeconds}</span>`;
}

// Function to create and show the name input modal
function showNameInputModal() {
    return new Promise((resolve) => {
        // Create modal container
        const modalContainer = document.createElement('div');
        modalContainer.style.position = 'fixed';
        modalContainer.style.top = '0';
        modalContainer.style.left = '0';
        modalContainer.style.width = '100%';
        modalContainer.style.height = '100%';
        modalContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        modalContainer.style.display = 'flex';
        modalContainer.style.justifyContent = 'center';
        modalContainer.style.alignItems = 'center';
        modalContainer.style.zIndex = '9999';

        // Create modal content
        const modalContent = document.createElement('div');
        modalContent.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
        modalContent.style.padding = '30px';
        modalContent.style.borderRadius = '15px';
        modalContent.style.border = '2px solid #ff6600';
        modalContent.style.boxShadow = '0 0 20px rgba(255, 102, 0, 0.5)';
        modalContent.style.textAlign = 'center';
        modalContent.style.maxWidth = '90%';
        modalContent.style.width = '400px';

        // Add congratulations message
        const congratsMessage = document.createElement('h2');
        congratsMessage.textContent = 'Congratulations!';
        congratsMessage.style.color = '#ff6600';
        congratsMessage.style.marginBottom = '20px';
        congratsMessage.style.fontSize = '28px';
        congratsMessage.style.textShadow = '0 0 10px rgba(255, 102, 0, 0.5)';

        // Add input label
        const inputLabel = document.createElement('p');
        inputLabel.textContent = 'Enter your name for the leaderboard:';
        inputLabel.style.color = '#ffffff';
        inputLabel.style.marginBottom = '15px';
        inputLabel.style.fontSize = '18px';

        // Create input field
        const input = document.createElement('input');
        input.type = 'text';
        input.maxLength = '20';
        input.style.width = '100%';
        input.style.padding = '12px';
        input.style.marginBottom = '20px';
        input.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
        input.style.border = '2px solid #ff6600';
        input.style.borderRadius = '8px';
        input.style.color = '#ffffff';
        input.style.fontSize = '18px';
        input.style.outline = 'none';
        input.style.transition = 'all 0.3s ease';
        input.placeholder = 'Your name';

        // Style input focus
        input.addEventListener('focus', () => {
            input.style.backgroundColor = 'rgba(255, 255, 255, 0.15)';
            input.style.boxShadow = '0 0 10px rgba(255, 102, 0, 0.5)';
        });

        input.addEventListener('blur', () => {
            input.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            input.style.boxShadow = 'none';
        });

        // Create submit button
        const submitButton = document.createElement('button');
        submitButton.textContent = 'SUBMIT';
        submitButton.style.backgroundColor = '#ff6600';
        submitButton.style.color = 'white';
        submitButton.style.padding = '12px 30px';
        submitButton.style.border = 'none';
        submitButton.style.borderRadius = '25px';
        submitButton.style.fontSize = '18px';
        submitButton.style.cursor = 'pointer';
        submitButton.style.transition = 'all 0.2s ease';
        submitButton.style.fontWeight = 'bold';
        submitButton.style.letterSpacing = '1px';

        // Button hover effects
        submitButton.addEventListener('mouseover', () => {
            submitButton.style.transform = 'scale(1.05)';
            submitButton.style.boxShadow = '0 0 15px rgba(255, 102, 0, 0.7)';
        });

        submitButton.addEventListener('mouseout', () => {
            submitButton.style.transform = 'scale(1)';
            submitButton.style.boxShadow = 'none';
        });

        // Handle form submission
        const handleSubmit = () => {
            const name = input.value.trim();
            if (name) {
                modalContainer.remove();
                resolve(name);
            } else {
                input.style.border = '2px solid #ff0000';
                input.style.animation = 'shake 0.5s';
                setTimeout(() => {
                    input.style.border = '2px solid #ff6600';
                    input.style.animation = '';
                }, 500);
            }
        };

        // Add event listeners
        submitButton.addEventListener('click', handleSubmit);
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleSubmit();
            }
        });

        // Assemble modal
        modalContent.appendChild(congratsMessage);
        modalContent.appendChild(inputLabel);
        modalContent.appendChild(input);
        modalContent.appendChild(submitButton);
        modalContainer.appendChild(modalContent);
        document.body.appendChild(modalContainer);

        // Focus input
        input.focus();
    });
}

// Add shake animation for invalid input
const styleSheet = document.createElement('style');
styleSheet.textContent = `
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-10px); }
        75% { transform: translateX(10px); }
    }
`;
document.head.appendChild(styleSheet);

// Start the game
init(); 