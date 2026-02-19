import * as THREE from 'https://esm.sh/three@0.160.0';
import { TrackballControls } from 'https://esm.sh/three@0.160.0/examples/jsm/controls/TrackballControls';

// Three-dimensional Reversi by Peter Alfeld. 
// Players are Red (1) and Green (2). Red starts.

// --- CONFIGURATION & STATE ---
let redColor = "rgb(255,0,0)";
let greenColor = "rgb(0,255,0)";
let eligibleColor = "rgb(255,255,0)"; 
let gridColor = "rgb(255,255,255)";
let backgroundColor = "rgb(0,0,0)";
let millBoardColor = "rgb(245,234,221)"; 
let millTitleBg = "#ffffcc";
let millTitleColor = "navy";

let S = 40;   // Scaling factor for 2D
let N = 8;    // Board size

// 0 = empty, 1 = Red, 2 = Green
let gameCube = []; 
let categoryMap = []; 
let activePlayer = 1; 

let currentSlices = { X: 0, Y: 0, Z: 0 };
let validMoves = []; 
let bestMoves = []; 

// History Management
let moveHistory = []; 
let currentMoveIndex = 0; 

// Visualization Settings
let showHints = true;
let showAxes = false; 
let showCategories = false; 
let showValues = false;     
let gridMode = 1; 
let playerBallSize = 0.25; 
let hintBallSize = 0.125; 

// Camera Settings
let cameraPersp, cameraOrtho;
let orthographicMode = false;

// --- BRAIN SETTINGS ---
const DefaultBrain = {
    name: "Standard",
    weights: {
        0: 20, 1: 100, 2: 40, 3: 1000, 4: -10, 
        5: -20, 6: 100, 7: -5, 8: 10, 9: -2
    }
};
let currentBrain = DefaultBrain;

// --- 3D GLOBAL VARIABLES ---
let scene, camera, renderer, controls;
let stoneGroup, gridGroup, axesHelper; 
let raycaster, mouse; 
let animationId = null;
let overlay3D = null; 

// --- 1. HELPER FUNCTIONS ---
function el(tag, attrs = {}, ...children) {
    const element = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
        if (key === 'text') element.textContent = value;
        else if (key.startsWith('on') && typeof value === 'function') {
            element.addEventListener(key.substring(2).toLowerCase(), value);
        } else if (key === 'style') {
            element.style.cssText = value; 
        } else {
            element.setAttribute(key, value);
        }
    }
    children.forEach(child => {
        if (child) element.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    });
    return element;
}

function log(msg) {
    const box = document.getElementById('status-box');
    if (box) {
        const line = document.createElement('div');
        line.textContent = msg;
        box.appendChild(line);
        box.scrollTop = box.scrollHeight; 
    }
    console.log(msg);
}

function printToOverlay(msg) {
    if (overlay3D) {
        overlay3D.textContent = msg;
    }
}

// "Smart Input" behavior (like in Mill.js)
function setupSmartInput(inputEl, validateAndApply) {
    inputEl.dataset.lastValid = inputEl.value;
    inputEl.addEventListener('focus', function() {
        this.dataset.lastValid = this.value;
        this.value = '';
    });
    inputEl.addEventListener('blur', function() {
        if (this.value.trim() === '') {
            this.value = this.dataset.lastValid;
        } else {
            let val = parseInt(this.value);
            if (Number.isFinite(val)) {
                let finalVal = validateAndApply(val);
                if (finalVal !== undefined && finalVal !== null) {
                    this.value = finalVal;
                    this.dataset.lastValid = finalVal;
                }
            } else {
                this.value = this.dataset.lastValid;
            }
        }
    });
    inputEl.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            this.blur();
        }
    });
    return inputEl;
}

// --- 2. GAME LOGIC ---

function initGameData() {
    gameCube = new Array(N).fill(0).map(() => new Array(N).fill(0).map(() => new Array(N).fill(0)));
    activePlayer = 1; 

    const mid = (N / 2) - 1;
    currentSlices = { X: mid, Y: mid, Z: mid };

    const centerIndices = [mid, mid + 1];
    for (let x of centerIndices) {
        for (let y of centerIndices) {
            for (let z of centerIndices) {
                gameCube[x][y][z] = (x + y + z) % 2 === 0 ? 1 : 2;
            }
        }
    }

    initGeometry();
    moveHistory = [];
    saveHistoryState(); 
    currentMoveIndex = 0;
    bestMoves = []; 
    updateGameState();
}

function initGeometry() {
    categoryMap = new Array(N).fill(0).map(() => new Array(N).fill(0).map(() => new Array(N).fill(0)));
    const isEnd = (v) => (v === 0 || v === N - 1);
    
    const distToCorner = (x, y, z) => {
        let minD = 999;
        const corners = [0, N-1];
        corners.forEach(cx => {
            corners.forEach(cy => {
                corners.forEach(cz => {
                    const d = Math.max(Math.abs(x - cx), Math.abs(y - cy), Math.abs(z - cz));
                    if (d < minD) minD = d;
                });
            });
        });
        return minD;
    };

    const isEdge = (x, y, z) => {
        let ends = 0;
        if (isEnd(x)) ends++;
        if (isEnd(y)) ends++;
        if (isEnd(z)) ends++;
        return ends === 2;
    };

    const distToEdge = (x, y, z) => {
        let minD = 999;
        for(let i=0; i<N; i++) {
            for(let j=0; j<N; j++) {
                for(let k=0; k<N; k++) {
                    if (isEdge(i,j,k)) {
                        const d = Math.max(Math.abs(x - i), Math.abs(y - j), Math.abs(z - k));
                        if (d < minD) minD = d;
                    }
                }
            }
        }
        return minD;
    };

    const distToFace = (x, y, z) => {
        const dx = Math.min(x, (N-1) - x);
        const dy = Math.min(y, (N-1) - y);
        const dz = Math.min(z, (N-1) - z);
        return Math.min(dx, dy, dz);
    };

    for(let x=0; x<N; x++) {
        for(let y=0; y<N; y++) {
            for(let z=0; z<N; z++) {
                let cat = 0; 
                let ends = 0;
                if (isEnd(x)) ends++;
                if (isEnd(y)) ends++;
                if (isEnd(z)) ends++;

                let dCorner = distToCorner(x, y, z);
                let dEdge = distToEdge(x, y, z);
                let dFace = distToFace(x, y, z);

                if (ends === 3) cat = 3; 
                else if (ends === 2 && dCorner === 1) cat = 4; 
                else if (dCorner === 1) cat = 5; 
                else if (ends === 2) cat = 6; 
                else if (dEdge === 1) cat = 7; 
                else if (ends === 1) cat = 8; 
                else if (dFace === 1) cat = 9; 
                else cat = 0; 

                categoryMap[x][y][z] = cat;
            }
        }
    }
}

function checkDirection(board, x, y, z, dx, dy, dz, player) {
    const opponent = player === 1 ? 2 : 1;
    let i = x + dx;
    let j = y + dy;
    let k = z + dz;
    let foundOpponent = false;

    while (i >= 0 && i < N && j >= 0 && j < N && k >= 0 && k < N) {
        const cell = board[i][j][k];
        if (cell === opponent) {
            foundOpponent = true;
        } else if (cell === player) {
            return foundOpponent; 
        } else {
            return false;
        }
        i += dx; j += dy; k += dz;
    }
    return false; 
}

function getValidMovesForPlayer(board, player) {
    let moves = [];
    for(let x=0; x<N; x++) {
        for(let y=0; y<N; y++) {
            for(let z=0; z<N; z++) {
                if (board[x][y][z] !== 0) continue; 
                let isValid = false;
                for (let dx = -1; dx <= 1; dx++) {
                    for (let dy = -1; dy <= 1; dy++) {
                        for (let dz = -1; dz <= 1; dz++) {
                            if (dx===0 && dy===0 && dz===0) continue;
                            if (checkDirection(board, x, y, z, dx, dy, dz, player)) {
                                isValid = true;
                                break; 
                            }
                        }
                        if (isValid) break;
                    }
                    if (isValid) break;
                }
                if (isValid) moves.push({x, y, z}); 
            }
        }
    }
    return moves;
}

function simulateMove(board, move, player) {
    const newBoard = JSON.parse(JSON.stringify(board));
    const {x, y, z} = move;
    newBoard[x][y][z] = player;
    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            for (let dz = -1; dz <= 1; dz++) {
                if (dx===0 && dy===0 && dz===0) continue;
                if (checkDirection(newBoard, x, y, z, dx, dy, dz, player)) {
                    let i = x + dx, j = y + dy, k = z + dz;
                    while (newBoard[i][j][k] !== player) {
                        newBoard[i][j][k] = player;
                        i += dx; j += dy; k += dz;
                    }
                }
            }
        }
    }
    return newBoard;
}

function staticEvaluation(board, player) {
    let opponent = (player === 1) ? 2 : 1;
    let score = 0;
    const w = currentBrain.weights;
    
    let counts = { p: {}, o: {} };
    for(let i=0; i<=9; i++) { counts.p[i]=0; counts.o[i]=0; }
    let pStones = 0, oStones = 0;

    for(let x=0; x<N; x++) {
        for(let y=0; y<N; y++) {
            for(let z=0; z<N; z++) {
                let val = board[x][y][z];
                if (val === 0) continue;
                let cat = categoryMap[x][y][z];
                if (val === player) { pStones++; counts.p[cat]++; } 
                else { oStones++; counts.o[cat]++; }
            }
        }
    }

    score += (pStones - oStones) * w[2]; 
    for(let i=3; i<=9; i++) {
        score += (counts.p[i] - counts.o[i]) * w[i];
    }

    if (w[0] !== 0) {
        const pMoves = getValidMovesForPlayer(board, player).length;
        const oMoves = getValidMovesForPlayer(board, opponent).length;
        score += (pMoves - oMoves) * w[0];
    }
    return score;
}

// --- BUTTON HANDLERS ---
function doStaticEval() {
    const val = staticEvaluation(gameCube, activePlayer);
    let msg = `Static Value (${activePlayer===1?"Red":"Green"}): ${val}`;
    printToOverlay(msg);
    log(msg); // Print to status box too
}

function doListMoves() {
    bestMoves = []; 
    const moves = getValidMovesForPlayer(gameCube, activePlayer);
    if (moves.length === 0) {
        printToOverlay("No moves available.");
        log("No moves available.");
        return;
    }
    const ranked = moves.map(m => {
        const nextBoard = simulateMove(gameCube, m, activePlayer);
        const score = staticEvaluation(nextBoard, activePlayer);
        return { move: m, score: score };
    });
    ranked.sort((a, b) => b.score - a.score);
    const bestScore = ranked[0].score;
    bestMoves = ranked.filter(r => r.score === bestScore).map(r => r.move);

    let txt = `--- Available Moves (${ranked.length}) ---\nBest Score: ${bestScore} (${bestMoves.length} moves)\n`;
    log(`--- Available Moves (${ranked.length}) ---`);
    log(`Best Score: ${bestScore} (${bestMoves.length} moves)`);
    
    ranked.forEach(item => {
        const isBest = item.score === bestScore;
        const mark = isBest ? " ★" : "";
        let lineStr = `(${item.move.x},${item.move.y},${item.move.z}) : ${item.score}${mark}`;
        txt += lineStr + `\n`;
        log(lineStr);
    });
    
    printToOverlay(txt);
    update3D();
    redrawAllSlices();
}

function toggleFullscreen() {
    const container = document.getElementById('view3d-container');
    if (!document.fullscreenElement) {
        container.requestFullscreen().catch(err => alert(`Error: ${err.message}`));
    } else {
        document.exitFullscreen();
    }
}

function toggleCamera() {
    orthographicMode = !orthographicMode;
    if (orthographicMode) {
        cameraOrtho.position.copy(cameraPersp.position);
        cameraOrtho.quaternion.copy(cameraPersp.quaternion);
        camera = cameraOrtho;
    } else {
        cameraPersp.position.copy(cameraOrtho.position);
        cameraPersp.quaternion.copy(cameraOrtho.quaternion);
        camera = cameraPersp;
    }
    controls.object = camera;
    updateCameraFrustum();
}

function updateCameraFrustum() {
    if (!renderer) return;
    const w = renderer.domElement.width;
    const h = renderer.domElement.height;
    const aspect = w / h;
    const frustumSize = N * 1.8; 
    
    if (cameraPersp) {
        cameraPersp.aspect = aspect;
        cameraPersp.updateProjectionMatrix();
    }
    if (cameraOrtho) {
        cameraOrtho.left = frustumSize * aspect / -2;
        cameraOrtho.right = frustumSize * aspect / 2;
        cameraOrtho.top = frustumSize / 2;
        cameraOrtho.bottom = frustumSize / -2;
        cameraOrtho.updateProjectionMatrix();
    }
}

document.addEventListener('fullscreenchange', () => {
    if (renderer && camera) {
        const isFS = !!document.fullscreenElement;
        const w = isFS ? window.innerWidth : 23 * S;
        const h = isFS ? window.innerHeight : 23 * S;
        renderer.setSize(w, h);
        updateCameraFrustum();
        if (controls && controls.handleResize) controls.handleResize();
    }
});

// KEYBOARD COMMANDS
document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

    if (e.key === ' ' || e.key === 'Escape') {
        if (document.fullscreenElement) {
            document.exitFullscreen();
            e.preventDefault();
        }
        return;
    }

    switch(e.key) {
        case '4': case '6': case '8':
            N = parseInt(e.key);
            if(document.getElementById('size-select')) document.getElementById('size-select').value = N;
            resetGame();
            break;
        case 'a':
            gridMode = (gridMode + 1) % 3;
            if(document.getElementById('grid-select')) document.getElementById('grid-select').value = gridMode;
            update3D();
            break;
        case 'A':
            showAxes = !showAxes;
            if(document.getElementById('btn-axes')) document.getElementById('btn-axes').style.backgroundColor = showAxes ? 'green' : 'grey';
            update3D();
            break;
        case 'c':
            showCategories = !showCategories;
            showValues = false;
            if(document.getElementById('btn-cats')) document.getElementById('btn-cats').style.backgroundColor = showCategories ? 'green' : 'grey';
            if(document.getElementById('btn-vals')) document.getElementById('btn-vals').style.backgroundColor = 'grey';
            update3D();
            break;
        case 'v':
            showValues = !showValues;
            showCategories = false;
            if(document.getElementById('btn-vals')) document.getElementById('btn-vals').style.backgroundColor = showValues ? 'green' : 'grey';
            if(document.getElementById('btn-cats')) document.getElementById('btn-cats').style.backgroundColor = 'grey';
            update3D();
            break;
        case 'S':
            doStaticEval();
            break;
        case 'M':
            doListMoves();
            break;
        case 'B':
            playerBallSize = Math.min(0.9, playerBallSize + 0.05);
            if(document.getElementById('slider-ball')) document.getElementById('slider-ball').value = playerBallSize;
            update3D();
            break;
        case 'b':
            playerBallSize = Math.max(0.1, playerBallSize - 0.05);
            if(document.getElementById('slider-ball')) document.getElementById('slider-ball').value = playerBallSize;
            update3D();
            break;
        case 'H':
            hintBallSize = Math.min(0.5, hintBallSize + 0.025);
            if(document.getElementById('slider-hint')) document.getElementById('slider-hint').value = hintBallSize;
            update3D();
            break;
        case 'h':
            hintBallSize = Math.max(0.05, hintBallSize - 0.025);
            if(document.getElementById('slider-hint')) document.getElementById('slider-hint').value = hintBallSize;
            update3D();
            break;
        case '<':
            loadHistoryState(currentMoveIndex - 1);
            break;
        case '>':
            loadHistoryState(currentMoveIndex + 1);
            break;
        case 'F':
        case 'f':
            toggleFullscreen();
            break;
        case 'I':
        case 'i':
            toggleCamera();
            if(document.getElementById('btn-camera')) document.getElementById('btn-camera').textContent = orthographicMode ? 'Perspective' : 'Infinity';
            break;
        case '.':
            printToOverlay("");
            break;
        case '?':
            printToOverlay(
`Commands:
4, 6, 8 : Set board size
a       : Cycle grid mode
A       : Toggle Axes
c       : Toggle Categories
v       : Toggle Clues (Values)
S       : Compute Static Value
M       : List sorted Moves
B / b   : Increase/Decrease Player ball size
H / h   : Increase/Decrease Hint ball size
< / >   : History back/forward
F / f   : Toggle Fullscreen
I / i   : Toggle Infinity (Orthographic) mode
.       : Clear text
?       : Show this help
Esc/Spc : Exit Fullscreen`);
            break;
    }
});

// --- STATE MANAGEMENT ---

function saveHistoryState() {
    const cubeCopy = JSON.parse(JSON.stringify(gameCube));
    if (currentMoveIndex < moveHistory.length - 1) {
        moveHistory = moveHistory.slice(0, currentMoveIndex + 1);
    }
    moveHistory.push({ cube: cubeCopy, player: activePlayer });
    currentMoveIndex = moveHistory.length - 1;
    updateNavUI();
}

function loadHistoryState(index) {
    if (index < 0 || index >= moveHistory.length) return;
    currentMoveIndex = index;
    const state = moveHistory[index];
    gameCube = JSON.parse(JSON.stringify(state.cube));
    activePlayer = state.player;
    updateGameState(true); 
    redrawAllSlices();
    update3D();
    updateNavUI();
}

function updateNavUI() {
    const txt = document.getElementById('nav-move-num');
    if (txt) txt.value = currentMoveIndex;
}

function resetGame() {
    const box = document.getElementById('status-box');
    if(box) box.innerHTML = "";
    printToOverlay(""); 
    initGameData();
    initGeometry(); 
    initLayout();   
}

function getScores() {
    let r = 0, g = 0;
    for(let x=0; x<N; x++) 
        for(let y=0; y<N; y++) 
            for(let z=0; z<N; z++) {
                if(gameCube[x][y][z] === 1) r++;
                if(gameCube[x][y][z] === 2) g++;
            }
    return { red: r, green: g };
}

function updateGameState(isViewOnly = false) {
    validMoves = getValidMovesForPlayer(gameCube, activePlayer).map(m => `${m.x},${m.y},${m.z}`); 
    const infoDiv = document.getElementById('game-info');

    if (!isViewOnly && validMoves.length === 0 && currentMoveIndex === moveHistory.length - 1) {
        const opponent = activePlayer === 1 ? 2 : 1;
        const opponentMoves = getValidMovesForPlayer(gameCube, opponent);

        if (opponentMoves.length === 0) {
            const scores = getScores();
            let winner = "DRAW";
            if (scores.red > scores.green) winner = "RED WINS!";
            else if (scores.green > scores.red) winner = "GREEN WINS!";
            log(`GAME OVER: ${winner}`);
            if(infoDiv) infoDiv.innerHTML += `<div style="color:blue; font-weight:bold; margin-top:5px;">${winner}</div>`;
            return; 
        } else {
            const pName = activePlayer === 1 ? "Red" : "Green";
            log(`${pName} has no moves. Passing...`);
            activePlayer = opponent;
            saveHistoryState();
            updateGameState();
            return; 
        }
    }

    const scores = getScores();
    if (infoDiv) {
        const pName = activePlayer === 1 ? "Red" : "Green";
        const color = activePlayer === 1 ? redColor : greenColor;
        infoDiv.innerHTML = `
            <div style="font-size: 1.4em; text-align: center;">
                <span style="color:${color}; font-weight:bold">${pName}</span>
                <span>&nbsp;&nbsp;&nbsp;</span>
                <span style="color: ${redColor}; font-weight:bold;">${scores.red}</span>
                <span style="font-weight:bold; color: black;">&nbsp;|&nbsp;</span>
                <span style="color: ${greenColor}; font-weight:bold;">${scores.green}</span>
            </div>
        `;
    }
}

function executeMove(x, y, z) {
    if (showCategories || showValues) return; 

    if (currentMoveIndex < moveHistory.length - 1) {
        moveHistory = moveHistory.slice(0, currentMoveIndex + 1);
    }

    gameCube[x][y][z] = activePlayer;
    bestMoves = []; 
    
    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            for (let dz = -1; dz <= 1; dz++) {
                if (dx===0 && dy===0 && dz===0) continue;
                if (checkDirection(gameCube, x, y, z, dx, dy, dz, activePlayer)) {
                    let i = x + dx, j = y + dy, k = z + dz;
                    while (gameCube[i][j][k] !== activePlayer) {
                        gameCube[i][j][k] = activePlayer;
                        i += dx; j += dy; k += dz;
                    }
                }
            }
        }
    }
    
    activePlayer = (activePlayer === 1 ? 2 : 1);
    saveHistoryState(); 
    updateGameState(); 
    redrawAllSlices();
    update3D(); 
}

// --- 3. 2D DRAWING ---

function drawSlice(canvas, axis, sliceIndex) {
    const ctx = canvas.getContext('2d');
    const size = canvas.width; 
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, size, size);

    const step = size / N; 
    const offset = step / 2;

    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    const lineStart = offset;
    const lineEnd = size - offset;

    for (let i = 0; i < N; i++) {
        const pos = offset + (i * step);
        ctx.moveTo(pos, lineStart); ctx.lineTo(pos, lineEnd);
        ctx.moveTo(lineStart, pos); ctx.lineTo(lineEnd, pos);
    }
    ctx.stroke();

    for (let i = 0; i < N; i++) { 
        for (let j = 0; j < N; j++) { 
            let x, y, z;
            if (axis === 'X') { x = sliceIndex; y = i; z = j; }       
            else if (axis === 'Y') { x = i; y = sliceIndex; z = j; }  
            else { x = i; y = j; z = sliceIndex; }                    

            const val = gameCube[x][y][z];
            const cx = offset + (i * step);
            const cy = offset + (j * step);

            const isBest = bestMoves.some(m => m.x === x && m.y === y && m.z === z);

            if (val !== 0) {
                const radius = step * 0.35; 
                ctx.fillStyle = (val === 1) ? redColor : greenColor;
                ctx.beginPath();
                ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
                ctx.fill();
            } else if (isBest) {
                const radius = step * 0.30; 
                ctx.fillStyle = eligibleColor;
                ctx.beginPath();
                ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
                ctx.fill();
            } else if (showHints && validMoves.includes(`${x},${y},${z}`) && !showCategories && !showValues) {
                const radius = step * 0.15; 
                ctx.fillStyle = (activePlayer === 1) ? "rgb(127,0,0)" : "rgb(0,127,0)";
                ctx.beginPath();
                ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
                ctx.fill();
            }
        }
    }
}

function handleCanvasClick(event, axis) {
    const rect = event.target.getBoundingClientRect();
    const size = event.target.width;
    const step = size / N; 
    const offset = step / 2;
    const i = Math.round((event.clientX - rect.left - offset) / step);
    const j = Math.round((event.clientY - rect.top - offset) / step);

    if (i >= 0 && i < N && j >= 0 && j < N) {
        let x, y, z, sliceIndex = currentSlices[axis];
        if (axis === 'X') { x = sliceIndex; y = i; z = j; }
        else if (axis === 'Y') { x = i; y = sliceIndex; z = j; }
        else { x = i; y = j; z = sliceIndex; }

        const moveKey = `${x},${y},${z}`;
        if (validMoves.includes(moveKey)) {
            executeMove(x, y, z);
        }
    }
}

function redrawAllSlices() {
    ['X', 'Y', 'Z'].forEach(axis => {
        const canvas = document.getElementById(`canvas-${axis}`);
        if (canvas) drawSlice(canvas, axis, currentSlices[axis]);
    });
}

// --- 4. 3D LOGIC (Three.js) ---

function init3D() {
    const container = document.getElementById('view3d-container');
    container.style.position = 'relative'; 
    const size = 23 * S;

    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }
    if (renderer) renderer.dispose();

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000); 

    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    const aspect = size / size;
    cameraPersp = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
    cameraPersp.position.set(N*0.8, N*0.8, N*1.5); 

    const frustumSize = N * 1.8;
    cameraOrtho = new THREE.OrthographicCamera(frustumSize * aspect / -2, frustumSize * aspect / 2, frustumSize / 2, frustumSize / -2, 0.1, 1000);
    cameraOrtho.position.set(N*0.8, N*0.8, N*1.5);

    camera = orthographicMode ? cameraOrtho : cameraPersp;

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(size, size);
    container.appendChild(renderer.domElement);

    if (overlay3D) {
        overlay3D.remove();
    }
    overlay3D = document.createElement('div');
    overlay3D.style.cssText = 'position: absolute; top: 10px; left: 10px; color: white; font-family: monospace; font-size: 16px; pointer-events: none; z-index: 10; text-shadow: 1px 1px 2px #000; white-space: pre-wrap;';
    container.appendChild(overlay3D);
    
    renderer.domElement.addEventListener('click', on3DClick);

    controls = new TrackballControls(camera, renderer.domElement);
    controls.rotateSpeed = 4.0;
    controls.zoomSpeed = 1.2;
    controls.panSpeed = 0.8;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(10, 20, 10);
    scene.add(dirLight);

    gridGroup = new THREE.Group();
    const offset = (N - 1) / 2;
    gridGroup.position.set(-offset, -offset, -offset);
    scene.add(gridGroup);

    stoneGroup = new THREE.Group();
    stoneGroup.position.set(-offset, -offset, -offset); 
    scene.add(stoneGroup);
    
    axesHelper = new THREE.Group();
    const lineHelper = new THREE.AxesHelper(N);
    axesHelper.add(lineHelper);

    const makeLabel = (txt, color) => {
        const canvas = document.createElement('canvas');
        canvas.width = 64; canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = color;
        ctx.font = 'bold 32px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(txt, 32, 32);
        const tex = new THREE.CanvasTexture(canvas);
        const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false });
        const sprite = new THREE.Sprite(mat);
        sprite.scale.set(1.5, 1.5, 1.5);
        return sprite;
    };

    const xLab = makeLabel('X', '#ff0000'); xLab.position.set(N + 0.5, 0, 0); axesHelper.add(xLab);
    const yLab = makeLabel('Y', '#00ff00'); yLab.position.set(0, N + 0.5, 0); axesHelper.add(yLab);
    const zLab = makeLabel('Z', '#0000ff'); zLab.position.set(0, 0, N + 0.5); axesHelper.add(zLab);

    axesHelper.position.set(-offset - 1, -offset - 1, -offset - 1);
    scene.add(axesHelper);

    update3DGrid();
    animate();
    update3D();
}

function update3DGrid() {
    while(gridGroup.children.length > 0) gridGroup.remove(gridGroup.children[0]);
    if (gridMode === 0) return; 

    const material = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3 });
    const points = [];

    for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
            points.push(new THREE.Vector3(0, i, j), new THREE.Vector3(N-1, i, j));
            points.push(new THREE.Vector3(i, 0, j), new THREE.Vector3(i, N-1, j));
            points.push(new THREE.Vector3(i, j, 0), new THREE.Vector3(i, j, N-1));
        }
    }

    if (gridMode === 2) {
        for (let x = 0; x < N; x++) {
            for (let y = 0; y < N; y++) {
                for (let z = 0; z < N; z++) {
                    const origin = new THREE.Vector3(x,y,z);
                    const diags = [
                        [1,1,0], [1,-1,0], [1,0,1], [1,0,-1], 
                        [0,1,1], [0,1,-1], [1,1,1], [1,1,-1], [1,-1,1], [1,-1,-1] 
                    ];
                    diags.forEach(d => {
                        const nx = x + d[0], ny = y + d[1], nz = z + d[2];
                        if (nx >=0 && nx < N && ny >=0 && ny < N && nz >=0 && nz < N) {
                            points.push(origin, new THREE.Vector3(nx, ny, nz));
                        }
                    });
                }
            }
        }
    }

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const lineSegments = new THREE.LineSegments(geometry, material);
    gridGroup.add(lineSegments);
}

function update3D() {
    if (!stoneGroup) return;
    if (axesHelper) axesHelper.visible = showAxes;
    update3DGrid(); 

    while(stoneGroup.children.length > 0) stoneGroup.remove(stoneGroup.children[0]);

    const pRadius = playerBallSize / 2;
    const hRadius = hintBallSize / 2;
    const stoneGeo = new THREE.SphereGeometry(pRadius, 32, 32);
    const hintGeo = new THREE.SphereGeometry(hRadius, 16, 16);
    const bestMoveGeo = new THREE.SphereGeometry(hRadius * 2, 16, 16);

    if (showCategories) {
        const catColors = [
            0x444444, 0xFFFFFF, 0xFFFFFF, 0xFFD700, 
            0x8B0000, 0xFF0000, 0x0000FF, 0xFFA500, 
            0x008000, 0x90EE90 
        ];
        const debugGeo = new THREE.SphereGeometry(0.12, 16, 16);
        for(let x=0; x<N; x++) {
            for(let y=0; y<N; y++) {
                for(let z=0; z<N; z++) {
                    const cat = categoryMap[x][y][z];
                    const mat = new THREE.MeshStandardMaterial({ 
                        color: catColors[cat] || 0x888888,
                        roughness: 0.4, transparent: true, opacity: 0.8
                    });
                    const mesh = new THREE.Mesh(debugGeo, mat);
                    mesh.position.set(x,y,z);
                    mesh.userData = { x:x, y:y, z:z }; 
                    stoneGroup.add(mesh);
                }
            }
        }
        return; 
    }

    if (showValues) {
        const debugGeo = new THREE.SphereGeometry(0.12, 16, 16);
        for(let x=0; x<N; x++) {
            for(let y=0; y<N; y++) {
                for(let z=0; z<N; z++) {
                    const cat = categoryMap[x][y][z];
                    const weight = currentBrain.weights[cat] || 0;
                    
                    let col = 0x888888;
                    if (weight > 0) {
                        if (weight >= 500) col = 0xFFD700; 
                        else col = 0x00FF00; 
                    } else if (weight < 0) {
                        col = 0xFF0000; 
                    }

                    const mat = new THREE.MeshStandardMaterial({ 
                        color: col,
                        roughness: 0.4, metalness: 0.1,
                        transparent: true, opacity: 0.6
                    });
                    const mesh = new THREE.Mesh(debugGeo, mat);
                    mesh.position.set(x,y,z);
                    mesh.userData = { x:x, y:y, z:z }; 
                    stoneGroup.add(mesh);
                }
            }
        }
        return;
    }

    const redMat = new THREE.MeshStandardMaterial({ color: 0xff0000, roughness: 0.2, metalness: 0.1 });
    const greenMat = new THREE.MeshStandardMaterial({ color: 0x00ff00, roughness: 0.2, metalness: 0.1 });
    
    const hintColorHex = (activePlayer === 1) ? 0x7f0000 : 0x007f00;
    const hintMat = new THREE.MeshStandardMaterial({ color: hintColorHex, transparent: true, opacity: 0.8, roughness: 0.2 });

    for(let x=0; x<N; x++) {
        for(let y=0; y<N; y++) {
            for(let z=0; z<N; z++) {
                const val = gameCube[x][y][z];
                if (val !== 0) {
                    const mesh = new THREE.Mesh(stoneGeo, val === 1 ? redMat : greenMat);
                    mesh.position.set(x, y, z);
                    mesh.userData = { isHint: false };
                    stoneGroup.add(mesh);
                }
            }
        }
    }

    if (showHints) {
        validMoves.forEach(moveStr => {
            const [x, y, z] = moveStr.split(',').map(Number);
            const isBest = bestMoves.some(m => m.x === x && m.y === y && m.z === z);
            
            const geometry = isBest ? bestMoveGeo : hintGeo;
            const mesh = new THREE.Mesh(geometry, hintMat);
            
            mesh.position.set(x, y, z);
            mesh.userData = { isHint: true, x: x, y: y, z: z };
            stoneGroup.add(mesh);
        });
    }
}

function on3DClick(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(stoneGroup.children);

    for (let i = 0; i < intersects.length; i++) {
        const obj = intersects[i].object;
        if (showCategories || showValues) return;
        if (obj.userData.isHint) {
            executeMove(obj.userData.x, obj.userData.y, obj.userData.z);
            return; 
        }
    }
}

function animate() {
    animationId = requestAnimationFrame(animate); 
    if (controls) controls.update();
    renderer.render(scene, camera);
}

// --- 5. UI LAYOUT ---

function initLayout() {
    if (gameCube.length !== N) initGameData();

    const root = document.getElementById('gameTable');
    if (!root) return;
    root.innerHTML = '';

    root.style.display = 'flex';
    root.style.flexDirection = 'row';
    root.style.gap = `${S}px`; 
    root.style.padding = `${S}px`;
    root.style.fontFamily = 'sans-serif';

    // 4. Config inputs prepared beforehand to use smart input setup
    let scaleInput = el('input', { type: 'text', value: S, style: 'width: 30px; text-align: center;' });
    setupSmartInput(scaleInput, (val) => {
        let safeS = Math.max(20, Math.min(60, val));
        S = safeS;
        initLayout();
        return safeS;
    });

    let historyInput = el('input', { type: 'text', value: currentMoveIndex, style: 'width: 30px; text-align: center;' });
    setupSmartInput(historyInput, (val) => {
        let maxIdx = Math.max(0, moveHistory.length - 1);
        let safeVal = Math.max(0, Math.min(val, maxIdx));
        loadHistoryState(safeVal);
        return safeVal;
    });

    // --- COLUMN 1: CONTROLS ---
    const col1 = el('div', { class: 'col-controls', style: 'min-width: 220px; max-width: 220px; display: flex; flex-direction: column; gap: 8px;' },
        
        // Header
        el('div', { style: `background-color: ${millTitleBg}; color: ${millTitleColor}; padding: 5px; border-radius: 4px; border: 1px solid ${millTitleColor}; text-align: center;` },
            el('div', { style: 'font-weight: bold; font-size: 1.2em;' }, "Reversi v. 1"),
            el('div', { style: 'font-size: 1em; font-weight: bold;' }, "JS engine.")
        ),

        // 1. Status / Info Box
        el('div', { 
            id: 'game-info',
            style: `background-color: ${millBoardColor}; padding: 10px; border-radius: 4px; border: 1px solid navy;`
        }, "Initializing..."),

        // 2. Status Log
        el('div', { 
            id: 'status-box',
            style: `background-color: ${millBoardColor}; color: navy; height: 100px; overflow-y: auto; padding: 5px; font-size: 0.8em; border: 1px solid navy; font-family: monospace;`
        }),

        // 3. Reset & History
        el('div', { style: 'display: flex; gap: 5px; align-items: center;' },
            el('button', { 
                text: 'Reset Game', 
                style: 'flex: 2; background-color: red; color: yellow; font-size: 16px; font-weight: bold; padding: 5px; cursor: pointer;',
                onclick: () => resetGame() 
            }),
            el('button', { text: '<', style: 'flex: 1; font-weight:bold; cursor: pointer;', onclick: () => loadHistoryState(currentMoveIndex - 1) }),
            historyInput,
            el('button', { text: '>', style: 'flex: 1; font-weight:bold; cursor: pointer;', onclick: () => loadHistoryState(currentMoveIndex + 1) })
        ),

        // 4. Config (Scale & N)
        el('div', { style: 'display: flex; justify-content: space-between; align-items: center;' },
            el('label', { text: 'Scale:' }),
            el('div', { style: 'display: flex; gap: 2px;' },
                el('button', { text: '<', style: 'cursor: pointer; font-weight:bold; width: 25px;', onclick: () => { S = Math.max(20, S - 2); initLayout(); } }),
                scaleInput,
                el('button', { text: '>', style: 'cursor: pointer; font-weight:bold; width: 25px;', onclick: () => { S = Math.min(60, S + 2); initLayout(); } })
            ),
            el('label', { text: 'N=' }),
            el('select', { 
                id: 'size-select',
                style: 'width: 40px;',
                onchange: (e) => { N = parseInt(e.target.value); resetGame(); } 
            },
                el('option', { value: '4', text: '4', ...(N===4 ? {selected: 'true'} : {}) }),
                el('option', { value: '6', text: '6', ...(N===6 ? {selected: 'true'} : {}) }),
                el('option', { value: '8', text: '8', ...(N===8 ? {selected: 'true'} : {}) })
            )
        ),

        // 5. Fullscreen / Infinity
        el('div', { style: 'display: flex; gap: 5px;' },
            el('button', { 
                text: 'Fullscreen', 
                style: 'flex: 1; background-color: navy; color: white; border: none; padding: 5px; cursor: pointer; font-weight: bold;',
                onclick: () => toggleFullscreen() 
            }),
            el('button', { 
                text: orthographicMode ? 'Perspective' : 'Infinity', 
                id: 'btn-camera',
                style: 'flex: 1; background-color: navy; color: white; border: none; padding: 5px; cursor: pointer; font-weight: bold;',
                onclick: () => { toggleCamera(); document.getElementById('btn-camera').textContent = orthographicMode ? 'Perspective' : 'Infinity'; }
            })
        ),

        // 6. Toggles
        el('div', { style: 'display: flex; gap: 5px;' },
            el('button', { 
                text: 'Hints', 
                id: 'btn-hints',
                style: `flex:1; background-color: ${showHints?'green':'grey'}; color: white; border: none; padding: 5px; cursor: pointer;`,
                onclick: (e) => { 
                    showHints = !showHints; 
                    e.target.style.backgroundColor = showHints?'green':'grey';
                    redrawAllSlices(); 
                    update3D(); 
                } 
            }),
            el('button', { 
                text: 'Axes', 
                id: 'btn-axes',
                style: `flex:1; background-color: ${showAxes?'green':'grey'}; color: white; border: none; padding: 5px; cursor: pointer;`,
                onclick: (e) => { 
                    showAxes = !showAxes; 
                    e.target.style.backgroundColor = showAxes?'green':'grey';
                    update3D(); 
                } 
            }),
            el('button', { 
                text: 'Cats', 
                id: 'btn-cats',
                style: `flex:1; background-color: ${showCategories?'green':'grey'}; color: white; border: none; padding: 5px; cursor: pointer;`,
                onclick: (e) => { 
                    showCategories = !showCategories;
                    showValues = false; 
                    document.getElementById('btn-vals').style.backgroundColor = 'grey';
                    e.target.style.backgroundColor = showCategories?'green':'grey';
                    update3D(); 
                } 
            }),
            el('button', { 
                text: 'Vals', 
                id: 'btn-vals',
                style: `flex:1; background-color: ${showValues?'green':'grey'}; color: white; border: none; padding: 5px; cursor: pointer;`,
                onclick: (e) => { 
                    showValues = !showValues;
                    showCategories = false;
                    document.getElementById('btn-cats').style.backgroundColor = 'grey';
                    e.target.style.backgroundColor = showValues?'green':'grey';
                    update3D(); 
                } 
            })
        ),

        // 7. Grid & Analysis
        el('div', { style: 'display: flex; align-items: center; gap: 5px;' },
            el('label', { text: 'Grid:' }),
            el('select', { 
                id: 'grid-select',
                style: 'flex: 1;',
                onchange: (e) => { gridMode = parseInt(e.target.value); update3D(); }
            },
                el('option', { value: '0', text: 'None', ...(gridMode===0 ? {selected: 'true'} : {}) }),
                el('option', { value: '1', text: 'Orthogonal', ...(gridMode===1 ? {selected: 'true'} : {}) }),
                el('option', { value: '2', text: 'All 26', ...(gridMode===2 ? {selected: 'true'} : {}) })
            ),
            el('button', { 
                text: 'Stat', 
                style: 'flex: 0.5; background-color: navy; color: white; border: none; padding: 3px; cursor: pointer;',
                onclick: () => doStaticEval() 
            }),
            el('button', { 
                text: 'Sort', 
                style: 'flex: 0.5; background-color: navy; color: white; border: none; padding: 3px; cursor: pointer;',
                onclick: () => doListMoves() 
            })
        )
    );

    // --- COLUMN 2: SLICES ---
    const col2 = el('div', { class: 'col-slices' });
    const sliceWidth = 5 * S; 

    ['X', 'Y', 'Z'].forEach(axis => {
        const cvs = el('canvas', { 
            id: `canvas-${axis}`, 
            width: sliceWidth, 
            height: sliceWidth, 
            style: `border: 1px solid #333; background: ${backgroundColor}; display: block; cursor: pointer;`,
            onclick: (e) => handleCanvasClick(e, axis)
        });

        const radioContainer = el('div', { 
            style: `display: flex; justify-content: space-between; width: ${sliceWidth}px; margin-top: 3px;` 
        });
        
        for (let i = 0; i < N; i++) {
            const radio = el('input', { 
                type: 'radio', 
                name: `slice-${axis}`, 
                value: i,
                title: `Index ${i}`,
                style: 'cursor: pointer; margin: 0; padding: 0; transform: scale(0.7);',
                onchange: (e) => {
                    currentSlices[axis] = parseInt(e.target.value);
                    drawSlice(cvs, axis, currentSlices[axis]);
                }
            });
            if (i === currentSlices[axis]) radio.checked = true;
            radioContainer.appendChild(radio);
        }

        col2.appendChild(el('div', { style: `margin-bottom: ${S}px` },
            el('div', { text: `${axis}-Axis`, style: 'text-align: center; font-size: 0.8em; margin-bottom: 2px;' }),
            cvs,
            radioContainer
        ));
    });

    // --- COLUMN 3: 3D VIEW ---
    const col3 = el('div', { class: 'col-3d' },
        el('div', { id: 'view3d-container' })
    );

    root.appendChild(col1);
    root.appendChild(col2);
    root.appendChild(col3);

    updateGameState();
    redrawAllSlices();
    init3D();
}

// --- 6. START THE GAME ---
initGameData();
initLayout();
