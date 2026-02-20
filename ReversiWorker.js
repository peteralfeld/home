// ReversiWorker.js
// Background thread for Alpha-Beta search

let N = 4;
let categoryMap = [];
let currentBrain = null;
let usePruning = true;
let aiNodesVisited = 0;
let depthVisits = {}; // Tracks nodes visited per depth

// --- GEOMETRY & RULES ---

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

function simulateMove(board, move, player) {
    const newBoard = cloneBoard(board);
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
    for(let i=3; i<=9; i++) score += (counts.p[i] - counts.o[i]) * w[i];

    if (w[0] !== 0) {
        score += (getValidMovesForPlayer(board, player).length - getValidMovesForPlayer(board, opponent).length) * w[0];
    }
    return score;
}

// --- AI ALPHA-BETA LOGIC ---

function alphaBeta(board, depth, alpha, beta, maximizingPlayerId, currentPlayerId, passed) {
    aiNodesVisited++;
    depthVisits[depth] = (depthVisits[depth] || 0) + 1;
    
    if (depth <= 0) return staticEvaluation(board, maximizingPlayerId);

    let moves = getValidMovesForPlayer(board, currentPlayerId);
    const opponentId = currentPlayerId === 1 ? 2 : 1;

    if (moves.length === 0) {
        if (passed) return staticEvaluation(board, maximizingPlayerId); 
        return alphaBeta(board, depth, alpha, beta, maximizingPlayerId, opponentId, true); 
    }

    const scoredMoves = moves.map(m => {
        const nb = simulateMove(board, m, currentPlayerId);
        return { board: nb, score: staticEvaluation(nb, maximizingPlayerId) };
    });

    if (currentPlayerId === maximizingPlayerId) {
        let maxEval = -Infinity;
        scoredMoves.sort((a, b) => b.score - a.score); 
        for (let item of scoredMoves) {
            let nextAlpha = usePruning ? alpha : -Infinity;
            let nextBeta = usePruning ? beta : Infinity;
            const ev = alphaBeta(item.board, depth - 1, nextAlpha, nextBeta, maximizingPlayerId, opponentId, false);
            maxEval = Math.max(maxEval, ev);
            if (usePruning) {
                alpha = Math.max(alpha, ev);
                if (beta <= alpha) break;
            }
        }
        return maxEval;
    } else {
        let minEval = Infinity;
        scoredMoves.sort((a, b) => a.score - b.score); 
        for (let item of scoredMoves) {
            let nextAlpha = usePruning ? alpha : -Infinity;
            let nextBeta = usePruning ? beta : Infinity;
            const ev = alphaBeta(item.board, depth - 1, nextAlpha, nextBeta, maximizingPlayerId, opponentId, false);
            minEval = Math.min(minEval, ev);
            if (usePruning) {
                beta = Math.min(beta, ev);
                if (beta <= alpha) break;
            }
        }
        return minEval;
    }
}

// Worker Communication Interface
self.onmessage = function(e) {
    const { id, tasks, rootPlayerId, weights, pruning, nVal } = e.data;
    
    if (N !== nVal || categoryMap.length === 0) {
        N = nVal;
        initGeometry();
    }
    
    currentBrain = { weights: weights };
    usePruning = pruning;
    aiNodesVisited = 0;
    depthVisits = {};

    let results = [];

    for (let task of tasks) {
        let score = alphaBeta(task.board, task.depthLeft, -Infinity, Infinity, rootPlayerId, task.currentPlayer, task.passed);
        results.push({ m1: task.m1, m2: task.m2, score: score });
    }

    self.postMessage({
        id: id,
        results: results,
        totalNodes: aiNodesVisited,
        depthVisits: depthVisits
    });
};
