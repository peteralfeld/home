/*
 * shared.js
 * Shared Utilities for Mill
 */

// --- GLOBAL CONSTANTS ---
export const npoints = 24;
export const maxScore = 99999;
export const minScore = -99999;
export const White = "White";
export const Black = "Black";
export const P = 2251799813685229n; // Large Prime for Hashing (BigInt)
export const B = 999999;

// --- BOARD DATA ---
// Adjacency list defining the connections between board vertices [1..24]
// Index 0 is empty (unused)
export const adjacencyList = [
    [],
    [2, 10],
    [1, 3, 5],
    [2, 15],
    [5, 11],
    [2, 4, 6, 8],
    [5, 14],
    [8, 12],
    [5, 7, 9],
    [8, 13],
    [1, 11, 22],
    [4, 10, 12, 19],
    [7, 11, 16],
    [9, 14, 18],
    [6, 13, 15, 21],
    [3, 14, 24],
    [12, 17],
    [16, 18, 20],
    [13, 17],
    [11, 20],
    [17, 19, 21, 23],
    [14, 20],
    [10, 23],
    [20, 22, 24],
    [15, 23]
];

// List of all possible Mill combinations (triplets of connected vertices)
export const Mills = [
    [],
    [[2, 3], [10, 22]],
    [[1, 3], [5, 8]],
    [[1, 2], [15, 24]],
    [[5, 6], [11, 19]],
    [[4, 6], [2, 8]],
    [[4, 5], [14, 21]],
    [[8, 9], [12, 16]],
    [[7, 9], [2, 5]],
    [[7, 8], [13, 18]],
    [[1, 22], [11, 12]],
    [[10, 12], [4, 19]],
    [[10, 11], [7, 16]],
    [[14, 15], [9, 18]],
    [[13, 15], [6, 21]],
    [[13, 14], [3, 24]],
    [[17, 18], [7, 12]],
    [[16, 18], [20, 23]],
    [[16, 17], [9, 13]],
    [[20, 21], [4, 11]],
    [[19, 21], [17, 23]],
    [[19, 20], [6, 14]],
    [[23, 24], [1, 10]],
    [[22, 24], [17, 20]],
    [[22, 23], [3, 15]]
];

// Symmetry permutations for the board (rotations and reflections)
// Used to reduce the search space in the transposition table
export const perms = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24],
    [0, 22, 23, 24, 19, 20, 21, 16, 17, 18, 10, 11, 12, 13, 14, 15, 7, 8, 9, 4, 5, 6, 1, 2, 3],
    [0, 3, 2, 1, 6, 5, 4, 9, 8, 7, 15, 14, 13, 12, 11, 10, 18, 17, 16, 21, 20, 19, 24, 23, 22],
    [0, 3, 15, 24, 6, 14, 21, 9, 13, 18, 2, 5, 8, 17, 20, 23, 7, 12, 16, 4, 11, 19, 1, 10, 22],
    [0, 22, 10, 1, 19, 11, 4, 16, 12, 7, 23, 20, 17, 8, 5, 2, 18, 13, 9, 21, 14, 6, 24, 15, 3],
    [0, 1, 10, 22, 4, 11, 19, 7, 12, 16, 2, 5, 8, 17, 20, 23, 9, 13, 18, 6, 14, 21, 3, 15, 24],
    [0, 24, 15, 3, 21, 14, 6, 18, 13, 9, 23, 20, 17, 8, 5, 2, 16, 12, 7, 19, 11, 4, 22, 10, 1],
    [0, 7, 8, 9, 4, 5, 6, 1, 2, 3, 12, 11, 10, 15, 14, 13, 22, 23, 24, 19, 20, 21, 16, 17, 18],
    [0, 24, 23, 22, 21, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1],
    [0, 16, 17, 18, 19, 20, 21, 22, 23, 24, 12, 11, 10, 15, 14, 13, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [0, 9, 8, 7, 6, 5, 4, 3, 2, 1, 13, 14, 15, 10, 11, 12, 24, 23, 22, 21, 20, 19, 18, 17, 16],
    [0, 18, 17, 16, 21, 20, 19, 24, 23, 22, 13, 14, 15, 10, 11, 12, 3, 2, 1, 6, 5, 4, 9, 8, 7],
    [0, 9, 13, 18, 6, 14, 21, 3, 15, 24, 8, 5, 2, 23, 20, 17, 1, 10, 22, 4, 11, 19, 7, 12, 16],
    [0, 18, 13, 9, 21, 14, 6, 24, 15, 3, 17, 20, 23, 2, 5, 8, 22, 10, 1, 19, 11, 4, 16, 12, 7],
    [0, 7, 12, 16, 4, 11, 19, 1, 10, 22, 8, 5, 2, 23, 20, 17, 3, 15, 24, 6, 14, 21, 9, 13, 18],
    [0, 16, 12, 7, 19, 11, 4, 22, 10, 1, 17, 20, 23, 2, 5, 8, 24, 15, 3, 21, 14, 6, 18, 13, 9]
];

// Object structure for a single Move
export const Move = {
    ply: 0,
    p: 0,
    q: 0,
    x: 0,
    player: White,
    w: 0,
    b: 0,
    init: function() {
        this.ply = 0;
        this.p = 0;
        this.q = 0;
        this.x = 0;
    }
};

// --- AI PERSONALITIES ---
// Each "Brain" has weights for different strategic elements.
// E.g., N3 = value of 3-way intersection, N4 = 4-way intersection.

const Arwen = {
    name: "Arwen",
    groupScore: 62,
    N3: 13,
    N4: 33,
    mobility1Score: 178,
    mobility2Score: 4,
    flyBonus: 78,
    pieceDiffMultiplier: 552,
    millScore: 18,
    doubleMillScore: 1000,
    nearMillFilled: 10,
    nearMillReady: 98,
    nearMillGuaranteed: 626
};

const Dwalin = {
    name: "Dwalin",
    groupScore: 37,
    N3: 11,
    N4: 29,
    mobility1Score: 145,
    mobility2Score: 3,
    flyBonus: 30,
    pieceDiffMultiplier: 452,
    millScore: 24,
    doubleMillScore: 1000,
    nearMillFilled: 15,
    nearMillReady: 54,
    nearMillGuaranteed: 508
};

const Bilbo = {
    name: "Bilbo",
    groupScore: 47,
    N3: 13,
    N4: 31,
    mobility1Score: 153,
    mobility2Score: 4,
    flyBonus: 33,
    pieceDiffMultiplier: 480,
    millScore: 24,
    doubleMillScore: 1000,
    nearMillFilled: 12,
    nearMillReady: 52,
    nearMillGuaranteed: 531
};

const Eowyn = {
    name: "Eowyn",
    groupScore: 81,
    N3: 15,
    N4: 49,
    mobility1Score: 267,
    mobility2Score: 4,
    flyBonus: 89,
    pieceDiffMultiplier: 741,
    millScore: 28,
    doubleMillScore: 1000,
    nearMillFilled: 12,
    nearMillReady: 57,
    nearMillGuaranteed: 856
};

const Celebrian = {
    name: "Celebrian",
    groupScore: 79,
    N3: 16,
    N4: 48,
    mobility1Score: 184,
    mobility2Score: 4,
    flyBonus: 92,
    pieceDiffMultiplier: 733,
    millScore: 22,
    doubleMillScore: 1000,
    nearMillFilled: 10,
    nearMillReady: 116,
    nearMillGuaranteed: 713
};

// Frodo is a composite brain, averaging Arwen and Bilbo
const Frodo = {
    name: "Frodo",
    groupScore: Math.round((Arwen.groupScore + Bilbo.groupScore) / 2),
    N3: Math.round((Arwen.N3 + Bilbo.N3) / 2),
    N4: Math.round((Arwen.N4 + Bilbo.N4) / 2),
    mobility1Score: Math.round((Arwen.mobility1Score + Bilbo.mobility1Score) / 2),
    mobility2Score: Math.round((Arwen.mobility2Score + Bilbo.mobility2Score) / 2),
    flyBonus: Math.round((Arwen.flyBonus + Bilbo.flyBonus) / 2),
    pieceDiffMultiplier: Math.round((Arwen.pieceDiffMultiplier + Bilbo.pieceDiffMultiplier) / 2),
    millScore: Math.round((Arwen.millScore + Bilbo.millScore) / 2),
    doubleMillScore: Math.round((Arwen.doubleMillScore + Bilbo.doubleMillScore) / 2),
    nearMillFilled: Math.round((Arwen.nearMillFilled + Bilbo.nearMillFilled) / 2),
    nearMillReady: Math.round((Arwen.nearMillReady + Bilbo.nearMillReady) / 2),
    nearMillGuaranteed: Math.round((Arwen.nearMillGuaranteed + Bilbo.nearMillGuaranteed) / 2),
};

// Original pre-tournament parameters
const Galadriel = {
    name: "Galadriel",
    groupScore: 50,
    N3: 15,
    N4: 30,
    mobility1Score: 10,
    mobility2Score: 4,
    flyBonus: 300,
    pieceDiffMultiplier: 1000,
    millScore: 100,
    doubleMillScore: 500,
    nearMillFilled: 10,
    nearMillReady: 20,
    nearMillGuaranteed: 30
};

// Constant parameters for testing
const Hamfast = {
    name: "Hamfast",
    groupScore: 1000,
    N3: 1000,
    N4: 1000,
    mobility1Score: 1000,
    mobility2Score: 1000,
    flyBonus: 1000,
    pieceDiffMultiplier: 1000,
    millScore: 1000,
    doubleMillScore: 1000,
    nearMillFilled: 1000,
    nearMillReady: 1000,
    nearMillGuaranteed: 1000
};

// Zero parameters for testing
const Indis = {
    name: "Indis",
    groupScore: 0,
    N3: 0,
    N4: 0,
    mobility1Score: 0,
    mobility2Score: 0,
    flyBonus: 0,
    pieceDiffMultiplier: 0,
    millScore: 0,
    doubleMillScore: 0,
    nearMillFilled: 0,
    nearMillReady: 0,
    nearMillGuaranteed: 0
};

// Negative of Arwen for testing
const Jolly = {
    name: "Jolly",
    groupScore: -Arwen.groupScore,
    N3: -Arwen.N3,
    N4: -Arwen.N4,
    mobility1Score: -Arwen.mobility1Score,
    mobility2Score: -Arwen.mobility2Score,
    flyBonus: -Arwen.flyBonus,
    pieceDiffMultiplier: -Arwen.pieceDiffMultiplier,
    millScore: -Arwen.millScore,
    doubleMillScore: -Arwen.doubleMillScore,
    nearMillFilled: -Arwen.nearMillFilled,
    nearMillReady: -Arwen.nearMillReady,
    nearMillGuaranteed: -Arwen.nearMillGuaranteed,
};

// Exporting the Array to fix the Menu
export const BrainList = [null, Arwen, Bilbo, Celebrian, Dwalin, Eowyn, Frodo, Galadriel, Hamfast, Indis, Jolly];

// Factory function for creating custom brains
export function makeBrain(name, groupScore, N3, N4, mobility1Score, mobility2Score, flyBonus, pieceDiffMultiplier, millScore, doubleMillScore, nearMillFilled, nearMillReady, nearMillGuaranteed) {
    return {
        name,
        groupScore,
        N3,
        N4,
        mobility1Score,
        mobility2Score,
        flyBonus,
        pieceDiffMultiplier,
        millScore,
        doubleMillScore,
        nearMillFilled,
        nearMillReady,
        nearMillGuaranteed
    };
}

export function defaultBrain() {
    return Arwen;
}

// --- UTILITIES ---

export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export function debug(msg) {
    console.log(msg);
}

export function stop() {
    throw new Error("STOP");
}

export function mod(n, m) {
    return ((n % m) + m) % m;
}

export function time() {
    return performance.now() / 1000;
}

export function boardCopy(src) {
    return [...src];
}

export function neighbors(p, q) {
    return adjacencyList[p].includes(q);
}

// Logic used by Main Thread to check if a move completes a mill
export function inMill(p, board) {
    let player = board[p];
    if (player === 1) {
        return false;
    }
    for (let m of Mills[p]) {
        if (board[m[0]] === player && board[m[1]] === player) {
            return true;
        }
    }
    return false;
}

// Generates all legal moves for the current board state
export function findMoves(board) {
    let moves = [];
    let ply = board[0];
    let player = (ply % 2 === 0) ? 2 : 3;
    let opponent = (player === 2) ? 3 : 2;
    let white = 0,
        black = 0;
    for (let i = 1; i <= npoints; i++) {
        if (board[i] === 2) {
            white++;
        }
        else {
            if (board[i] === 3) {
                black++;
            }
        }
    }
    // Phase 1: Placement (up to ply 18)
    if (ply < 18) {
        for (let p = 1; p <= npoints; p++) {
            if (board[p] === 1) {
                board[p] = player;
                if (inMill(p, board)) {
                    // Move creates a mill, must capture
                    let canCapture = false;
                    for (let x = 1; x <= npoints; x++) {
                        if (board[x] === opponent && !inMill(x, board)) {
                            moves.push({
                                p: p,
                                q: 0,
                                x: x
                            });
                            canCapture = true;
                        }
                    }
                    if (!canCapture) {
                        for (let x = 1; x <= npoints; x++) {
                            if (board[x] === opponent) {
                                moves.push({
                                    p: p,
                                    q: 0,
                                    x: x
                                });
                            }
                        }
                    }
                }
                else {
                    moves.push({
                        p: p,
                        q: 0,
                        x: 0
                    });
                }
                board[p] = 1;
            }
        }
    }
    // Phase 2: Movement
    else {
        let flying = ((player === 2 ? white : black) === 3);
        for (let p = 1; p <= npoints; p++) {
            if (board[p] === player) {
                let targets = flying ? Array.from({
                    length: 24
                }, (_, i) => i + 1).filter(t => board[t] === 1) : adjacencyList[p].filter(t => board[t] === 1);
                for (let q of targets) {
                    board[p] = 1;
                    board[q] = player;
                    if (inMill(q, board)) {
                        let canCapture = false;
                        for (let x = 1; x <= npoints; x++) {
                            if (board[x] === opponent && !inMill(x, board)) {
                                moves.push({
                                    p: p,
                                    q: q,
                                    x: x
                                });
                                canCapture = true;
                            }
                        }
                        if (!canCapture) {
                            for (let x = 1; x <= npoints; x++) {
                                if (board[x] === opponent) {
                                    moves.push({
                                        p: p,
                                        q: q,
                                        x: x
                                    });
                                }
                            }
                        }
                    }
                    else {
                        moves.push({
                            p: p,
                            q: q,
                            x: 0
                        });
                    }
                    board[q] = 1;
                    board[p] = player;
                }
            }
        }
    }
    return moves;
}

// Applies a move to the board and returns a new board state
export function apply(m, board) {
    let nb = [...board];
    if (m.q === 0) {
        nb[m.p] = (board[0] % 2 === 0) ? 2 : 3;
    }
    else {
        nb[m.q] = nb[m.p];
        nb[m.p] = 1;
    }
    if (m.x > 0) {
        nb[m.x] = 1;
    }
    return nb;
}

// Applies a symmetry permutation to the board
export function applyPermutation(board, perm) {
    let nb = new Array(25).fill(0);
    nb[0] = board[0];
    for (let i = 1; i <= npoints; i++) {
        nb[i] = board[perm[i]];
    }
    return nb;
}

// --- ZOBRIST HASHING ---
// Used for Transposition Tables to uniquely identify board states
export const ZTable = [];
export let ZTurn = 0n;
let ZInitialized = false;
let seed = 987654321;

function nextRand() {
    seed = (1664525 * seed + 1013904223) % 4294967296;
    return BigInt(seed);
}

function initZobrist() {
    if (ZInitialized) {
        return;
    }
    for (let p = 0; p <= npoints; p++) {
        ZTable[p] = [];
        for (let c = 0; c < 4; c++) {
            let r1 = nextRand();
            let r2 = nextRand();
            ZTable[p][c] = r1 | (r2 << 32n);
        }
    }
    let r1 = nextRand();
    let r2 = nextRand();
    ZTurn = r1 | (r2 << 32n);
    ZInitialized = true;
}
initZobrist();

// Computes hash for current board. Lazy initialization handled here.
export function ZobrinHash(board) {
    if (!ZInitialized) {
        initZobrist();
    }
    let h = 0n;
    if (board[0] % 2 !== 0) {
        h ^= ZTurn;
    }
    for (let p = 1; p <= npoints; p++) {
        h ^= ZTable[p][board[p]];
    }
    return h;
}

// Finds the canonical hash by checking all 16 symmetries
export function hash(board) {
    let bestH = null;
    let bestPerm = 0;
    let bestBoard = null;
    for (let i = 0; i < 16; i++) {
        let pb = applyPermutation(board, perms[i]);
        let h = ZobrinHash(pb);
        // Correct initialization: If bestH is null, take h.
        if (bestH === null || h < bestH) {
            bestH = h;
            bestPerm = i;
            bestBoard = pb;
        }
    }
    return [bestH, bestPerm, bestBoard];
}

// --- SAFE TRANSPOSITION TABLE (Map-Based) ---
export let pruningEnabled = true;
export let TTenabled = true;
export let symmetryCutOff = 19;
export let maxTTEntries = 1000000;
let transpositionTable = new Map();

export function setTT(v) {
    TTenabled = v;
}

export function setMaxTTEntries(count) {
    maxTTEntries = count;
}

export function clearTT() {
    transpositionTable.clear();
}

export function setPruning(v) {
    pruningEnabled = v;
}

export function setMinSaveDepth(v) {}

export function setSymmetryCutOff(v) {
    symmetryCutOff = v;
}

export function setStopTime(v) {}

// --- HELPER EVALUATION FUNCTIONS ---

function calculateMobility(board, ply, white, black, playerCode, m1, m2) {
    let total = 0;
    let isWhite = (playerCode === 2);
    let count = isWhite ? white : black;
    if (ply >= 18 && count === 3) {
        let empty = 0;
        for (let i = 1; i <= 24; i++) {
            if (board[i] === 1) {
                empty++;
            }
        }
        return empty * m1;
    }
    for (let p = 1; p <= 24; p++) {
        if (board[p] === playerCode) {
            for (let n1 of adjacencyList[p]) {
                if (board[n1] === 1) {
                    total += m1;
                    for (let n2 of adjacencyList[n1]) {
                        if (n2 !== p && board[n2] === 1) {
                            total += m2;
                        }
                    }
                }
            }
        }
    }
    return total;
}

// Calculates fragmentation of pieces using graph traversal
function calculateGroups(board, player) {
    let ply = board[0];
    let stoneCount = 0;
    for (let i = 1; i <= 24; i++) {
        if (board[i] === player) {
            stoneCount++;
        }
    }
    if (stoneCount === 3 && ply >= 18) {
        return 1;
    }
    if (stoneCount === 0) {
        return 0;
    }
    let opponent = (player === 2 ? 3 : 2);
    let visited = new Array(25).fill(false);
    let groups = 0;
    for (let i = 1; i <= 24; i++) {
        if (board[i] === player && !visited[i]) {
            groups++;
            let stack = [i];
            visited[i] = true;
            while (stack.length > 0) {
                let u = stack.pop();
                for (let v of adjacencyList[u]) {
                    // --- CRITICAL CHANGE HERE ---
                    // We traverse if the neighbor is Friendly OR Empty.
                    // We only stop if the neighbor is the Opponent.
                    if (board[v] !== opponent && !visited[v]) {
                        visited[v] = true;
                        stack.push(v);
                    }
                }
            }
        }
    }
    return groups;
}

function calculateMillsCount(board, player, scoreVal) {
    let score = 0;
    for (let p = 1; p <= 24; p++) {
        if (board[p] === player && inMill(p, board)) {
            score += scoreVal;
        }
    }
    return score;
}

// --- MINIMAX SEARCH ---
// Recursive function to determine the best move score
export function evaluate(brain, board, depth, alpha, beta, depths, historyHashes = [], wMode = 0, bMode = 0) {
    if (depths && depths[depth] !== undefined) {
        depths[depth]++;
    }
    let alphaNum = Number(alpha);
    let betaNum = Number(beta);
    let originalAlpha = alphaNum;
    let zHash = 0n;
    // Transposition Table Lookup
    if (TTenabled) {
        if (board[0] < symmetryCutOff) {
            zHash = hash(board)[0];
        }
        else {
            zHash = ZobrinHash(board);
        }
        if (transpositionTable.has(zHash)) {
            let entry = transpositionTable.get(zHash);
            if (entry.depth >= depth) {
                if (entry.flag === 0) {
                    return [entry.val, alphaNum, betaNum, depths];
                }
                if (entry.flag === 1) {
                    alphaNum = Math.max(alphaNum, entry.val);
                }
                if (entry.flag === 2) {
                    betaNum = Math.min(betaNum, entry.val);
                }
                if (alphaNum >= betaNum) {
                    return [entry.val, alphaNum, betaNum, depths];
                }
            }
        }
    }
    // Win/Loss check (under 3 pieces)
    let w = 0,
        b = 0;
    for (let i = 1; i <= 24; i++) {
        if (board[i] === 2) {
            w++;
        }
        else {
            if (board[i] === 3) {
                b++;
            }
        }
    }
    if (board[0] >= 18) {
        if (w < 3) {
            return [minScore - depth, alphaNum, betaNum, depths];
        }
        if (b < 3) {
            return [maxScore + depth, alphaNum, betaNum, depths];
        }
    }
    // Leaf node: Static Evaluation
    if (depth === 0) {
        let score = staticEvaluation(brain, board, false);
        return [score, alphaNum, betaNum, depths];
    }
    // Recursive Step
    let moves = findMoves(board);
    if (moves.length === 0) {
        return [(board[0] % 2 === 0) ? minScore - depth : maxScore + depth, alphaNum, betaNum, depths];
    }
    // Sort moves to improve pruning (captures first)
    moves.sort((a, b) => {
        return (b.x > 0) - (a.x > 0);
    });
    let bestVal = (board[0] % 2 === 0) ? minScore : maxScore;
    for (let m of moves) {
        let nb = apply(m, board);
        nb[0]++;
        let res = evaluate(brain, nb, depth - 1, alphaNum, betaNum, depths, [], wMode, bMode);
        let val = res[0];
        if (board[0] % 2 === 0) {
            if (val > bestVal) {
                bestVal = val;
            }
            if (val > alphaNum) {
                alphaNum = val;
            }
        }
        else {
            if (val < bestVal) {
                bestVal = val;
            }
            if (val < betaNum) {
                betaNum = val;
            }
        }
        // Alpha-Beta Pruning Cutoff
        if (pruningEnabled && alphaNum >= betaNum) {
            break;
        }
    }
    // Store result in Transposition Table
    if (TTenabled) {
        let flag = 0;
        if (bestVal <= originalAlpha) {
            flag = 2;
        }
        else {
            if (bestVal >= betaNum) {
                flag = 1;
            }
        }
        if (transpositionTable.size >= maxTTEntries) {
            transpositionTable.delete(transpositionTable.keys().next().value);
        }
        transpositionTable.set(zHash, {
            val: bestVal,
            depth: depth,
            flag: flag
        });
    }
    return [bestVal, alphaNum, betaNum, depths];
}

// --- STATIC EVALUATION ---
// Calculates score of a board position based on Brain weights
export function staticEvaluation(brain, board, verbose = false) {
    let w = 0,
        b = 0;
    let wN3 = 0,
        wN4 = 0,
        bN3 = 0,
        bN4 = 0;
    const Lines = [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
        [10, 11, 12],
        [13, 14, 15],
        [16, 17, 18],
        [19, 20, 21],
        [22, 23, 24],
        [1, 10, 22],
        [4, 11, 19],
        [7, 12, 16],
        [2, 5, 8],
        [17, 20, 23],
        [9, 13, 18],
        [6, 14, 21],
        [3, 15, 24]
    ];
    // Helper to analyze lines for Mills and Near-Mills
    function analyzeLineStats(playerCode) {
        let oppCode = (playerCode === 2) ? 3 : 2;
        let stats = {
            Mill: 0,
            NMF: 0,
            NMR: 0,
            NMG: 0,
            DM: 0
        };
        let millStones = [];
        let potentialTargets = new Array(25).fill(false);
        for (let line of Lines) {
            let myCount = 0;
            let oppCount = 0;
            let targetSpot = -1;
            for (let p of line) {
                if (board[p] === playerCode) {
                    myCount++;
                }
                else {
                    if (board[p] === oppCode) {
                        oppCount++;
                    }
                    targetSpot = p;
                }
            }
            if (myCount === 3) {
                stats.Mill++;
                for (let p of line) {
                    if (!millStones.includes(p)) {
                        millStones.push(p);
                    }
                }
            }
            else {
                if (myCount === 2) {
                    potentialTargets[targetSpot] = true;
                    let externalFriendReady = false;
                    let enemyContesting = false;
                    for (let n of adjacencyList[targetSpot]) {
                        if (board[n] === playerCode && !line.includes(n)) {
                            externalFriendReady = true;
                        }
                        if (board[n] === oppCode) {
                            enemyContesting = true;
                        }
                    }
                    if (board[targetSpot] === oppCode) {
                        if (externalFriendReady) {
                            stats.NMF++;
                        }
                    }
                    else {
                        if (externalFriendReady) {
                            if (enemyContesting) {
                                stats.NMR++;
                            }
                            else {
                                stats.NMG++;
                            }
                        }
                    }
                }
            }
        }
        // Double Mill calculation
        for (let p of millStones) {
            for (let n of adjacencyList[p]) {
                if (potentialTargets[n]) {
                    stats.DM++;
                    break;
                }
            }
        }
        return stats;
    }
    // Gather raw data
    for (let i = 1; i <= 24; i++) {
        if (board[i] === 2) {
            w++;
            let n = adjacencyList[i].length;
            if (n === 3) {
                wN3++;
            }
            else {
                if (n === 4) {
                    wN4++;
                }
            }
        }
        else {
            if (board[i] === 3) {
                b++;
                let n = adjacencyList[i].length;
                if (n === 3) {
                    bN3++;
                }
                else {
                    if (n === 4) {
                        bN4++;
                    }
                }
            }
        }
    }
    let wFrag = calculateGroups(board, 2);
    let bFrag = calculateGroups(board, 3);
    let ply = board[0];
    let wM1 = calculateMobility(board, ply, w, b, 2, 1, 0);
    let wM2 = calculateMobility(board, ply, w, b, 2, 0, 1);
    let bM1 = calculateMobility(board, ply, w, b, 3, 1, 0);
    let bM2 = calculateMobility(board, ply, w, b, 3, 0, 1);
    let wFly = (w === 3 && ply >= 18);
    let bFly = (b === 3 && ply >= 18);
    let wLine = analyzeLineStats(2);
    let bLine = analyzeLineStats(3);
    // Apply weights
    let score = 0;
    score += (w - b) * brain.pieceDiffMultiplier;
    score += (wN3 - bN3) * brain.N3;
    score += (wN4 - bN4) * brain.N4;
    if (brain.groupScore !== 0) {
        score -= (wFrag * brain.groupScore);
        score += (bFrag * brain.groupScore);
    }
    score += (wM1 - bM1) * brain.mobility1Score;
    score += (wM2 - bM2) * brain.mobility2Score;
    if (wFly) {
        score += brain.flyBonus;
    }
    if (bFly) {
        score -= brain.flyBonus;
    }
    score += (wLine.Mill - bLine.Mill) * brain.millScore;
    score += (wLine.DM - bLine.DM) * brain.doubleMillScore;
    score += (wLine.NMF - bLine.NMF) * brain.nearMillFilled;
    score += (wLine.NMR - bLine.NMR) * brain.nearMillReady;
    score += (wLine.NMG - bLine.NMG) * brain.nearMillGuaranteed;
    if (verbose) {
        console.group("Detailed Evaluation");
        let line = `%c Board: ${board}`;
        console.log(line, "color: blue; font-weight: bold; font-size: 14px;");
        console.log(`%c Final Score: ${score}`, "color: green; font-weight: bold; font-size: 14px;");
        const pad = (v, len) => String(v).padStart(len);
        const row = (lbl, wVal, bVal, wt, net) => `${lbl.padEnd(6)} | ${pad(wVal,3)} | ${pad(bVal,3)} | ${pad(wt,4)} | ${pad(net,5)}`;
        let txt = "";
        txt += "Param  |  W  |  B  |  Wt  |  Net \n";
        txt += "-------|-----|-----|------|------\n";
        txt += row("GS", wFrag, bFrag, -brain.groupScore, -(wFrag - bFrag) * brain.groupScore) + "\n";
        txt += row("N3", wN3, bN3, brain.N3, (wN3 - bN3) * brain.N3) + "\n";
        txt += row("N4", wN4, bN4, brain.N4, (wN4 - bN4) * brain.N4) + "\n";
        txt += row("M1", wM1, bM1, brain.mobility1Score, (wM1 - bM1) * brain.mobility1Score) + "\n";
        txt += row("M2", wM2, bM2, brain.mobility2Score, (wM2 - bM2) * brain.mobility2Score) + "\n";
        txt += row("FB", wFly ? 1 : 0, bFly ? 1 : 0, brain.flyBonus, (Number(wFly) - Number(bFly)) * brain.flyBonus) + "\n";
        txt += row("PD", w, b, brain.pieceDiffMultiplier, (w - b) * brain.pieceDiffMultiplier) + "\n";
        txt += row("MS", wLine.Mill, bLine.Mill, brain.millScore, (wLine.Mill - bLine.Mill) * brain.millScore) + "\n";
        txt += row("DMS", wLine.DM, bLine.DM, brain.doubleMillScore, (wLine.DM - bLine.DM) * brain.doubleMillScore) + "\n";
        txt += row("NMF", wLine.NMF, bLine.NMF, brain.nearMillFilled, (wLine.NMF - bLine.NMF) * brain.nearMillFilled) + "\n";
        txt += row("NMR", wLine.NMR, bLine.NMR, brain.nearMillReady, (wLine.NMR - bLine.NMR) * brain.nearMillReady) + "\n";
        txt += row("NMG", wLine.NMG, bLine.NMG, brain.nearMillGuaranteed, (wLine.NMG - bLine.NMG) * brain.nearMillGuaranteed) + "\n";
        txt += "-------|-----|-----|------|------\n";
        txt += row("TOTAL", "", "", "", score);
        console.log(txt);
        console.groupEnd();
    }
    return score;
}
