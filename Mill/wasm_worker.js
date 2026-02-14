/*
 * wasm_worker.js
 * Fixed: Now respects the AlphaBeta toggle passed in search requests
 */
let depthsBuffer = null;
var Module = {
    print: function(text) {
        if (arguments.length > 1) {
            text = Array.prototype.slice.call(arguments).join(' ');
        }
        postMessage({
            type: 'REPORT',
            text: "[C++] " + text
        });
    },
    printErr: function(text) {
        if (arguments.length > 1) {
            text = Array.prototype.slice.call(arguments).join(' ');
        }
        postMessage({
            type: 'REPORT',
            text: "[C++ Error] " + text
        });
    },
    onRuntimeInitialized: function() {
        isReady = true;
        Module._initEngine();
        boardBuffer = Module._malloc(25 * 4);
        depthsBuffer = Module._malloc(64 * 4);
        postMessage({
            type: 'ENGINE_READY'
        });
    }
};
importScripts('mill_engine.js');
let isReady = false;
let boardBuffer = null;
// C++ Constants
const CPP_MAX = 99999;
const CPP_MIN = -99999;

onmessage = function(e) {
    if (!isReady) {
        return;
    }
    const data = e.data;
    // --- CONTROL SWITCHES (Direct Commands) ---
    if (data.command === "clearTT") {
        Module._clearTT();
        return;
    }
    if (data.command === "setTT") {
        Module._setTTEnabled(data.value ? 1 : 0);
        return;
    }
    if (data.command === "setPruning") {
        Module._setPruningEnabled(data.value ? 1 : 0);
        return;
    }
    // --- SEARCH REQUEST ---
    if (data.brain) {
        // 1. Configure Engine Settings based on Request Data
        Module._setBrain(
            data.brain.groupScore || 0,
            data.brain.N3 || 0,
            data.brain.N4 || 0,
            data.brain.mobility1Score || 0,
            data.brain.mobility2Score || 0,
            data.brain.flyBonus || 0,
            data.brain.pieceDiffMultiplier || 0,
            data.brain.millScore || 0,
            data.brain.doubleMillScore || 0,
            data.brain.nearMillFilled || 0,
            data.brain.nearMillReady || 0,
            data.brain.nearMillGuaranteed || 0
        );
        // FIX: Update Pruning & TT settings from the search packet
        if (data.AlphaBeta !== undefined) {
            Module._setPruningEnabled(data.AlphaBeta ? 1 : 0);
        }
        if (data.TTable !== undefined) {
            Module._setTTEnabled(data.TTable ? 1 : 0);
        }
        // 2. Prepare Board
        const safeBoard = new Int32Array(data.board);
        Module.HEAP32.set(safeBoard, boardBuffer >> 2);
        // 3. Clamp Alpha/Beta (BigInt Safety)
        let rawAlpha = Number(data.alpha);
        let rawBeta = Number(data.beta);
        let safeAlpha = Math.max(rawAlpha, CPP_MIN * 2);
        if (safeAlpha > CPP_MAX * 2) {
            safeAlpha = CPP_MAX * 2;
        }
        let safeBeta = Math.min(rawBeta, CPP_MAX * 2);
        if (safeBeta < CPP_MIN * 2) {
            safeBeta = CPP_MIN * 2;
        }
        const startTime = performance.now();
        // 4. Run Search
        const score = Module._search(
            boardBuffer,
            data.depth,
            safeAlpha,
            safeBeta,
            data.whiteMode || 0,
            data.blackMode || 0,
            data.symmetryCutOff || 12,
            depthsBuffer
        );
        const endTime = performance.now();
        const nodes = Module._getNodesVisited();
        // 5. Read Output
        let depthsArray = [];
        for (let i = 0; i <= data.depth + 1; i++) {
            depthsArray[i] = Module.HEAP32[(depthsBuffer >> 2) + i];
        }
        postMessage({
            id: data.id,
            moveIndex: data.moveIndex,
            value: score,
            depth: data.depth,
            newAlpha: data.alpha,
            newBeta: data.beta,
            Depths: depthsArray,
            nodes: nodes,
            time: endTime - startTime
        });
    }
};
