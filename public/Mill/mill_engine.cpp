/*
 * mill_engine.cpp
 * Final Release Version - Fully Controllable (TT/Pruning switches enabled)
 */
#include <algorithm>
#include <vector>
#include <array>
#include <cmath>
#include <cstring>
#include <map>

// --- CONSTANTS ---
const int NPOINTS = 24;
const int MAX_SCORE = 99999;
const int MIN_SCORE = -99999;
const int WHITE = 2;
const int BLACK = 3;
// Track nodes per depth (Max depth 64 is safe)
int depthCounts[64];
// --- GLOBALS FOR TESTING ---
bool TTEnabled = true;
bool UseAlphaBeta = true;
// --- DATA ---
const std::vector<std::vector<int>> ADJ = {
    {},
    {2, 10}, {1, 3, 5}, {2, 15},
    {5, 11}, {2, 4, 6, 8}, {5, 14},
    {8, 12}, {5, 7, 9}, {8, 13},
    {1, 11, 22}, {4, 10, 12, 19}, {7, 11, 16},
    {9, 14, 18}, {6, 13, 15, 21}, {3, 14, 24},
    {12, 17}, {16, 18, 20}, {13, 17},
    {11, 20}, {17, 19, 21, 23}, {14, 20},
    {10, 23}, {20, 22, 24}, {15, 23}
};
const std::vector<std::vector<std::vector<int>>> MILLS = {
    {},
    {{2, 3}, {10, 22}}, {{1, 3}, {5, 8}}, {{1, 2}, {15, 24}},
    {{5, 6}, {11, 19}}, {{4, 6}, {2, 8}}, {{4, 5}, {14, 21}},
    {{8, 9}, {12, 16}}, {{7, 9}, {2, 5}}, {{7, 8}, {13, 18}},
    {{1, 22}, {11, 12}}, {{10, 12}, {4, 19}}, {{10, 11}, {7, 16}},
    {{14, 15}, {9, 18}}, {{13, 15}, {6, 21}}, {{13, 14}, {3, 24}},
    {{17, 18}, {7, 12}}, {{16, 18}, {20, 23}}, {{16, 17}, {9, 13}},
    {{20, 21}, {4, 11}}, {{19, 21}, {17, 23}}, {{19, 20}, {6, 14}},
    {{23, 24}, {1, 10}}, {{22, 24}, {17, 20}}, {{22, 23}, {3, 15}}
};
const int PERMS[16][25] = {
    {0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24},
    {0, 22, 23, 24, 19, 20, 21, 16, 17, 18, 10, 11, 12, 13, 14, 15, 7, 8, 9, 4, 5, 6, 1, 2, 3},
    {0, 3, 2, 1, 6, 5, 4, 9, 8, 7, 15, 14, 13, 12, 11, 10, 18, 17, 16, 21, 20, 19, 24, 23, 22},
    {0, 3, 15, 24, 6, 14, 21, 9, 13, 18, 2, 5, 8, 17, 20, 23, 7, 12, 16, 4, 11, 19, 1, 10, 22},
    {0, 22, 10, 1, 19, 11, 4, 16, 12, 7, 23, 20, 17, 8, 5, 2, 18, 13, 9, 21, 14, 6, 24, 15, 3},
    {0, 1, 10, 22, 4, 11, 19, 7, 12, 16, 2, 5, 8, 17, 20, 23, 9, 13, 18, 6, 14, 21, 3, 15, 24},
    {0, 24, 15, 3, 21, 14, 6, 18, 13, 9, 23, 20, 17, 8, 5, 2, 16, 12, 7, 19, 11, 4, 22, 10, 1},
    {0, 7, 8, 9, 4, 5, 6, 1, 2, 3, 12, 11, 10, 15, 14, 13, 22, 23, 24, 19, 20, 21, 16, 17, 18},
    {0, 24, 23, 22, 21, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1},
    {0, 16, 17, 18, 19, 20, 21, 22, 23, 24, 12, 11, 10, 15, 14, 13, 1, 2, 3, 4, 5, 6, 7, 8, 9},
    {0, 9, 8, 7, 6, 5, 4, 3, 2, 1, 13, 14, 15, 10, 11, 12, 24, 23, 22, 21, 20, 19, 18, 17, 16},
    {0, 18, 17, 16, 21, 20, 19, 24, 23, 22, 13, 14, 15, 10, 11, 12, 3, 2, 1, 6, 5, 4, 9, 8, 7},
    {0, 9, 13, 18, 6, 14, 21, 3, 15, 24, 8, 5, 2, 23, 20, 17, 1, 10, 22, 4, 11, 19, 7, 12, 16},
    {0, 18, 13, 9, 21, 14, 6, 24, 15, 3, 17, 20, 23, 2, 5, 8, 22, 10, 1, 19, 11, 4, 16, 12, 7},
    {0, 7, 12, 16, 4, 11, 19, 1, 10, 22, 8, 5, 2, 23, 20, 17, 3, 15, 24, 6, 14, 21, 9, 13, 18},
    {0, 16, 12, 7, 19, 11, 4, 22, 10, 1, 17, 20, 23, 2, 5, 8, 24, 15, 3, 21, 14, 6, 18, 13, 9}
};
struct Brain {
    int groupScore;
    int N3;
    int N4;
    int mobility1Score;
    int mobility2Score;
    int flyBonus;
    int pieceDiffMultiplier;
    int millScore;
    int doubleMillScore;
    int nearMillFilled;
    int nearMillReady;
    int nearMillGuaranteed;
};
Brain currentBrain;
struct Move {
    int ply;
    int p;
    int q;
    int x;
};
struct TTEntry {
    unsigned long long key;
    int value;
    int depth;
    int flag;
};
const int TT_SIZE = 1048576;
std::vector<TTEntry> TTable(TT_SIZE);
unsigned long long ZTable[25][4];
unsigned long long ZTurn;
bool ZInitialized = false;

void initZobrist() {
    if (ZInitialized) {
        return;
    }
    unsigned long long seed = 987654321;
    auto nextRand = [&]() {
        seed = (1664525 * seed + 1013904223) % 4294967296;
        return seed;
    };
    for (int p = 1; p <= 24; p++) {
        for (int c = 0; c < 4; c++) {
            ZTable[p][c] = nextRand() | (nextRand() << 32);
        }
    }
    ZTurn = nextRand() | (nextRand() << 32);
    ZInitialized = true;
}

unsigned long long getHash(int* board) {
    unsigned long long h = 0;
    if (board[0] % 2 != 0) {
        h ^= ZTurn;
    }
    for (int p = 1; p <= 24; p++) {
        h ^= ZTable[p][board[p]];
    }
    return h;
}

std::pair<unsigned long long, int> getCanonicalHash(int* board) {
    unsigned long long bestH = 0xFFFFFFFFFFFFFFFF;
    int bestPerm = 0;
    for (int i = 0; i < 16; i++) {
        unsigned long long currentH = 0;
        if (board[0] % 2 != 0) {
            currentH ^= ZTurn;
        }
        for (int p = 1; p <= 24; p++) {
            currentH ^= ZTable[p][board[PERMS[i][p]]];
        }
        if (currentH < bestH) {
            bestH = currentH;
            bestPerm = i;
        }
    }
    return {bestH, bestPerm};
}

// GAME LOGIC
bool inMill(int p, int* board) {
    int player = board[p];
    if (player == 1) {
        return false;
    }
    const auto& myMills = MILLS[p];
    for (size_t i = 0; i < myMills.size(); ++i) {
        if (board[myMills[i][0]] == player && board[myMills[i][1]] == player) {
            return true;
        }
    }
    return false;
}

int calculateMobility(int* board, int ply, int white, int black, int playerCode, int m1, int m2) {
    int total = 0;
    bool isWhite = (playerCode == WHITE);
    int count = isWhite ? white : black;
    if (ply >= 18 && count == 3) {
        int empty = 0;
        for (int i = 1; i <= 24; i++) {
            if (board[i] == 1) {
                empty++;
            }
        }
        return empty * m1;
    }
    for (int p = 1; p <= 24; p++) {
        if (board[p] == playerCode) {
            for (int n1 : ADJ[p]) {
                if (board[n1] == 1) {
                    total += m1;
                    for (int n2 : ADJ[n1]) {
                        if (n2 != p && board[n2] == 1) {
                            total += m2;
                        }
                    }
                }
            }
        }
    }
    return total;
}

void dfsGroup(int u, int player, int* board, std::vector<bool>& visited) {
    visited[u] = true;
    for (int v : ADJ[u]) {
        if (board[v] == player && !visited[v]) {
            dfsGroup(v, player, board, visited);
        }
    }
}

int calculateGroups(int* board, int player) {
    std::vector<bool> visited(25, false);
    int groups = 0;
    for (int i = 1; i <= 24; i++) {
        if (board[i] == player && !visited[i]) {
            groups++;
            dfsGroup(i, player, board, visited);
        }
    }
    return groups;
}

int calculateMillsCount(int* board, int player, int scoreVal) {
    int score = 0;
    for (int p = 1; p <= 24; p++) {
        if (board[p] == player && inMill(p, board)) {
            score += scoreVal;
        }
    }
    return score;
}

int staticEvaluation(int* board, int ply, int wMode, int bMode) {
    int white = 0, black = 0;
    int whitePos = 0, blackPos = 0;
    for (int p = 1; p <= 24; p++) {
        if (board[p] == WHITE) {
            white++;
        }
        else {
            if (board[p] == BLACK) {
                black++;
            }
        }
    }
    int score = currentBrain.pieceDiffMultiplier * (white - black);
    for (int p = 1; p <= 24; p++) {
        int neighbors = ADJ[p].size();
        int bonus = (neighbors == 3) ? currentBrain.N3 : ((neighbors == 4) ? currentBrain.N4 : 0);
        if (board[p] == WHITE) {
            whitePos += bonus;
        }
        else {
            if (board[p] == BLACK) {
                blackPos += bonus;
            }
        }
    }
    score += (whitePos - blackPos);
    if (currentBrain.groupScore != 0) {
        score -= (calculateGroups(board, WHITE) - 1) * currentBrain.groupScore;
        score += (calculateGroups(board, BLACK) - 1) * currentBrain.groupScore;
    }
    score += (calculateMillsCount(board, WHITE, currentBrain.millScore) - calculateMillsCount(board, BLACK, currentBrain.millScore));
    int phase = (ply >= 18) ? 2 : 1;
    bool wFly = (white == 3 && phase > 1);
    bool bFly = (black == 3 && phase > 1);
    int wMob = calculateMobility(board, ply, white, black, WHITE, currentBrain.mobility1Score, currentBrain.mobility2Score);
    int bMob = calculateMobility(board, ply, white, black, BLACK, currentBrain.mobility1Score, currentBrain.mobility2Score);
    score += (wMob - bMob);
    if (wFly) {
        score += currentBrain.flyBonus;
    }
    if (bFly) {
        score -= currentBrain.flyBonus;
    }
    return score;
}

void applyMove(int* board, const Move& m) {
    if (m.q != 0) {
        board[m.q] = board[m.p];
        board[m.p] = 1;
    }
    else {
        board[m.p] = (board[0] % 2 == 0) ? WHITE : BLACK;
    }
    if (m.x != 0) {
        board[m.x] = 1;
    }
    board[0]++;
}

int nodesVisited = 0;

/* mill_engine.cpp Optimization */

void getMoves(int* board, Move* moveList, int& count) {
    count = 0; // Reset counter
    int ply = board[0];
    int player = (ply % 2 == 0) ? WHITE : BLACK;
    int opponent = (player == WHITE) ? BLACK : WHITE;
    int white = 0, black = 0;
    // Count pieces
    for (int i = 1; i <= 24; i++) {
        if (board[i] == WHITE) {
            white++;
        }
        else {
            if (board[i] == BLACK) {
                black++;
            }
        }
    }
    // ... (Your logic for "Placing" phase remains the same, just use moveList[count++]) ...
    if (ply < 18) {
        for (int p = 1; p <= 24; p++) {
            if (board[p] == 1) {
                board[p] = player;
                if (inMill(p, board)) {
                    bool canCapture = false;
                    for (int x = 1; x <= 24; x++) {
                        if (board[x] == opponent && !inMill(x, board)) {
                            moveList[count++] = {ply + 1, p, 0, x};
                            canCapture = true;
                        }
                    }
                    if (!canCapture) {
                        for (int x = 1; x <= 24; x++) {
                            if (board[x] == opponent) {
                                moveList[count++] = {ply + 1, p, 0, x};
                            }
                        }
                    }
                }
                else {
                    moveList[count++] = {ply + 1, p, 0, 0};
                }
                board[p] = 1;
            }
        }
    }
    else {
        // ... (Your logic for "Moving/Flying" phase) ...
        int myCount = (player == WHITE) ? white : black;
        bool flying = (myCount == 3);
        for (int p = 1; p <= 24; p++) {
            if (board[p] == player) {
                // Use a small local buffer for targets to avoid vector
                int targets[24];
                int tCount = 0;
                if (flying) {
                    for (int t = 1; t <= 24; t++) {
                        if (board[t] == 1) {
                            targets[tCount++] = t;
                        }
                    }
                }
                else {
                    for (int t : ADJ[p]) {
                        if (board[t] == 1) {
                            targets[tCount++] = t;
                        }
                    }
                }
                for (int k = 0; k < tCount; k++) {
                    int q = targets[k];
                    board[p] = 1;
                    board[q] = player;
                    if (inMill(q, board)) {
                        bool canCapture = false;
                        for (int x = 1; x <= 24; x++) {
                            if (board[x] == opponent && !inMill(x, board)) {
                                moveList[count++] = {ply + 1, p, q, x};
                                canCapture = true;
                            }
                        }
                        if (!canCapture) {
                            for (int x = 1; x <= 24; x++) {
                                if (board[x] == opponent) {
                                    moveList[count++] = {ply + 1, p, q, x};
                                }
                            }
                        }
                    }
                    else {
                        moveList[count++] = {ply + 1, p, q, 0};
                    }
                    board[q] = 1;
                    board[p] = player;
                }
            }
        }
    }
}

int alphaBeta(int* board, int depth, int alpha, int beta, int whiteMode, int blackMode, int symCutoff) {
    if (depth >= 0 && depth < 64) {
        depthCounts[depth]++;
    }
    nodesVisited++;
    unsigned long long zHash;
    if (board[0] < symCutoff) {
        zHash = getCanonicalHash(board).first;
    }
    else {
        zHash = getHash(board);
    }
    int ttIndex = zHash % TT_SIZE;
    TTEntry& tte = TTable[ttIndex];
    if (TTEnabled && tte.key == zHash && tte.depth >= depth) {
        if (tte.flag == 0) {
            return tte.value;
        }
        if (tte.flag == 1) {
            alpha = std::max(alpha, tte.value);
        }
        if (tte.flag == 2) {
            beta = std::min(beta, tte.value);
        }
        if (alpha >= beta) {
            return tte.value;
        }
    }
    // ... (Your Win/Loss/Draw logic remains the same) ...
    int white = 0, black = 0;
    for (int i = 1; i <= 24; i++) {
        if (board[i] == WHITE) {
            white++;
        }
        if (board[i] == BLACK) {
            black++;
        }
    }
    if (board[0] >= 18) {
        if (white < 3) {
            return MIN_SCORE - depth;
        }
        if (black < 3) {
            return MAX_SCORE + depth;
        }
    }
    if (depth == 0) {
        return staticEvaluation(board, board[0], whiteMode, blackMode);
    }
    // --- OPTIMIZATION START ---
    // Instead of std::vector<Move>, use a raw array on the stack
    Move moves[128]; // 128 is safe max for Mill
    int moveCount = 0;
    getMoves(board, moves, moveCount); // Pass array and ref to counter
    if (moveCount == 0) {
        return (board[0] % 2 == 0) ? (MIN_SCORE - depth) : (MAX_SCORE + depth);
    }
    // Sort using std::sort with raw pointers
    std::sort(moves, moves + moveCount, [](const Move& a, const Move& b) {
        return (a.x > 0) > (b.x > 0);
    });
    // --- OPTIMIZATION END ---
    int bestVal = (board[0] % 2 == 0) ? MIN_SCORE : MAX_SCORE;
    int originalAlpha = alpha;
    for (int i = 0; i < moveCount; i++) {
        const auto& m = moves[i];
        int nextBoard[25];
        std::memcpy(nextBoard, board, 25 * sizeof(int));
        applyMove(nextBoard, m);
        int val = alphaBeta(nextBoard, depth - 1, alpha, beta, whiteMode, blackMode, symCutoff);
        if (board[0] % 2 == 0) {
            if (val > bestVal) {
                bestVal = val;
            }
            alpha = std::max(alpha, bestVal);
        }
        else {
            if (val < bestVal) {
                bestVal = val;
            }
            beta = std::min(beta, bestVal);
        }
        if (UseAlphaBeta && alpha >= beta) {
            break;
        }
    }
    // ... (Your TT Store logic remains the same) ...
    if (TTEnabled) {
        tte.key = zHash;
        tte.value = bestVal;
        tte.depth = depth;
        if (bestVal <= originalAlpha) {
            tte.flag = 2;
        }
        else {
            if (bestVal >= beta) {
                tte.flag = 1;
            }
            else {
                tte.flag = 0;
            }
        }
    }
    return bestVal;
}

extern "C" {
    void initEngine() {
        initZobrist();
    }
    void setBrain(int gs, int n3, int n4, int m1, int m2, int fb, int pd, int ms, int dms, int nmf, int nmr, int nmg) {
        currentBrain.groupScore = gs;
        currentBrain.N3 = n3;
        currentBrain.N4 = n4;
        currentBrain.mobility1Score = m1;
        currentBrain.mobility2Score = m2;
        currentBrain.flyBonus = fb;
        currentBrain.pieceDiffMultiplier = pd;
        currentBrain.millScore = ms;
        currentBrain.doubleMillScore = dms;
        currentBrain.nearMillFilled = nmf;
        currentBrain.nearMillReady = nmr;
        currentBrain.nearMillGuaranteed = nmg;
    }
    void clearTT() {
        std::fill(TTable.begin(), TTable.end(), TTEntry {
            0, 0, 0, 0
        });
    }
    // NEW: Control Switches
    void setTTEnabled(int enabled) {
        TTEnabled = (enabled != 0);
    }
    void setPruningEnabled(int enabled) {
        UseAlphaBeta = (enabled != 0);
    }
    int getNodesVisited() {
        return nodesVisited;
    }
    // UPDATE the signature to accept 'int* depthsOut' at the end
    int search(int* board, int depth, int alpha, int beta, int whiteMode, int blackMode, int symCutoff, int* depthsOut) {
        nodesVisited = 0;
        // 1. Reset counts before starting
        std::memset(depthCounts, 0, sizeof(depthCounts));
        // 2. Run the search
        int val = alphaBeta(board, depth, alpha, beta, whiteMode, blackMode, symCutoff);
        // 3. Copy counts to the output buffer provided by JS
        if (depthsOut != nullptr) {
            std::memcpy(depthsOut, depthCounts, 64 * sizeof(int));
        }
        return val;
    }
}
