/*
 * Mill.js
 * Main UI and Logic - Updated for Task Stack Architecture (100% CPU Utilization)
 */
import {
    npoints,
    maxScore,
    minScore,
    White,
    Black,
    adjacencyList,
    perms,
    Mills,
    Move,
    B,
    P,
    BrainList,
    maxTTEntries,
    pruningEnabled
} from './shared.js';
import {
    sleep,
    neighbors,
    inMill,
    applyPermutation,
    debug,
    stop,
    mod,
    findMoves,
    apply,
    boardCopy,
    time,
    evaluate,
    staticEvaluation,
    setPruning,
    ZobrinHash,
    hash,
    makeBrain,
    defaultBrain,
    setTT,
    clearTT,
    symmetryCutOff,
    setSymmetryCutOff
} from './shared.js';

let defaultBrainList = null;
const version = "Mill version of 2/11/26";
let Cores = (navigator.hardwareConcurrency - 2) || 4;
const emptyBoard = [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1];
const editorParams = [
    "groupScore", "N3", "N4", "mobility1Score", "mobility2Score", "flyBonus",
    "pieceDiffMultiplier", "millScore", "doubleMillScore", "nearMillFilled",
    "nearMillReady", "nearMillGuaranteed"
];
let pendingOB = new Map();
let obRequestId = 0;
let bookMoveTimer = null;
let silentMode = true;
let currentMatchTitle = "No Match Active";
let lastGameOutcome = "";
let tournamentActive = false;
let improving = false;
let useCppEngine = true;
let cppAvailable = true;
let totalTTLimit = 16000000;
const boardColor = "rgb(245,234,221)";
const historyboardColor = "rgb(220,255,255)";
const setupColor = "rgb(255,200,100)";
const LineColor = "rgb(0,75,0)";
const whiteBody = "rgb(255,255,255)";
const whiteRim = "rgb(0,0,0)";
const blackBody = "rgb(0,0,0)";
const blackRim = "rgb(255,255,255)";
const LabelColor = "rgb(0,200,0)";
const spacing = 100;
const radius = spacing / 6;
const lw = spacing / 15;
const msg = document.getElementById("status");
const Board = document.getElementById("Board");
const ctx = Board.getContext("2d");
const gameDiv = document.getElementById('game');
const searchDepthWhiteElement = document.getElementById('searchDepthWhite');
const searchDepthBlackElement = document.getElementById('searchDepthBlack');
const bareGameTop = "<H2>The Game</H2><p><table class = 'gameTable'><tr><td>n</td><td>P</td><td>p</td><td>q</td><td>x</td><td>w</td><td>b</td><td>V</td></tr><tr></tr>";
const gameBottom = "</TABLE>";
let gameBoard = [];
let history = [];
let Moves = [];
let points = [];
let playing = false;
let settingUp = false;
let gameOver = false;
let Mode = 1; // 1: Placing, 2: Moving, 3: Flying, 4: Draw, 5: White Wins, 6: Black Wins
let Player = White;
let whiteStones = 0;
let blackStones = 0;
let plyCount = 0;
let moveShown = 0;
let takeMode = false;
let dragging = false;
let movedPoint = 0;
let lastCapturePly = 0;
let threePieceStartPly = 0;
let gameShown = true;
let gameTop = "";
let workers = [];
let numberWorkers = 0;
let searchId = 0;
let searchAborted = false;
let currentStopTime = 0;
let currentDepth = 0;
let WhiteBrain = defaultBrain();
let BlackBrain = defaultBrain();
let WhiteHuman = true;
let BlackHuman = false;
let WhiteDepth = parseInt(searchDepthWhiteElement.value, 10);
let BlackDepth = parseInt(searchDepthBlackElement.value, 10);
let WhiteEvalMode = 0;
let BlackEvalMode = 0;
let engineReadyCount = 0;
let minSplitDepth = 4;
let currentBestMove;
let possibleMoves = [];
let afterMoves = [];
let moveValues = [];
let moveIndices = [];
let moveTimes = [];
let movesCompleted = 0;
let movesAssigned = 0;
let depthCount = [];
let gameHistoryHashes = [];
let alpha = -P;
let beta = P;
let OBon = true;
let AlphaBeta = true;
let TTable = true;
let Random = true;
let ReportDepths = false;
let reportComputerTime = false;
let historyShown = false;
let LabelIt = true;
let showEligibles = true;
let showHighlight = true;
let timing = false;
let humanTiming = false;
let timePerMoveForWhite = 3;
let timePerMoveForBlack = 3;
let whiteTimeRemaining = timePerMoveForWhite;
let blackTimeRemaining = timePerMoveForBlack;
let timerInterval = null;
let startTime = 0;
let endTime = 0;
const safeTime = 0.02;
let currentMove = Object.create(Move);
const Position = {
    ply: 0,
    board: emptyBoard,
    black: 0,
    white: 0,
    player: White,
    Value: undefined,
    Mode: 0,
    move: undefined,
    hash: 0n,
    perm: 0,
    compute: function() {
        if (this.white === 0 && this.black === 0) {
            for (let p = 1; p <= npoints; p++) {
                if (this.board[p] === 2) {
                    this.white++;
                }
                else {
                    if (this.board[p] === 3) {
                        this.black++;
                    }
                }
            }
        }
    }
};

function init() {
    if (!defaultBrainList) {
        defaultBrainList = structuredClone(BrainList);
    }
    setupMenus();
    setupBoardGeometry();
    setupWorkers();
    loadOpeningBook();
    setupParticipantsTable();
    setupUIControls();
    setupBrainIO();
    reset();
    let platformName = (navigator.userAgentData && navigator.userAgentData.platform) ? navigator.userAgentData.platform : navigator.platform;
    report(version + " 27 using " + Cores + " workers on " + platformName);
    setToggleStyle(document.getElementById("Labels"), LabelIt, "Lab", "Lab");
    setToggleStyle(document.getElementById("eligibles"), showEligibles, "Elgb", "Elgb");
    setToggleStyle(document.getElementById("highlight"), showHighlight, "HLight", "HLight");
    setToggleStyle(document.getElementById("reportDepths"), ReportDepths, "Stats", "Stats");
    setToggleStyle(document.getElementById("ReportTiming"), reportComputerTime, "CPU", "CPU");
    setToggleStyle(document.getElementById("alphaBeta"), AlphaBeta, "<B>&alpha;/&beta;</B>", "<B>&alpha;/&beta;</B>");
    setToggleStyle(document.getElementById("OB"), OBon, "<B>OB</B>", "<B>OB</B>");
    setToggleStyle(document.getElementById("tTable"), TTable, "<B>TT</B>", "<B>TT</B>");
}

function setupMenus() {
    const whitePlayerMenu = document.getElementById("WhitePlayer");
    const blackPlayerMenu = document.getElementById("BlackPlayer");
    const editMenu = document.getElementById("editBrainSelect");
    whitePlayerMenu.innerHTML = '<option value="0" selected>Human</option>';
    blackPlayerMenu.innerHTML = '<option value="0">Human</option>';
    editMenu.innerHTML = '<option value="0" disabled selected>Brain</option>';
    for (let i = 1; i < BrainList.length; i++) {
        if (BrainList[i]) {
            let name = BrainList[i].name;
            let whiteOpt = new Option(name, i);
            let blackOpt = new Option(name, i);
            
            // Logic to auto-select Arwen for Black
            if (name === "Arwen") {
                blackOpt.selected = true;
                BlackBrain = BrainList[i]; // Assign the brain object
            }
            
            whitePlayerMenu.add(whiteOpt);
            blackPlayerMenu.add(blackOpt);
            // ...
        }
    }
    const wContainer = whitePlayerMenu.parentNode;
    if (!document.getElementById("whiteEvalMode")) {
        const sel = document.createElement("select");
        sel.title = "AI mode. Expand for more info.";
        sel.id = "whiteEvalMode";
        sel.innerHTML = `
            <option value="0" title="Original Behavior">Legacy</option>
            <option value="1" title="Phase 1: Linear Ramp">Ramp</option>
            <option value="2" title="Phase 3: Capped Flying">Flying</option>
            <option value="3" selected title="Both">Both</option>
        `;
        sel.style.marginLeft = "5px";
        sel.addEventListener("change", (e) => {
            WhiteEvalMode = parseInt(e.target.value);
        });
        if (whitePlayerMenu.nextSibling) {
            wContainer.insertBefore(sel, whitePlayerMenu.nextSibling);
        }
        else {
            wContainer.appendChild(sel);
        }
    }
    const bContainer = blackPlayerMenu.parentNode;
    if (!document.getElementById("blackEvalMode")) {
        const sel = document.createElement("select");
        sel.title = "AI mode. Expand for more info."
        sel.id = "blackEvalMode";
        sel.innerHTML = `
            <option value="0" title="Original Behavior">Legacy</option>
            <option value="1" title="Phase 1: Linear Ramp">Ramp</option>
            <option value="2" title="Phase 3: Capped Flying">Flying</option>
            <option value="3" selected title="Both">Both</option>
        `;
        sel.style.marginLeft = "5px";
        sel.addEventListener("change", (e) => {
            BlackEvalMode = parseInt(e.target.value);
        });
        if (blackPlayerMenu.nextSibling) {
            bContainer.insertBefore(sel, blackPlayerMenu.nextSibling);
        }
        else {
            bContainer.appendChild(sel);
        }
    }
    const evalMenu = document.getElementById("evalDepth");
    const recMenu = document.getElementById("recDepth");
    const whiteDepthMenu = document.getElementById("searchDepthWhite");
    const blackDepthMenu = document.getElementById("searchDepthBlack");
    if (evalMenu) {
        evalMenu.innerHTML = "";
    }
    if (recMenu) {
        recMenu.innerHTML = "";
    }
    if (whiteDepthMenu) {
        whiteDepthMenu.innerHTML = "";
    }
    if (blackDepthMenu) {
        blackDepthMenu.innerHTML = "";
    }
    if (whiteDepthMenu) {
        whiteDepthMenu.add(new Option("Time", 0));
    }
    if (blackDepthMenu) {
        blackDepthMenu.add(new Option("Time", 0));
    }
    if (evalMenu) {
        evalMenu.add(new Option("0 (Static)", 0));
    }
    for (let i = 2; i <= 20; i += 2) {
        if (evalMenu) {
            evalMenu.add(new Option(i, i));
        }
        if (recMenu) {
            recMenu.add(new Option(i, i));
        }
        if (whiteDepthMenu) {
            whiteDepthMenu.add(new Option(i, i));
        }
        if (blackDepthMenu) {
            blackDepthMenu.add(new Option(i, i));
        }
    }
    if (whiteDepthMenu) {
        WhiteDepth = parseInt(whiteDepthMenu.value, 10);
    }
    if (blackDepthMenu) {
        BlackDepth = parseInt(blackDepthMenu.value, 10);
    }
}

function setupBoardGeometry() {
    points[1] = [1, 1];
    points[2] = [4, 1];
    points[3] = [7, 1];
    points[4] = [2, 2];
    points[5] = [4, 2];
    points[6] = [6, 2];
    points[7] = [3, 3];
    points[8] = [4, 3];
    points[9] = [5, 3];
    points[10] = [1, 4];
    points[11] = [2, 4];
    points[12] = [3, 4];
    points[13] = [5, 4];
    points[14] = [6, 4];
    points[15] = [7, 4];
    points[16] = [3, 5];
    points[17] = [4, 5];
    points[18] = [5, 5];
    points[19] = [2, 6];
    points[20] = [4, 6];
    points[21] = [6, 6];
    points[22] = [1, 7];
    points[23] = [4, 7];
    points[24] = [7, 7];
    for (let i = 1; i <= 24; i++) {
        points[i][2] = points[i][0] * spacing;
        points[i][3] = points[i][1] * spacing;
    }
    for (let n = 1; n <= npoints; n++) {
        gameBoard[n] = 1;
    }
    history[0] = Object.create(Position);
    history[0].board = boardCopy(gameBoard);
    history[0].compute();
}

function loadOpeningBook() {
    fetch('millOB.json?v=' + Date.now())
        .then(response => {
            if (!response.ok) {
                report("No Opening Book found. AI will play in calculation mode.");
                return null;
            }
            return response.json();
        })
        .then(bookData => {
            if (bookData) {
                window.openingBook = bookData;
                window.openingBookMap = new Map(bookData);
                report("Opening Book loaded: " + bookData.length + " positions.");
            }
        })
        .catch(err => {
            report("Opening book skipped.");
        });
}

function setupParticipantsTable() {
    let partHTML = "<table border='1' style='border-collapse: collapse; text-align: center;'>";
    const cbStyle = "transform: scale(1.5); cursor: pointer; margin: 2px;";
    partHTML += "<tr><td style='padding: 5px 5px 0px 5px; font-size: 14px; vertical-align: bottom;'>All</td><td style='padding: 5px 5px 0px 5px; font-size: 14px; vertical-align: bottom;'>None</td>";
    for (let i = 1; i < BrainList.length; i++) {
        if (BrainList[i]) {
            partHTML += `<td style='padding: 5px 5px 0px 5px; vertical-align: bottom;'><b>${BrainList[i].name.charAt(0)}</b></td>`;
        }
    }
    partHTML += "</tr><tr>";
    partHTML += `<td style='padding: 0px 5px 5px 5px; vertical-align: top;'><input type='checkbox' id='cb_select_all' title='Select All' style='${cbStyle}'></td>`;
    partHTML += `<td style='padding: 0px 5px 5px 5px; vertical-align: top;'><input type='checkbox' id='cb_select_none' title='Select None' style='${cbStyle}'></td>`;
    for (let i = 1; i < BrainList.length; i++) {
        if (BrainList[i]) {
            partHTML += `<td style='padding: 0px 5px 5px 5px; vertical-align: top;'><input type='checkbox' id='part_checkbox_${i}' checked style='${cbStyle}'></td>`;
        }
    }
    partHTML += "</tr></table>";
    document.getElementById("participants").innerHTML = partHTML;
    const allBox = document.getElementById("cb_select_all");
    const noneBox = document.getElementById("cb_select_none");

    function getPlayerBoxes() {
        let boxes = [];
        for (let i = 1; i < BrainList.length; i++) {
            if (BrainList[i]) {
                let box = document.getElementById(`part_checkbox_${i}`);
                if (box) {
                    boxes.push(box);
                }
            }
        }
        return boxes;
    }
    if (allBox) {
        allBox.checked = true;
        allBox.addEventListener('change', function() {
            if (this.checked) {
                if (noneBox) {
                    noneBox.checked = false;
                }
                getPlayerBoxes().forEach(b => b.checked = true);
            }
        });
    }
    if (noneBox) {
        noneBox.addEventListener('change', function() {
            if (this.checked) {
                if (allBox) {
                    allBox.checked = false;
                }
                getPlayerBoxes().forEach(b => b.checked = false);
            }
        });
    }
    getPlayerBoxes().forEach(box => {
        box.addEventListener('change', function() {
            if (this.checked) {
                if (noneBox) {
                    noneBox.checked = false;
                }
            }
            else {
                if (allBox) {
                    allBox.checked = false;
                }
            }
        });
    });
}

function setupUIControls() {
    document.getElementById("timeForWhite").style.verticalAlign = "middle";
    document.getElementById("timeForBlack").style.verticalAlign = "middle";
    document.getElementById("timeForWhite").style.textAlign = "center";
    document.getElementById("timeForBlack").style.textAlign = "center";
    checkTimingLogic();
    updateTiming();
}

function reset() {
    playing = false;
    searchId++;
    if (bookMoveTimer) {
        clearTimeout(bookMoveTimer);
        bookMoveTimer = null;
    }
    stopGameTimer();
    lastCapturePly = 0;
    threePieceStartPly = 0;
    takeMode = false;
    dragging = false;
    Player = White;
    Mode = 1;
    whiteStones = 0;
    blackStones = 0;
    plyCount = 0;
    moveShown = 0;
    gameBoard = boardCopy(emptyBoard);
    // Only draw if NOT silent/tourney/improving
    if (!silentMode || (!tournamentActive && !improving)) {
        if (settingUp) {
            Draw(gameBoard, setupColor);
            const pliesField = document.getElementById("plies");
            if (pliesField) {
                pliesField.value = "0";
            }
        }
        else {
            draw();
        }
    }
    Moves = [];
    history = [];
    history[0] = Object.create(Position);
    history[0].board = boardCopy(gameBoard);
    history[0].compute();
    if (workers.length > 0) {
        for (const w of workers) {
            w.postMessage({
                command: "clearTT"
            });
        }
    }
    setPlay();
    gameTop = bareGameTop;
    // FIX: Prevent flicker.
    if (!silentMode || (!tournamentActive && !improving)) {
        game.innerHTML = gameTop + gameBottom;
    }
    if (!tournamentActive) {
        uS();
    }
    currentMove.init();
    currentMove.ply = 1;
    currentMove.player = Player;
    checkTimingLogic();
    whiteTimeRemaining = timePerMoveForWhite;
    blackTimeRemaining = timePerMoveForBlack;
    updateTiming();
}

function nextMove() {
    if (Mode < 4) {
        currentMove.w = whiteStones;
        currentMove.b = blackStones;
        Moves[plyCount] = structuredClone(currentMove);
        if (currentMove.x > 0) {
            lastCapturePly = plyCount;
        }
        gameBoard[0]++;
        const newPosition = Object.create(Position);
        newPosition.board = boardCopy(gameBoard);
        newPosition.ply = plyCount;
        newPosition.player = Player;
        newPosition.move = currentMove;
        newPosition.compute();
        whiteStones = newPosition.white;
        blackStones = newPosition.black;
        if (whiteStones === 3 && blackStones === 3) {
            if (threePieceStartPly === 0) {
                threePieceStartPly = plyCount;
            }
        }
        else {
            threePieceStartPly = 0;
        }
        history[plyCount + 1] = newPosition;
        if (!silentMode || (!tournamentActive && !improving)) {
            gameTop = gameTop + html(currentMove, newPosition);
            game.innerHTML = gameTop + gameBottom;
            gameDiv.scrollTop = gameDiv.scrollHeight;
        }
        if (Mode > 1) {
            if (Player === White && blackStones < 3) {
                Mode = 5;
                lastGameOutcome = "White Wins (Material)";
                // FIX: Do not update msg if improving
                if (!tournamentActive && !improving) {
                    msg.innerHTML = lastGameOutcome;
                }
            }
            else {
                if (Player === Black && whiteStones < 3) {
                    Mode = 6;
                    lastGameOutcome = "Black Wins (Material)";
                    // FIX: Do not update msg if improving
                    if (!tournamentActive && !improving) {
                        msg.innerHTML = lastGameOutcome;
                    }
                }
            }
        }
        if (Mode > 1 && Mode < 4) {
            let currentHash = ZobrinHash(gameBoard);
            history[plyCount + 1].hash = currentHash;
            let repeatCount = 1;
            for (let i = (plyCount + 1) - 2; i >= 0; i -= 2) {
                if (!history[i]) {
                    break;
                }
                if (!history[i].hash) {
                    history[i].hash = ZobrinHash(history[i].board);
                }
                if (history[i].hash === currentHash) {
                    repeatCount++;
                }
            }
            if (repeatCount >= 3) {
                Mode = 4;
                lastGameOutcome = "Draw (Repetition)";
                // FIX: Do not update msg if improving
                if (!tournamentActive && !improving) {
                    msg.innerHTML = "Threefold repetition<br>Game Drawn";
                }
                playing = false;
            }
            if (plyCount > 18 && (plyCount - Math.max(lastCapturePly, 18)) >= 80) {
                Mode = 4;
                lastGameOutcome = "Draw (80 plies rule)";
                // FIX: Do not update msg if improving
                if (!tournamentActive && !improving) {
                    msg.innerHTML = lastGameOutcome;
                }
            }
            if (whiteStones === 3 && blackStones === 3 && (plyCount - lastCapturePly) >= 2) {
                Mode = 4;
                lastGameOutcome = "Draw (3 vs 3)";
                // FIX: Do not update msg if improving
                if (!tournamentActive && !improving) {
                    msg.innerHTML = lastGameOutcome;
                }
            }
        }
        plyCount++;
        Player = (Player === White) ? Black : White;
        if (Mode < 4) {
            let eligibleMoves = markEligible();
            if ((Mode > 1 || plyCount >= 18) && eligibleMoves === 0) {
                if (Player === White) {
                    Mode = 6;
                    lastGameOutcome = "Black Wins (No Moves)";
                    // FIX: Do not update msg if improving
                    if (!tournamentActive && !improving) {
                        msg.innerHTML = lastGameOutcome;
                    }
                }
                else {
                    Mode = 5;
                    lastGameOutcome = "White Wins (No Moves)";
                    // FIX: Do not update msg if improving
                    if (!tournamentActive && !improving) {
                        msg.innerHTML = lastGameOutcome;
                    }
                }
            }
        }
        if (Mode < 4) {
            if (plyCount >= 18) {
                Mode = 2;
            }
            else {
                Mode = 1;
            }
            if (Mode === 2) {
                if (Player === White && whiteStones === 3) {
                    Mode = 3;
                }
                if (Player === Black && blackStones === 3) {
                    Mode = 3;
                }
            }
            currentMove.init();
            currentMove.ply = plyCount + 1;
            currentMove.player = Player;
        }
        else {
            setPlay();
            if (!silentMode || (!tournamentActive && !improving)) {
                let logMessage = tournamentActive ? (lastGameOutcome + "<br>" + currentMatchTitle) : msg.innerHTML;
                game.innerHTML = gameTop + gameBottom + `<P>${logMessage}</P>`;
                gameDiv.scrollTop = gameDiv.scrollHeight;
            }
        }
        if (!silentMode || (!tournamentActive && !improving)) {
            draw();
            uS();
        }
        if (startTime != 0 && reportComputerTime) {
            endTime = time();
            let durationMs = Math.round((endTime - startTime) * 1000);
            startTime = 0;
            report(plyCount + ": " + commas(durationMs) + " ms " + (currentDepth - 2));
        }
        if (timing) {
            if (Player === Black) {
                let whiteNeedsInc = (!WhiteHuman && WhiteDepth === 0) || (WhiteHuman && humanTiming);
                if (whiteNeedsInc) {
                    whiteTimeRemaining += timePerMoveForWhite;
                }
            }
            else {
                let blackNeedsInc = (!BlackHuman && BlackDepth === 0) || (BlackHuman && humanTiming);
                if (blackNeedsInc) {
                    blackTimeRemaining += timePerMoveForBlack;
                }
            }
        }
        updateClockDisplay();
        if (!silentMode || (!tournamentActive && !improving)) {
            numberWhitePieces.innerHTML = "<B>" + whiteStones + "</B>";
            numberBlackPieces.innerHTML = "<B>" + blackStones + "</B>";
        }
        if (Mode < 4 && PlayerIsComputer() & playing) {
            play();
        }
    }
}

function restart() {
    plyCount = moveShown;
    lastCapturePly = 0;
    for (let i = 0; i < plyCount; i++) {
        if (Moves[i] && Moves[i].x > 0) {
            lastCapturePly = Moves[i].ply - 1;
        }
    }
    threePieceStartPly = 0;
    if (history[moveShown].white === 3 && history[moveShown].black === 3) {
        threePieceStartPly = plyCount;
    }
    let historicState = history[moveShown];
    gameBoard = boardCopy(historicState.board);
    whiteStones = historicState.white;
    blackStones = historicState.black;
    Player = (plyCount % 2 === 0) ? White : Black;
    gameBoard[0] = plyCount;
    if (plyCount < 18) {
        Mode = 1;
    }
    else {
        Mode = 2;
        if (Player === White && whiteStones === 3) {
            Mode = 3;
        }
        else {
            if (Player === Black && blackStones === 3) {
                Mode = 3;
            }
        }
    }
    takeMode = false;
    historyShown = false;
    playing = true;
    dragging = false;
    Moves.length = plyCount;
    history.length = plyCount + 1;
    currentMove.init();
    currentMove.ply = plyCount + 1;
    currentMove.player = Player;
    gameTop = bareGameTop;
    for (let i = 0; i < plyCount; i++) {
        gameTop += html(Moves[i], history[i + 1]);
    }
    game.innerHTML = gameTop + gameBottom;
    uS();
    draw();
    if (PlayerIsComputer()) {
        play();
    }
}

async function play() {
    searchId++;
    searchAborted = false;
    let currentBrain = (gameBoard[0] % 2 === 0) ? WhiteBrain : BlackBrain;
    if (checkBook()) {
        return;
    }
    movesCompleted = 0;
    movesAssigned = 0;
    // FIX: Use accurate performance timer (Seconds)
    startTime = time();
    currentDepth = 2;
    if (!silentMode || (!tournamentActive && !improving)) {
        if (gameBoard[0] % 2 === 0) {
            msg.innerHTML = "White is thinking...";
        }
        else {
            msg.innerHTML = "Black is thinking...";
        }
    }
    await sleep(10);
    depthCount = [];
    let currentMoveDepth = (gameBoard[0] % 2 === 0) ? WhiteDepth : BlackDepth;
    let isWhiteTurn = (gameBoard[0] % 2 === 0);
    let totalRemaining = isWhiteTurn ? whiteTimeRemaining : blackTimeRemaining;
    let increment = isWhiteTurn ? timePerMoveForWhite : timePerMoveForBlack;
    gameHistoryHashes = [];
    for (let i = 0; i <= plyCount; i++) {
        if (history[i]) {
            gameHistoryHashes.push(ZobrinHash(history[i].board));
        }
    }
    let maxDepth = (currentMoveDepth > 0) ? currentMoveDepth : 50;
    let rawMoves = findMoves(gameBoard);
    let rootMoves = [];
    if (symmetryCutOff > plyCount) {
        let seenHashes = new Set();
        for (let m of rawMoves) {
            let nextBoard = apply(m, gameBoard);
            nextBoard[0]++;
            let [canonicalHash] = hash(nextBoard);
            if (!seenHashes.has(canonicalHash)) {
                seenHashes.add(canonicalHash);
                rootMoves.push(m);
            }
        }
    }
    else {
        rootMoves = rawMoves;
    }
    if (rootMoves.length === 1) {
        currentBestMove = rootMoves[0];
        finishMove();
        return;
    }
    while (currentDepth <= maxDepth) {
        let taskList = [];
        for (let m of rootMoves) {
            let boardAfterMove = apply(m, gameBoard);
            boardAfterMove[0]++;
            if (currentDepth <= minSplitDepth) {
                taskList.push({
                    rootMove: m,
                    board: boardAfterMove,
                    depth: currentDepth - 1
                });
            }
            else {
                let responseMoves = findMoves(boardAfterMove);
                if (responseMoves.length === 0) {
                    taskList.push({
                        rootMove: m,
                        board: boardAfterMove,
                        depth: currentDepth - 1
                    });
                }
                else {
                    for (let rm of responseMoves) {
                        let boardAfterResponse = apply(rm, boardAfterMove);
                        boardAfterResponse[0]++;
                        taskList.push({
                            rootMove: m,
                            board: boardAfterResponse,
                            depth: currentDepth - 2
                        });
                    }
                }
            }
        }
        let evalPromises = taskList.map(task => {
            return evaluateAsync(task.board, task.depth, currentBrain).then(result => ({
                rootMove: task.rootMove,
                score: result.value,
                nodes: result.nodes,
                depths: result.Depths
            }));
        });
        let results = await Promise.all(evalPromises);
        let scoresByMove = new Map();
        depthCount = new Array(maxDepth + 2).fill(0);
        depthCount = new Array(maxDepth + 2).fill(0);
        // --- FIX: Add Main Thread Nodes to Stats ---
        if (currentDepth > minSplitDepth) {
            let ply1Depth = currentDepth - 1;
            if (ply1Depth >= 0) {
                depthCount[ply1Depth] = rootMoves.length;
            }
        }
        for (let r of results) {
            if (r.depths) {
                for (let d = 0; d < r.depths.length; d++) {
                    if (r.depths[d]) {
                        if (depthCount[d] === undefined) {
                            depthCount[d] = 0;
                        }
                        depthCount[d] += r.depths[d];
                    }
                }
            }
            let moveKey = `${r.rootMove.p}_${r.rootMove.q}_${r.rootMove.x}`;
            if (!scoresByMove.has(moveKey)) {
                scoresByMove.set(moveKey, {
                    move: r.rootMove,
                    scores: []
                });
            }
            scoresByMove.get(moveKey).scores.push(r.score);
        }
        let moveEvaluations = [];
        for (let entry of scoresByMove.values()) {
            let finalScore;
            if (currentDepth <= minSplitDepth) {
                finalScore = entry.scores[0];
            }
            else {
                if (isWhiteTurn) {
                    finalScore = Math.min(...entry.scores);
                }
                else {
                    finalScore = Math.max(...entry.scores);
                }
            }
            moveEvaluations.push({
                move: entry.move,
                score: finalScore
            });
        }
        if (isWhiteTurn) {
            moveEvaluations.sort((a, b) => b.score - a.score);
        }
        else {
            moveEvaluations.sort((a, b) => a.score - b.score);
        }
        currentBestMove = moveEvaluations[0].move;
        let currentBestVal = moveEvaluations[0].score;
        if (!silentMode || (!tournamentActive && !improving)) {
            msg.innerHTML = `${isWhiteTurn ? "White" : "Black"} thinking...<br>Depth ${currentDepth} done.<br>Best: ${currentBestVal}`;
        }
        if (currentMoveDepth === 0 && timing) {
            let now = time();
            let timeSpent = now - startTime;
            if (totalRemaining - timeSpent < 0.0) {
                break;
            }
            let allocatedTime = totalRemaining * safeTime;
            if (timeSpent > allocatedTime) {
                break;
            }
        }
        currentDepth += 2;
    }
    finishMove();
}

function finishMove() {
    searchId++;
    gameBoard = apply(currentBestMove, gameBoard);
    currentMove.p = currentBestMove.p;
    currentMove.q = currentBestMove.q;
    currentMove.x = currentBestMove.x;
    currentMove.ply = plyCount + 1;
    currentMove.player = Player;
    if (ReportDepths) {
        reportDepth(gameBoard, depthCount);
    }
    nextMove();
}

function createWorkerListener(worker) {
    return function(event) {
        if (event.data.type === 'REPORT') {
            report(event.data.text);
            return;
        }
        if (event.data.id && typeof event.data.id === 'string' && event.data.id.startsWith("OB_")) {
            const reqId = event.data.id;
            if (pendingOB.has(reqId)) {
                const resolve = pendingOB.get(reqId);
                resolve(event.data);
                pendingOB.delete(reqId);
            }
            return;
        }
        if (event.data.type === 'ENGINE_READY') {
            engineReadyCount++;
            if (engineReadyCount === workers.length) {
                msg.innerHTML = "<H4>Welcome to Mill C++<BR> Press Play to Start";
                document.getElementById("play").classList.add("blink");
                report("All C++ Engines Loaded and Ready.");
            }
            return;
        }
    }
}

function uS() {
    if (improving || (tournamentActive && silentMode)) {
        return;
    }
    if (takeMode) {
        msg.innerHTML = "<H4>" + Player + ", remove <BR >an opposing stone</H4> ";
        return;
    }
    if (Mode === 1) {
        if (plyCount <= 18) {
            msg.innerHTML = Player + ", place a stone";
        }
    }
    else {
        if (Mode === 2) {
            msg.innerHTML = Player + ", move a stone ";
        }
        else {
            if (Mode === 3) {
                msg.innerHTML = Player + ", fly a stone ";
            }
        }
    }
}

function draw() {
    gameShown = true;
    Draw(gameBoard, boardColor);
}

function Draw(pos, color) {
    ctx.clearRect(0, 0, Board.width, Board.height);
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 8 * spacing, 8 * spacing);
    dl(1, 3);
    dl(4, 6);
    dl(7, 9);
    dl(10, 12);
    dl(13, 15);
    dl(16, 18);
    dl(19, 21);
    dl(22, 24);
    dl(1, 22);
    dl(4, 19);
    dl(7, 16);
    dl(2, 8);
    dl(17, 23);
    dl(9, 18);
    dl(6, 21);
    dl(3, 24);
    for (let i = 1; i <= npoints; i++) {
        if (pos[i] === 1) {
            dc(i, boardColor, LineColor, radius);
        }
        else {
            if (pos[i] === 2) {
                dc(i, whiteBody, whiteRim, 2 * radius);
            }
            else {
                if (pos[i] === 3) {
                    dc(i, blackBody, blackRim, 2 * radius);
                }
                else {
                    dc(i, "red", "red", 2.5 * radius);
                }
            }
        }
    }
    Labels();
    if (showHighlight) {
        let moveIndex = -1;
        if (historyShown) {
            moveIndex = moveShown - 1;
        }
        else {
            moveIndex = plyCount - 1;
        }
        if (moveIndex >= 0 && Moves[moveIndex]) {
            let lastMove = Moves[moveIndex];
            if (lastMove.q > 0) {
                ctx.beginPath();
                ctx.arc(points[lastMove.q][2], points[lastMove.q][3], radius * 2.5, 0, 2 * Math.PI);
                ctx.strokeStyle = "gold";
                ctx.lineWidth = 8;
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(points[lastMove.p][2], points[lastMove.p][3], radius * 2.5, 0, 2 * Math.PI);
                ctx.strokeStyle = "rgba(255, 215, 0)";
                ctx.lineWidth = 6;
                ctx.stroke();
            }
            else {
                if (lastMove.q === 0) {
                    ctx.beginPath();
                    ctx.arc(points[lastMove.p][2], points[lastMove.p][3], radius * 2.5, 0, 2 * Math.PI);
                    ctx.strokeStyle = "gold";
                    ctx.lineWidth = 6;
                    ctx.stroke();
                }
            }
        }
    }
}

function markWhite(p) {
    dc(p, whiteBody, whiteRim, 1.5 * radius);
    gameBoard[p] = 2;
    whiteStones++;
}

function markBlack(p) {
    dc(p, blackBody, blackRim, 1.5 * radius);
    gameBoard[p] = 3;
    blackStones++;
}

function commas(z) {
    if (isFinite(z)) {
        return z.toLocaleString();
    }
    return z;
}

function reportDepth(board, depths) {
    if (!ReportDepths) {
        return;
    }
    let s = "Depth Report:\n";
    let totalNodes = 0;
    for (let i = depths.length - 1; i >= 0; i--) {
        if (depths[i] !== undefined && depths[i] > 0) {
            s += `Depth ${i}: ${commas(depths[i])} nodes\n`;
            totalNodes += depths[i];
        }
    }
    s += `Total Nodes: ${commas(totalNodes)}\n`;
    report(s);
}

function Labels() {
    if (LabelIt) {
        ctx.font = "30px Arial";
        ctx.fillStyle = LabelColor;
        for (let i = 1; i <= 24; i++) {
            ctx.fillText("" + i, points[i][2] + 2 * radius, points[i][3] - radius / 2);
        }
    }
}

function dl(i, j) {
    let x0 = points[i][0];
    let y0 = points[i][1];
    let x1 = points[j][0];
    let y1 = points[j][1];
    ctx.beginPath();
    ctx.moveTo(x0 * spacing, y0 * spacing);
    ctx.lineTo(x1 * spacing, y1 * spacing);
    ctx.lineWidth = lw;
    ctx.strokeStyle = LineColor;
    ctx.stroke();
}

function dc(i, body, rim, r) {
    let xcenter = points[i][2];
    let ycenter = points[i][3];
    dcircle(xcenter, ycenter, body, rim, r);
}

function dcircle(xcenter, ycenter, body, rim, r) {
    ctx.beginPath();
    ctx.arc(xcenter, ycenter, r, 0, 2 * Math.PI);
    ctx.fillStyle = body;
    ctx.fill();
    ctx.strokeStyle = rim;
    ctx.lineWidth = lw;
    ctx.stroke();
}

function report(msg) {
    console.log(msg);
}

function markEligible() {
    let count = 0;
    for (let p = 1; p <= npoints; p++) {
        if (eligible(p)) {
            if (showEligibles && !PlayerIsComputer()) {
                markp(p);
            }
            count++;
        }
    }
    return count;
}

function markp(p) {
    if (eligible(p) || dragging) {
        dc(p, "rgb(127,255,127", "rgb(255,127,127", 1.0 * radius);
    }
}

function markP(p) {
    dc(p, "rgb(127,127,255)", "rgb(127,127,127", 1.0 * radius);
}

function eligible(p) {
    return Eligible(p, gameBoard);
}

function Eligible(p, pos) {
    if (settingUp) {
        return true;
    }
    else {
        if (takeMode) {
            let opponent = 3;
            if (Player === Black) {
                opponent = 2;
            }
            if (pos[p] === opponent) {
                if (!inMill(p, pos)) {
                    return true;
                }
                else {
                    for (let q = 1; q <= npoints; q++) {
                        if (pos[q] === opponent && !inMill(q, pos)) {
                            return false;
                        }
                    }
                    return true;
                }
            }
            return false;
        }
        else {
            if (pos[p] === 1 && plyCount < 18) {
                return true;
            }
            else {
                if (pos[p] !== 1 && plyCount >= 18) {
                    const playerCode = (Player === White) ? 2 : 3;
                    if (pos[p] === playerCode && freeToMove(p, pos)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }
}

function freeToMove(p, pos) {
    const player = Player;
    const stoneCount = (player === White) ? whiteStones : blackStones;
    const isFlyingPhase = (stoneCount === 3 && plyCount >= 18);
    if (isFlyingPhase) {
        return true;
    }
    for (const neighbor of adjacencyList[p]) {
        if (pos[neighbor] === 1) {
            return true;
        }
    }
    return false;
}

function locate(x, y) {
    for (let p = 1; p <= npoints; p++) {
        if (eligible(p)) {
            if ((points[p][2] - x) ** 2 + (points[p][3] - y) ** 2 < 3 * radius ** 2) {
                return (p);
            }
        }
    }
    return (0);
}

function locateAny(x, y) {
    for (let p = 1; p <= npoints; p++) {
        if ((points[p][2] - x) ** 2 + (points[p][3] - y) ** 2 < 3 * radius ** 2) {
            return (p);
        }
    }
    return (0);
}

function prepareRemove() {
    uS();
    draw();
    markEligible();
}

function PlayerIsComputer() {
    if (Player === White && !WhiteHuman) {
        return true;
    }
    if (Player === Black && !BlackHuman) {
        return true;
    }
    return false;
}

function listGame() {
    for (let i = 0; i <= plyCount; i++) {
        if (history[i] && history[i].board) {
            report(history[i].board);
        }
    }
}

function blank(p) {
    if (isFinite(p) && p !== 0) {
        return p;
    }
    else {
        return "";
    }
}

function html(move, position) {
    let ButtonID = "M" + move.ply;
    let line = "<tr>";
    let buttonStyle = `font-size: 20px;}`;
    line += "<td>" + blank(move.ply) + "</td>";
    if (move.player === White) {
        line += `<td><button type="button" id="${ButtonID}" style="background-color: white; color: black; ${buttonStyle}" > White </button></td>`;
    }
    else {
        line += `<td><button type="button" id="${ButtonID}" style="background-color: black; color: white; ${buttonStyle}" > Black </button></td>`;
    }
    line += "<td>" + blank(move.p) + "</td>";
    line += "<td>" + blank(move.q) + "</td>";
    line += "<td>" + blank(move.x) + "</td>";
    line += "<td>" + position.white + "</td>";
    line += "<td>" + position.black + "</td>";
    let depths = [];
    let evalBrain = (move.player === White) ? WhiteBrain : BlackBrain;
    line += "<td>" + evaluate(evalBrain, gameBoard, 0, -P, P, depths, [], WhiteEvalMode, BlackEvalMode)[0] + "</td>";
    line += "</tr>";
    return line;
}

function showHistory(n) {
    if (n < 0) {
        n = 0;
    }
    if (n > plyCount) {
        n = plyCount;
    }
    if (n !== moveShown || playing) {
        searchId++;
        moveShown = n;
        playing = false;
        setPlay();
        if (history[moveShown]) {
            gameBoard = boardCopy(history[moveShown].board);
            Draw(gameBoard, historyboardColor);
            let updatedGameHtml = bareGameTop;
            for (let i = 0; i < n - 1; i++) {
                updatedGameHtml += html(Moves[i], history[i]);
            }
            for (let i = n; i <= plyCount; i++) {
                updatedGameHtml += html(Moves[i - 1], history[i], (i === moveShown));
            }
            game.innerHTML = updatedGameHtml + gameBottom;
            msg.innerHTML = ("Showing Board after Move " + moveShown);
            playing = false;
            setPlay();
            historyShown = true;
        }
    }
}

function forward() {
    showHistory(moveShown + 1);
}

function backward() {
    showHistory(moveShown - 1);
}

function setPlay() {
    playing = false;
    document.getElementById('play').textContent = "PLAY";
}

function updateClockDisplay() {
    if (!silentMode || (!tournamentActive && !improving)) {
        const runningColor = "rgb(200,200,200)";
        let whiteActive = false;
        let blackActive = false;
        if (playing) {
            if (Player === White) {
                if ((!WhiteHuman && WhiteDepth === 0 && timing) || (WhiteHuman && humanTiming)) {
                    whiteActive = true;
                }
            }
            else {
                if ((!BlackHuman && BlackDepth === 0 && timing) || (BlackHuman && humanTiming)) {
                    blackActive = true;
                }
            }
        }
        const wc = document.getElementById("whiteClock");
        if (wc) {
            wc.style.backgroundColor = whiteActive ? runningColor : "white";
            wc.innerHTML = "<B><font size=6 color=red>" + formatTime(whiteTimeRemaining) + "</B></font>";
        }
        const bc = document.getElementById("blackClock");
        if (bc) {
            bc.style.backgroundColor = blackActive ? runningColor : "black";
            bc.innerHTML = "<B><font size=6 color=red>" + formatTime(blackTimeRemaining) + "</font></B>";
        }
    }
}

function formatTime(seconds) {
    if (seconds < 0) {
        return "00:00";
    }
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function stopGameTimer() {
    if (window.millTimer) {
        clearInterval(window.millTimer);
        window.millTimer = null;
    }
}

function startGameTimer() {
    stopGameTimer();
    window.millTimer = setInterval(updateClock, 1000);
    updateClockDisplay();
}

function updateClock() {
    if (!playing) {
        return;
    }
    let decrement = false;
    if (Player === White) {
        if (!WhiteHuman && WhiteDepth === 0 && timing) {
            decrement = true;
        }
        else {
            if (WhiteHuman && humanTiming) {
                decrement = true;
            }
        }
        if (decrement) {
            whiteTimeRemaining--;
        }
    }
    else {
        if (!BlackHuman && BlackDepth === 0 && timing) {
            decrement = true;
        }
        else {
            if (BlackHuman && humanTiming) {
                decrement = true;
            }
        }
        if (decrement) {
            blackTimeRemaining--;
        }
    }
    if (decrement) {
        if (whiteTimeRemaining <= 0 || blackTimeRemaining <= 0) {
            report("Time is up!");
            playing = false;
            setPlay();
            if (timerInterval) {
                clearInterval(timerInterval);
            }
            if (window.millTimer) {
                clearInterval(window.millTimer);
                window.millTimer = null;
            }
            if (whiteTimeRemaining <= 0) {
                Mode = 6;
                lastGameOutcome = "Black Wins (Time)";
                if (!tournamentActive) {
                    msg.innerHTML = "White's Time is up<br>Black Wins!";
                }
            }
            else {
                Mode = 5;
                lastGameOutcome = "White Wins (Time)";
                if (!tournamentActive) {
                    msg.innerHTML = "Black's Time is up<br>White Wins!";
                }
            }
            game.innerHTML += `<P><B>${msg.innerHTML}</B></P>`;
            const gameDiv = document.getElementById('game');
            if (gameDiv) {
                gameDiv.scrollTop = gameDiv.scrollHeight;
            }
            return;
        }
    }
    updateClockDisplay();
}

function same(Board1, Board2) {
    let Same = true;
    for (let i = 0; i <= 24; i++) {
        if (Board1[i] !== Board2[i]) {
            Same = false;
            break;
        }
    }
    return Same;
}

function setToggleStyle(btn, isOn, textOn, textOff) {
    if (isOn) {
        btn.innerHTML = textOn;
        btn.style.backgroundColor = "green";
        btn.style.color = "white";
    }
    else {
        btn.innerHTML = textOff;
        btn.style.backgroundColor = "red";
        btn.style.color = "white";
    }
}

function checkTimingLogic() {
    const timingBtn = document.getElementById("Timing");
    if (!timingBtn) {
        return;
    }
    let computerNeedsTiming = (!WhiteHuman && WhiteDepth === 0) || (!BlackHuman && BlackDepth === 0);
    let isGreen = computerNeedsTiming || humanTiming;
    timing = isGreen;
    if (isGreen) {
        timingBtn.style.backgroundColor = "green";
        timingBtn.style.color = "white";
        if (humanTiming) {
            timingBtn.innerHTML = "<B>Timing: All</B>";
        }
        else {
            timingBtn.innerHTML = "<B>Timing: Auto</B>";
        }
    }
    else {
        timingBtn.style.backgroundColor = "blue";
        timingBtn.style.color = "white";
        timingBtn.innerHTML = "<B>Timing</B>";
    }
}

function setupStandardInput(elementId, initialValue, validatorFn, callbackFn) {
    const el = document.getElementById(elementId);
    if (!el) {
        return;
    }
    el.style.textAlign = "center";
    if (initialValue !== null && initialValue !== undefined) {
        el.value = initialValue;
    }
    el.dataset.lastValid = el.value;
    el.addEventListener("focus", function() {
        this.dataset.lastValid = this.value;
        this.value = "";
    });
    el.addEventListener("blur", function() {
        if (this.value.trim() === "") {
            this.value = this.dataset.lastValid;
        }
        else {
            validateAndApply(this);
        }
    });
    el.addEventListener("change", function() {
        validateAndApply(this);
    });

    function validateAndApply(input) {
        let val = parseFloat(input.value, 10);
        let validated = validatorFn(val);
        if (validated !== null) {
            input.value = validated;
            input.dataset.lastValid = validated;
            if (callbackFn) {
                callbackFn(validated);
            }
        }
        else {
            report(`Invalid input for ${elementId}: ${input.value}. Reverting.`);
            input.value = input.dataset.lastValid;
        }
    }
}

function unmap(canonicalPoint, perm) {
    if (canonicalPoint === 0) {
        return 0;
    }
    for (let i = 1; i <= npoints; i++) {
        if (perm[i] === canonicalPoint) {
            return i;
        }
    }
    return 0;
}

function downloadBook() {
    if (!window.openingBookMap || window.openingBookMap.size === 0) {
        report("No book to download.");
        return;
    }
    report("Downloading Book (" + window.openingBookMap.size + " entries)...");
    const arrayData = Array.from(window.openingBookMap.entries());
    const jsonString = JSON.stringify(arrayData);
    const blob = new Blob([jsonString], {
        type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "millOB.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

function checkBook() {
    if (OBon) {
        if (settingUp) {
            return false;
        }
        let hashResult = hash(gameBoard);
        let permIndex = hashResult[1];
        let genericBoard = hashResult[2];
        let zKey = ZobrinHash(genericBoard).toString();
        if (window.openingBookMap && window.openingBookMap.has(zKey)) {
            let entry = window.openingBookMap.get(zKey);
            let score = entry[0];
            let numberOfMoves = entry.length - 2;
            let randomIndex = 2 + Math.floor(Math.random() * numberOfMoves);
            let canonicalP = entry[randomIndex];
            let currentPerm = perms[permIndex];
            let realP = currentPerm[canonicalP];
            if (!silentMode && !tournamentActive) {
                msg.innerHTML = "Playing Book Move...";
            }
            gameBoard = apply({
                p: realP,
                q: 0,
                x: 0
            }, gameBoard);
            currentMove.p = realP;
            currentMove.q = 0;
            currentMove.x = 0;
            currentMove.ply = plyCount + 1;
            currentMove.player = Player;
            startTime = 0;
            if (ReportDepths) {
                reportDepth(gameBoard, depthCount);
            }
            if (bookMoveTimer) {
                clearTimeout(bookMoveTimer);
            }
            bookMoveTimer = setTimeout(() => {
                nextMove();
            }, 20);
            return true;
        }
    }
    return false;
}

function evaluateAsync(board, depth, brain) {
    return new Promise((resolve, reject) => {
        let workerIndex = obRequestId % workers.length;
        let worker = workers[workerIndex];
        let reqId = "OB_" + obRequestId++;
        pendingOB.set(reqId, resolve);
        // FIX 1: Use standard numbers for Infinity, not BigInt (P)
        let alphaVal = -1000000;
        let betaVal = 1000000;
        let payload = {
            id: reqId,
            moveIndex: 0,
            brain: brain,
            depth: depth,
            board: board,
            alpha: alphaVal, // FIX: Send Number, not BigInt
            beta: betaVal, // FIX: Send Number, not BigInt
            depths: [],
            historyHashes: []
        };
        if (useCppEngine) {
            payload.AlphaBeta = AlphaBeta;
            payload.TTable = TTable;
            payload.symmetryCutOff = symmetryCutOff;
        }
        else {
            payload.AlphaBeta = AlphaBeta;
            payload.TTable = TTable;
            payload.ttLimit = 0;
            payload.minSaveDepth = 0;
            payload.symmetryCutOff = symmetryCutOff;
        }
        worker.postMessage(payload);
    });
}

async function createOpeningBook(openingPly, calculationDepth) {
    report(`Computing Opening Book (Task Stack Mode) - Depth ${calculationDepth}`);
    msg.innerHTML = "Generating Positions...";
    await sleep(10);
    let bookMap = new Map();
    let uniqueBoardsByPly = [];
    let rootBoard = new Array(25).fill(1);
    rootBoard[0] = 0;
    uniqueBoardsByPly.push(new Map());
    uniqueBoardsByPly[0].set(ZobrinHash(rootBoard).toString(), rootBoard);
    for (let ply = 1; ply < openingPly; ply++) {
        uniqueBoardsByPly.push(new Map());
        let previousLayer = uniqueBoardsByPly[ply - 1];
        for (let parentBoard of previousLayer.values()) {
            let moves = findMoves(parentBoard);
            for (let m of moves) {
                let nextBoard = apply(m, parentBoard);
                nextBoard[0]++;
                let genericBoard = hash(nextBoard)[2];
                let boardKey = ZobrinHash(genericBoard).toString();
                if (!uniqueBoardsByPly[ply].has(boardKey)) {
                    uniqueBoardsByPly[ply].set(boardKey, genericBoard);
                }
            }
        }
        report("Ply " + ply + ": " + commas(uniqueBoardsByPly[ply].size) + " unique positions.");
        msg.innerHTML = `Generating Tree... Ply ${ply} complete.`;
        await sleep(10);
    }
    report("Starting Parallel Analysis...");
    for (let ply = 0; ply < openingPly; ply++) {
        let count = 0;
        let total = uniqueBoardsByPly[ply].size;
        let isWhiteTurn = (ply % 2 === 0);
        for (let board of uniqueBoardsByPly[ply].values()) {
            count++;
            msg.innerHTML = `Analyzing Ply ${ply}<br>Position ${count} / ${total}`;
            await sleep(10);
            let rootMoves = findMoves(board);
            let brainToUse = isWhiteTurn ? WhiteBrain : BlackBrain;
            let bestRootScore = isWhiteTurn ? -Infinity : Infinity;
            let bestRootMoves = [];
            for (let m of rootMoves) {
                let boardAfterMove = apply(m, board);
                boardAfterMove[0]++;
                let moveScore;
                if (calculationDepth <= minSplitDepth) {
                    let res = await evaluateAsync(boardAfterMove, calculationDepth, brainToUse);
                    moveScore = res.value;
                }
                else {
                    let responseMoves = findMoves(boardAfterMove);
                    if (responseMoves.length === 0) {
                        let res = await evaluateAsync(boardAfterMove, calculationDepth, brainToUse);
                        moveScore = res.value;
                    }
                    else {
                        let subTasks = responseMoves.map(rm => {
                            let boardAfterResponse = apply(rm, boardAfterMove);
                            boardAfterResponse[0]++;
                            return evaluateAsync(boardAfterResponse, calculationDepth - 1, brainToUse);
                        });
                        let results = await Promise.all(subTasks);
                        let subScores = results.map(r => r.value);
                        if (isWhiteTurn) {
                            moveScore = Math.min(...subScores);
                        }
                        else {
                            moveScore = Math.max(...subScores);
                        }
                    }
                }
                if (isWhiteTurn) {
                    if (moveScore > bestRootScore) {
                        bestRootScore = moveScore;
                        bestRootMoves = [m.p];
                    }
                    else {
                        if (moveScore === bestRootScore) {
                            bestRootMoves.push(m.p);
                        }
                    }
                }
                else {
                    if (moveScore < bestRootScore) {
                        bestRootScore = moveScore;
                        bestRootMoves = [m.p];
                    }
                    else {
                        if (moveScore === bestRootScore) {
                            bestRootMoves.push(m.p);
                        }
                    }
                }
            }
            if (bestRootMoves.length > 0) {
                let zKey = ZobrinHash(board).toString();
                bookMap.set(zKey, [bestRootScore, calculationDepth, ...bestRootMoves]);
            }
        }
        report(`Finished analyzing Ply ${ply}`);
    }
    window.openingBookMap = bookMap;
    report("Book Complete (" + bookMap.size + " entries).");
    msg.innerHTML = "Book Complete!";
    downloadBook();
}

function downloadTournamentResults(scores, headToHead, displayPlayers, gamesPerPair, outcomeStats) {
    let csv = "Mill Tournament Results\n";
    csv += `Date,"${new Date().toLocaleString()}"\n`;
    csv += "Parameters: \n";
    csv += `Games per Pair,${gamesPerPair}\n`;
    let wDepthVal = (WhiteDepth === 0) ? "Time" : WhiteDepth;
    let bDepthVal = (BlackDepth === 0) ? "Time" : BlackDepth;
    csv += `White Depth,${wDepthVal}\n`;
    csv += `Black Depth,${bDepthVal}\n`;
    csv += `White Strategy Mode,${WhiteEvalMode}\n`;
    csv += `Black Strategy Mode,${BlackEvalMode}\n`;
    if (WhiteDepth === 0 || BlackDepth === 0) {
        csv += `Time per Move (White),${timePerMoveForWhite}s\n`;
        csv += `Time per Move (Black),${timePerMoveForBlack}s\n`;
    }
    csv += "\n";
    csv += "Standings\n";
    csv += "Rank,Name,Points,Wins,Losses,Draws\n";
    let ranking = displayPlayers.map(p => {
        let s = scores[p.id];
        return {
            name: p.name,
            ...s
        };
    }).sort((a, b) => b.points - a.points);
    ranking.forEach((player, index) => {
        csv += `${index + 1},${player.name},${player.points},${player.wins},${player.losses},${player.draws}\n`;
    });
    csv += "\n";
    csv += "Head-to-Head (Points received by Row Player when playing White against Column Player)\n";
    let opponentNames = displayPlayers.map(p => p.name).join(",");
    csv += "White \\ Black," + opponentNames + "\n";
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
    const paramHeaders = [
        "GS", "N3", "N4", "M1", "M2", "FB", "PD", "MS", "DMS", "NMF", "NMR", "NMG"
    ];
    const paramMap = {
        "GS": "groupScore",
        "N3": "N3",
        "N4": "N4",
        "M1": "mobility1Score",
        "M2": "mobility2Score",
        "FB": "flyBonus",
        "PD": "pieceDiffMultiplier",
        "MS": "millScore",
        "DMS": "doubleMillScore",
        "NMF": "nearMillFilled",
        "NMR": "nearMillReady",
        "NMG": "nearMillGuaranteed"
    };
    csv += "Name," + paramHeaders.join(",") + "\n";
    displayPlayers.forEach(p => {
        let brain = p.params;
        let row = p.name;
        paramHeaders.forEach(header => {
            let key = paramMap[header];
            row += `,${brain[key]}`;
        });
        csv += row + "\n";
    });
    if (outcomeStats) {
        csv += "\nGame Outcome Statistics\n";
        csv += "Result Type,Count\n";
        csv += `White Wins (Material),${outcomeStats.white.material}\n`;
        csv += `White Wins (Blocked),${outcomeStats.white.blocked}\n`;
        csv += `White Wins (Time),${outcomeStats.white.time}\n`;
        csv += `Black Wins (Material),${outcomeStats.black.material}\n`;
        csv += `Black Wins (Blocked),${outcomeStats.black.blocked}\n`;
        csv += `Black Wins (Time),${outcomeStats.black.time}\n`;
        csv += `Draw (Repetition),${outcomeStats.draws.repetition}\n`;
        csv += `Draw (80 Move Rule),${outcomeStats.draws.moves80}\n`;
        csv += `Draw (3 vs 3 Standoff),${outcomeStats.draws.insufficient}\n`;
    }
    const blob = new Blob([csv], {
        type: 'text/csv;charset=utf-8;'
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "MillTournamentResults.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

async function runTournamentGame(whiteIndex, blackIndex) {
    WhiteBrain = BrainList[whiteIndex];
    BlackBrain = BrainList[blackIndex];
    WhiteHuman = false;
    BlackHuman = false;
    document.getElementById("WhitePlayer").value = whiteIndex;
    document.getElementById("BlackPlayer").value = blackIndex;
    reset();
    playing = true;
    document.getElementById('play').textContent = "playing...";
    play();
    while (Mode < 4 && playing) {
        await sleep(20);
    }
    stopGameTimer();
    if (Mode < 4) {
        return "ABORT";
    }
    if (Mode === 5) {
        return 1;
    }
    if (Mode === 6) {
        return -1;
    }
    return 0;
}

async function playTournament() {
    const btn = document.getElementById("tournament");
    btn.disabled = true;
    tournamentActive = true;
    try {
        const numberGames = document.getElementById("tGames") || document.getElementById("tMoves");
        const gamesPerPair = parseInt(numberGames.value, 10);
        let outcomeStats = {
            white: {
                material: 0,
                blocked: 0,
                time: 0
            },
            black: {
                material: 0,
                blocked: 0,
                time: 0
            },
            draws: {
                repetition: 0,
                moves80: 0,
                insufficient: 0
            }
        };
        let scores = {};
        let headToHead = {};
        for (let i = 1; i < BrainList.length; i++) {
            if (BrainList[i]) {
                scores[i] = {
                    wins: 0,
                    losses: 0,
                    draws: 0,
                    points: 0
                };
                headToHead[i] = {};
                for (let j = 1; j < BrainList.length; j++) {
                    headToHead[i][j] = 0;
                }
            }
        }
        let checkboxIndices = [];
        let displayPlayers = [];
        for (let i = 1; i < BrainList.length; i++) {
            let cb = document.getElementById(`part_checkbox_${i}`);
            if (cb && cb.checked) {
                checkboxIndices.push(i);
            }
        }
        const recordOutcome = () => {
            if (lastGameOutcome.includes("White Wins (Material)")) {
                outcomeStats.white.material++;
            }
            else {
                if (lastGameOutcome.includes("White Wins (No Moves)")) {
                    outcomeStats.white.blocked++;
                }
                else {
                    if (lastGameOutcome.includes("White Wins (Time)")) {
                        outcomeStats.white.time++;
                    }
                    else {
                        if (lastGameOutcome.includes("Black Wins (Material)")) {
                            outcomeStats.black.material++;
                        }
                        else {
                            if (lastGameOutcome.includes("Black Wins (No Moves)")) {
                                outcomeStats.black.blocked++;
                            }
                            else {
                                if (lastGameOutcome.includes("Black Wins (Time)")) {
                                    outcomeStats.black.time++;
                                }
                                else {
                                    if (lastGameOutcome.includes("Repetition")) {
                                        outcomeStats.draws.repetition++;
                                    }
                                    else {
                                        if (lastGameOutcome.includes("80 plies")) {
                                            outcomeStats.draws.moves80++;
                                        }
                                        else {
                                            if (lastGameOutcome.includes("3 vs 3")) {
                                                outcomeStats.draws.insufficient++;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        };
        if (checkboxIndices.length > 1) {
            displayPlayers = checkboxIndices.map(idx => ({
                id: idx,
                name: BrainList[idx].name,
                params: BrainList[idx]
            }));
            for (let i of checkboxIndices) {
                for (let j of checkboxIndices) {
                    if (i === j) {
                        continue;
                    }
                    for (let g = 1; g <= gamesPerPair; g++) {
                        msg.innerHTML = `Tournament: ${BrainList[i].name} (W) vs ${BrainList[j].name} (B)<br>Game ${g} of ${gamesPerPair}`;
                        await sleep(10);
                        let result = await runTournamentGame(i, j);
                        if (result === "ABORT") {
                            tournamentActive = false;
                            return;
                        }
                        recordOutcome();
                        if (result === 1) {
                            scores[i].wins++;
                            scores[i].points += 1;
                            scores[j].losses++;
                            scores[j].points -= 1;
                            headToHead[i][j] += 1;
                        }
                        else {
                            if (result === -1) {
                                scores[j].wins++;
                                scores[j].points += 1;
                                scores[i].losses++;
                                scores[i].points -= 1;
                                headToHead[j][i] += 1;
                            }
                            else {
                                scores[i].draws++;
                                scores[j].draws++;
                            }
                        }
                    }
                }
            }
        }
        else {
            let wIdx = parseInt(document.getElementById("WhitePlayer").value);
            let bIdx = parseInt(document.getElementById("BlackPlayer").value);
            let pIndices = [wIdx];
            if (wIdx !== bIdx) {
                pIndices.push(bIdx);
            }
            displayPlayers = pIndices.map(idx => ({
                id: idx,
                name: BrainList[idx].name,
                params: BrainList[idx]
            }));
            for (let g = 1; g <= gamesPerPair; g++) {
                msg.innerHTML = `Tournament: Game ${g} / ${gamesPerPair}`;
                await sleep(10);
                let result = await runTournamentGame(wIdx, bIdx);
                if (result === "ABORT") {
                    tournamentActive = false;
                    return;
                }
                recordOutcome();
                if (result === 1) {
                    scores[wIdx].wins++;
                    scores[wIdx].points += 1;
                    scores[bIdx].losses++;
                    scores[bIdx].points -= 1;
                    headToHead[wIdx][bIdx] += 1;
                }
                else {
                    if (result === -1) {
                        scores[bIdx].wins++;
                        scores[bIdx].points += 1;
                        scores[wIdx].losses++;
                        scores[wIdx].points -= 1;
                        headToHead[bIdx][wIdx] += 1;
                    }
                    else {
                        scores[wIdx].draws++;
                        scores[bIdx].draws++;
                    }
                }
            }
        }
        downloadTournamentResults(scores, headToHead, displayPlayers, gamesPerPair, outcomeStats);
        report("finished tournament \n results downloaded");
        msg.innerHTML = "finished tournament <br> results downloaded";
    }
    catch (e) {
        console.error(e);
        if (e.message !== "Match Interrupted") {
            alert("Error: " + e.message);
        }
    }
    finally {
        btn.disabled = false;
        lastGameOutcome = " ";
        tournamentActive = false;
    }
}

async function improve() {
    improving = true;
    const sel = document.getElementById("editBrainSelect");
    const originalIdx = parseInt(sel.value);
    if (!originalIdx || !BrainList[originalIdx]) {
        alert("Please select a brain to improve.");
        improving = false;
        return;
    }
    let genInput = document.getElementById("impGenerations").value;
    let maxGenerations = parseInt(genInput);
    if (!Number.isFinite(maxGenerations) || maxGenerations < 0) {
        alert("Generations must be a non-negative number.");
        improving = false;
        return;
    }
    let gamesInput = document.getElementById("impGames").value;
    let gamesPerSide = parseInt(gamesInput);
    if (!Number.isFinite(gamesPerSide) || gamesPerSide <= 0) {
        alert("Games per match must be greater than 0");
        improving = false;
        return;
    }
    if (maxGenerations === 0) {
        let champion = BrainList[originalIdx];
        report(`Exporting ${champion.name} (No evolution requested).`);
        downloadRevisedBrain(champion);
        improving = false;
        return;
    }
    let mutationRatePercent = parseFloat(document.getElementById("impPercent").value);
    if (!Number.isFinite(mutationRatePercent)) {
        mutationRatePercent = 20;
    }
    let champion = BrainList[originalIdx];
    let mutantIdx = BrainList.length;
    BrainList.push(structuredClone(champion));
    report(`Starting Evolution: ${champion.name}`);
    msg.innerHTML = `Starting Evolution<br>${champion.name}`;
    await sleep(50);
    try {
        let successes = 0;
        let currentRate = mutationRatePercent;
        for (let gen = 1; gen <= maxGenerations; gen++) {
            if (!improving) {
                break;
            }
            let mutantBrain = BrainList[mutantIdx];
            mutantBrain.name = "Mutant";
            for (let param of editorParams) {
                let currentVal = champion[param];
                let noise = (Math.random() * 2) - 1;
                let change = Math.round(currentVal * (currentRate / 100.0) * noise);
                let newVal = currentVal + change;
                if (newVal < 1) {
                    newVal = 1;
                }
                mutantBrain[param] = newVal;
            }
            msg.innerHTML = `Gen ${gen}/${maxGenerations}<br>Rate: ${Math.round(currentRate)}%<br>Testing...`;
            let score = await playBalancedMatch(originalIdx, mutantIdx, gamesPerSide);
            if (score < 0) {
                msg.innerHTML = `Gen ${gen}: Hit!<br>Score: ${score}<br>Optimizing...`;
                report(`Gen ${gen}: Random mutation found! (Score: ${score}). Starting Line Search...`);
                let optimizedBrain = await performLineSearch(champion, mutantBrain, gamesPerSide);
                successes++;
                report(`Gen ${gen}: Line Search Complete. Updating Champion.`);
                for (let param of editorParams) {
                    champion[param] = optimizedBrain[param];
                    updateEditorField(param, champion[param]);
                }
                normalizeBrain(champion);
                downloadRevisedBrain(champion);
            }
            else {
                currentRate *= 0.95;
                if (currentRate < 1) {
                    currentRate = 1;
                }
                document.getElementById("impPercent").value = Math.round(currentRate);
            }
        }
        report(`Evolution Complete. ${successes} improvements made.`);
        msg.innerHTML = `Evolution Done<br>Successes: ${successes}`;
        alert("Evolution Complete!");
    }
    catch (e) {
        console.error(e);
        msg.innerHTML = "Error:<br>" + e.message;
    }
    finally {
        if (BrainList.length > originalIdx + 1) {
            BrainList.splice(mutantIdx, BrainList.length - mutantIdx);
        }
        improving = false;
    }
}

function loadBrain() {
    const selector = document.getElementById("brains");
    if (!selector) {
        return;
    }
    const selectedBrain = selector.value;
    report("Selected Brain: " + selectedBrain);
}

function stopImprove() {
    improving = false;
    const stopBtn = document.getElementById("stopImprove");
    if (stopBtn) {
        stopBtn.disabled = true;
    }
    report("Improvement stopped by user.");
}

async function performLineSearch(originBrain, firstStepBrain, gamesPerSide) {
    let vector = {};
    for (let param of editorParams) {
        vector[param] = firstStepBrain[param] - originBrain[param];
    }
    let center = structuredClone(firstStepBrain);
    center.name = "LS_Center";
    let centerIdx = BrainList.length;
    let forwardIdx = centerIdx + 1;
    let backwardIdx = centerIdx + 2;
    BrainList.push(center);
    BrainList.push({});
    BrainList.push({});
    try {
        let stepScale = 0.5;
        let expanding = true;
        let searching = true;
        let iterations = 0;
        while (searching && iterations < 20 && improving) {
            iterations++;
            msg.innerHTML = `Line Search<br>Step ${iterations}<br>Scale ${stepScale.toFixed(3)}`;
            let forward = applyVector(center, vector, stepScale);
            forward.name = "LS_Forward";
            let backward = applyVector(center, vector, -stepScale);
            backward.name = "LS_Backward";
            BrainList[centerIdx] = center;
            BrainList[forwardIdx] = forward;
            BrainList[backwardIdx] = backward;
            if (isSameBrain(forward, center) && isSameBrain(backward, center)) {
                report(`Line Search converged (step too small).`);
                msg.innerHTML = "Converged<br>(Step too small)";
                await sleep(1000);
                break;
            }
            report(`Line Search Step ${iterations} (Scale ${stepScale}): Tourney [F, C, B]`);
            let contestants = [forwardIdx, centerIdx, backwardIdx];
            let winnerIdx = await runRoundRobin(contestants, gamesPerSide);
            if (winnerIdx === forwardIdx) {
                center = BrainList[forwardIdx];
                center.name = "LS_Center";
                if (expanding) {
                    for (let p of editorParams) {
                        vector[p] *= 2;
                    }
                    report("-> Forward wins. Doubling stride.");
                    msg.innerHTML = "Forward Wins<br>Doubling Stride";
                }
                else {
                    stepScale /= 2;
                    report("-> Forward wins (refining). Halving step.");
                    msg.innerHTML = "Forward Wins<br>Refining<br>Halving Step";
                }
            }
            else {
                if (winnerIdx === backwardIdx) {
                    center = BrainList[backwardIdx];
                    center.name = "LS_Center";
                    expanding = false;
                    stepScale /= 2;
                    report("-> Backward wins. Turned around. Halving step.");
                    msg.innerHTML = "Backward Wins<br>Turning Around<br>Halving Step";
                }
                else {
                    expanding = false;
                    stepScale /= 2;
                    report("-> Center wins. Peak found. Halving step.");
                    msg.innerHTML = "Center Wins<br>Peak Found<br>Halving Step";
                }
            }
            await sleep(1500);
        }
        let finalResult = structuredClone(BrainList[centerIdx]);
        return finalResult;
    }
    finally {
        if (BrainList.length > centerIdx) {
            BrainList.splice(centerIdx, BrainList.length - centerIdx);
        }
    }
}

function applyVector(base, vec, scale) {
    let newBrain = structuredClone(base);
    for (let param of editorParams) {
        let delta = vec[param] * scale;
        let val = base[param] + delta;
        newBrain[param] = Math.round(val);
        if (newBrain[param] < 0) {
            newBrain[param] = 0;
        }
    }
    return newBrain;
}

function isSameBrain(b1, b2) {
    for (let param of editorParams) {
        if (b1[param] !== b2[param]) {
            return false;
        }
    }
    return true;
}

async function runRoundRobin(indices, gamesPerSide) {
    let scores = {};
    indices.forEach(i => scores[i] = 0);
    for (let i = 0; i < indices.length; i++) {
        for (let j = i + 1; j < indices.length; j++) {
            let p1 = indices[i];
            let p2 = indices[j];
            let res1 = await playBalancedMatch(p1, p2, gamesPerSide);
            if (res1 > 0) {
                scores[p1] += 1;
            }
            else {
                if (res1 < 0) {
                    scores[p2] += 1;
                }
            }
        }
    }
    let maxScore = -1;
    let winners = [];
    for (let idx of indices) {
        if (scores[idx] > maxScore) {
            maxScore = scores[idx];
            winners = [idx];
        }
        else {
            if (scores[idx] === maxScore) {
                winners.push(idx);
            }
        }
    }
    if (winners.length === 1) {
        return winners[0];
    }
    report(`Tie detected between ${winners.map(i => BrainList[i].name).join(", ")}. Playing Rematch...`);
    let rematchWinner = await playRematch(winners);
    if (rematchWinner !== null) {
        return rematchWinner;
    }
    let fwd = indices[0];
    let cen = indices[1];
    let bwd = indices[2];
    let hasF = winners.includes(fwd);
    let hasC = winners.includes(cen);
    let hasB = winners.includes(bwd);
    if (hasC) {
        return cen;
    }
    if (hasF && hasB) {
        return fwd;
    }
    return winners[0];
}

async function playRematch(indices) {
    let scores = {};
    indices.forEach(i => scores[i] = 0);
    for (let i = 0; i < indices.length; i++) {
        for (let j = i + 1; j < indices.length; j++) {
            let p1 = indices[i];
            let p2 = indices[j];
            let res = await playBalancedMatch(p1, p2, 1);
            if (res > 0) {
                scores[p1]++;
            }
            else {
                if (res < 0) {
                    scores[p2]++;
                }
            }
        }
    }
    let maxScore = -999;
    let finalWinners = [];
    for (let idx of indices) {
        if (scores[idx] > maxScore) {
            maxScore = scores[idx];
            finalWinners = [idx];
        }
        else {
            if (scores[idx] === maxScore) {
                finalWinners.push(idx);
            }
        }
    }
    if (finalWinners.length === 1) {
        return finalWinners[0];
    }
    return null;
}

async function playBalancedMatch(idxA, idxB, gamesPerSide) {
    let netScore = 0;
    for (let g = 0; g < gamesPerSide; g++) {
        let res = await runTournamentGame(idxA, idxB);
        if (res === "ABORT") {
            throw new Error("Aborted");
        }
        netScore += res;
    }
    for (let g = 0; g < gamesPerSide; g++) {
        let res = await runTournamentGame(idxB, idxA);
        if (res === "ABORT") {
            throw new Error("Aborted");
        }
        netScore -= res;
    }
    return netScore;
}

function normalizeBrain(brain) {
    let maxVal = 0;
    for (let param of editorParams) {
        if (Math.abs(brain[param]) > maxVal) {
            maxVal = Math.abs(brain[param]);
        }
    }
    if (maxVal === 0) {
        return;
    }
    let scale = 1000 / maxVal;
    for (let param of editorParams) {
        let oldVal = brain[param];
        let newVal = Math.round(oldVal * scale);
        brain[param] = newVal;
        updateEditorField(param, newVal);
    }
}

function updateEditorField(param, val) {
    let input = document.getElementById("p_" + param);
    if (input) {
        input.value = val;
    }
}

function downloadRevisedBrain(brain) {
    let content = `// Revised Parameters for ${brain.name}\n`;
    content += `// Date: ${new Date().toLocaleString()}\n\n`;
    content += `const ${brain.name.replace(/[^a-zA-Z0-9]/g, '')} = {\n`;
    content += `    name: "${brain.name}",\n`;
    for (let param of editorParams) {
        content += `    ${param}: ${brain[param]},\n`;
    }
    content = content.replace(/,\n$/, "\n");
    content += `};\n`;
    const blob = new Blob([content], {
        type: 'text/plain;charset=utf-8;'
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${brain.name}_Improved.js`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function updateAuxDepths() {
    let newDefault = Math.max(2, WhiteDepth, BlackDepth);
    if (newDefault > 16) {
        newDefault = 16;
    }
    const eMenu = document.getElementById("evalDepth");
    const rMenu = document.getElementById("recDepth");
    if (eMenu) {
        eMenu.value = newDefault;
    }
    if (rMenu) {
        rMenu.value = newDefault;
    }
}

window.onload = function() {
    if (window.hasMillInitialized) {
        console.warn("Mill.js tried to initialize a second time. Ignoring.");
        return;
    }
    window.hasMillInitialized = true;
    init();
    draw();
    searchDepthWhiteElement.addEventListener('change', (event) => {
        WhiteDepth = parseInt(event.target.value, 10);
        if (searchDepthBlackElement.value !== event.target.value) {
            searchDepthBlackElement.value = event.target.value;
            BlackDepth = parseInt(event.target.value, 10);
        }
        updateAuxDepths();
        checkTimingLogic();
    });
    searchDepthBlackElement.addEventListener('change', (event) => {
        BlackDepth = parseInt(event.target.value, 10);
        updateAuxDepths();
        checkTimingLogic();
    });
    document.getElementById("WhitePlayer").addEventListener("change", function(event) {
        let val = parseInt(event.target.value);
        if (val > 0 && BrainList[val]) {
            WhiteBrain = BrainList[val];
        }
        else {
            WhiteBrain = defaultBrain();
        }
        WhiteHuman = (val === 0);
        const blackMenu = document.getElementById("BlackPlayer");
        if (blackMenu.value != event.target.value) {
            blackMenu.value = event.target.value;
            let blackVal = parseInt(blackMenu.value);
            if (blackVal > 0 && BrainList[blackVal]) {
                BlackBrain = BrainList[blackVal];
            }
            else {
                BlackBrain = defaultBrain();
            }
            BlackHuman = (blackVal === 0);
        }
        checkTimingLogic();
    });
    document.getElementById("BlackPlayer").addEventListener("change", function(event) {
        let val = parseInt(event.target.value);
        if (val > 0 && BrainList[val]) {
            BlackBrain = BrainList[val];
        }
        else {
            BlackBrain = defaultBrain();
        }
        BlackHuman = (val === 0);
        checkTimingLogic();
    });
    document.getElementById("createOB").addEventListener("click", function() {
        const N = document.getElementById('OBplies').value;
        const D = document.getElementById('OBDepth').value;
        createOpeningBook(N, D);
    });
    document.getElementById("setup").addEventListener("click", function() {
        const btn = document.getElementById("setup");
        settingUp = !settingUp;
        let field = document.getElementById("plies");
        if (settingUp) {
            setPlay();
            btn.innerText = "click again to finish setting up";
            field.value = gameBoard[0];
            Draw(gameBoard, setupColor);
        }
        else {
            btn.innerText = "set up board";
            let s = field.value;
            let c = parseInt(s);
            if (Number.isFinite(c) && c >= 0) {
                plyCount = c;
            }
            else {
                plyCount = 19;
            }
            gameBoard[0] = plyCount;
            whiteStones = 0;
            blackStones = 0;
            for (let i = 1; i <= npoints; i++) {
                if (gameBoard[i] === 2) {
                    whiteStones++;
                }
                else {
                    if (gameBoard[i] === 3) {
                        blackStones++;
                    }
                }
            }
            numberWhitePieces.innerHTML = "<B>" + whiteStones + "</B>";
            numberBlackPieces.innerHTML = "<B>" + blackStones + "</B>";
            Player = (plyCount % 2 === 0) ? White : Black;
            if (plyCount < 18) {
                Mode = 1;
            }
            else {
                Mode = 2;
                if ((Player === White && whiteStones === 3) || (Player === Black && blackStones === 3)) {
                    Mode = 3;
                }
            }
            if (Moves.length > plyCount) {
                Moves.length = plyCount;
            }
            if (history.length > plyCount) {
                history.length = plyCount;
            }
            let setupPos = Object.create(Position);
            setupPos.board = boardCopy(gameBoard);
            setupPos.white = whiteStones;
            setupPos.black = blackStones;
            setupPos.ply = plyCount + 1;
            setupPos.player = Player;
            setupPos.compute();
            history[plyCount] = setupPos;
            gameTop = bareGameTop;
            for (let i = 0; i < plyCount; i++) {
                if (Moves[i] && history[i + 1]) {
                    gameTop += html(Moves[i], history[i + 1]);
                }
            }
            game.innerHTML = gameTop + gameBottom;
            currentMove.init();
            currentMove.ply = plyCount + 1;
            currentMove.player = Player;
            takeMode = false;
            gameShown = true;
            uS();
            msg.innerText = "press play to start";
            draw();
            whiteTimeRemaining = timePerMoveForWhite;
            blackTimeRemaining = timePerMoveForBlack;
            updateClockDisplay();
        }
    });
    document.getElementById("tTable").addEventListener("click", function() {
        const btn = document.getElementById("tTable");
        TTable = !TTable;
        if (!TTable) {
            report("Warning: Transposition Table is off");
        }
        setTT(TTable);
        if (!TTable) {
            clearTT();
        }
        setToggleStyle(btn, TTable, "<B>TT</B>", "<B>TT</B>");
    });
    document.getElementById("alphaBeta").addEventListener("click", function() {
        const btn = document.getElementById("alphaBeta");
        AlphaBeta = !AlphaBeta;
        if (!AlphaBeta) {
            report("Warning: alpha/beta pruning is off");
        }
        setPruning(AlphaBeta);
        setToggleStyle(btn, AlphaBeta, "<B>&alpha;/&beta;</B>", "<B>&alpha;/&beta;</B>");
    });
    document.getElementById("OB").addEventListener("click", function() {
        const btn = document.getElementById("OB");
        OBon = !OBon;
        if (!OBon) {
            report("Warning: Opening Book is turned off ");
        }
        setToggleStyle(btn, OBon, "<B>OB</B>", "<B>OB</B>");
    });
    document.getElementById("reset").addEventListener("click", function() {
        reset();
    });
    document.getElementById("randomize").addEventListener("click", function() {
        Random = !Random;
        if (Random) {
            randomize.innerHTML = " randomizing best move";
        }
        else {
            randomize.innerHTML = " playing first best move";
        }
        draw();
    });
    document.getElementById("Game").addEventListener("click", function() {
        listGame();
    });
    document.getElementById("forward").addEventListener("click", function() {
        forward();
    });
    document.getElementById("backward").addEventListener("click", function() {
        backward();
    });
    document.getElementById("game").addEventListener("click", function(event) {
        if (event.target.tagName === 'BUTTON' && event.target.id.startsWith('M')) {
            const ply = parseInt(event.target.id.substring(1), 10);
            showHistory(ply);
        }
    });
    document.getElementById("print").addEventListener("click", function() {
        const canvas = document.getElementById('Board');
        const imgData = canvas.toDataURL("image/png");
        const link = document.createElement('a');
        link.download = 'Mill-Board.png';
        link.href = imgData;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });
    document.getElementById("play").addEventListener("click", async function() {
        document.getElementById("play").classList.remove("blink");
        if (!settingUp) {
            playing = !playing;
            if (playing) {
                uS();
                if (historyShown) {
                    restart();
                }
                let playingPossible = true;
                let reason = "";
                if (whiteStones > 9) {
                    report(" Warning: too many white stones");
                }
                if (blackStones > 9) {
                    report(" Warning: too many black stones");
                }
                if ((whiteStones + blackStones) === 24) {
                    reason = " No moves available<p> Board is full";
                    playingPossible = false;
                }
                else {
                    if (plyCount >= 18) {
                        if (whiteStones < 3) {
                            reason = " White lacks material";
                            playingPossible = false;
                        }
                        if (blackStones < 3) {
                            reason = " Black lacks material";
                            playingPossible = false;
                        }
                        possibleMoves = findMoves(gameBoard);
                        if (possibleMoves.length === 0) {
                            reason = Player + " has no moves";
                            playingPossible = false;
                        }
                    }
                }
                if (!playingPossible) {
                    msg.innerHTML = "<B>Playing impossible<p>" + reason + "<b>";
                    setPlay();
                    return;
                }
                document.getElementById('play').textContent = "Pause";
                document.getElementById("plies").value = "";
                if (PlayerIsComputer() && Mode < 4) {
                    play();
                }
            }
            else {
                setPlay();
                document.getElementById('play').textContent = "Resume";
            }
            draw();
            if (playing) {
                startGameTimer();
            }
            else {
                if (timerInterval) {
                    clearInterval(timerInterval);
                }
                timerInterval = null;
            }
        }
        else {
            msg.innerHTML = " <H4>finish setting up first</H4>";
        }
    });
    document.getElementById("Evaluate").addEventListener("click", async function() {
        msg.innerHTML = " evaluating... ";
        await sleep(10);
        let depths = structuredClone(depthCount);
        let evaluationDepth = parseInt(document.getElementById("evalDepth").value, 10);
        let currentBrain = (gameBoard[0] % 2 === 0) ? WhiteBrain : BlackBrain;
        let score;
        if (evaluationDepth === 0) {
            console.log("--- Manual Static Evaluation Request ---");
            score = staticEvaluation(currentBrain, gameBoard, true);
        }
        else {
            score = evaluate(currentBrain, gameBoard, evaluationDepth, -P, P, depths, [], WhiteEvalMode, BlackEvalMode)[0];
        }
        report(" score for this position: " + score);
        msg.innerHTML = " <h4> score is " + score + "</h4>";
    });
    document.getElementById("Recommend").addEventListener("click", async function() {
        let recommendations = "<B>available Moves:<br> computing...</B>";
        msg.innerHTML = recommendations;
        await sleep(10);
        let rawMoves = findMoves(gameBoard);
        let moves = [];
        if (symmetryCutOff > plyCount) {
            let seenHashes = new Set();
            for (let m of rawMoves) {
                let nextBoard = apply(m, gameBoard);
                nextBoard[0]++;
                let [canonicalHash] = hash(nextBoard);
                if (!seenHashes.has(canonicalHash)) {
                    seenHashes.add(canonicalHash);
                    moves.push(m);
                }
            }
        }
        else {
            moves = rawMoves;
        }
        let moveNumber = moves.length;
        let localAfterMoves = [];
        let moveValues = [];
        let moveIndices = [];
        let currentBrain = (gameBoard[0] % 2 === 0) ? WhiteBrain : BlackBrain;
        let recDepth = parseInt(document.getElementById("recDepth").value, 10);
        for (let k = 0; k < moveNumber; k++) {
            localAfterMoves[k] = apply(moves[k], gameBoard);
            localAfterMoves[k][0]++;
            let depths = structuredClone(depthCount);
            moveValues[k] = evaluate(currentBrain, localAfterMoves[k], recDepth - 1, -P, P, depths, [], WhiteEvalMode, BlackEvalMode)[0];
            moveIndices[k] = k;
        }
        if (gameBoard[0] % 2 == 0) {
            moveIndices.sort((a, b) => moveValues[b] - moveValues[a]);
        }
        else {
            moveIndices.sort((a, b) => moveValues[a] - moveValues[b]);
        }
        recommendations = "<B>available Moves (" + moveNumber + "):<n><TABLE>";
        recommendations += "<TR><TD>n<TD>p<TD>q<TD>r<TD>value</TD></TD></TD></TD></TD></TR><TR></TR>"
        for (let k = 0; k < moveNumber; k++) {
            let K = moveIndices[k];
            recommendations += " <TR><TD> " + k + ":  </TD><TD>" + blank(moves[K].p) + "</TD><TD> " + blank(moves[K].q) + "</TD><TD> " + blank(moves[K].x) + "</TD><TD> " + moveValues[K] + "</TD></TR>";
        }
        recommendations += "</Table></B>";
        msg.innerHTML = recommendations;
    });
    document.getElementById("tournament").addEventListener("click", async function() {
        playTournament();
    });
    document.getElementById("Labels").addEventListener("click", function() {
        LabelIt = !LabelIt;
        const btn = document.getElementById("Labels");
        setToggleStyle(btn, LabelIt, "<B>Lab</B>", "<B>Lab</B>");
        draw();
    });
    document.getElementById("eligibles").addEventListener("click", function() {
        showEligibles = !showEligibles;
        const btn = document.getElementById("eligibles");
        setToggleStyle(btn, showEligibles, "<B>Elgb</B>", "<B>Elgb</B>");
        if (!PlayerIsComputer()) {
            draw();
        }
    });
    document.getElementById("highlight").addEventListener("click", function() {
        showHighlight = !showHighlight;
        const btn = document.getElementById("highlight");
        setToggleStyle(btn, showHighlight, "<B>HLight</B>", "<B>Hlight</B>");
        draw();
    });
    document.getElementById("reportDepths").addEventListener("click", function() {
        ReportDepths = !ReportDepths;
        const btn = document.getElementById("reportDepths");
        setToggleStyle(btn, ReportDepths, "<B>Stats</B>", "<B>Stats</B>");
    });
    document.getElementById("ReportTiming").addEventListener("click", function() {
        reportComputerTime = !reportComputerTime;
        const btn = document.getElementById("ReportTiming");
        setToggleStyle(btn, reportComputerTime, "<B>CPU</B>", "<B>CPU</B>");
    });
    document.getElementById("Timing").addEventListener("click", function() {
        humanTiming = !humanTiming;
        if (!humanTiming) {
            if (WhiteHuman) {
                whiteTimeRemaining = timePerMoveForWhite;
            }
            if (BlackHuman) {
                blackTimeRemaining = timePerMoveForBlack;
            }
            updateClockDisplay();
        }
        checkTimingLogic();
    });
    document.getElementById("improveBtn").addEventListener("click", function() {
        improve();
    });
    document.getElementById("editBrainSelect").addEventListener("change", function(event) {
        let val = parseInt(event.target.value);
        if (val > 0 && BrainList[val]) {
            for (let param of editorParams) {
                let input = document.getElementById("p_" + param);
                if (input) {
                    input.value = BrainList[val][param];
                }
            }
        }
    });
    for (let param of editorParams) {
        setupStandardInput("p_" + param, null, (val) => (Number.isFinite(val) ? val : null), (val) => {
            let brainIdx = parseInt(document.getElementById("editBrainSelect").value);
            if (brainIdx > 0 && BrainList[brainIdx]) {
                BrainList[brainIdx][param] = val;
                report(`Updated ${BrainList[brainIdx].name}.${param} to ${val}`);
            }
        });
    }
    setupStandardInput("plies", null, (v) => (Number.isInteger(v) && v >= 0 ? v : null), null);
    setupStandardInput("impGenerations", 500, (v) => (v >= 0 ? v : null), null);
    setupStandardInput("impGames", 10, (v) => (v > 0 ? v : null), null);
    setupStandardInput("impPercent", 5, (v) => (v > 0 ? v : null), null);
    setupStandardInput("impSteps", null, (v) => (v > 0 ? v : null), null);
    setupStandardInput("impReps", null, (v) => (v > 0 ? v : null), null);
    setupStandardInput("symCutoff", symmetryCutOff, (v) => (v >= 0 && v <= 18 ? v : null), (v) => setSymmetryCutOff(v));
    setupStandardInput("tGames", 100, (v) => (v >= 1 ? v : null), null);
    setupStandardInput("numberProcesses", Cores, (v) => (v > 0 ? v : null), (v) => {
        Cores = v;
        setupWorkers();
    });
    setupStandardInput("OBplies", 4, (v) => (v >= 0 ? v : null), null);
    setupStandardInput("OBDepth", 6, (v) => (v >= 0 ? v : null), null);
    setupStandardInput("minSplitDepth", 4, (v) => (v >= 0 ? v : null), (v) => {
        minSplitDepth = v;
    });
    setupStandardInput("ttLimit", 16, (v) => (v > 0 ? v : null), (v) => {
        totalTTLimit = v * 1000000;
        report("setting TT to " + totalTTLimit + " entries");
    });
    Board.addEventListener('click', function(event) {
        if (settingUp) {
            let p = locate(event.offsetX, event.offsetY);
            gameBoard[p]++;
            if (gameBoard[p] > 3) {
                gameBoard[p] = 1;
            }
            Draw(gameBoard, setupColor);
        }
        else {
            if (playing && !PlayerIsComputer()) {
                let p = locate(event.offsetX, event.offsetY);
                if (p > 0) {
                    if (takeMode) {
                        gameBoard[p] = 1;
                        currentMove.x = p;
                        if (Player === White) {
                            blackStones--;
                        }
                        else {
                            whiteStones--;
                        }
                        takeMode = false;
                        nextMove();
                        draw();
                    }
                    else {
                        currentMove.p = p;
                        if (Mode === 1) {
                            if (Player === White) {
                                markWhite(p);
                            }
                            else {
                                markBlack(p);
                            }
                            if (inMill(p, gameBoard)) {
                                takeMode = true;
                                prepareRemove();
                            }
                            else {
                                nextMove();
                            }
                        }
                        markEligible();
                    }
                }
            }
        }
    });
    Board.addEventListener('mousedown', function(event) {
        if (playing && !PlayerIsComputer()) {
            if (Mode === 2 || Mode === 3) {
                let p = locateAny(event.offsetX, event.offsetY);
                if (p > 0) {
                    const playerCode = (Player === White) ? 2 : 3;
                    if (gameBoard[p] === playerCode && Eligible(p, gameBoard)) {
                        movedPoint = p;
                        currentMove.p = p;
                        dragging = true;
                        markP(p);
                        uS();
                    }
                    else {
                        dragging = false;
                    }
                }
                else {
                    dragging = false;
                }
            }
        }
    });
    Board.addEventListener('mousemove', function(event) {
        if (playing && !PlayerIsComputer()) {
            if (dragging) {
                draw();
                let playerMark = (Player === White) ? 2 : 3;
                let bodyColor = (playerMark === 2) ? whiteBody : blackBody;
                let rimColor = (playerMark === 2) ? whiteRim : blackRim;
                dcircle(event.offsetX, event.offsetY, bodyColor, rimColor, 2 * radius);
                markEligible();
                if (movedPoint > 0) {
                    markP(movedPoint);
                }
            }
        }
    });
    Board.addEventListener('mouseup', async function(event) {
        if (playing && !PlayerIsComputer() && dragging) {
            let x = event.offsetX;
            let y = event.offsetY;
            let q = locateAny(x, y);
            const startPoint = currentMove.p;
            const validTarget = gameBoard[q] === 1;
            const isNeighborOrFlying = neighbors(startPoint, q) || Mode === 3;
            if (q > 0 && validTarget && isNeighborOrFlying) {
                gameBoard[q] = gameBoard[startPoint];
                gameBoard[startPoint] = 1;
                currentMove.q = q;
                dragging = false;
                draw();
                markEligible();
                if (inMill(q, gameBoard)) {
                    takeMode = true;
                    prepareRemove();
                }
                else {
                    nextMove();
                }
            }
            else {
                dragging = false;
                draw();
                markEligible();
                uS();
            }
        }
        draw();
        markEligible();
    });
    Board.addEventListener('mouseenter', function(event) {
        if (playing && !PlayerIsComputer()) {
            markEligible();
        }
    });
    Board.addEventListener('mouseleave', function(event) {
        if (playing && !PlayerIsComputer()) {
            draw();
        }
    });
    document.getElementById("timeForWhite").addEventListener("change", function() {
        let s = document.getElementById("timeForWhite").value;
        let time = parseInt(s);
        if (Number.isFinite(time) && time > 0) {
            if (time >= 6000) {
                time = 5999;
            }
            timePerMoveForWhite = time;
            if (plyCount === 0) {
                whiteTimeRemaining = time;
            }
            if (!playing) {
                whiteClock.innerHTML = "<B>" + formatTime(timePerMoveForWhite) + "</B>";
            }
        }
        document.getElementById("timeForWhite").value = "" + formatTime(timePerMoveForWhite);
        updateClockDisplay();
    });
    document.getElementById("timeForWhite").addEventListener("click", function() {
        timeForWhite.value = "";
    });
    document.getElementById("timeForBlack").addEventListener("click", function() {
        timeForBlack.value = "";
    });
    document.getElementById("timeForBlack").addEventListener("change", function() {
        let s = document.getElementById("timeForBlack").value;
        let time = parseInt(s);
        if (Number.isFinite(time) && time > 0) {
            if (time >= 6000) {
                time = 5999;
            }
            timePerMoveForBlack = time;
            if (plyCount === 0) {
                blackTimeRemaining = time;
            }
            if (!playing) {
                blackClock.innerHTML = "<B>" + formatTime(timePerMoveForBlack) + "</B>";
            }
            timeForBlack.value = formatTime(timePerMoveForBlack);
        }
        document.getElementById("timeForBlack").value = "" + formatTime(timePerMoveForBlack);
        updateClockDisplay();
    });
    document.getElementById("engineToggle").addEventListener("click", function() {
        toggleEngine();
    });
    updateEngineButton();
    document.getElementById("silence").addEventListener("click", function() {
        silentMode = !silentMode;
        updateSilence();
    });

    function updateSilence() {
        const btn = document.getElementById("silence");
        if (silentMode) {
            btn.style.backgroundColor = "red";
            btn.style.color = "white";
            btn.innerText = "Silence ON";
        }
        else {
            btn.style.backgroundColor = "green";
            btn.style.color = "white";
            btn.innerText = "Silence OFF";
        }
    }
    window.improve = improve;
    window.stopImprove = stopImprove;
    window.loadBrain = loadBrain;
    updateSilence();
};

function updateTiming() {
    numberWhitePieces.innerHTML = "<B>0<B>";
    numberBlackPieces.innerHTML = "<B>0<B>";
    timeForBlack.value = formatTime(timePerMoveForBlack);
    timeForWhite.value = formatTime(timePerMoveForWhite);
    updateClockDisplay();
    if (timerInterval) {
        clearInterval(timerInterval);
    }
    timerInterval = null;
}

function setupBrainIO() {
    const nameField = document.getElementById("brainFileName");
    if (nameField) {
        nameField.dataset.default = "brains";
        nameField.addEventListener("focus", function() {
            this.value = "";
        });
        nameField.addEventListener("blur", function() {
            if (this.value.trim() === "") {
                this.value = this.dataset.default;
            }
        });
    }
    const btnExport = document.getElementById("btnExportBrains");
    if (btnExport) {
        btnExport.addEventListener("click", exportBrains);
    }
    const btnReset = document.getElementById("btnResetBrains");
    if (btnReset) {
        btnReset.addEventListener("click", resetBrains);
    }
    const btnImport = document.getElementById("btnImportBrains");
    const fileInput = document.getElementById("fileInputBrains");
    if (btnImport && fileInput && nameField) {
        btnImport.addEventListener("click", function() {
            let filename = nameField.value.trim();
            if (!filename) {
                filename = "brains";
            }
            if (!filename.toLowerCase().endsWith(".csv") && !filename.toLowerCase().endsWith(".txt")) {
                filename += ".csv";
            }
            report("Attempting to auto-load: " + filename);
            fetch(filename, {
                    method: 'GET'
                }).then(response => {
                    if (response.ok) {
                        return response.text();
                    }
                    throw new Error("File not found on server");
                }).then(text => {
                    report("Auto-load successful.");
                    importBrains(text);
                })
                .catch(err => {
                    console.log("Auto-load failed (" + err.message + "). Opening selector...");
                    fileInput.click();
                });
        });
        fileInput.addEventListener("change", function(e) {
            const file = e.target.files[0];
            if (!file) {
                return;
            }
            const reader = new FileReader();
            reader.onload = function(e) {
                importBrains(e.target.result);
                fileInput.value = '';
            };
            reader.readAsText(file);
        });
    }
}

function resetBrains() {
    if (!confirm("Are you sure you want to restore the default players? Unsaved changes will be lost.")) {
        return;
    }
    BrainList.length = 0;
    defaultBrainList.forEach(b => {
        BrainList.push(structuredClone(b));
    });
    setupMenus();
    setupParticipantsTable();
    const editSelect = document.getElementById("editBrainSelect");
    if (editSelect && editSelect.options.length > 1) {
        editSelect.value = 1;
        editSelect.dispatchEvent(new Event("change"));
    }
    alert("Default brains restored.");
}

function exportBrains() {
    let content = "Name";
    for (let param of editorParams) {
        content += "," + param;
    }
    content += "\n";
    for (let i = 1; i < BrainList.length; i++) {
        const b = BrainList[i];
        if (b) {
            let safeName = b.name.replace(/,/g, '');
            let row = safeName;
            for (let param of editorParams) {
                row += "," + b[param];
            }
            content += row + "\n";
        }
    }
    let filename = document.getElementById("brainFileName").value.trim();
    if (!filename) {
        filename = "brains";
    }
    if (!filename.toLowerCase().endsWith(".csv")) {
        filename += ".csv";
    }
    const blob = new Blob([content], {
        type: 'text/csv;charset=utf-8;'
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function importBrains(fileContent) {
    try {
        const lines = fileContent.trim().split(/\r?\n/);
        if (lines.length < 2) {
            throw new Error("File empty or missing header.");
        }
        const headers = lines[0].split(',').map(h => h.trim());
        const nameIndex = headers.indexOf("Name");
        if (nameIndex === -1) {
            throw new Error("Missing 'Name' column.");
        }
        const paramMap = {};
        for (let param of editorParams) {
            const idx = headers.indexOf(param);
            if (idx !== -1) {
                paramMap[param] = idx;
            }
        }
        const newBrainList = [null];
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) {
                continue;
            }
            const cols = line.split(',');
            const newBrain = {};
            if (cols.length <= nameIndex) {
                continue;
            }
            newBrain.name = cols[nameIndex].trim();
            if (!newBrain.name) {
                newBrain.name = "Brain " + i;
            }
            for (let param of editorParams) {
                if (paramMap.hasOwnProperty(param) && cols.length > paramMap[param]) {
                    let val = parseInt(cols[paramMap[param]], 10);
                    if (isNaN(val)) {
                        val = 0;
                    }
                    newBrain[param] = val;
                }
                else {
                    newBrain[param] = 0;
                }
            }
            newBrainList.push(newBrain);
        }
        BrainList.length = 0;
        newBrainList.forEach(b => BrainList.push(b));
        setupMenus();
        setupParticipantsTable();
        const editSelect = document.getElementById("editBrainSelect");
        if (editSelect && editSelect.options.length > 1) {
            editSelect.value = 1;
            editSelect.dispatchEvent(new Event("change"));
        }
        alert(`Loaded ${BrainList.length - 1} brains.`);
    }
    catch (err) {
        console.error(err);
        alert("Import Failed: " + err.message);
    }
}

function updateEngineButton() {
    const btn = document.getElementById("engineToggle");
    if (useCppEngine) {
        btn.innerHTML = "<h1>Mill v. 28 C++</h1>";
        btn.style.backgroundColor = "#e0e0e0";
        btn.style.color = "blue";
    }
    else {
        btn.innerHTML = "<h1>Mill v. 28 JS</h1>";
        btn.style.backgroundColor = "#ffffcc";
        btn.style.color = "navy";
    }
}

function toggleEngine() {
    if (playing) {
        alert("Please stop the game before switching engines.");
        return;
    }
    if (!useCppEngine && !cppAvailable) {
        alert("The C++ Engine is unavailable on this system.\n\n(It may be missing the .wasm file or WebAssembly is disabled.)\n\nStaying in JavaScript mode.");
        return;
    }
    useCppEngine = !useCppEngine;
    updateEngineButton();
    msg.innerHTML = "Switching Engine...";
    setTimeout(() => {
        setupWorkers();
    }, 50);
}

function setupTooltips() {
    let tooltip = document.getElementById('custom-tooltip');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'custom-tooltip';
        document.body.appendChild(tooltip);
    }
    let tooltipTimer;
    let lastX = 0;
    let lastY = 0;
    const updatePosition = () => {
        let x = lastX + 15;
        let y = lastY + 15;
        if (x + tooltip.offsetWidth > window.innerWidth) {
            x = lastX - tooltip.offsetWidth - 10;
        }
        if (y + tooltip.offsetHeight > window.innerHeight) {
            y = lastY - tooltip.offsetHeight - 10;
        }
        tooltip.style.left = x + 'px';
        tooltip.style.top = y + 'px';
    };
    const elements = document.querySelectorAll('[title]');
    elements.forEach(el => {
        if (el.hasAttribute('data-tooltip-initialized')) {
            return;
        }
        el.setAttribute('data-tooltip-initialized', 'true');
        let rawText = el.getAttribute('title');
        if (rawText) {
            const cleanText = rawText.split('\n').map(line => line.trim()).filter(line => line.length > 0).join('\n');
            el.setAttribute('data-tooltip', cleanText);
            el.removeAttribute('title');
            el.addEventListener('mouseenter', (e) => {
                if (tooltipTimer) {
                    clearTimeout(tooltipTimer);
                }
                lastX = e.clientX;
                lastY = e.clientY;
                const text = el.getAttribute('data-tooltip');
                if (text) {
                    tooltip.innerText = text;
                    tooltipTimer = setTimeout(() => {
                        tooltip.style.display = 'block';
                        updatePosition();
                    }, 2000);
                }
            });
            el.addEventListener('mousemove', (e) => {
                lastX = e.clientX;
                lastY = e.clientY;
                if (tooltip.style.display === 'block') {
                    updatePosition();
                }
            });
            el.addEventListener('mouseleave', () => {
                if (tooltipTimer) {
                    clearTimeout(tooltipTimer);
                }
                tooltip.style.display = 'none';
            });
        }
    });
}
setupTooltips();

async function setupWorkers() {
    // 1. Sync worker count
    numberWorkers = Cores; 

    // CHANGE 1: Point to wasm_worker.js for C++ mode
    // This file imports the raw engine and adds the necessary message handling logic.
    let scriptToUse = useCppEngine ? 'wasm_worker.js' : 'js_worker.js';
    
    // CHANGE 2: Use 'classic' for C++ (needed for importScripts)
    let typeToUse   = useCppEngine ? 'classic' : 'module';

    // 3. Terminate old workers
    if (workers.length > 0) {
        workers.forEach(w => w.terminate());
    }
    workers = [];

    // 4. Create new workers
    for (let i = 0; i < numberWorkers; i++) {
        try {
            const worker = new Worker(scriptToUse, { type: typeToUse });
            
            // CHANGE 3: Use the proper listener function!
            // The old inline code was ignoring "ENGINE_READY" messages.
            worker.onmessage = createWorkerListener(worker);

            worker.onerror = function(err) {
                console.error(`Worker ${i} error:`, err.message);
            };

            workers.push(worker);

        } catch (e) {
            console.error("Critical: Failed to create worker:", e);
        }
    }

    // 5. Initialize Memory (JS Only) or Show Ready State
    if (!useCppEngine) {
        let sharePerWorker = Math.floor(totalTTLimit / workers.length);
        if (sharePerWorker < 1024) sharePerWorker = 1024;
        
        setTimeout(() => {
            for (const w of workers) {
                w.postMessage({ command: "setMaxTTEntries", value: sharePerWorker });
            }
            engineReadyCount = workers.length;
            if(msg) msg.innerHTML = "<H4>JavaScript Engine Ready<BR>Press PLAY to start</H4>";
            let playBtn = document.getElementById("play");
            if(playBtn) playBtn.classList.add("blink");
        }, 200);
    } else {
        // C++ Ready state is handled by createWorkerListener when "ENGINE_READY" arrives
        setTimeout(() => {
            if(msg) msg.innerHTML = `<H4>Loading C++ Engine...</H4>`;
        }, 20);
    }
}
