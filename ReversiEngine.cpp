#include <algorithm>
#include <cmath>
#include <cstring>
#include <emscripten.h>

using namespace std;

int N = 4;
int N2 = 16;
int N3 = 64;
int weights[10];
bool usePruning = true;

// Performance metrics
long long nodesVisited = 0;
long long depthVisits[20] = {0};

// Pre-computed static data
int categoryMap[512] = {0};

// RAY CASTING LOOKUP TABLES
int ray_len[512][26]; 
int ray_path[512][26][8]; 

// Static board buffer that JS can write to
uint8_t global_board[512];

inline int idx(int x, int y, int z) {
    return x * N2 + y * N + z;
}

// Memory-efficient Move structs
struct ScoredMove {
    int m;
    int score;
};

// ZERO-STACK POOL
#define MAX_DEPTH 64
int global_moves[MAX_DEPTH][512];
ScoredMove global_scored_moves[MAX_DEPTH][512];
uint8_t global_temp_boards[MAX_DEPTH][512];

int eval_moves_p[512];
int eval_moves_o[512];

// --- Pre-computation ---
void initRays() {
    int dirs[26][3];
    int idx_dir = 0;
    for(int dx=-1; dx<=1; dx++) {
        for(int dy=-1; dy<=1; dy++) {
            for(int dz=-1; dz<=1; dz++) {
                if(dx==0 && dy==0 && dz==0) continue;
                dirs[idx_dir][0] = dx;
                dirs[idx_dir][1] = dy;
                dirs[idx_dir][2] = dz;
                idx_dir++;
            }
        }
    }

    for(int x=0; x<N; x++) {
        for(int y=0; y<N; y++) {
            for(int z=0; z<N; z++) {
                int c = idx(x, y, z);
                for(int d=0; d<26; d++) {
                    int len = 0;
                    int cx = x + dirs[d][0];
                    int cy = y + dirs[d][1];
                    int cz = z + dirs[d][2];
                    
                    while(cx >= 0 && cx < N && cy >= 0 && cy < N && cz >= 0 && cz < N) {
                        ray_path[c][d][len] = idx(cx, cy, cz);
                        len++;
                        cx += dirs[d][0];
                        cy += dirs[d][1];
                        cz += dirs[d][2];
                    }
                    ray_len[c][d] = len;
                }
            }
        }
    }
}

void initGeometry() {
    auto isEnd = [](int v) { return v == 0 || v == N - 1; };
    auto distToCorner = [](int x, int y, int z) {
        int minD = 999;
        int corners[2] = {0, N - 1};
        for(int cx : corners) for(int cy : corners) for(int cz : corners) {
            int d = max({abs(x - cx), abs(y - cy), abs(z - cz)});
            if(d < minD) minD = d;
        }
        return minD;
    };
    auto isEdge = [&](int x, int y, int z) {
        int ends = 0;
        if(isEnd(x)) ends++; if(isEnd(y)) ends++; if(isEnd(z)) ends++;
        return ends == 2;
    };
    auto distToEdge = [&](int x, int y, int z) {
        int minD = 999;
        for(int i=0; i<N; i++) for(int j=0; j<N; j++) for(int k=0; k<N; k++) {
            if(isEdge(i,j,k)) {
                int d = max({abs(x - i), abs(y - j), abs(z - k)});
                if(d < minD) minD = d;
            }
        }
        return minD;
    };
    auto distToFace = [](int x, int y, int z) {
        return min({min(x, N - 1 - x), min(y, N - 1 - y), min(z, N - 1 - z)});
    };

    for(int x=0; x<N; x++) {
        for(int y=0; y<N; y++) {
            for(int z=0; z<N; z++) {
                int cat = 0; int ends = 0;
                if(isEnd(x)) ends++; if(isEnd(y)) ends++; if(isEnd(z)) ends++;
                int dCorner = distToCorner(x, y, z);
                int dEdge = distToEdge(x, y, z);
                int dFace = distToFace(x, y, z);

                if(ends == 3) cat = 3;
                else if(ends == 2 && dCorner == 1) cat = 4;
                else if(dCorner == 1) cat = 5;
                else if(ends == 2) cat = 6;
                else if(dEdge == 1) cat = 7;
                else if(ends == 1) cat = 8;
                else if(dFace == 1) cat = 9;
                categoryMap[idx(x, y, z)] = cat;
            }
        }
    }
}

// --- High Speed Core Logic ---

int getValidMoves(const uint8_t* board, int player, int* out_moves) {
    int count = 0;
    int opponent = (player == 1) ? 2 : 1;
    
    for(int c = 0; c < N3; ++c) {
        if (board[c] != 0) continue; 
        bool valid = false;
        
        for(int d = 0; d < 26; d++) {
            int len = ray_len[c][d];
            if (len < 2) continue; 
            
            if (board[ray_path[c][d][0]] != opponent) continue;
            
            for(int i = 1; i < len; i++) {
                uint8_t p = board[ray_path[c][d][i]];
                if (p == player) { valid = true; break; }
                if (p == 0) break; 
            }
            if (valid) break;
        }
        if (valid) out_moves[count++] = c;
    }
    return count;
}

void simulateMove(const uint8_t* board_in, uint8_t* board_out, int m, int player) {
    memcpy(board_out, board_in, N3);
    board_out[m] = player;
    int opponent = (player == 1) ? 2 : 1;
    
    for(int d = 0; d < 26; d++) {
        int len = ray_len[m][d];
        if (len < 2) continue;
        if (board_out[ray_path[m][d][0]] != opponent) continue;
        
        bool flip = false;
        for(int i = 1; i < len; i++) {
            uint8_t p = board_out[ray_path[m][d][i]];
            if (p == player) { flip = true; break; }
            if (p == 0) break;
        }
        
        if (flip) {
            for(int i = 0; i < len; i++) {
                int step_idx = ray_path[m][d][i];
                if (board_out[step_idx] == player) break;
                board_out[step_idx] = player;
            }
        }
    }
}

// FULL EVALUATION: Includes heavy mobility logic (Used only at Depth 0)
int staticEvaluation(const uint8_t* board, int player) {
    int opponent = (player == 1) ? 2 : 1;
    int score = 0;
    int pStones = 0, oStones = 0;
    int pCat[10] = {0}, oCat[10] = {0};

    for(int i=0; i<N3; ++i) {
        uint8_t val = board[i];
        if (val == 0) continue;
        int cat = categoryMap[i];
        if (val == player) { pStones++; pCat[cat]++; }
        else { oStones++; oCat[cat]++; }
    }

    score += (pStones - oStones) * weights[2];
    for(int i=3; i<=9; i++) score += (pCat[i] - oCat[i]) * weights[i];

    if (weights[0] != 0) {
        int pMoves = getValidMoves(board, player, eval_moves_p);
        int oMoves = getValidMoves(board, opponent, eval_moves_o);
        score += (pMoves - oMoves) * weights[0];
    }
    return score;
}

// FAST EVALUATION: Skips mobility entirely (Used for move ordering)
int fastEvaluation(const uint8_t* board, int player) {
    int score = 0;
    int pStones = 0, oStones = 0;
    int pCat[10] = {0}, oCat[10] = {0};

    for(int i=0; i<N3; ++i) {
        uint8_t val = board[i];
        if (val == 0) continue;
        int cat = categoryMap[i];
        if (val == player) { pStones++; pCat[cat]++; }
        else { oStones++; oCat[cat]++; }
    }

    score += (pStones - oStones) * weights[2];
    for(int i=3; i<=9; i++) score += (pCat[i] - oCat[i]) * weights[i];
    return score;
}

int alphaBeta(const uint8_t* board, int depth, int alpha, int beta, int maxPlayer, int currentPlayer, bool passed) {
    nodesVisited++;
    if (depth >= 0 && depth < 20) depthVisits[depth]++;

    // At the absolute end, run the heavy mobility evaluation
    if (depth <= 0) return staticEvaluation(board, maxPlayer);

    int safeDepth = depth;
    if (safeDepth >= MAX_DEPTH) safeDepth = MAX_DEPTH - 1;

    int* moves = global_moves[safeDepth];
    int moveCount = getValidMoves(board, currentPlayer, moves);
    int opponentId = (currentPlayer == 1) ? 2 : 1;

    if (moveCount == 0) {
        if (passed) return staticEvaluation(board, maxPlayer);
        return alphaBeta(board, depth - 1, alpha, beta, maxPlayer, opponentId, true);
    }

    ScoredMove* scoredMoves = global_scored_moves[safeDepth];
    uint8_t* tempBoard = global_temp_boards[safeDepth];
    
    // Move Ordering Phase: Use fastEvaluation to bypass mobility check
    for (int i = 0; i < moveCount; ++i) {
        simulateMove(board, tempBoard, moves[i], currentPlayer);
        scoredMoves[i] = { moves[i], fastEvaluation(tempBoard, maxPlayer) };
    }

    if (currentPlayer == maxPlayer) {
        int maxEval = -1000000000;
        sort(scoredMoves, scoredMoves + moveCount, [](const ScoredMove& a, const ScoredMove& b) {
            return a.score > b.score;
        });

        for (int i = 0; i < moveCount; ++i) {
            int nextAlpha = usePruning ? alpha : -1000000000;
            int nextBeta = usePruning ? beta : 1000000000;
            
            simulateMove(board, tempBoard, scoredMoves[i].m, currentPlayer);
            int ev = alphaBeta(tempBoard, depth - 1, nextAlpha, nextBeta, maxPlayer, opponentId, false);
            
            if (ev > maxEval) maxEval = ev;
            if (usePruning) {
                if (ev > alpha) alpha = ev;
                if (beta <= alpha) break;
            }
        }
        return maxEval;
    } else {
        int minEval = 1000000000;
        sort(scoredMoves, scoredMoves + moveCount, [](const ScoredMove& a, const ScoredMove& b) {
            return a.score < b.score;
        });

        for (int i = 0; i < moveCount; ++i) {
            int nextAlpha = usePruning ? alpha : -1000000000;
            int nextBeta = usePruning ? beta : 1000000000;
            
            simulateMove(board, tempBoard, scoredMoves[i].m, currentPlayer);
            int ev = alphaBeta(tempBoard, depth - 1, nextAlpha, nextBeta, maxPlayer, opponentId, false);
            
            if (ev < minEval) minEval = ev;
            if (usePruning) {
                if (ev < beta) beta = ev;
                if (beta <= alpha) break;
            }
        }
        return minEval;
    }
}

// --- WASM EXPORTS ---
extern "C" {
    EMSCRIPTEN_KEEPALIVE uint8_t* get_board_ptr() { return global_board; }

    EMSCRIPTEN_KEEPALIVE void init_engine(int n_val, int w0, int w1, int w2, int w3, int w4, int w5, int w6, int w7, int w8, int w9, bool pruning) {
        N = n_val; N2 = N * N; N3 = N * N * N;
        weights[0] = w0; weights[1] = w1; weights[2] = w2; weights[3] = w3;
        weights[4] = w4; weights[5] = w5; weights[6] = w6; weights[7] = w7;
        weights[8] = w8; weights[9] = w9;
        usePruning = pruning;
        initGeometry();
        initRays(); 
    }

    EMSCRIPTEN_KEEPALIVE void reset_stats() {
        nodesVisited = 0;
        memset(depthVisits, 0, sizeof(depthVisits));
    }

    EMSCRIPTEN_KEEPALIVE double get_nodes_visited() { return (double)nodesVisited; }
    EMSCRIPTEN_KEEPALIVE double get_depth_visits(int d) { if(d>=0 && d<20) return (double)depthVisits[d]; return 0; }

    EMSCRIPTEN_KEEPALIVE int run_alpha_beta(int depth, int alpha, int beta, int max_player, int current_player, bool passed) {
        return alphaBeta(global_board, depth, alpha, beta, max_player, current_player, passed);
    }
}
