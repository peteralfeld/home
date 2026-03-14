// ReversiWorker.js
// Background thread for dual JS / C++ Alpha-Beta search

let N = 4;
let N2 = 16;
let N3 = 64;
let categoryMap = new Int32Array(512);
let currentBrain = null;
let usePruning = true;
let aiNodesVisited = 0;
let depthVisits = {}; 
let initialized = false; 

// CACHED WEBASSEMBLY ENGINE (Crucial for Speed!)
let wasmInstanceCache = null;
let wasmExports = null;
let memArray = null;
let boardPtr = null;

// RAY CASTING LOOKUP TABLES
let ray_len = new Int32Array(512 * 26);
let ray_path = new Int32Array(512 * 26 * 8);

function idx(x, y, z) { return x * N2 + y * N + z; }

// --- Pre-computation ---
function initRays() {
    let dirs = [];
    for(let dx=-1; dx<=1; dx++) for(let dy=-1; dy<=1; dy++) for(let dz=-1; dz<=1; dz++) {
        if(dx===0 && dy===0 && dz===0) continue;
        dirs.push([dx, dy, dz]);
    }
    for(let x=0; x<N; x++) for(let y=0; y<N; y++) for(let z=0; z<N; z++) {
        let c = idx(x, y, z);
        for(let d=0; d<26; d++) {
            let len = 0;
            let cx = x + dirs[d][0], cy = y + dirs[d][1], cz = z + dirs[d][2];
            while(cx>=0 && cx<N && cy>=0 && cy<N && cz>=0 && cz<N) {
                ray_path[c * 26 * 8 + d * 8 + len] = idx(cx, cy, cz);
                len++;
                cx += dirs[d][0]; cy += dirs[d][1]; cz += dirs[d][2];
            }
            ray_len[c * 26 + d] = len;
        }
    }
}

function initGeometry() {
    const isEnd = (v) => v === 0 || v === N - 1;
    const distToCorner = (x, y, z) => {
        let minD = 999;
        [0, N-1].forEach(cx => [0, N-1].forEach(cy => [0, N-1].forEach(cz => {
            let d = Math.max(Math.abs(x - cx), Math.abs(y - cy), Math.abs(z - cz));
            if (d < minD) minD = d;
        }))); return minD;
    };
    const isEdge = (x, y, z) => {
        let ends = 0; if(isEnd(x)) ends++; if(isEnd(y)) ends++; if(isEnd(z)) ends++;
        return ends === 2;
    };
    const distToEdge = (x, y, z) => {
        let minD = 999;
        for(let i=0; i<N; i++) for(let j=0; j<N; j++) for(let k=0; k<N; k++) {
            if (isEdge(i,j,k)) {
                let d = Math.max(Math.abs(x - i), Math.abs(y - j), Math.abs(z - k));
                if (d < minD) minD = d;
            }
        } return minD;
    };
    const distToFace = (x, y, z) => Math.min(x, N-1-x, y, N-1-y, z, N-1-z);

    for(let x=0; x<N; x++) for(let y=0; y<N; y++) for(let z=0; z<N; z++) {
        let cat = 0, ends = 0;
        if(isEnd(x)) ends++; if(isEnd(y)) ends++; if(isEnd(z)) ends++;
        let dCorner = distToCorner(x, y, z), dEdge = distToEdge(x, y, z), dFace = distToFace(x, y, z);
        if(ends === 3) cat = 3; else if(ends === 2 && dCorner === 1) cat = 4; else if(dCorner === 1) cat = 5;
        else if(ends === 2) cat = 6; else if(dEdge === 1) cat = 7; else if(ends === 1) cat = 8; else if(dFace === 1) cat = 9;
        categoryMap[idx(x, y, z)] = cat;
    }
}

// --- High Speed Core JS Logic ---

function getValidMoves(board, player, out_moves) {
    let count = 0;
    let opponent = player === 1 ? 2 : 1;
    for(let c=0; c<N3; c++) {
        if(board[c] !== 0) continue;
        let valid = false;
        for(let d=0; d<26; d++) {
            let len = ray_len[c * 26 + d];
            if(len < 2) continue;
            if(board[ray_path[c * 26 * 8 + d * 8 + 0]] !== opponent) continue;
            for(let i=1; i<len; i++) {
                let p = board[ray_path[c * 26 * 8 + d * 8 + i]];
                if(p === player) { valid = true; break; }
                if(p === 0) break;
            }
            if(valid) break;
        }
        if(valid) out_moves[count++] = c;
    }
    return count;
}

function simulateMove(board_in, board_out, m, player) {
    board_out.set(board_in);
    board_out[m] = player;
    let opponent = player === 1 ? 2 : 1;
    for(let d=0; d<26; d++) {
        let len = ray_len[m * 26 + d];
        if(len < 2) continue;
        if(board_out[ray_path[m * 26 * 8 + d * 8 + 0]] !== opponent) continue;
        let flip = false;
        for(let i=1; i<len; i++) {
            let p = board_out[ray_path[m * 26 * 8 + d * 8 + i]];
            if(p === player) { flip = true; break; }
            if(p === 0) break;
        }
        if(flip) {
            for(let i=0; i<len; i++) {
                let step_idx = ray_path[m * 26 * 8 + d * 8 + i];
                if(board_out[step_idx] === player) break;
                board_out[step_idx] = player;
            }
        }
    }
}

let eval_moves_p = new Int32Array(512);
let eval_moves_o = new Int32Array(512);

function staticEvaluation(board, player) {
    let opponent = player === 1 ? 2 : 1;
    let score = 0, pStones = 0, oStones = 0;
    let pCat = [0,0,0,0,0,0,0,0,0,0], oCat = [0,0,0,0,0,0,0,0,0,0];
    let w = currentBrain.weights;

    for(let i=0; i<N3; i++) {
        let val = board[i];
        if(val === 0) continue;
        let cat = categoryMap[i];
        if(val === player) { pStones++; pCat[cat]++; }
        else { oStones++; oCat[cat]++; }
    }
    score += (pStones - oStones) * w[2];
    for(let i=3; i<=9; i++) score += (pCat[i] - oCat[i]) * w[i];
    
    if(w[0] !== 0) {
        score += (getValidMoves(board, player, eval_moves_p) - getValidMoves(board, opponent, eval_moves_o)) * w[0];
    }
    return score;
}

function fastEvaluation(board, player) {
    let score = 0, pStones = 0, oStones = 0;
    let pCat = [0,0,0,0,0,0,0,0,0,0], oCat = [0,0,0,0,0,0,0,0,0,0];
    let w = currentBrain.weights;
    for(let i=0; i<N3; i++) {
        let val = board[i];
        if(val === 0) continue;
        let cat = categoryMap[i];
        if(val === player) { pStones++; pCat[cat]++; }
        else { oStones++; oCat[cat]++; }
    }
    score += (pStones - oStones) * w[2];
    for(let i=3; i<=9; i++) score += (pCat[i] - oCat[i]) * w[i];
    return score;
}

// Zero-allocation recursive pools
let global_moves = new Array(128).fill(0).map(()=>new Int32Array(512));
let global_temp_boards = new Array(128).fill(0).map(()=>new Uint8Array(512));

function alphaBetaJS(board, depth, alpha, beta, maxPlayer, currentPlayer, passed) {
    aiNodesVisited++;
    if(depth >= 0 && depth < 20) depthVisits[depth] = (depthVisits[depth] || 0) + 1;
    if(depth <= 0) return staticEvaluation(board, maxPlayer);

    let safeDepth = Math.min(depth, 127);
    let moves = global_moves[safeDepth];
    let moveCount = getValidMoves(board, currentPlayer, moves);
    let opponentId = currentPlayer === 1 ? 2 : 1;

    if(moveCount === 0) {
        if(passed) return staticEvaluation(board, maxPlayer);
        return alphaBetaJS(board, depth - 1, alpha, beta, maxPlayer, opponentId, true);
    }

    let scoredMoves = [];
    let tempBoard = global_temp_boards[safeDepth];

    for(let i=0; i<moveCount; i++) {
        simulateMove(board, tempBoard, moves[i], currentPlayer);
        scoredMoves.push({ m: moves[i], score: fastEvaluation(tempBoard, maxPlayer) });
    }

    if(currentPlayer === maxPlayer) {
        let maxEval = -Infinity;
        scoredMoves.sort((a,b) => b.score - a.score);
        for(let i=0; i<moveCount; i++) {
            let nextAlpha = usePruning ? alpha : -Infinity;
            let nextBeta = usePruning ? beta : Infinity;
            simulateMove(board, tempBoard, scoredMoves[i].m, currentPlayer);
            let ev = alphaBetaJS(tempBoard, depth - 1, nextAlpha, nextBeta, maxPlayer, opponentId, false);
            if(ev > maxEval) maxEval = ev;
            if(usePruning) {
                if(ev > alpha) alpha = ev;
                if(beta <= alpha) break;
            }
        } return maxEval;
    } else {
        let minEval = Infinity;
        scoredMoves.sort((a,b) => a.score - b.score);
        for(let i=0; i<moveCount; i++) {
            let nextAlpha = usePruning ? alpha : -Infinity;
            let nextBeta = usePruning ? beta : Infinity;
            simulateMove(board, tempBoard, scoredMoves[i].m, currentPlayer);
            let ev = alphaBetaJS(tempBoard, depth - 1, nextAlpha, nextBeta, maxPlayer, opponentId, false);
            if(ev < minEval) minEval = ev;
            if(usePruning) {
                if(ev < beta) beta = ev;
                if(beta <= alpha) break;
            }
        } return minEval;
    }
}

// --- WORKER INTERFACE ---
self.onmessage = async function(e) {
    const data = e.data;
    
    // CACHE WEBASSEMBLY ACROSS MESSAGES
    if (data.engineMode === 'WASM' && data.wasmModule) {
        if (!wasmInstanceCache) {
            wasmInstanceCache = await WebAssembly.instantiate(data.wasmModule, {
                env: { emscripten_notify_memory_growth: function() {} }
            });
            wasmExports = wasmInstanceCache.exports;
            boardPtr = wasmExports.get_board_ptr();
            memArray = new Uint8Array(wasmExports.memory.buffer);
        }
    }
    // ========================================================
    // HEADLESS TOURNAMENT MODE (Runs entire match in one Worker)
    // ========================================================
if (data.command === 'play_match') {
        const { b1, b2, depth1, depth2, nVal, pruning, playMode } = data; // Added playMode
        if (N !== nVal || !initialized) {
            N = nVal; N2 = N*N; N3 = N*N*N;
            initGeometry(); initRays(); initialized = true;
        }

        let currentPlayer = 1;
        let passes = 0;

        // ZERO ALLOCATION: Declare arrays exactly ONCE outside the loop
        let board = new Uint8Array(N3);
        let tempBoard = new Uint8Array(N3);
        let newBoard = new Uint8Array(N3);
        let moves = new Int32Array(512);

        // Setup starting pieces
// Setup starting pieces
        const mid = (N / 2) - 1;
        if (playMode === '3D') {
            let centerIndices = [mid, mid + 1];
            for (let x of centerIndices) for (let y of centerIndices) for (let z of centerIndices) {
                board[idx(x,y,z)] = (x + y + z) % 2 === 0 ? 1 : 2;
            }
        } else {
            // 2D Mode: Setup standard 4 pieces on the z=0 face
            board[idx(mid, mid, 0)] = 2;             // Green
            board[idx(mid + 1, mid + 1, 0)] = 2;     // Green
            board[idx(mid, mid + 1, 0)] = 1;         // Red
            board[idx(mid + 1, mid, 0)] = 1;         // Red
        }

        while (passes < 2) {
            let activeBrain = currentPlayer === 1 ? b1 : b2;
            let activeDepth = currentPlayer === 1 ? depth1 : depth2;
            currentBrain = { weights: activeBrain.weights }; 
            
            let moveCount = getValidMoves(board, currentPlayer, moves);

            if (moveCount === 0) {
                passes++;
                currentPlayer = currentPlayer === 1 ? 2 : 1;
                continue;
            }
            passes = 0;

            let bestScore = -Infinity; // Both players want their OWN max score
            let bestMoves = [];

            if (wasmExports && data.engineMode === 'WASM') {
                wasmExports.init_engine(N, currentBrain.weights[0], currentBrain.weights[1], currentBrain.weights[2], currentBrain.weights[3], currentBrain.weights[4], currentBrain.weights[5], currentBrain.weights[6], currentBrain.weights[7], currentBrain.weights[8], currentBrain.weights[9], pruning);
                
                for (let i=0; i<moveCount; i++) {
                    let m = moves[i];
                    simulateMove(board, tempBoard, m, currentPlayer);
                    
                    for(let j=0; j<N3; j++) memArray[boardPtr + j] = tempBoard[j];
                    
                    // Score is evaluated relative to currentPlayer
                    let score = wasmExports.run_alpha_beta(activeDepth - 1, -1000000000, 1000000000, currentPlayer, currentPlayer === 1 ? 2 : 1, false);
                    
                    if (score > bestScore) { bestScore = score; bestMoves = [m]; }
                    else if (score === bestScore) bestMoves.push(m);
                }
            } else {
                for (let i=0; i<moveCount; i++) {
                    let m = moves[i];
                    simulateMove(board, tempBoard, m, currentPlayer);
                    
                    // Score is evaluated relative to currentPlayer
                    let score = alphaBetaJS(tempBoard, activeDepth - 1, -Infinity, Infinity, currentPlayer, currentPlayer === 1 ? 2 : 1, false);
                    
                    if (score > bestScore) { bestScore = score; bestMoves = [m]; }
                    else if (score === bestScore) bestMoves.push(m);
                }
            }

            let bestMove = bestMoves[Math.floor(Math.random() * bestMoves.length)];
            simulateMove(board, newBoard, bestMove, currentPlayer);
            
            // Swap array pointers to avoid allocating memory for the next loop!
            let t = board;
            board = newBoard;
            newBoard = t;

            currentPlayer = currentPlayer === 1 ? 2 : 1;
// Yield to the event loop so the browser watchdog doesn't kill the worker
            await new Promise(r => setTimeout(r, 0));
        }

        let s1 = 0, s2 = 0;
        for(let i=0; i<N3; i++) {
            if (board[i] === 1) s1++;
            else if (board[i] === 2) s2++;
        }
        let winner = s1 > s2 ? 1 : (s2 > s1 ? 2 : 0);
        
        self.postMessage({ result: 'match_done', winner, s1, s2 });
        return;
    }

    // ========================================================
    // STANDARD UI EVALUATION MODE (Evaluates individual moves)
    // ========================================================
    const { id, tasks, rootPlayerId, weights, pruning, nVal } = data;
    
    if (N !== nVal || !initialized) { 
        N = nVal; N2 = N*N; N3 = N*N*N;
        initGeometry(); initRays(); initialized = true;
    }
    
    currentBrain = { weights: weights }; 
    usePruning = pruning;
    aiNodesVisited = 0; 
    depthVisits = {};
    let results = [];

    if (wasmExports && data.engineMode === 'WASM') {
        wasmExports.init_engine(N, weights[0], weights[1], weights[2], weights[3], weights[4], weights[5], weights[6], weights[7], weights[8], weights[9], pruning);

        for (let task of tasks) {
            // Memory set is instantly mapped from task.flatBoard
            memArray.set(task.flatBoard, boardPtr);
            wasmExports.reset_stats();
            let score = wasmExports.run_alpha_beta(task.depthLeft, -1000000000, 1000000000, rootPlayerId, task.currentPlayer, task.passed);
            
            aiNodesVisited += Number(wasmExports.get_nodes_visited());
            for(let d=0; d<=task.depthLeft; d++) {
                depthVisits[d] = (depthVisits[d] || 0) + Number(wasmExports.get_depth_visits(d));
            }
            results.push({ m1: task.m1, m2: task.m2, score: score });
        }
    } else {
        for (let task of tasks) {
            let score = alphaBetaJS(task.flatBoard, task.depthLeft, -Infinity, Infinity, rootPlayerId, task.currentPlayer, task.passed);
            results.push({ m1: task.m1, m2: task.m2, score: score });
        }
    }

    self.postMessage({ id: id, results: results, totalNodes: aiNodesVisited, depthVisits: depthVisits });
};

