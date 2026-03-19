// Three-dimensional Reversi by Peter Alfeld. 
// started 2/15/26
// Players are Red (1) and Green (2). Red starts.
// 3/13/26: 2D added

import * as THREE from 'https://esm.sh/three@0.160.0';
import { TrackballControls } from 'https://esm.sh/three@0.160.0/examples/jsm/controls/TrackballControls';

// Timing parameters:
let tick;
let tock;
let startTime;

// CONFIGURATION & STATE
let redColor = "rgb(255,50,50)";  
let greenColor = "rgb(50,255,50)";
let millTitleColor = "navy";
let scoreBgColor = "#333333";
let eligibleColor = "rgb(255,255,0)"; 
let gridColor = "rgb(255,255,255)";
let playMode = '3D'; // default is 3D
let color2D = "rgb(0,50,50)"; // color for 2D
let color3D = "rgb(0,0,0)";   // Black for 3D
let backgroundColor = color3D; // Starts in 3D mode
let millTitleBg = "#ffffcc";

let S = 43;   
let N = 6;    

let numWorkers = navigator.hardwareConcurrency ? Math.max(1, Math.floor(navigator.hardwareConcurrency * 0.8)) : 4;

let duplicateLogs = true; 

// ENGINE STATE
let engineMode = 'WASM'; 
let wasmModule = null;
let currentAIEpoch = 0; // Tracks resets to kill orphaned workers

// GLOBAL TASK CANCELLATION
let cancelBackgroundTasks = false;
let currentTask = 'NONE'; // 'TOURNEY', 'EVO', or 'NONE'

// WORKER POOL
let workerPool = [];
let activeWorkers = new Set(); // Tracks currently calculating threads

function getWorker() {
    let w = workerPool.length > 0 ? workerPool.pop() : new Worker('ReversiWorker.js');
    activeWorkers.add(w);
    
    // NEW: Send the heavy WASM module ONLY ONCE when the thread is created
    if (!w.hasWasm) {
        w.postMessage({ command: 'init_wasm', wasmModule: wasmModule });
        w.hasWasm = true;
    }
    
    return w;
}

function releaseWorker(worker) {
    worker.onmessage = null; 
    worker.currentResolve = null;
    activeWorkers.delete(worker);
    
    // --- NEW: The Rolling Restart ---
    worker.gamesPlayed = (worker.gamesPlayed || 0) + 1;
    
    if (worker.gamesPlayed >= 50) {
        // Hard flush the fragmented V8 memory back to the OS
        worker.terminate(); 
    } else {
        // Still healthy, put it back in the pool
        workerPool.push(worker); 
    }
}


async function loadWasmEngine() {
    try {
        const response = await fetch('ReversiEngine.wasm');
        if (!response.ok) throw new Error("WASM file not found.");
        const buffer = await response.arrayBuffer();
        wasmModule = await WebAssembly.compile(buffer);
        updateEngineButtonUI();
        log("C++ Engine loaded successfully.");
    } catch(e) {
        console.warn("Could not load ReversiEngine.wasm. Falling back to JS mode.", e);
        engineMode = 'JS';
        updateEngineButtonUI();
        log("JS Engine loaded successfully.");
    }
    log("Ready to Go, \nBoard Size = " +N+"x"+N+"x"+N+".");
    log("Using "+numWorkers+ " of " + navigator.hardwareConcurrency + " available workers");
}
loadWasmEngine(); 

// BRAIN DATA & EVOLUTION
function makeBrain(name, w0, w1, w2, w3, w4, w5, w6, w7, w8, w9) {
    return { name, weights: [w0, w1, w2, w3, w4, w5, w6, w7, w8, w9] };
}

// Normalized to max parameter = 1000

const Bilbo = {
    name: "Bilbo",
    weights: [14, 0, 9, 1000, -1, -7, 94, -3, 5, -1]
};

const Arwen = {
    name: "Arwen",
    weights: [14, 0, 6, 1000, -1, -8, 91, -3, 4, -1]
};

const Dwalin = {
    name: "Dwalin",
    weights: [21, 0, 26, 1000, -8, -21, 75, -6, 5, -2]
};



const Hamfast = {
    name: "Hamfast",
    weights: [84, 0, 17, 1000, -4, -26, 72, -10, 19, -4]
};

const Indis = {
    name: "Indis",
    weights: [9, 0, 16, 1000, -10, -14, 145, -2, 3, -3]
};

const Eowyn = { // 8x8 champion
    name: "Eowyn",
    weights: [369, 0, 57, 1000, -11, -20, 108, -14, 114, -4]
};

const Galadriel = makeBrain("Galadriel", 20, 0, 40, 1000, -10, -20, 100, -5, 10, -2);

const Celebrian = {  // 6x6x6 champion
    name: "Celebrian",
    weights: [14, 0, 9, 1000, -1, -7, 98, -3, 5, -1]
};

const Frodo = { // 4x4x4 champion
    name: "Frodo",
    weights: [15, 0, 22, 1000, -9, -19, 132, -2, 2, -2]
};


let Jolly = makeBrain("Jolly", 1000,0,1000,1000,-1000,-1000,1000,-1000,1000,-1000);

let defaultBrainList = [Arwen, Bilbo, Celebrian, Dwalin, Eowyn, Frodo, Galadriel, Hamfast, Indis, Jolly];
let BrainList = JSON.parse(JSON.stringify(defaultBrainList)); 

let editBrainIndex = 0;
let activeParams = [0, 2, 3, 4, 5, 6, 7, 8, 9]; 

// Player / UI Configuration
let redType = 'Human';   
let greenType = 'Human'; 
let redDepth = 4;        
let greenDepth = 4;
let evalDepth = 4; 
let tGamesVal = 10;
let tDepthVal = 4;
let impGenVal = 1000; 
let impGamesVal = 10; 
let impMutVal = 10;
let silenceMode = true;

// Game State Controls
let isPlaying = false;    
let isAIThinking = false; 
let isGameOver = false;
let unplayedClickCount = 0; 

// Toggles
let usePruning = true;    
let useSymmetry = true;   
let useRandom = true;     
let showDepths = false;   

// 0 = empty, 1 = Red, 2 = Green
let gameCube = []; 
let categoryMap = []; 
let activePlayer = 1; 

let currentSlices = { X: 0, Y: 0, Z: 0 };
let validMoves = []; 
let bestMoves = []; 
let lastMoveRecord = null; 

// History Management
let moveHistory = []; 
let currentMoveIndex = 0; 

// Visualization Settings
let showHints = true;
let showAxes = false; 
let showHover = false;      
let showCategories = false; 
let showValues = false;     
let gridMode = 1; 
let playerBallSize = 0.25; 
let hintBallSize = 0.125; 

// Camera Settings
let cameraPersp, cameraOrtho;
let orthographicMode = false;
let isMajesticRotation = true;

// 3D GLOBAL VARIABLES
let scene, camera, renderer, controls;
let stoneGroup, gridGroup, axesHelper; 
let raycaster, mouse; 
let animationId = null;
let overlay3D = null; 
let hoverTooltip = null; 

// 1. HELPER FUNCTIONS
function el(tag, attrs = {}, ...children) {
    const element = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
        if (key === 'text') element.textContent = value;
        else if (key.startsWith('on') && typeof value === 'function') element.addEventListener(key.substring(2).toLowerCase(), value);
        else if (key === 'style') element.style.cssText = value; 
        else element.setAttribute(key, value);
    }
    children.forEach(child => {
        if (child) element.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    });
    return element;
}

function commas(z) {
    if (isFinite(z)) {
        return z.toLocaleString();
    }
    return z;
}

function log(msg) {
    console.log(msg); 
    if (duplicateLogs) {
	let logDiv = document.getElementById('game-info-log');
	if (logDiv) {
            logDiv.textContent += msg + '\n';
            logDiv.scrollTop = logDiv.scrollHeight; 
	}
    }
}

function techLog(msg) { 
    console.log(msg); 
}

function printToOverlay(msg) {
    if (overlay3D) overlay3D.textContent = msg;
}

function stopTasks() {
    if (currentTask !== 'NONE') {
        cancelBackgroundTasks = true;
        setEngineTaskState('NONE');
        currentAIEpoch++;
        
        // Instantly murder all active workers mid-calculation
        for (let w of activeWorkers) {
            // Send dummy resolution to safely unblock awaiting Promises
            if (w.currentResolve) {
                w.currentResolve({ result: 'cancelled', bestMove: null, maxEval: 0, ranked: [], totalNodes: 0 });
            }
            w.terminate();
        }
        activeWorkers.clear();

	for (let w of workerPool) {
            w.terminate();
        }

        workerPool = []; // Wipe the pool so fresh, untainted workers spawn next time
        
        log("Background tasks manually stopped.");
        updateGameState();
    }
}

function setEngineTaskState(taskName) {
    currentTask = taskName; 

    let btnPlay = document.getElementById('btn-play');
    let btnTourney = document.getElementById('btn-tourney');
    let btnEvolve = document.getElementById('btn-evolve');

    // 1. Manage the Play Button
    if (btnPlay) {
        if (taskName !== 'NONE') {
            btnPlay.disabled = true;
            btnPlay.style.backgroundColor = 'gray';
            btnPlay.style.cursor = 'not-allowed';
            btnPlay.textContent = 'Play';
        } else {
            btnPlay.disabled = isGameOver; 
            btnPlay.style.backgroundColor = isPlaying ? 'orange' : 'green';
            btnPlay.style.cursor = isGameOver ? 'not-allowed' : 'pointer';
            btnPlay.textContent = isPlaying ? 'Playing' : 'Play';
        }
    }

    // 2. Manage the Tournament Button
    if (btnTourney) {
        if (taskName === 'TOURNEY') {
            btnTourney.textContent = 'Stop Tourney';
            btnTourney.style.backgroundColor = 'red';
            btnTourney.disabled = false;
        } else {
            btnTourney.textContent = 'Run Tournament';
            btnTourney.style.backgroundColor = 'orange';
            btnTourney.disabled = (taskName === 'EVO'); // Lock if Evo is running
        }
    }

    // 3. Manage the Evolution Button
    if (btnEvolve) {
        if (taskName === 'EVO') {
            btnEvolve.textContent = 'Stop Evolution';
            btnEvolve.style.backgroundColor = 'red';
            btnEvolve.disabled = false;
        } else {
            btnEvolve.textContent = 'Evolve';
            btnEvolve.style.backgroundColor = 'orange';
            btnEvolve.disabled = (taskName === 'TOURNEY'); // Lock if Tourney is running
        }
    }

    updateGameState(); 
}

function setPlayState(playing) {
    isPlaying = playing;
    if (currentTask === 'NONE') {
        setEngineTaskState('NONE'); // Restores the button appearance cleanly
    }
}

function setupSmartInput(inputEl, validateAndApply) {
    inputEl.dataset.lastValid = inputEl.value;
    inputEl.addEventListener('focus', function() {
        this.dataset.lastValid = this.value;
        this.value = '';
    });
    inputEl.addEventListener('blur', function() {
        if (this.value.trim() === '') this.value = this.dataset.lastValid;
        else {
            let val = parseFloat(this.value);
            if (Number.isFinite(val)) {
                let finalVal = validateAndApply(val);
                if (finalVal !== undefined && finalVal !== null) {
                    this.value = finalVal;
                    this.dataset.lastValid = finalVal;
                }
            } else this.value = this.dataset.lastValid;
        }
    });
    inputEl.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') this.blur();
    });
    return inputEl;
}

// Zero-Allocation Memory Pools for 3D Arrays
let boardPool = [];
function getEmptyBoard() {
    if (boardPool.length > 0) {
        let b = boardPool.pop();
        if (b.length === N) return b; 
    }
    let b = new Array(N);
    for(let x=0; x<N; x++) {
        let col = new Array(N);
        for(let y=0; y<N; y++) col[y] = new Array(N).fill(0);
        b[x] = col;
    }
    return b;
}
function releaseBoard(b) {
    if (b) boardPool.push(b);
}

function cloneBoardPooled(board) {
    let newB = getEmptyBoard();
    for(let x=0; x<N; x++) {
        for(let y=0; y<N; y++) {
            for(let z=0; z<N; z++) newB[x][y][z] = board[x][y][z];
        }
    }
    return newB;
}

function cloneBoard(board) {
    let newB = new Array(N);
    for(let x=0; x<N; x++) {
        let col = new Array(N);
        for(let y=0; y<N; y++) {
            let row = new Array(N);
            for(let z=0; z<N; z++) row[z] = board[x][y][z];
            col[y] = row;
        }
        newB[x] = col;
    }
    return newB;
}

function updateEngineButtonUI() {
    const btn = document.getElementById('engine-toggle-btn');
    if (!btn) return;
    const eng = engineMode === 'WASM' ? (wasmModule ? 'C++' : '...') : 'JS';
    btn.innerHTML = `<h2 style="margin: 0; white-space: nowrap; font-size: 1.2em;">REVERSI V. 11 (${numWorkers} Workers) ${eng}</h2>`;
}

function updateBrainUI() {
    let sel = document.getElementById('editBrainSelect');
    if (sel) {
        sel.innerHTML = '';
        BrainList.forEach((b, i) => sel.appendChild(el('option', {value: i, text: b.name})));
        sel.value = editBrainIndex;
    }
    
    let b = BrainList[editBrainIndex];
    if (b) {
        activeParams.forEach(w => {
            let inp = document.getElementById(`p_W${w}`);
            if (inp) {
                inp.value = b.weights[w];
                inp.dataset.lastValid = b.weights[w];
            }
        });
    }

    let partDiv = document.getElementById('participants');
    if (partDiv) {
        let partHTML = "<table style='border-collapse: collapse; text-align: center; width: 100%; border: none; margin: 0; padding: 0;'>";
        const cbStyle = "cursor: pointer; margin: 0; padding: 0; vertical-align: middle;";
        partHTML += "<tr><td style='padding: 0 2px; font-size: 11px; color: white;'>All</td><td style='padding: 0 2px; font-size: 11px; color: white;'>None</td>";
        for (let i = 0; i < BrainList.length; i++) {
            partHTML += `<td style='padding: 0; font-size: 11px; color: white;' title='Toggle ${BrainList[i].name}'><b>${BrainList[i].name.charAt(0)}</b></td>`;
        }
        partHTML += "</tr><tr>";
        partHTML += `<td style='padding: 0;'><input type='checkbox' id='cb_select_all' title='Select All' style='${cbStyle}'></td>`;
        partHTML += `<td style='padding: 0;'><input type='checkbox' id='cb_select_none' title='Select None' style='${cbStyle}'></td>`;
        for (let i = 0; i < BrainList.length; i++) {
            let existing = document.getElementById('part_checkbox_' + i);
            let isChecked = existing ? existing.checked : true;
            partHTML += `<td style='padding: 0;'><input type='checkbox' id='part_checkbox_${i}' class='tourn-participant' value='${i}' title='Include ${BrainList[i].name} in tournament' ${isChecked ? 'checked' : ''} style='${cbStyle}'></td>`;
        }
        partHTML += "</tr></table>";
        partDiv.innerHTML = partHTML;
        
        document.getElementById('cb_select_all').addEventListener('change', function() {
            if (this.checked) {
                document.getElementById('cb_select_none').checked = false;
                document.querySelectorAll('.tourn-participant').forEach(cb => cb.checked = true);
            }
        });
        document.getElementById('cb_select_none').addEventListener('change', function() {
            if (this.checked) {
                document.getElementById('cb_select_all').checked = false;
                document.querySelectorAll('.tourn-participant').forEach(cb => cb.checked = false);
            }
        });
        document.querySelectorAll('.tourn-participant').forEach(cb => {
            cb.addEventListener('change', function() {
                if (this.checked) document.getElementById('cb_select_none').checked = false;
                else document.getElementById('cb_select_all').checked = false;
            });
        });
    }
    updateTypeSelects();
}

function updateTypeSelects() {
    let rs = document.getElementById('red-type-select');
    let gs = document.getElementById('green-type-select');
    if (!rs || !gs) return;
    
    rs.innerHTML = ''; gs.innerHTML = '';
    
    let optH = el('option', {value: 'Human', text: 'Human'});
    rs.appendChild(optH); gs.appendChild(optH.cloneNode(true));
    
    BrainList.forEach((b, i) => {
        rs.appendChild(el('option', {value: `AI_${i}`, text: `${b.name}`}));
        gs.appendChild(el('option', {value: `AI_${i}`, text: `${b.name}`}));
    });
    
    rs.value = redType; if(rs.selectedIndex < 0) rs.value = 'Human';
    gs.value = greenType; if(gs.selectedIndex < 0) gs.value = 'Human';
}

function exportBrainsJS() {
    let filename = document.getElementById('brainFileName').value || 'brains.js';
    if (!filename.endsWith('.js')) filename += '.js';
    let content = "// Reversi AI Brains\n\n";
    content += "[\n";
    BrainList.forEach((b, i) => {
        content += `    { name: "${b.name}", weights: [${b.weights.join(', ')}] }${i < BrainList.length - 1 ? ',' : ''}\n`;
    });
    content += "]\n";
    let blob = new Blob([content], {type: "text/javascript;charset=utf-8;"});
    let dlAnchorElem = document.createElement('a');
    dlAnchorElem.href = URL.createObjectURL(blob);
    dlAnchorElem.download = filename;
    dlAnchorElem.click();
}

function downloadRevisedBrain(brain) {
let boardDim = playMode === '2D' ? `${N}x${N}` : `${N}x${N}x${N}`;
    
    // 1. Create a descriptive header
    let content = `// Revised Parameters for ${brain.name}\n`;
    content += `// Date: ${new Date().toLocaleString()}\n`;
    content += `// Board Size: ${boardDim}\n`; 
    content += `// Play Mode: ${playMode}\n\n`;
    
    // 2. Format as a clean JS constant
    let cleanConstName = brain.name.replace(/[^a-zA-Z0-9]/g, '');
    content += `const ${cleanConstName} = {\n`;
    content += `    name: "${brain.name}",\n`;
    content += `    weights: [${brain.weights.join(', ')}]\n`;
    content += `};\n`;

    // 3. Generate a descriptive filename
    // Example output: ArwenOpt1_6x6x6.js
    let fileName = `${brain.name}-${boardDim}-${playMode}.js`;

    const blob = new Blob([content], { type: 'text/javascript;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000); 
}

function downloadTournamentResults(scores, headToHead, displayPlayers, gamesPerPair, globalStats) {
    let csv = "Reversi Tournament Results\n";
    csv += "Starting Date:, ";       
    csv += tick.toLocaleString() + "\n";
    tock = new Date();
    csv += "Ending Date:, ";
    csv += tock.toLocaleString() + "\n";
    let boardDim = playMode === '2D' ? `${N}x${N}` : `${N}x${N}x${N}`;
    csv += "Duration:," + `"${commas(tock - tick)} ms"` + "\n";
    csv += "Number of Workers: " + numWorkers +"\n";
    csv += `Board Size,${boardDim}\n`;
    csv += `Play Mode,${playMode}\n`; 
    csv += "Parameters: \n";
    csv += `Games per Pair,${gamesPerPair}\n`;
    csv += `Depth,${tDepthVal}\n\n`;
    
    csv += "Standings\n";
    csv += "Rank,Name,Points,Wins,Losses,Draws\n";
    let ranking = displayPlayers.map(p => {
        let s = scores[p.id];
        return { name: p.name, ...s };
    }).sort((a, b) => b.points - a.points);
    
    ranking.forEach((player, index) => {
        csv += `${index + 1},${player.name},${player.points},${player.wins},${player.losses},${player.draws}\n`;
    });
    csv += "\n";
    
    csv += "Head-to-Head\n";
    let opponentNames = displayPlayers.map(p => p.name).join(",");
    csv += "Row vs Col," + opponentNames + "\n";
    displayPlayers.forEach(p1 => {
        let rowName = p1.name;
        let rowValues = displayPlayers.map(p2 => {
            if (p1.id === p2.id) return "";
            return headToHead[p1.id][p2.id] || 0;
        }).join(",");
        csv += `${rowName},${rowValues}\n`;
    });
    csv += "\n";
    
    csv += "Player Parameters:\n";
    const paramHeaders = ["W0(Mob)", "W1", "W2(Dif)", "W3(Cor)", "W4(C-Sq)", "W5(X-Sq)", "W6(Edg)", "W7(IEd)", "W8(Fac)", "W9(IFa)"];
    csv += "Name," + paramHeaders.join(",") + "\n";
    displayPlayers.forEach(p => {
        let w = p.params.weights;
        csv += `${p.name},${w[0]},${w[1]},${w[2]},${w[3]},${w[4]},${w[5]},${w[6]},${w[7]},${w[8]},${w[9]}\n`;
    });
    csv += "\n";
    
    csv += "Global Color Performance:\n";
    csv += `Red (First Mover) Wins,${globalStats.redWins}\n`;
    csv += `Green (Second Mover) Wins,${globalStats.greenWins}\n`;
    csv += `Total Draws,${globalStats.draws}\n`;
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "ReversiTournamentResults.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// SYMMETRY ENGINE (ROOT FILTERING)
function applySymToCoord(x, y, z, sym) {
    let px = x, py = y, pz = z;
    let perm = sym % 6;
    let inv = Math.floor(sym / 6); 
    if (inv & 1) px = (N - 1) - px;
    if (inv & 2) py = (N - 1) - py;
    if (inv & 4) pz = (N - 1) - pz;
    if (perm === 0) return {x: px, y: py, z: pz};
    if (perm === 1) return {x: px, y: pz, z: py};
    if (perm === 2) return {x: py, y: px, z: pz};
    if (perm === 3) return {x: py, y: pz, z: px};
    if (perm === 4) return {x: pz, y: px, z: py};
    if (perm === 5) return {x: pz, y: py, z: px};
}

function getBoardSymmetries(board) {
    let syms = [];
    for (let sym = 0; sym < 48; sym++) {
        let match = true;
        for (let x = 0; x < N && match; x++) {
            for (let y = 0; y < N && match; y++) {
                for (let z = 0; z < N && match; z++) {
                    let mc = applySymToCoord(x, y, z, sym);
                    if (board[x][y][z] !== board[mc.x][mc.y][mc.z]) match = false;
                }
            }
        }
        if (match) syms.push(sym);
    }
    return syms;
}

function filterSymmetricMoves(board, validMoves) {
    let syms = getBoardSymmetries(board);
    if (syms.length === 1) return validMoves; 
    let uniqueMoves = [];
    for (let m of validMoves) {
        let isRedundant = false;
        for (let um of uniqueMoves) {
            for (let sym of syms) {
                let mapped = applySymToCoord(m.x, m.y, m.z, sym);
                if (mapped.x === um.x && mapped.y === um.y && mapped.z === um.z) {
                    isRedundant = true; break;
                }
            }
            if (isRedundant) break;
        }
        if (!isRedundant) uniqueMoves.push(m);
    }
    return uniqueMoves;
}

// 2. GAME LOGIC

function initGameData() {
    gameCube = new Array(N).fill(0).map(() => new Array(N).fill(0).map(() => new Array(N).fill(0)));
    activePlayer = 1; 

    const mid = (N / 2) - 1;
    // Force the Z-slice to 0 when in 2D mode
    currentSlices = { X: mid, Y: mid, Z: playMode === '2D' ? 0 : mid };

    if (playMode === '3D') {
        const centerIndices = [mid, mid + 1];
        for (let x of centerIndices) {
            for (let y of centerIndices) {
                for (let z of centerIndices) {
                    gameCube[x][y][z] = (x + y + z) % 2 === 0 ? 1 : 2;
                }
            }
        }
    } else {
        // 2D Mode: Setup standard 4 pieces on the z=0 face
        gameCube[mid][mid][0] = 2;             // Green
        gameCube[mid + 1][mid + 1][0] = 2;     // Green
        gameCube[mid][mid + 1][0] = 1;         // Red
        gameCube[mid + 1][mid][0] = 1;         // Red
    }

    initGeometry();
    moveHistory = [];
    lastMoveRecord = null; 
    saveHistoryState(); 
    currentMoveIndex = 0;
    bestMoves = []; 
    isGameOver = false;
    unplayedClickCount = 0;
}

function initGeometry() {
    categoryMap = new Array(N).fill(0).map(() => new Array(N).fill(0).map(() => new Array(N).fill(0)));
    const isEnd = (v) => (v === 0 || v === N - 1);
    const distToCorner = (x, y, z) => {
        let minD = 999;
        const corners = [0, N-1];
        corners.forEach(cx => corners.forEach(cy => corners.forEach(cz => {
            const d = Math.max(Math.abs(x - cx), Math.abs(y - cy), Math.abs(z - cz));
            if (d < minD) minD = d;
        })));
        return minD;
    };
    const isEdge = (x, y, z) => {
        let ends = 0;
        if (isEnd(x)) ends++; if (isEnd(y)) ends++; if (isEnd(z)) ends++;
        return ends === 2;
    };
    const distToEdge = (x, y, z) => {
        let minD = 999;
        for(let i=0; i<N; i++) for(let j=0; j<N; j++) for(let k=0; k<N; k++) {
            if (isEdge(i,j,k)) {
                const d = Math.max(Math.abs(x - i), Math.abs(y - j), Math.abs(z - k));
                if (d < minD) minD = d;
            }
        }
        return minD;
    };
    const distToFace = (x, y, z) => {
        return Math.min(Math.min(x, (N-1) - x), Math.min(y, (N-1) - y), Math.min(z, (N-1) - z));
    };

    for(let x=0; x<N; x++) {
        for(let y=0; y<N; y++) {
            for(let z=0; z<N; z++) {
                let cat = 0; let ends = 0;
                if (isEnd(x)) ends++; if (isEnd(y)) ends++; if (isEnd(z)) ends++;
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
                categoryMap[x][y][z] = cat;
            }
        }
    }
}

function checkDirection(board, x, y, z, dx, dy, dz, player) {
    const opponent = player === 1 ? 2 : 1;
    let i = x + dx, j = y + dy, k = z + dz;
    let foundOpponent = false;
    while (i >= 0 && i < N && j >= 0 && j < N && k >= 0 && k < N) {
        const cell = board[i][j][k];
        if (cell === opponent) foundOpponent = true;
        else if (cell === player) return foundOpponent; 
        else return false;
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
                                isValid = true; break; 
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

function simulateMovePooled(board, move, player) {
    const newBoard = cloneBoardPooled(board);
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

// 3. AI LOGIC (2-PLY WEB WORKER POOL)

async function getBestMoveAI_Async(board, player, depth, activeBrain) {
    const startTime = performance.now();
    let M1 = getValidMovesForPlayer(board, player);
    
    if (M1.length === 0) return { bestMove: null, maxEval: 0, ranked: [], totalNodes: 0 };

    const initialMovesCount = M1.length;
    if (useSymmetry) {
        M1 = filterSymmetricMoves(board, M1);
        if (M1.length < initialMovesCount) {
            techLog(`Symmetry filter: reduced ${initialMovesCount} moves to ${M1.length} unique.`);
        }
    }

    let combinedDepthVisits = {};
    combinedDepthVisits[depth] = 1; 
    let totalNodes = 1;
    
    if (M1.length > 0) {
        combinedDepthVisits[depth - 1] = M1.length;
        totalNodes += M1.length;
    }

    let tasks = [];
    let tempBoards = []; 

    for (let m1 of M1) {
        let b1 = simulateMovePooled(board, m1, player);
        tempBoards.push(b1);
        let opponent = player === 1 ? 2 : 1;
        let M2 = getValidMovesForPlayer(b1, opponent);
        
        if (depth <= 1 || M2.length === 0) {
            let flatB = new Uint8Array(512);
            let n2 = N*N;
            for(let x=0; x<N; x++) for(let y=0; y<N; y++) for(let z=0; z<N; z++) flatB[x*n2+y*N+z] = b1[x][y][z];
            
            tasks.push({
                m1: m1, m2: null, flatBoard: flatB, depthLeft: Math.max(0, depth - 1),
                currentPlayer: (M2.length === 0) ? player : opponent,
                passed: (M2.length === 0)
            });
        } else {
            for (let m2 of M2) {
                let b2 = simulateMovePooled(b1, m2, opponent);
                tempBoards.push(b2);
                
                let flatB = new Uint8Array(512);
                let n2 = N*N;
                for(let x=0; x<N; x++) for(let y=0; y<N; y++) for(let z=0; z<N; z++) flatB[x*n2+y*N+z] = b2[x][y][z];

                tasks.push({
                    m1: m1, m2: m2, flatBoard: flatB, depthLeft: depth - 2,
                    currentPlayer: player, passed: false
                });
            }
        }
    }

    let chunks = Array.from({ length: Math.min(numWorkers, tasks.length) }, () => []);
    tasks.forEach((t, i) => chunks[i % chunks.length].push(t));

    const promises = chunks.map((chunk, i) => {
        return new Promise((resolve) => {
            const worker = getWorker();
            worker.currentResolve = (data) => resolve(data);
            worker.onmessage = function(e) {
                worker.currentResolve = null;
                resolve(e.data);
                releaseWorker(worker);
            };
            worker.postMessage({
                id: i, tasks: chunk, rootPlayerId: player,
                weights: activeBrain.weights, pruning: usePruning, nVal: N,
                engineMode: engineMode
            });
        });
    });

    const resultsArray = await Promise.all(promises);
    
    for(let b of tempBoards) releaseBoard(b);

    let m1Map = new Map(); 

    for (let workerRes of resultsArray) {
        if (workerRes.result === 'cancelled') return { bestMove: null, maxEval: 0, ranked: [], totalNodes: 0 };
        totalNodes += workerRes.totalNodes;
        for (let d in workerRes.depthVisits) {
            combinedDepthVisits[d] = (combinedDepthVisits[d] || 0) + workerRes.depthVisits[d];
        }

        for (let res of workerRes.results) {
            let key = `${res.m1.x},${res.m1.y},${res.m1.z}`;
            if (!m1Map.has(key)) m1Map.set(key, { m1: res.m1, minScore: Infinity });
            if (res.score < m1Map.get(key).minScore) {
                m1Map.get(key).minScore = res.score;
            }
        }
    }

    let ranked = Array.from(m1Map.values()).map(item => ({ move: item.m1, score: item.minScore }));
    ranked.sort((a, b) => b.score - a.score);

    let bestScore = ranked[0].score;
    let bestList = ranked.filter(r => r.score === bestScore);
    let bestMove;

    if (useRandom) {
        bestMove = bestList[Math.floor(Math.random() * bestList.length)].move;
    } else {
        bestList.sort((a,b) => {
            if (a.move.x !== b.move.x) return a.move.x - b.move.x;
            if (a.move.y !== b.move.y) return a.move.y - b.move.y;
            return a.move.z - b.move.z;
        });
        bestMove = bestList[0].move;
    }

    const timeTakenMs = Math.round(performance.now() - startTime);
    techLog(`AI Done: ${commas(totalNodes)} nodes, ${commas(timeTakenMs)}ms, V: ${commas(bestScore)}`);
    
    if (showDepths) {
        techLog(`Depth Visits`);
        for (let i = depth; i >= 0; i--) {
            if (combinedDepthVisits[i] !== undefined) {
                techLog(`Depth ${i}: ${commas(combinedDepthVisits[i])}`);
            }
        }
    }

    return { bestMove, maxEval: bestScore, ranked, totalNodes, timeTakenMs };
}

async function makeAIMove() {
    if (isAIThinking || !isPlaying || isGameOver) return;
    if (currentMoveIndex < moveHistory.length - 1) return;

    let epoch = currentAIEpoch; 
    isAIThinking = true;
    let depth = activePlayer === 1 ? redDepth : greenDepth;
    let pType = activePlayer === 1 ? redType : greenType;
    let bIdx = pType.startsWith('AI') ? parseInt(pType.split('_')[1]) : 0;
    let activeBrain = BrainList[bIdx] || BrainList[0];

    let pName = activePlayer === 1 ? "Red" : "Green";
    log(`${pName} is thinking, depth ${depth}...`);
    
    await new Promise(resolve => setTimeout(resolve, 10)); // Force DOM to paint the log
    
    try {
        const aiResult = await getBestMoveAI_Async(gameCube, activePlayer, depth, activeBrain);
        if (epoch !== currentAIEpoch || cancelBackgroundTasks) {
            return;
        }

        if (!isPlaying || isGameOver) {
            isAIThinking = false;
            return; 
        }
        isAIThinking = false;
        
        if (aiResult.bestMove) {
            executeMove(aiResult.bestMove.x, aiResult.bestMove.y, aiResult.bestMove.z);
        }
    } catch (e) {
        console.error("AI Thread Error:", e);
        if (epoch === currentAIEpoch) isAIThinking = false;
    }
}

// BUTTON HANDLERS
async function doStaticEval() {
    let pType = activePlayer === 1 ? redType : greenType;
    let bIdx = pType.startsWith('AI') ? parseInt(pType.split('_')[1]) : 0;
    const aiResult = await getBestMoveAI_Async(gameCube, activePlayer, evalDepth, BrainList[bIdx]);
    if (!aiResult.bestMove) { log("No moves."); return; }
    let msg = `Eval (D=${evalDepth}): ${commas(aiResult.maxEval)}`;
    log(msg); 
}

async function doListMoves() {
    bestMoves = []; 
    let pType = activePlayer === 1 ? redType : greenType;
    let bIdx = pType.startsWith('AI') ? parseInt(pType.split('_')[1]) : 0;
    const aiResult = await getBestMoveAI_Async(gameCube, activePlayer, evalDepth, BrainList[bIdx]);
    if (!aiResult.bestMove) { log("No moves available."); return; }

    const bestScore = aiResult.maxEval;
    bestMoves = aiResult.ranked.filter(r => r.score === bestScore).map(r => r.move);

    log(`Moves (D=${evalDepth})`);
    aiResult.ranked.forEach(item => {
        const isBest = item.score === bestScore;
        const mark = isBest ? " ★" : "";
        let lineStr = `(${item.move.x},${item.move.y},${item.move.z}) : ${commas(item.score)}${mark}`;
        log(lineStr);
    });
    
    update3D();
    redrawAllSlices();
}

// EVOLUTION: GRADIENT LINE SEARCH
function normalizeBrain(brain) {
    let maxVal = 0;
    for (let i of activeParams) {
        if (Math.abs(brain.weights[i]) > maxVal) {
            maxVal = Math.abs(brain.weights[i]);
        }
    }
    if (maxVal === 0) return;
    let scale = 1000 / maxVal;
    for (let i of activeParams) {
        let val = Math.round(brain.weights[i] * scale);
        if (val === 0) val = Math.random() > 0.5 ? 1 : -1;
        brain.weights[i] = val;
    }
}

function applyVector(base, vec, scale) {
    let newBrain = JSON.parse(JSON.stringify(base));
    
    // 1. Apply the raw mathematical step
    for (let param of activeParams) {
        let delta = vec[param] * scale;
        newBrain.weights[param] = base.weights[param] + delta;
    }
    
    // 2. NEW: Instantly normalize the brain. 
    // This automatically scales it to 1000, rounds it to integers, and prevents zeros.
    normalizeBrain(newBrain);
    
    return newBrain;
}

function isSameBrain(b1, b2) {
    for (let param of activeParams) {
        if (b1.weights[param] !== b2.weights[param]) return false;
    }
    return true;
}

async function playBalancedMatch(bA, bB, gamesPerSide, depth) {
    let aWins = 0, bWins = 0, draws = 0;
    
    if (!silenceMode) {
        // [Keep all of your existing non-silenceMode code exactly as it is here]
        // ...
        
    } else {
        // --- NEW CONTINUOUS DISPATCHER (PUMP) MODEL ---
        await new Promise(resolve => {
            let totalGames = gamesPerSide * 2;
            let gamesStarted = 0;
            let gamesCompleted = 0;
            let activeCount = 0; // Tracks how many workers are currently busy

            function pump() {
                // 1. Exit condition: Are we done or was it cancelled?
                if (cancelBackgroundTasks || gamesCompleted === totalGames) {
                    if (activeCount === 0) resolve();
                    return;
                }

                // 2. Feed available workers until we hit our concurrency limit 
                //    OR we run out of games to start.
                while (gamesStarted < totalGames && activeCount < numWorkers) {
                    let gameIndex = gamesStarted++;
                    activeCount++;

                    // Determine who is Red and who is Green for this specific match
                    let isEven = (gameIndex % 2 === 0);
                    let match_b1 = isEven ? bA : bB;
                    let match_b2 = isEven ? bB : bA;
                    let idx1 = isEven ? 'A' : 'B';
                    let idx2 = isEven ? 'B' : 'A';

                    let worker = getWorker();
                    
                    // Fallback to safely unblock if stopTasks() murders the worker
                    worker.currentResolve = () => {
                        releaseWorker(worker);
                        activeCount--;
                        gamesCompleted++;
                        pump();
                    };

                    worker.onmessage = function(e) {
                        worker.currentResolve = null;
                        let res = e.data;
                        
                        if (res.result === 'match_done') {
                            if (res.winner === 1) {
                                if (idx1 === 'A') aWins++; else bWins++;
                            } else if (res.winner === 2) {
                                if (idx2 === 'A') aWins++; else bWins++;
                            } else draws++;
                        }
                        
                        releaseWorker(worker);
                        activeCount--;
                        gamesCompleted++;
                        
                        // The worker is free! Instantly loop back to give it more work
                        pump(); 
                    };

                    worker.postMessage({
                        command: 'play_match', b1: match_b1, b2: match_b2, 
                        depth1: depth, depth2: depth,
                        nVal: N, engineMode: engineMode,  
                        pruning: usePruning, playMode: playMode 
                    });
                }
            }

            // Ignite the engine
            pump();
        });
        
        // CRITICAL: We NO LONGER terminate the workerPool here!
        // The workers simply go back into the pool, warm and ready for the next phase.
    }
    
    return aWins - bWins;
}

async function runRoundRobin(brains, gamesPerSide, depth) {
    let scores = [0, 0, 0]; 
    for (let i = 0; i < brains.length; i++) {
        for (let j = i + 1; j < brains.length; j++) {
            if (cancelBackgroundTasks) break;
            let netScore = await playBalancedMatch(brains[i], brains[j], gamesPerSide, depth);
            if (netScore > 0) scores[i] += 1;
            else if (netScore < 0) scores[j] += 1;
        }
    }
    if (cancelBackgroundTasks) return 0;
    
    let maxScore = -1;
    let winners = [];
    for (let i = 0; i < brains.length; i++) {
        if (scores[i] > maxScore) { maxScore = scores[i]; winners = [i]; }
        else if (scores[i] === maxScore) { winners.push(i); }
    }
    if (winners.length === 1) return winners[0];
    
    log(`Tie detected. Rematch...`);
    scores = [0, 0, 0];
    for (let i = 0; i < winners.length; i++) {
        for (let j = i + 1; j < winners.length; j++) {
            if (cancelBackgroundTasks) break;
            let p1 = winners[i], p2 = winners[j];
            let netScore = await playBalancedMatch(brains[p1], brains[p2], 1, depth);
            if (netScore > 0) scores[p1] += 1;
            else if (netScore < 0) scores[p2] += 1;
        }
    }
    maxScore = -999;
    let finalWinners = [];
    for (let idx of winners) {
        if (scores[idx] > maxScore) { maxScore = scores[idx]; finalWinners = [idx]; }
        else if (scores[idx] === maxScore) { finalWinners.push(idx); }
    }
    if (finalWinners.length === 1) return finalWinners[0];
    
    // Priority: Center > Forward > Backward
    if (finalWinners.includes(1)) return 1;
    if (finalWinners.includes(0)) return 0;
    return finalWinners[0];
}

async function performLineSearch(originBrain, firstStepBrain, gamesPerSide, depth) {
    let V = {};
    for (let p of activeParams) {
        V[p] = firstStepBrain.weights[p] - originBrain.weights[p];
    }
    
    let X = JSON.parse(JSON.stringify(firstStepBrain)); 
    let expanding = true;
    let iterations = 0;

    while (iterations < 30) {
        if (cancelBackgroundTasks) break;
        iterations++;

        let A = applyVector(X, V, 1.0);
        let B = applyVector(X, V, -1.0);

        // CONVERGENCE CHECK
        if (isSameBrain(X, A) && isSameBrain(X, B)) {
            log(`Line Search converged at integer peak in ${iterations} steps.`);
            break;
        }

        log(`LS ${iterations}: Testing Triplet {A, X, B}...`);
        
        let Step = "Step = ";
        for(let p of activeParams) {Step += V[p] +" ";}
        log(Step);

        // 1. A vs X
        let scoreAX = await playBalancedMatch(A, X, gamesPerSide, depth);
        if (scoreAX === 0 && !cancelBackgroundTasks) {
            log("--> Draw (A vs X). Retrying...");
            scoreAX = await playBalancedMatch(A, X, gamesPerSide, depth);
        }
        if (cancelBackgroundTasks) break;

        // 2. B vs X
        let scoreBX = await playBalancedMatch(B, X, gamesPerSide, depth);
        if (scoreBX === 0 && !cancelBackgroundTasks) {
            log("--> Draw (B vs X). Retrying...");
            scoreBX = await playBalancedMatch(B, X, gamesPerSide, depth);
        }
        if (cancelBackgroundTasks) break;

        // LOGIC ENGINE
        if (scoreAX === 0 && scoreBX === 0) {
            log("--> Double Draw. Terminating.");
            break;
        }

        if (scoreAX <= 0 && scoreBX <= 0) {
            // X is best
            expanding = false;
            for(let p of activeParams) V[p] = (V[p] > 0) ? Math.floor(V[p] / 2) : Math.ceil(V[p] / 2);
            log("--> X is best. Halving step.");
        } else if (scoreAX > scoreBX && scoreAX > 0) {
            // A is better
            X = A;
            if (expanding) {
                for(let p of activeParams) V[p] *= 2;
                log("--> A is winner. Doubling step.");
            } else {
                for(let p of activeParams) V[p] = V[p] = (V[p] > 0) ? Math.floor(V[p] / 2) : Math.ceil(V[p] / 2);
                log("--> A is winner. Halving step.");
            }
        } else if (scoreBX > scoreAX && scoreBX > 0) {
            // B is better
            X = B;
            expanding = false;
            for(let p of activeParams) V[p] = V[p] = (V[p] > 0) ? Math.floor(V[p] / 2) : Math.ceil(V[p] / 2);
            log("--> B is winner. Reversing/Halving step.");
        } else {
            // Anomaly: A and B both > X
            log("--> Non-convex result. Tie-break A vs B.");
            let scoreAB = await playBalancedMatch(A, B, gamesPerSide, depth);
            X = (scoreAB >= 0) ? A : B;
            expanding = false;
            for(let p of activeParams) V[p] = V[p] = (V[p] > 0) ? Math.floor(V[p] / 2) : Math.ceil(V[p] / 2);
        }
    }
    return X;
}

async function runTournament() {
    tick = new Date();
    setEngineTaskState('TOURNEY');
    cancelBackgroundTasks = false;
    
    let checks = Array.from(document.querySelectorAll('.tourn-participant:checked'));
    let displayPlayers = [];
    let pIndices = [];
    let queue = [];
    let globalStats = { redWins: 0, greenWins: 0, draws: 0 };
    
    // 1. Build the list of participants
    if (checks.length === 0) {
        let rIdx = redType.startsWith('AI_') ? parseInt(redType.split('_')[1]) : 0;
        let gIdx = greenType.startsWith('AI_') ? parseInt(greenType.split('_')[1]) : 0;
        displayPlayers = [
            { id: 0, name: BrainList[rIdx].name, params: BrainList[rIdx], depth: redDepth },
            { id: 1, name: BrainList[gIdx].name, params: BrainList[gIdx], depth: greenDepth }
        ];
        pIndices = [0, 1];
    } else if (checks.length < 2) { 
        log("Need at least 2 participants."); 
        setEngineTaskState('NONE');
        return; 
    } else {
        pIndices = checks.map(c => parseInt(c.value));
        displayPlayers = pIndices.map(i => ({ id: i, name: BrainList[i].name, params: BrainList[i], depth: tDepthVal }));
    }

    // 2. Build the Match Queue
    for (let i = 0; i < pIndices.length; i++) {
        for (let j = i + 1; j < pIndices.length; j++) {
            let p1 = displayPlayers.find(p => p.id === pIndices[i]);
            let p2 = displayPlayers.find(p => p.id === pIndices[j]);
            for (let g = 0; g < tGamesVal; g++) {
                // Ensure balanced starts: alternate who is Red/Green
                if (g % 2 === 0) queue.push({ b1: p1.params, d1: p1.depth, idx1: p1.id, name1: p1.name, b2: p2.params, d2: p2.depth, idx2: p2.id, name2: p2.name });
                else queue.push({ b1: p2.params, d1: p2.depth, idx1: p2.id, name1: p2.name, b2: p1.params, d2: p1.depth, idx2: p1.id, name2: p1.name });
            }
        }
    }

    let scores = {};
    let headToHead = {};
    pIndices.forEach(i => {
        scores[i] = { wins: 0, losses: 0, draws: 0, points: 0 };
        headToHead[i] = {};
        pIndices.forEach(j => headToHead[i][j] = 0);
    });

    log(`Tournament Start (${queue.length} matches)`);
    let resultsProcessed = 0;
    let totalMatches = queue.length;

    // 3. The Continuous Dispatcher Pump
    await new Promise(resolve => {
        let gamesStarted = 0;
        let gamesCompleted = 0;
        let activeCount = 0;

        function pump() {
            if (cancelBackgroundTasks || gamesCompleted === totalMatches) {
                if (activeCount === 0) resolve();
                return;
            }

            while (gamesStarted < totalMatches && activeCount < numWorkers) {
                let match = queue[gamesStarted++];
                activeCount++;
                let worker = getWorker();

                worker.currentResolve = () => {
                    releaseWorker(worker);
                    activeCount--;
                    gamesCompleted++;
                    pump();
                };

                worker.onmessage = function(e) {
                    worker.currentResolve = null;
                    let res = e.data;
                    if (res.result === 'match_done') {
                        let winner = res.winner;
                        if (winner === 1) {
                            globalStats.redWins++;
                            scores[match.idx1].wins++; scores[match.idx1].points += 1;
                            scores[match.idx2].losses++; scores[match.idx2].points -= 1;
                            headToHead[match.idx1][match.idx2] += 1;
                            headToHead[match.idx2][match.idx1] -= 1;
                        } else if (winner === 2) {
                            globalStats.greenWins++;
                            scores[match.idx2].wins++; scores[match.idx2].points += 1;
                            scores[match.idx1].losses++; scores[match.idx1].points -= 1;
                            headToHead[match.idx2][match.idx1] += 1;
                            headToHead[match.idx1][match.idx2] -= 1;
                        } else {
                            globalStats.draws++;
                            scores[match.idx1].draws++;
                            scores[match.idx2].draws++;
                        }
                        resultsProcessed++;
                        if (!silenceMode) {
                            let resultText = winner === 0 ? "Draw" : (winner === 1 ? `${match.name1} wins` : `${match.name2} wins`);
                            log(`Game ${resultsProcessed}/${totalMatches}: ${match.name1} vs ${match.name2} -> ${resultText}`);
                        }
                    }
                    releaseWorker(worker);
                    activeCount--;
                    gamesCompleted++;
                    pump();
                };

                worker.postMessage({
                    command: 'play_match', b1: match.b1, b2: match.b2, 
                    depth1: match.d1, depth2: match.d2,
                    nVal: N, engineMode: engineMode, pruning: usePruning, playMode: playMode 
                });
            }
        }
        pump();
    });

    if (cancelBackgroundTasks) {
        log("Tournament cancelled by user.");
    } else {
        log(`Tournament Done! Red: ${globalStats.redWins} | Green: ${globalStats.greenWins} | Draws: ${globalStats.draws}`);
        downloadTournamentResults(scores, headToHead, displayPlayers, tGamesVal, globalStats);
    }
    setEngineTaskState('NONE');
}

async function runImprovement() {
    setEngineTaskState('EVO');
    cancelBackgroundTasks = false;
    
    let brainIndex = editBrainIndex;
    
    // 1. The baseline we MUST beat to prove ultimate superiority
    let absoluteOriginalBrain = JSON.parse(JSON.stringify(BrainList[brainIndex]));
    // 2. The active parent we mutate from
    let baseBrain = JSON.parse(JSON.stringify(absoluteOriginalBrain));
    
    normalizeBrain(baseBrain); 
    let depth = tDepthVal;
    
    log(`EVOLUTION START: ${baseBrain.name}`);
    let successes = 0;
    let currentRate = impMutVal;
    
    let bestGauntletScore = 0;
    let gauntletMultiplier = 10; // NEW: dynamic multiplier
    
    for (let g = 0; g < impGenVal; g++) {
        if (cancelBackgroundTasks) break;
        log(`Gen ${g+1}/${impGenVal} (Rate: ${Math.round(currentRate)}%)`);
        
        let mutant = JSON.parse(JSON.stringify(baseBrain));
        mutant.name = baseBrain.name + `G${g+1}`;
        
        let changed = false;
        for (let i of activeParams) {
            let noise = (Math.random() * 2) - 1; 
            let change = mutant.weights[i] * (currentRate / 100) * noise;
            if (Math.abs(change) > 1.0) {
                changed = true;
            }
            mutant.weights[i] = Math.round(mutant.weights[i] + change);
            if (mutant.weights[i] === 0) mutant.weights[i] = Math.random() > 0.5 ? 1 : -1;
        }
        if (!changed) continue; 
        
        // 1. Fast Scouting Test against CURRENT parent
        let netScore = await playBalancedMatch(mutant, baseBrain, impGamesVal, depth);
        if (cancelBackgroundTasks) break;
        
        if (netScore > 0) {
            log(`Gen ${g+1}: Scout Hit! (+${netScore} vs Parent). Line Search...`);
            let optimized = await performLineSearch(baseBrain, mutant, impGamesVal, depth);
            if (cancelBackgroundTasks) break;
            
            normalizeBrain(optimized); 
            
            // 2. The Verification Gauntlet against the BASELINE
            let vGames = impGamesVal * gauntletMultiplier; 
            log(`Line Search done. Gauntlet against BASELINE (${vGames} pairs)...`);
            let vScore = await playBalancedMatch(optimized, absoluteOriginalBrain, vGames, depth);
            
            if (cancelBackgroundTasks) break;

            // Calculate the absolute maximum possible score (a perfect sweep)
            let maxPossibleScore = vGames * 2;

            // 3. Strict acceptance
            if (vScore > bestGauntletScore) {
                successes++;
                bestGauntletScore = vScore; 
                
                let baseName = absoluteOriginalBrain.name.replace(/Opt\d+$/, "");
                baseBrain = optimized; 
                baseBrain.name = `${baseName}Opt${successes}`;
                
                BrainList[brainIndex] = JSON.parse(JSON.stringify(baseBrain)); 
                updateBrainUI();
                downloadRevisedBrain(baseBrain);
                
                log(`VERIFIED! New High Score vs Baseline: +${vScore}! Crowned ${baseBrain.name}.`);

                // --- NEW: THE CEILING BREAKER ---
                // If the mutant achieved a perfect sweep, the baseline is obsolete.
                if (vScore === maxPossibleScore) {
                    log(`PERFECT SWEEP DETECTED! The baseline brain is completely outclassed.`);
                    gauntletMultiplier *= 2; // Double the game volume as requested
                    absoluteOriginalBrain = JSON.parse(JSON.stringify(baseBrain)); // Set new baseline
                    bestGauntletScore = 0; // Reset the high score
                    log(`--> Doubled Gauntlet to ${gauntletMultiplier}x. Setting ${baseBrain.name} as the new baseline!`);
                }

            } else {
                log(`REJECTED! Score +${vScore} vs Baseline failed to beat the record (+${bestGauntletScore}).`);
            }
        }
    }
    if (cancelBackgroundTasks) {
        log("Evolution cancelled by user.");
    } else {
        log(`EVOLUTION DONE (${successes} upgrades)`);
    }
    setEngineTaskState('NONE');
}

function triggerBlink() {
    let el = document.getElementById('press-play-msg');
    if (!el) return;
    let blinks = 0;
    let iv = setInterval(() => {
        if(!el) { clearInterval(iv); return; }
        el.style.visibility = (el.style.visibility === 'hidden') ? 'visible' : 'hidden';
        blinks++;
        if(blinks >= 10) { clearInterval(iv); el.style.visibility = 'visible'; }
    }, 200);
}

function handleBoardClick() {
    // If a background task is running, ignore clicks entirely
    if (currentTask !== 'NONE') return true;

    if (!isPlaying && !isGameOver) { 
        if (currentMoveIndex === 0) {
            
            // --- NEW: Change the text instantly on click ---
            let msgEl = document.getElementById('press-play-msg');
            if (msgEl) msgEl.textContent = "Press Play to Start!";
            
            unplayedClickCount++;
            if (unplayedClickCount > 1) triggerBlink();
        }
        log("Press Play to start."); 
        return true; 
    }
    return false;
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
    case '2':
        // Toggle 2D/3D mode
        playMode = playMode === '2D' ? '3D' : '2D';
        backgroundColor = playMode === '2D' ? color2D : color3D;
        activeParams = playMode === '2D' ? [0, 2, 3, 4, 5, 6, 7, 8] : [0, 2, 3, 4, 5, 6, 7, 8, 9];
        resetGame(); 
        initLayout(); 
        break;
    case '4': case '6': case '8':
        N = parseInt(e.key);
        if(document.getElementById('size-select')) document.getElementById('size-select').value = N;
        resetGame();
        initLayout(); 
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
    case 's':
    case 'S':
        doStaticEval();
        break;
    case 'm':
    case 'M':
        doListMoves();
        break;
    case 'w':
    case 'W':
        isMajesticRotation = !isMajesticRotation;
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
    case 'p':
    case 'P':
        if (currentTask !== 'NONE') {
            stopTasks();
            setPlayState(true);
            updateGameState();
        } else {
            if (isGameOver) break;
            setPlayState(!isPlaying);
            if (isPlaying) updateGameState();
        }
        break;
    case 'r':
    case 'R':
        resetGame();
        break;
    case '.':
    case '?':
        if (overlay3D.textContent.trim() !== "") {
            printToOverlay("");
        } else {
            printToOverlay(
		`Commands:
2       : switch to 2D mode
4, 6, 8 : Set board size
a       : Cycle grid mode
A       : Toggle Axes
c       : Toggle Categories
v       : Toggle Clues (Values)
S / s   : Compute Static Value
M / m   : List sorted Moves
w / W   : Toggle Majestic Movement
B / b   : Increase/Decrease Player ball size
H / h   : Increase/Decrease Hint ball size
< / >   : History back/forward
p       : Play / Stop
r       : Reset game
F / f   : Toggle Fullscreen
I / i   : Toggle Infinity (Orthographic) mode
. / ?   : Toggle this help display
Esc/Spc : Exit Fullscreen`);
        }
        break;
    }
});

// STATE MANAGEMENT

function saveHistoryState() {
    const cubeCopy = cloneBoard(gameCube);
    if (currentMoveIndex < moveHistory.length - 1) {
        moveHistory = moveHistory.slice(0, currentMoveIndex + 1);
    }
    moveHistory.push({ 
        cube: cubeCopy, 
        player: activePlayer,
        lastMove: lastMoveRecord
    });
    currentMoveIndex = moveHistory.length - 1;
    updateNavUI();
}

function loadHistoryState(index) {
    if (index < 0 || index >= moveHistory.length || isAIThinking) return;
    currentMoveIndex = index;
    const state = moveHistory[index];
    gameCube = cloneBoard(state.cube);
    activePlayer = state.player;
    lastMoveRecord = state.lastMove || null; 
    
    if (currentMoveIndex < moveHistory.length - 1 && isPlaying) {
        setPlayState(false);
    }
    
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
    // 1. Stop any background work first
    if (currentTask !== 'NONE') {
        stopTasks();
    }
    
    // 2. CRITICAL: Initialize the board data for the NEW N immediately
    // This builds the gameCube array to the correct size
    initGameData();

    // 3. Now it is safe to reset states and update the UI
    currentAIEpoch++; 
    isAIThinking = false;
    setPlayState(false); 
    isGameOver = false;
    unplayedClickCount = 0;
    // Unlock the Play button in case it was disabled by Game Over
    const btnPlay = document.getElementById('btn-play');
    if (btnPlay) btnPlay.disabled = false;
    
    updateGameState(); 
    redrawAllSlices();
    update3D(); 
    log("Board reset, N= " + N + ".");
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
    const scores = getScores();
    const headerDiv = document.getElementById('game-score-header');
    let winnerText = "";

    // Determine Game Over
    if (!isViewOnly && !isGameOver && validMoves.length === 0 && currentMoveIndex === moveHistory.length - 1) {
        const opponent = activePlayer === 1 ? 2 : 1;
        const opponentMoves = getValidMovesForPlayer(gameCube, opponent);

        if (opponentMoves.length === 0) {
            isGameOver = true;
            setPlayState(false);
            if (scores.red > scores.green) winnerText = "RED WINS!";
            else if (scores.green > scores.red) winnerText = "GREEN WINS!";
            else winnerText = "DRAW!";
            log(`GAME OVER: ${winnerText}`);
            
	    const btnPlay = document.getElementById('btn-play');
            if (btnPlay) {
                btnPlay.textContent = 'Game Over';
                btnPlay.style.backgroundColor = 'gray';
                btnPlay.style.fontSize = '14px'; // Shrinks the text to fit
                btnPlay.style.whiteSpace = 'nowrap'; // Prevents text from wrapping to a new line
                btnPlay.disabled = true; 
            }

        } else {
            const pName = activePlayer === 1 ? "Red" : "Green";
            log(`${pName} has no moves. Passing...`);
            activePlayer = opponent;
            saveHistoryState();
            updateGameState();
            return; 
        }
    }

    // Output UI HTML
    if (headerDiv) {
        const pName = activePlayer === 1 ? "Red" : "Green";
        const color = activePlayer === 1 ? redColor : greenColor;
        let html = "";

        // 1. MASTER GUARD: If a task is active, ONLY show the task message.
        // We remove !isPlaying because background matches toggle isPlaying to true.
        if (currentTask !== 'NONE') {
            let msg = currentTask === 'TOURNEY' ? 'Running Tournament...' : 'Running Evolution...';
            html = `
                <div style="font-size: 1.2em; font-weight: bold; color: orange; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%;">
                    <div>${msg}</div>
                    <div style="font-size: 0.75em; color: yellow; margin-top: 4px;">Press Reset to stop</div>
                </div>`;
        } 
        // 2. IDLE GUARD: Only show "Press Play" if NO task is running and we are at the start.
        else if (currentTask === 'NONE' && currentMoveIndex === 0 && !isPlaying && !isGameOver) {
            html = `<div id="press-play-msg" style="font-size: 1.3em; font-weight: bold; color: magenta; display: flex; align-items: center; justify-content: center; height: 100%;">Ready to Go!</div>`;
        } 
        // 3. DEFAULT: Standard Gameplay UI.
        else {
            let lastMoveHtml = "";
            if (lastMoveRecord) {
                const lmColor = lastMoveRecord.player === 1 ? redColor : greenColor;
                lastMoveHtml = `<span style="color: ${lmColor};">(${lastMoveRecord.x}, ${lastMoveRecord.y}, ${lastMoveRecord.z})</span>`;
            }
            let line2 = isGameOver ? `<span style="color: ${scores.red>scores.green?redColor:(scores.green>scores.red?greenColor:'white')}; font-weight:bold;">${winnerText}</span>` : lastMoveHtml;
            html = `
                <div style="font-size: 1.1em; font-weight: bold; white-space: nowrap; margin-bottom: 2px;">
                    <span style="color:${color};">${pName}</span>
                    <span>&nbsp;&nbsp;</span>
                    <span style="color: ${redColor};">${scores.red}</span>
                    <span style="color: white;">&nbsp;|&nbsp;</span>
                    <span style="color: ${greenColor};">${scores.green}</span>
                </div>
                <div style="font-size: 0.95em; font-weight: bold; white-space: nowrap;">${line2}</div>
            `;
        }
        headerDiv.innerHTML = html;
    }
    
    // Defer AI trigger to prevent locking UI thread / memory exhaustion
    if (!isViewOnly && !isGameOver && validMoves.length > 0 && currentMoveIndex === moveHistory.length - 1) {
        let pType = activePlayer === 1 ? redType : greenType;
        if (isPlaying && pType.startsWith('AI') && !isAIThinking) {
            setTimeout(makeAIMove, 50);
        }
    }
}

function executeMove(x, y, z) {
    if (showCategories || showValues) return; 

    if (currentMoveIndex < moveHistory.length - 1) {
        moveHistory = moveHistory.slice(0, currentMoveIndex + 1);
    }

    lastMoveRecord = { player: activePlayer, x: x, y: y, z: z };
    gameCube[x][y][z] = activePlayer;
    bestMoves = []; 
    
    const pName = activePlayer === 1 ? "Red" : "Green";
    log(`${pName} to (${x},${y},${z})`);

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

// 4. 2D DRAWING

function drawSlice(canvas, axis, sliceIndex) {
    const ctx = canvas.getContext('2d');
    const size = canvas.width; 
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, size, size);

    // --- NEW: Margin for axis scales ---
    const margin = 24; 
    const boardSize = size - margin;
    const step = boardSize / N; 
    const offset = margin + step / 2;

    // Draw axis scales
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Determine correct axis labels for the current slice
    let hAxis, vAxis;
    if (axis === 'X') { hAxis = 'Y'; vAxis = 'Z'; }
    else if (axis === 'Y') { hAxis = 'X'; vAxis = 'Z'; }
    else { hAxis = 'X'; vAxis = 'Y'; }

    // Top-left corner axis labels
    ctx.font = '10px sans-serif';
    ctx.fillText(`${vAxis} \\ ${hAxis}`, margin / 2, margin / 2);

    ctx.font = '12px sans-serif';
    // Draw horizontal numbers (1 to N)
    for (let i = 0; i < N; i++) {
        ctx.fillText((i + 1).toString(), offset + (i * step), margin / 2);
    }
    // Draw vertical numbers (1 to N)
    for (let j = 0; j < N; j++) {
        ctx.fillText((j + 1).toString(), margin / 2, offset + (j * step));
    }

    // Preserve original wireframe grid style
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    
    const lineStart = offset;
    const lineEnd = margin + boardSize - step / 2;

    for (let i = 0; i < N; i++) {
        const pos = offset + (i * step);
        ctx.moveTo(pos, lineStart); ctx.lineTo(pos, lineEnd);
        ctx.moveTo(lineStart, pos); ctx.lineTo(lineEnd, pos);
    }
    ctx.stroke();

    // Draw pieces and hints
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
    if (handleBoardClick()) return; 
    if (isAIThinking) return;

    const rect = event.target.getBoundingClientRect();
    const size = event.target.width;
    
    // --- NEW: Adjust math for the axis margin ---
    const margin = 24; 
    const boardSize = size - margin;
    const step = boardSize / N; 
    
    // Offset raw click coordinates by the margin
    const clickX = event.clientX - rect.left - margin;
    const clickY = event.clientY - rect.top - margin;

    // Ignore clicks inside the margin (scales) or out of bounds
    if (clickX < 0 || clickY < 0 || clickX > boardSize || clickY > boardSize) return;

    // Map click to grid index
    const i = Math.floor(clickX / step);
    const j = Math.floor(clickY / step);

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
    
    // Also target the large 2D board if it exists
    const canvas2D = document.getElementById('canvas-Z-2D');
    if (canvas2D) {
        drawSlice(canvas2D, 'Z', currentSlices['Z']);
    }
}

// 5. 3D LOGIC (Three.js)

function init3D() {
    const container = document.getElementById('view3d-container');
    container.style.position = 'relative'; 
    const size = 23 * S;

    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }

    if (!renderer) {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.domElement.addEventListener('mousemove', on3DMouseMove);
        renderer.domElement.addEventListener('click', on3DClick);

        // NEW: Stop the majestic rotation only on left-click
        const stopRotation = (e) => { 
            if (e.button === 0) isMajesticRotation = false; // 0 is left-click
        };
        renderer.domElement.addEventListener('pointerdown', stopRotation, { passive: true });
    }

    renderer.setSize(size, size);
    if (!container.contains(renderer.domElement)) {
        container.appendChild(renderer.domElement);
    }

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

    if (overlay3D) overlay3D.remove();
    overlay3D = document.createElement('div');
    overlay3D.style.cssText = 'position: absolute; top: 10px; left: 10px; color: white; font-family: monospace; font-size: 16px; pointer-events: none; z-index: 10; text-shadow: 1px 1px 2px #000; white-space: pre-wrap;';
    container.appendChild(overlay3D);
    
    if (hoverTooltip) hoverTooltip.remove();
    hoverTooltip = document.createElement('div');
    hoverTooltip.style.cssText = 'position: absolute; background: rgba(0,0,0,0.8); color: white; padding: 3px 6px; border-radius: 4px; pointer-events: none; display: none; font-family: monospace; font-size: 14px; z-index: 100; font-weight: bold; border: 1px solid white;';
    document.body.appendChild(hoverTooltip); 
    
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
    if (!animationId) animate();
    update3D();
}

function update3DGrid() {
    while(gridGroup.children.length > 0) {
        let child = gridGroup.children[0];
        gridGroup.remove(child);
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
    }
    if (gridMode === 0) return; 
    const material = new THREE.LineBasicMaterial({ color: "rgb(150,200,255)", transparent: true, opacity: 0.8 });
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

    while(stoneGroup.children.length > 0) {
        let child = stoneGroup.children[0];
        stoneGroup.remove(child);
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
            if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
            else child.material.dispose();
        }
    }

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
                    mesh.userData = { isHint: false, x:x, y:y, z:z }; 
                    stoneGroup.add(mesh);
                }
            }
        }
        return; 
    }

if (showValues) {
        const debugGeo = new THREE.SphereGeometry(0.12, 16, 16);
        
        // --- NEW: Grab the brain currently selected in the UI ---
        const inspectBrain = BrainList[editBrainIndex] || BrainList[0];

        for(let x=0; x<N; x++) {
            for(let y=0; y<N; y++) {
                for(let z=0; z<N; z++) {
                    const cat = categoryMap[x][y][z];
                    
                    // --- CHANGED: Read from inspectBrain instead of currentBrain ---
                    const weight = inspectBrain.weights[cat] || 0;
                    
                    let col = 0x888888;
                    if (weight > 0) {
                        if (weight >= 500) col = 0xFFD700; // Gold for high value
                        else col = 0x00FF00;               // Green for positive
                    } else if (weight < 0) col = 0xFF0000; // Red for negative

                    const mat = new THREE.MeshStandardMaterial({ 
                        color: col, roughness: 0.4, metalness: 0.1, transparent: true, opacity: 0.6
                    });
                    const mesh = new THREE.Mesh(debugGeo, mat);
                    mesh.position.set(x,y,z);
                    mesh.userData = { isHint: false, x:x, y:y, z:z }; 
                    stoneGroup.add(mesh);
                }
            }
        }
        return;
    }

    const redMat = new THREE.MeshStandardMaterial({ color: 0xff3333, roughness: 0.2, metalness: 0.1 });
    const greenMat = new THREE.MeshStandardMaterial({ color: 0x33ff33, roughness: 0.2, metalness: 0.1 });
    const hintColorHex = (activePlayer === 1) ? 0x7f0000 : 0x007f00;
    const hintMat = new THREE.MeshStandardMaterial({ color: hintColorHex, transparent: true, opacity: 0.8, roughness: 0.2 });

    for(let x=0; x<N; x++) {
        for(let y=0; y<N; y++) {
            for(let z=0; z<N; z++) {
                const val = gameCube[x][y][z];
                if (val !== 0) {
                    const mesh = new THREE.Mesh(stoneGeo, val === 1 ? redMat : greenMat);
                    mesh.position.set(x, y, z);
                    mesh.userData = { isHint: false, x: x, y: y, z: z };
                    stoneGroup.add(mesh);
                }
            }
        }
    }

    if (showHints && !isAIThinking) {
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

function on3DMouseMove(event) {
    if (!showHover || !hoverTooltip) {
        if (hoverTooltip) hoverTooltip.style.display = 'none';
        return;
    }

    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(stoneGroup.children);

    if (intersects.length > 0) {
        const obj = intersects[0].object;
        const {x, y, z} = obj.userData;
        if (x !== undefined) {
            hoverTooltip.textContent = `(${x}, ${y}, ${z})`;
            hoverTooltip.style.display = 'block';
            hoverTooltip.style.left = (event.clientX + 15) + 'px';
            hoverTooltip.style.top = (event.clientY + 15) + 'px';
        }
    } else hoverTooltip.style.display = 'none';
}

function on3DClick(event) {
    if (handleBoardClick()) return; 
    if (isAIThinking) return;

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

    // NEW: Complex 3D cinematic orbit using a Lissajous curve
    if (isMajesticRotation && playMode === '3D') {
        const time = Date.now() * 0.0004; // Master speed control
        const radius = N * 2.0; // Distance from the center
        
        // Different frequency multipliers (0.7, 0.3, 0.5) create a sweeping, 
        // non-repeating 3D flight path around all axes.
        camera.position.x = Math.sin(time * 0.7) * radius;
        
        // We dampen the Y-axis slightly (* 0.8) so the camera doesn't fly 
        // perfectly top-down or bottom-up, which can flip the 'up' vector
        camera.position.y = Math.sin(time * 0.3) * (radius * 0.8); 
        
        camera.position.z = Math.cos(time * 0.5) * radius;
        
        camera.lookAt(0, 0, 0); // Keep the lens locked exactly on the center
    }

    renderer.render(scene, camera);
}

// 6. UI LAYOUT

function initLayout() {
    if (gameCube.length !== N) initGameData();

    let fileInp = document.getElementById('brainFileInput');
    if (!fileInp) {
        fileInp = el('input', { type: 'file', id: 'brainFileInput', style: 'display: none;', accept: '.js,.json' });
        document.body.appendChild(fileInp);
    }
    fileInp.onchange = (e) => {
        let file = e.target.files[0];
        if (!file) return;
        let reader = new FileReader();
        reader.onload = function(evt) {
            try {
                let text = evt.target.result;
                let match = text.match(/\[[\s\S]*\]/); 
                if (match) {
                    let parsed = eval(match[0]);
                    if (Array.isArray(parsed)) {
                        BrainList = parsed;
                        editBrainIndex = 0;
                        updateBrainUI();
                        log("Brains imported successfully.");
                    }
                }
            } catch (err) {
                log("Failed to parse file.");
            }
        };
        reader.readAsText(file);
        e.target.value = ''; 
    };

    const root = document.getElementById('gameTable');
    if (!root) return;
    root.innerHTML = '';

    root.style.display = 'flex';
    root.style.flexDirection = 'row';
    root.style.gap = '2px'; 
    root.style.padding = '2px';
    root.style.fontFamily = 'sans-serif';

    let scaleInput = el('input', { type: 'text', value: S, title: '3D Render Scale', style: 'width: 30px; text-align: center;' });
    setupSmartInput(scaleInput, (val) => {
        let safeS = Math.max(20, Math.min(60, parseInt(val) || 45));
        S = safeS;
        initLayout();
        return safeS;
    });

    let historyInput = el('input', { id: 'nav-move-num', type: 'text', value: currentMoveIndex, title: 'Current Move Number', style: 'width: 30px; text-align: center;' });
    setupSmartInput(historyInput, (val) => {
        let maxIdx = Math.max(0, moveHistory.length - 1);
        let safeVal = Math.max(0, Math.min(parseInt(val) || 0, maxIdx));
        loadHistoryState(safeVal);
        return safeVal;
    });

    let workerInput = el('input', { type: 'text', value: numWorkers, title: 'Number of Background Web Workers', style: 'width: 30px; text-align: center;' });
    setupSmartInput(workerInput, (val) => {
        let safeW = Math.max(1, Math.min(32, parseInt(val) || 4)); 
        numWorkers = safeW;
        return safeW;
    });

    function makeWeightInput(label, index, title) {
        let inp = el('input', {
            id: `p_W${index}`,
            type: 'text',
            value: BrainList[editBrainIndex].weights[index],
            style: 'width: 38px; text-align: center; font-size: 0.85em; padding: 1px;',
            title: title
        });
        setupSmartInput(inp, (val) => {
            let parsed = parseInt(val);
            let safeVal = isNaN(parsed) ? 0 : parsed;
            BrainList[editBrainIndex].weights[index] = safeVal;
            return safeVal;
        });
        return el('div', {style: 'display: flex; flex-direction: column; align-items: center; gap: 1px;'}, 
		  el('span', {text: label, style: 'font-size: 0.7em;', title: title}), 
		  inp
		 );
    }

    // COLUMN 1: CONTROLS
    const col1 = el('div', { 
        class: 'col-controls', 
        style: `min-width: 280px; max-width: 280px; display: flex; flex-direction: column; gap: 8px; max-height: ${23 * S}px; overflow-y: auto; padding-right: 5px;` 
    },
		    
		    // 1. Title / Engine Toggle
		    el('button', { 
			id: 'engine-toggle-btn',
			title: 'Click to toggle between C++ and JS evaluation engines',
			style: `width: 100%; height: 48px; background-color: ${millTitleBg}; color: ${millTitleColor}; border-radius: 4px; border: 2px solid ${millTitleColor}; text-align: center; cursor: pointer; display: flex; align-items: center; justify-content: center; overflow: hidden; box-sizing: border-box; font-family: sans-serif; font-weight: bold; text-shadow: 1px 1px 2px rgba(0,0,0,0.2);`,
			onclick: (e) => {
			    if (engineMode === 'JS') {
				if (wasmModule) {
				    engineMode = 'WASM';
				    log("Switched to C++ Engine.");
				} else {
				    alert("WASM module not loaded. Please compile ReversiEngine.cpp");
				}
			    } else {
				engineMode = 'JS';
				log("Switched to JS Engine.");
			    }
			    updateEngineButtonUI();
			}
		    }),

		    // 1.2 NEW: 2D/3D Mode Toggle
		    el('button', { 
			id: 'mode-toggle-btn',
			text: playMode === '2D' ? '2D (click for 3D)' : '3D (click for 2D)',
			title: 'Toggle between 2D and 3D play modes',
			style: `width: 100%; height: 32px; font-size: 16px; background-color: ${playMode === '2D' ? color2D : color3D}; color: white; border-radius: 4px; border: 1px solid white; text-align: center; cursor: pointer; font-family: sans-serif; font-weight: bold; margin-top: 4px; margin-bottom: 2px;`,

			onclick: () => {
			    playMode = playMode === '2D' ? '3D' : '2D';
			    backgroundColor = playMode === '2D' ? color2D : color3D;
			    
			    // Freeze Cat 9 (Inner Faces) in 2D mode
			    activeParams = playMode === '2D' ? [0, 2, 3, 4, 5, 6, 7, 8] : [0, 2, 3, 4, 5, 6, 7, 8, 9];
			    
			    resetGame(); 
			    initLayout(); 
			}
		    }),

		    // 2.0 Help Link (Third Row)
		    el('div', { style: 'text-align: center; margin: 4px 0;' }, 
		       // <--- Note the opening bracket here
		       el('a', { 
			   href: 'Reversi.html', 
			   target: '_blank', 
			   text: 'Click here for rules and instructions', 
			   title: 'link to game rules and instructions',
			   style: 'color: rgb(200,200,255); font-weight: bold; text-decoration: none; font-size: 0.9em;'
		       })
		      ),

		    // 3. Play Row
		    el('div', { style: 'display: flex; gap: 5px; align-items: stretch;' },
el('button', { 
                   id: 'btn-play',
                   text: isPlaying ? 'Playing' : 'Play',
                   title: 'Start/Stop a game between the selected players on the board.',
                   style: `flex: 1; background-color: ${isPlaying?'orange':'green'}; color: white; font-size: 18px; font-weight: bold; padding: 10px; cursor: pointer; border: none; border-radius: 4px;`,
                   onclick: (e) => { 
                       if (isGameOver || currentTask !== 'NONE') return;

                       // Resume from history feature
                       if (!isPlaying && currentMoveIndex < moveHistory.length - 1) {
                           log(`Resuming game from move ${currentMoveIndex}...`);
                           moveHistory = moveHistory.slice(0, currentMoveIndex + 1);
                           lastMoveRecord = moveHistory[currentMoveIndex].lastMove;
                       }

                       setPlayState(!isPlaying);
                       updateGameState();
                       redrawAllSlices();
                       update3D();
                   }
               }),
		       el('div', {style: 'display: flex; gap: 3px; margin-top: 4px;'},
			  el('button', { 
			      id: 'btn-silence',
			      text: silenceMode ? 'Silence: ON' : 'Silence: OFF', 
			      title: 'Toggle Headless Mode for Tournaments/Evolution',
			      style: `background-color: ${silenceMode ? '#800' : '#080'}; flex: 1; color: white; font-weight: bold; cursor: pointer; padding: 4px; border: none;`, 
			      onclick: (e) => { 
				  // 1. Toggle the actual global variable
				  silenceMode = !silenceMode; 
				  
				  // 2. Update the button's appearance immediately
				  e.target.textContent = silenceMode ? 'Silence: ON' : 'Silence: OFF'; 
				  e.target.style.backgroundColor = silenceMode ? '#800' : '#080';
				  
				  // 3. Log the change so you can see it in the console
				  log(`Headless mode (Silence) is now ${silenceMode ? 'ON' : 'OFF'}.`);
			      } 
			  }),
			  el('button', { 
			      text: 'Reset', 
			      title: 'Stop ongoing background tasks and instantly reset the board to the starting state',
			      style: 'background-color: red; color: yellow; font-weight: bold; flex: 1; cursor: pointer; padding: 4px; border: none;', 
			      onclick: resetGame
			  })
			 ),
		       el('div', { style: 'display: flex; align-items: center; justify-content: center; gap: 2px;' },
			  el('span', { text: 'N=', style: 'font-weight: bold;' }),
			  el('select', { 
			      id: 'size-select',
			      title: 'Board Size (N)',
			      style: 'width: 40px; font-size: 16px; background-color: rgb(200,255,150);',
			      onchange: (e) => { 
				  N = parseInt(e.target.value); 
				  resetGame(); 
				  initLayout(); 
			      } 
			  },
			     el('option', { value: '4', text: '4', ...(N===4 ? {selected: 'true'} : {}) }),
			     el('option', { value: '6', text: '6', ...(N===6 ? {selected: 'true'} : {}) }),
			     el('option', { value: '8', text: '8', ...(N===8 ? {selected: 'true'} : {}) })
			    )
			 )
		      ),

		    // 4. Navigation & Board Reset Row
		    el('div', { style: 'display: flex; gap: 5px; align-items: center;' },
		       el('button', { text: '<', title: 'Previous Move', style: 'flex: 0.5; font-weight:bold; cursor: pointer;', onclick: () => loadHistoryState(currentMoveIndex - 1) }),
		       historyInput,
		       el('button', { text: '>', title: 'Next Move', style: 'flex: 0.5; font-weight:bold; cursor: pointer;', onclick: () => loadHistoryState(currentMoveIndex + 1) }),
		       el('button', { text: '>>', title: 'End of Game', style: 'flex: 0.5; font-weight:bold; cursor: pointer;', onclick: () => {
			   loadHistoryState(moveHistory.length - 1);
			   if (!isPlaying && !isGameOver) {
			       setPlayState(true);
			       updateGameState();
			   }
		       }})
		      ),

		    // 5. Player Selects
		    el('div', { style: 'display: flex; gap: 5px; align-items: center; font-size: 0.9em;' },
		       el('span', { text: 'Red:', style: `color: ${redColor}; font-weight: bold; width: 45px;` }),
		       el('select', { 
			   id: 'red-type-select', title: 'Red Player Type', style: 'flex: 1; min-width: 0;',
			   onchange: (e) => { 
			       redType = e.target.value; greenType = redType; 
			       let gs = document.getElementById('green-type-select');
			       if (gs) gs.value = greenType;
			       if(isPlaying) updateGameState(); 
			   } 
		       }),
		       el('span', { text: 'D=' }),
		       el('select', { 
			   id: 'red-depth-select', title: 'Red Search Depth', style: 'width: 45px; background-color: #add8e6;',
			   onchange: (e) => { 
			       redDepth = parseInt(e.target.value); greenDepth = redDepth;
			       let gs = document.getElementById('green-depth-select');
			       if (gs) gs.value = greenDepth;
			   }
		       }, ...[2,4,6,8,10,12,14,16,18,20].map(d => el('option', { value: d.toString(), text: d.toString(), ...(redDepth===d ? {selected: 'true'} : {}) })))
		      ),

		    el('div', { style: 'display: flex; gap: 5px; align-items: center; font-size: 0.9em;' },
		       el('span', { text: 'Green:', style: `color: ${greenColor}; font-weight: bold; width: 45px;` }),
		       el('select', { 
			   id: 'green-type-select', title: 'Green Player Type', style: 'flex: 1; min-width: 0;',
			   onchange: (e) => { greenType = e.target.value; if(isPlaying) updateGameState(); } 
		       }),
		       el('span', { text: 'D=' }),
		       el('select', { 
			   id: 'green-depth-select', title: 'Green Search Depth', style: 'width: 45px; background-color: #add8e6;',
			   onchange: (e) => { greenDepth = parseInt(e.target.value); }
		       }, ...[2,4,6,8,10,12,14,16,18,20].map(d => el('option', { value: d.toString(), text: d.toString(), ...(greenDepth===d ? {selected: 'true'} : {}) })))
		      ),

		    // 6. Game Info / Log Wrapper
		    el('div', { 
			id: 'game-info-wrapper',
			style: `background-color: ${scoreBgColor}; color: white; border-radius: 4px; border: 1px solid navy; display: flex; flex-direction: column; height: 160px; overflow: hidden;`
		    },
		       el('div', { id: 'game-score-header', title: 'Current Score', style: 'padding: 4px; border-bottom: 1px solid #555; text-align: center; min-height: 45px; display: flex; flex-direction: column; justify-content: center;' }, "Initializing..."),
		       el('div', { id: 'game-info-log', title: 'Engine Logs and Output', style: 'flex: 1; overflow-y: auto; padding: 4px; font-size: 0.85em; font-family: monospace; white-space: pre-wrap; background-color: #111;' })
		      ),
		    
		    // 7. Value / Moves Row
		    el('div', { style: 'display: flex; gap: 5px; align-items: center;' },
		       el('button', { 
			   text: 'Value', title: 'Compute Static Value of Current Board',
			   style: 'flex: 1; background-color: navy; color: white; border: none; padding: 5px; cursor: pointer;',
			   onclick: () => doStaticEval() 
		       }),
		       el('button', { 
			   text: 'Moves', title: 'List Ranked Moves for Current Player',
			   style: 'flex: 1; background-color: navy; color: white; border: none; padding: 5px; cursor: pointer;',
			   onclick: () => doListMoves() 
		       }),
		       el('span', { text: 'D=', style: 'font-weight: bold; font-size: 0.9em;' }),
		       el('select', { 
			   title: 'Search Depth for Static Eval and Moves List',
			   style: 'width: 45px; background-color: #add8e6;',
			   onchange: (e) => { evalDepth = parseInt(e.target.value); }
		       }, ...[2,4,6,8,10,12,14,16,18,20].map(d => el('option', { value: d.toString(), text: d.toString(), ...(evalDepth===d ? {selected: 'true'} : {}) })))
		      ),

		    // Other options
		    el('div', { style: 'display: flex; justify-content: space-between; align-items: center;' },
		       el('label', { text: 'Scale:' }),
		       el('div', { style: 'display: flex; gap: 2px;' },
			  el('button', { text: '<', title: 'Decrease Render Scale', style: 'cursor: pointer; font-weight:bold; width: 25px;', onclick: () => { S = Math.max(20, S - 2); initLayout(); } }),
			  scaleInput,
			  el('button', { text: '>', title: 'Increase Render Scale', style: 'cursor: pointer; font-weight:bold; width: 25px;', onclick: () => { S = Math.min(60, S + 2); initLayout(); } })
			 ),
		       el('label', { text: 'W:' }), workerInput
		      ),

		    el('div', { style: 'display: flex; gap: 5px;' },
		       el('button', { 
			   text: 'Fullscreen', title: 'Toggle Fullscreen Mode',
			   style: 'flex: 1; background-color: navy; color: white; border: none; padding: 5px; cursor: pointer; font-weight: bold;',
			   onclick: () => toggleFullscreen() 
		       }),
		       el('button', { 
			   text: orthographicMode ? 'Perspective' : 'Infinity', title: 'Toggle Camera Projection Mode',
			   id: 'btn-camera',
			   style: 'flex: 1; background-color: navy; color: white; border: none; padding: 5px; cursor: pointer; font-weight: bold;',
			   onclick: () => { toggleCamera(); document.getElementById('btn-camera').textContent = orthographicMode ? 'Perspective' : 'Infinity'; }
		       })
		      ),

		    el('div', { style: 'display: flex; gap: 5px;' },
		       el('button', { 
			   text: 'Hints', id: 'btn-hints', title: 'Toggle Hint Markers',
			   style: `flex:1; background-color: ${showHints?'green':'grey'}; color: white; border: none; padding: 5px; cursor: pointer;`,
			   onclick: (e) => { showHints = !showHints; e.target.style.backgroundColor = showHints?'green':'grey'; redrawAllSlices(); update3D(); } 
		       }),
		       el('button', { 
			   text: 'Axes', id: 'btn-axes', title: 'Toggle XYZ Axes',
			   style: `flex:1; background-color: ${showAxes?'green':'grey'}; color: white; border: none; padding: 5px; cursor: pointer;`,
			   onclick: (e) => { showAxes = !showAxes; e.target.style.backgroundColor = showAxes?'green':'grey'; update3D(); } 
		       }),
		       el('button', { 
			   text: 'Hover', id: 'btn-hover', title: 'Toggle Hover Tooltips',
			   style: `flex:1; background-color: ${showHover?'green':'grey'}; color: white; border: none; padding: 5px; cursor: pointer;`,
			   onclick: (e) => { 
			       showHover = !showHover; 
			       e.target.style.backgroundColor = showHover?'green':'grey'; 
			       if (!showHover && hoverTooltip) hoverTooltip.style.display = 'none';
			   } 
		       })
		      ),
		    
		    el('div', { style: 'display: flex; gap: 5px;' },
		       el('button', { 
			   text: 'Cats', id: 'btn-cats', title: 'Toggle Category Coloring',
			   style: `flex:1; background-color: ${showCategories?'green':'grey'}; color: white; border: none; padding: 5px; cursor: pointer;`,
			   onclick: (e) => { 
			       showCategories = !showCategories; showValues = false; 
			       document.getElementById('btn-vals').style.backgroundColor = 'grey';
			       e.target.style.backgroundColor = showCategories?'green':'grey'; update3D(); 
			   } 
		       }),
		       el('button', { 
			   text: 'Vals', id: 'btn-vals', title: 'Toggle Heuristic Value Coloring',
			   style: `flex:1; background-color: ${showValues?'green':'grey'}; color: white; border: none; padding: 5px; cursor: pointer;`,
			   onclick: (e) => { 
			       showValues = !showValues; showCategories = false;
			       document.getElementById('btn-cats').style.backgroundColor = 'grey';
			       e.target.style.backgroundColor = showValues?'green':'grey'; update3D(); 
			   } 
		       })
		      ),

		    el('div', { style: 'display: flex; align-items: center; gap: 5px;' },
		       el('label', { text: 'Grid:' }),
		       el('select', { 
			   id: 'grid-select', title: 'Toggle 3D Grid Visibility',
			   style: 'flex: 1;',
			   onchange: (e) => { gridMode = parseInt(e.target.value); update3D(); }
		       },
			  el('option', { value: '0', text: 'None', ...(gridMode===0 ? {selected: 'true'} : {}) }),
			  el('option', { value: '1', text: 'Orthogonal', ...(gridMode===1 ? {selected: 'true'} : {}) }),
			  el('option', { value: '2', text: 'All 26', ...(gridMode===2 ? {selected: 'true'} : {}) })
			 )
		      ),

		    el('div', { style: 'display: flex; gap: 5px;' },
		       el('button', { 
			   id: 'btn-pruning', text: 'α/β', title: 'Toggle Alpha-Beta Pruning',
			   style: `flex: 1; background-color: ${usePruning?'green':'red'}; color: white; border: none; padding: 5px; cursor: pointer; font-weight: bold;`,
			   onclick: (e) => { 
			       usePruning = !usePruning;
			       e.target.style.backgroundColor = usePruning ? 'green' : 'red';
			   } 
		       }),
		       el('button', { 
			   id: 'btn-sym', text: 'S', title: 'Toggle Symmetry Filtering',
			   style: `flex: 1; background-color: ${useSymmetry?'green':'red'}; color: white; border: none; padding: 5px; cursor: pointer; font-weight: bold;`,
			   onclick: (e) => { 
			       useSymmetry = !useSymmetry;
			       e.target.style.backgroundColor = useSymmetry ? 'green' : 'red';
			   } 
		       }),
		       el('button', { 
			   id: 'btn-rand', text: 'Rand', title: 'Toggle Random Selection for Equal Best Moves',
			   style: `flex: 1; background-color: ${useRandom?'green':'red'}; color: white; border: none; padding: 5px; cursor: pointer; font-weight: bold;`,
			   onclick: (e) => { 
			       useRandom = !useRandom;
			       e.target.style.backgroundColor = useRandom ? 'green' : 'red';
			   } 
		       })
		      ),

		    el('div', { style: 'display: flex; gap: 5px;' },
		       el('button', { 
			   id: 'btn-logs', text: 'Logs', title: 'Toggle Duplicate Logs to Console',
			   style: `flex: 1; background-color: ${duplicateLogs?'green':'red'}; color: white; border: none; padding: 5px; cursor: pointer; font-weight: bold;`,
			   onclick: (e) => { 
			       duplicateLogs = !duplicateLogs;
			       e.target.style.backgroundColor = duplicateLogs ? 'green' : 'red';
			   } 
		       }),
		       el('button', { 
			   id: 'btn-depths', text: 'Depths', title: 'Toggle Search Depth Visit Stats',
			   style: `flex: 1; background-color: ${showDepths?'green':'red'}; color: white; border: none; padding: 5px; cursor: pointer; font-weight: bold;`,
			   onclick: (e) => { 
			       showDepths = !showDepths;
			       e.target.style.backgroundColor = showDepths ? 'green' : 'red';
			   } 
		       })
		      ),
		    
		    el('div', { style: 'display: flex; gap: 5px; align-items: center; margin-top: 2px;' }, 
		       el('div', { style: 'font-size: 0.9em; font-weight: bold;' }, "B:"),
		       el('input', { id: 'slider-ball', type: 'range', min: '0.1', max: '0.9', step: '0.05', value: playerBallSize, title: 'Player Stone Size', style: 'flex: 1; min-width: 0;', oninput: (e) => { playerBallSize = parseFloat(e.target.value); update3D(); } }),
		       el('div', { style: 'font-size: 0.9em; font-weight: bold; margin-left: 5px;' }, "H:"),
		       el('input', { id: 'slider-hint', type: 'range', min: '0.05', max: '0.5', step: '0.025', value: hintBallSize, title: 'Hint Marker Size', style: 'flex: 1; min-width: 0;', oninput: (e) => { hintBallSize = parseFloat(e.target.value); update3D(); } })
		      ),

		    // AI LAB / EVOLUTION PANEL
		    el('div', {style: 'display: flex; gap: 3px; margin-top: 10px;'},
		       el('button', {text: 'Import', title: 'Import Brains from a JS file', style: 'flex: 1; cursor: pointer; background-color: #ddd;', onclick: () => document.getElementById('brainFileInput').click()}),
		       el('input', {id: 'brainFileName', value: 'brains.js', title: 'Filename to export', style: 'flex: 1.5; text-align: center; min-width: 0;'}),
		       el('button', {text: 'Export', title: 'Export Brains to a JS file', style: 'flex: 1; cursor: pointer; background-color: #ddd;', onclick: exportBrainsJS}),
		       el('button', {text: 'Def.', title: 'Restore Default Brains', style: 'flex: 0.8; cursor: pointer; background-color: #fcc;', onclick: () => { BrainList = JSON.parse(JSON.stringify(defaultBrainList)); editBrainIndex = 0; updateBrainUI(); }})
		      ),


		    el('div', {style: 'display: flex; justify-content: space-between; gap: 2px; margin-top: 4px;'},
		       makeWeightInput('Mob', 0, 'Mobility'),
		       makeWeightInput('Dif', 2, 'Piece Difference'),
		       makeWeightInput('Cor', 3, 'Corners'),
		       makeWeightInput('C-Sq', 4, 'C-Squares'),
		       makeWeightInput('X-Sq', 5, 'X-Squares')
		      ),
		    el('div', {style: 'display: flex; justify-content: space-between; gap: 2px;'},
		       makeWeightInput('Edg', 6, 'Edges'),
		       makeWeightInput('IEd', 7, 'Inner Edges'),
		       makeWeightInput('Fac', 8, 'Faces'),
		       makeWeightInput('IFa', 9, 'Inner Faces'),
		       el('div', {style: 'width: 38px;'}) 
		      )
		   );

    let impGenInp = el('input', {id: 'impGenerations', type: 'text', value: impGenVal, title: 'Generations', style: 'flex: 1; text-align: center; padding: 2px; min-width: 0;'});
    setupSmartInput(impGenInp, val => { impGenVal = Math.max(1, parseInt(val) || 1); return impGenVal; });

    let impGamesInp = el('input', {id: 'impGames', type: 'text', value: impGamesVal, title: 'Games per match', style: 'flex: 1; text-align: center; padding: 2px; min-width: 0;'});
    setupSmartInput(impGamesInp, val => { impGamesVal = Math.max(1, parseInt(val) || 1); return impGamesVal; });

    let impPercentInp = el('input', {id: 'impPercent', type: 'text', value: impMutVal, title: 'Mutation %', style: 'flex: 1; text-align: center; padding: 2px; min-width: 0;'});
    setupSmartInput(impPercentInp, val => { impMutVal = Math.max(1, parseInt(val) || 1); return impMutVal; });
let evoControlsDiv = el('div', {style: 'display: flex; gap: 4px; margin-top: 4px; align-items: stretch; justify-content: space-between; height: 24px;'},
    el('button', {
        id: 'btn-evolve', 
        text: 'Evolve', 
        title: 'Run or Stop Line Search Evolution', 
        style: 'background-color: orange; font-weight: bold; cursor: pointer; padding: 2px 4px; flex: 1.5;', 
        onclick: () => currentTask === 'EVO' ? stopTasks() : runImprovement()
    }),
    el('select', {id: 'editBrainSelect', title: 'Select Brain to Edit/Evolve', style: 'flex: 0.8; text-align: center; min-width: 0;', onchange: (e) => { editBrainIndex = parseInt(e.target.value); updateBrainUI(); }}),
    impGenInp, impGamesInp, impPercentInp
);
col1.appendChild(evoControlsDiv);
    // TOURNAMENT PANEL
    col1.appendChild(el('div', {id: 'participants', style: 'background: #222; margin-top: 6px;'}));

    let tGamesInp = el('input', {id: 'tGames', type: 'text', value: tGamesVal, title: 'Games per pair', style: 'width: 35px; text-align: center; font-size: 0.9em; padding: 2px;'});
    setupSmartInput(tGamesInp, val => { tGamesVal = Math.max(1, parseInt(val) || 1); return tGamesVal; });

    let tDepthSelect = el('select', { 
        id: 'tDepth', title: 'Search Depth for Tournaments/Evolution',
        style: 'width: 45px; background-color: #add8e6;',
        onchange: (e) => { tDepthVal = parseInt(e.target.value); }
    }, ...[2,4,6,8,10,12,14,16,18,20].map(d => el('option', { value: d.toString(), text: d.toString(), ...(tDepthVal===d ? {selected: 'true'} : {}) })));

let tourneyControlsDiv = el('div', {style: 'display: flex; gap: 5px; margin-top: 4px; align-items: center;'},
    el('button', {
        id: 'btn-tourney', 
        text: 'Run Tournament', 
        title: 'Run or Stop a Round-Robin Tournament', 
        style: 'background-color: orange; font-weight: bold; flex: 1; cursor: pointer; padding: 4px;', 
        onclick: () => currentTask === 'TOURNEY' ? stopTasks() : runTournament()
    }),
    tGamesInp,
    el('span', {text: 'D=', style: 'font-size: 0.9em;'}),
    tDepthSelect
);
    col1.appendChild(tourneyControlsDiv);

    // COLUMN 2: SLICES
    const col2 = el('div', { 
        class: 'col-slices',
        style: `height: ${23 * S}px; display: flex; flex-direction: column; justify-content: space-between;`
    });
    
    const sliceWidth = Math.max(50, Math.floor(((23 * S) - 110) / 3)); 

    ['X', 'Y', 'Z'].forEach(axis => {
        const cvs = el('canvas', { 
            id: `canvas-${axis}`, 
            width: sliceWidth, 
            height: sliceWidth, 
            style: `border: 1px solid #333; background: ${backgroundColor}; display: block; cursor: pointer; width: ${sliceWidth}px; height: ${sliceWidth}px;`,
            onclick: (e) => handleCanvasClick(e, axis)
        });

        const radioContainer = el('div', { 
            style: `display: flex; justify-content: space-between; width: ${sliceWidth}px; margin-top: 3px; height: 16px;` 
        });
        
        for (let i = 0; i < N; i++) {
            const radio = el('input', { 
                type: 'radio', name: `slice-${axis}`, value: i, title: `Index ${i}`,
                style: 'cursor: pointer; margin: 0; padding: 0; transform: scale(0.7);',
                onchange: (e) => {
                    currentSlices[axis] = parseInt(e.target.value);
                    drawSlice(cvs, axis, currentSlices[axis]);
                }
            });
            if (i === currentSlices[axis]) radio.checked = true;
            radioContainer.appendChild(radio);
        }

        col2.appendChild(el('div', { style: `display: flex; flex-direction: column; align-items: center; margin-bottom: 0;` },
			    el('div', { text: `${axis}-Axis`, style: 'text-align: center; font-size: 0.8em; margin-bottom: 2px;' }),
			    cvs,
			    radioContainer
			   ));
    });

    // COLUMN 3: 3D VIEW
    const col3 = el('div', { class: 'col-3d' },
		    el('div', { id: 'view3d-container' })
		   );

    // Append to DOM FIRST so getElementById works
    root.appendChild(col1);

    if (playMode === '2D') {
        const boardSize = 23 * S;
        const col2D = el('div', {
            id: 'col-2d-mode',
            style: `display: flex; align-items: center; justify-content: center; margin-left: 15px; width: ${boardSize + 150}px;`
        },
			 el('canvas', {
			     id: 'canvas-Z-2D',
			     width: boardSize,
			     height: boardSize,
			     style: `border: 2px solid grey; background: ${backgroundColor}; display: block; cursor: pointer; box-shadow: 2px 2px 10px rgba(0,0,0,0.5);`,
			     onclick: (e) => handleCanvasClick(e, 'Z')
			 })
			);
        root.appendChild(col2D);
    } else {
        root.appendChild(col2);
        root.appendChild(col3);
        init3D();
    }

    updateEngineButtonUI();
    updateBrainUI(); 
    setEngineTaskState('NONE');
    updateGameState();
    redrawAllSlices();
    update3D();
}

// 7. START THE GAME
initGameData();
initLayout();
