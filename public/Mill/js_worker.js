/*
 * js_worker.js
 * Fixed: Now respects the AlphaBeta toggle passed in search requests
 */
import {
    evaluate,
    clearTT,
    setTT,
    setPruning,
    setMaxTTEntries
} from './shared.js';

onmessage = function(e) {
    const data = e.data;
    // --- Control Commands ---
    if (data.command === "clearTT") {
        clearTT();
        return;
    }
    if (data.command === "setTT") {
        setTT(data.value);
        return;
    }
    // --- ADD THIS NEW COMMAND ---
    if (data.command === "setMaxTTEntries") {
        // Initialize the TypedArrays
        // We import setMaxTTEntries at the top of this file
        // (Make sure to update the import line below!)
        setMaxTTEntries(data.value);
        return;
    }
    // ----------------------------
    if (data.command === "setPruning") {
        setPruning(data.value);
        return;
    }
    // --- Search Request ---
    if (data.brain) {
        // FIX: Update settings from the search packet before evaluating
        if (data.AlphaBeta !== undefined) {
            setPruning(data.AlphaBeta);
        }
        if (data.TTable !== undefined) {
            setTT(data.TTable);
        }
        const startTime = performance.now();
        let localDepths = new Array(data.depth + 1).fill(0);
        const result = evaluate(
            data.brain,
            data.board,
            data.depth,
            data.alpha,
            data.beta,
            localDepths,
            data.historyHashes || [],
            data.whiteMode || 0,
            data.blackMode || 0
        );
        const endTime = performance.now();
        let nodesVisited = 0;
        for (let k in localDepths) {
            if (localDepths[k]) {
                nodesVisited += localDepths[k];
            }
        }
        postMessage({
            id: data.id,
            moveIndex: data.moveIndex,
            value: result[0], // score
            depth: data.depth,
            newAlpha: result[1], // alpha
            newBeta: result[2], // beta
            Depths: localDepths,
            nodes: nodesVisited,
            time: endTime - startTime
        });
    }
};
