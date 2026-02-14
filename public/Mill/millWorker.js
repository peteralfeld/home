/*
 * millWorker.js
 * Web Worker for Mill AI Search
 * Handles off-main-thread calculations for the Alpha-Beta search.
 */
import {
    npoints,
    maxScore,
    minScore,
    White,
    Black,
    adjacencyList,
    Mills,
    B,
    P,
    TTenabled,
    pruningEnabled,
    symmetryCutOff,
    neighbors,
    inMill,
    debug,
    stop,
    evaluate,
    setTT,
    clearTT,
    setPruning,
    setMaxTTEntries,
    setMinSaveDepth,
    transpositionTable,
    ZobrinHash,
    setSymmetryCutOff,
    setStopTime
} from './shared.js';

onmessage = function(task) {
    try {
        const data = task.data;
        // --- COMMAND HANDLERS ---
        if (data.command === "clearTT") {
            clearTT();
            self.bookLoaded = false;
            return;
        }
        if (data.command === "exportTT") {
            const entries = Array.from(transpositionTable.entries());
            self.postMessage({
                type: 'EXPORT_TT',
                buffer: entries
            });
            return;
        }
        // --- SEARCH TASK ---
        // Destructure task parameters
        let {
            id,
            brain,
            moveIndex,
            depth,
            Depth,
            board,
            alpha,
            beta,
            depths,
            AlphaBeta,
            TTable,
            historyHashes,
            value,
            ttLimit,
            minSaveDepth,
            stopTime
        } = task.data;
        // Configure Global State for this Worker context
        if (ttLimit) {
            setMaxTTEntries(ttLimit);
        }
        if (minSaveDepth) {
            setMinSaveDepth(minSaveDepth);
        }
        if (symmetryCutOff !== undefined) {
            setSymmetryCutOff(symmetryCutOff);
        }
        setStopTime(stopTime || 0);
        setPruning(AlphaBeta);
        setTT(TTable);
        // Reset depth counters
        for (let i = 0; i < Math.max(depth, Depth); i++) {
            depths[i] = 0;
        }
        // Execute Evaluation
        let result = evaluate(brain, board, depth, alpha, beta, depths, historyHashes);
        // Return Results
        data.value = result[0];
        data.newAlpha = result[1];
        data.newBeta = result[2];
        data.Depths = result[3];
        self.postMessage(data);
    }
    catch (error) {
        // Handle Timeouts strictly
        if (error.message === "TIMEOUT") {
            self.postMessage({
                type: 'TIMEOUT',
                id: task.data ? task.data.id : 0
            });
            return;
        }
        // Handle General Errors
        self.postMessage({
            id: task.data ? task.data.id : 0,
            error: error.message,
            moveIndex: task.data ? task.data.moveIndex : -1,
            depth: task.data ? task.data.depth : -1,
            value: 99999999
        });
    }
};
