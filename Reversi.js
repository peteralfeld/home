import * as THREE from 'https://esm.sh/three@0.160.0';
import { OrbitControls } from 'https://esm.sh/three@0.160.0/examples/jsm/controls/OrbitControls';

// Three-dimensional Reversi by Peter Alfeld. 
// Players are Red (1) and Green (2). Red starts.

// --- CONFIGURATION & STATE ---
let redColor = "rgb(255,0,0)";
let greenColor = "rgb(0,255,0)";
let eligibleColor = "rgb(255,255,0)"; 
let gridColor = "rgb(255,255,255)";
let backgroundColor = "rgb(0,0,0)";

let S = 30;   // Scaling factor for 2D
let N = 4;    // Board size

// 0 = empty, 1 = Red, 2 = Green
let gameCube = []; 
let currentSlices = { X: 0, Y: 0, Z: 0 };
let validMoves = []; 

// History Management
let moveHistory = []; // Stores copies of gameCube
let currentMoveIndex = 0; // Where we are in the timeline (0 = start)

// Visualization Settings
let showHints = true;
let showAxes = true;
let gridMode = 1; // 0=None, 1=Ortho(XYZ), 2=All 26
let playerBallSize = 0.25; // Diameter relative to cell spacing (0.25 means radius 0.125)
let hintBallSize = 0.15;   // Diameter

// --- 3D GLOBAL VARIABLES ---
let scene, camera, renderer, controls;
let stoneGroup, gridGroup, axesHelper; 
let raycaster, mouse; 
let animationId = null;

// --- 1. HELPER FUNCTIONS ---
function el(tag, attrs = {}, ...children) {
    const element = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
        if (key === 'text') element.textContent = value;
        else if (key.startsWith('on') && typeof value === 'function') {
            element.addEventListener(key.substring(2).toLowerCase(), value);
        } else if (key === 'style') {
            element.style.cssText = value; 
        } else {
            element.setAttribute(key, value);
        }
    }
    children.forEach(child => {
        if (child) element.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    });
    return element;
}

function createSpacer(height) {
    return el('div', { style: `height: ${height}px; width: 100%;` });
}

function log(msg) {
    const box = document.getElementById('status-box');
    if (box) {
        const line = document.createElement('div');
        line.textContent = msg;
        box.appendChild(line);
        box.scrollTop = box.scrollHeight; // Auto-scroll
    }
    console.log(msg);
}

// --- 2. GAME LOGIC ---

function initGameData() {
    gameCube = new Array(N).fill(0).map(() => new Array(N).fill(0).map(() => new Array(N).fill(0)));
    
    const mid = (N / 2) - 1;
    currentSlices = { X: mid, Y: mid, Z: mid };

    // Starter Pattern
    const centerIndices = [mid, mid + 1];
    for (let x of centerIndices) {
        for (let y of centerIndices) {
            for (let z of centerIndices) {
                gameCube[x][y][z] = (x + y + z) % 2 === 0 ? 1 : 2;
            }
        }
    }

    // Initialize History
    moveHistory = [];
    saveHistoryState(); // Save initial state (Index 0)
    currentMoveIndex = 0;

    updateGameState();
}

function saveHistoryState() {
    // Deep copy the cube
    const cubeCopy = JSON.parse(JSON.stringify(gameCube));
    // If we are not at the end of history, truncate the future
    if (currentMoveIndex < moveHistory.length - 1) {
        moveHistory = moveHistory.slice(0, currentMoveIndex + 1);
    }
    moveHistory.push(cubeCopy);
    currentMoveIndex = moveHistory.length - 1;
    updateNavUI();
}

function loadHistoryState(index) {
    if (index < 0 || index >= moveHistory.length) return;
    
    currentMoveIndex = index;
    // Restore Cube
    gameCube = JSON.parse(JSON.stringify(moveHistory[index]));
    
    updateGameState();
    redrawAllSlices();
    update3D();
    updateNavUI();
    log(`Jumped to Move ${index}`);
}

function updateNavUI() {
    const txt = document.getElementById('nav-move-num');
    if (txt) txt.value = currentMoveIndex;
}

function resetGame() {
    const box = document.getElementById('status-box');
    if(box) box.innerHTML = "";
    log("--- RESETTING GAME ---");
    initGameData();
    // Reset view options to defaults? Optional. Keeping current prefs is usually better.
    update3D(); // Rebuild scene
}

function getCurrentPlayer() {
    let count = 0;
    for(let x=0; x<N; x++) 
        for(let y=0; y<N; y++) 
            for(let z=0; z<N; z++) 
                if(gameCube[x][y][z] !== 0) count++;
    return (count % 2 === 0) ? 1 : 2; 
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

function checkDirection(x, y, z, dx, dy, dz, player) {
    const opponent = player === 1 ? 2 : 1;
    let i = x + dx;
    let j = y + dy;
    let k = z + dz;
    let foundOpponent = false;

    while (i >= 0 && i < N && j >= 0 && j < N && k >= 0 && k < N) {
        const cell = gameCube[i][j][k];
        if (cell === opponent) {
            foundOpponent = true;
        } else if (cell === player) {
            return foundOpponent; 
        } else {
            return false;
        }
        i += dx; j += dy; k += dz;
    }
    return false; 
}

function updateGameState() {
    validMoves = [];
    const player = getCurrentPlayer();
    
    for(let x=0; x<N; x++) {
        for(let y=0; y<N; y++) {
            for(let z=0; z<N; z++) {
                if (gameCube[x][y][z] !== 0) continue; 

                let isValid = false;
                for (let dx = -1; dx <= 1; dx++) {
                    for (let dy = -1; dy <= 1; dy++) {
                        for (let dz = -1; dz <= 1; dz++) {
                            if (dx===0 && dy===0 && dz===0) continue;
                            if (checkDirection(x, y, z, dx, dy, dz, player)) {
                                isValid = true;
                                break; 
                            }
                        }
                        if (isValid) break;
                    }
                    if (isValid) break;
                }
                if (isValid) validMoves.push(`${x},${y},${z}`);
            }
        }
    }
    
    // Update Score Board
    const scores = getScores();
    const infoDiv = document.getElementById('game-info');
    if (infoDiv) {
        const pName = player === 1 ? "Red" : "Green";
        const color = player === 1 ? redColor : greenColor;
        infoDiv.innerHTML = `
            <div style="margin-bottom: 5px;">Turn: <span style="color:${color}; font-weight:bold">${pName}</span></div>
            <div style="font-size: 0.9em;">Red: ${scores.red} | Green: ${scores.green}</div>
        `;
    }
}

function executeMove(x, y, z) {
    // If we are looking at history, we can't play unless we are at the HEAD
    // But typical behavior is to branch new history. 
    // Since saveHistoryState truncates future, this works naturally.
    
    const player = getCurrentPlayer();
    gameCube[x][y][z] = player;
    
    log(`Move: ${player===1?"Red":"Green"} to (${x},${y},${z})`);

    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            for (let dz = -1; dz <= 1; dz++) {
                if (dx===0 && dy===0 && dz===0) continue;
                if (checkDirection(x, y, z, dx, dy, dz, player)) {
                    let i = x + dx, j = y + dy, k = z + dz;
                    while (gameCube[i][j][k] !== player) {
                        gameCube[i][j][k] = player;
                        i += dx; j += dy; k += dz;
                    }
                }
            }
        }
    }
    
    saveHistoryState(); // Commit to history
    updateGameState();
    redrawAllSlices();
    update3D(); 
}

// --- 3. 2D DRAWING ---

function drawSlice(canvas, axis, sliceIndex) {
    const ctx = canvas.getContext('2d');
    const size = canvas.width; 
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, size, size);

    const step = size / N; 
    const offset = step / 2;

    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    const lineStart = offset;
    const lineEnd = size - offset;

    for (let i = 0; i < N; i++) {
        const pos = offset + (i * step);
        ctx.moveTo(pos, lineStart); ctx.lineTo(pos, lineEnd);
        ctx.moveTo(lineStart, pos); ctx.lineTo(lineEnd, pos);
    }
    ctx.stroke();

    for (let i = 0; i < N; i++) { 
        for (let j = 0; j < N; j++) { 
            let x, y, z;
            if (axis === 'X') { x = sliceIndex; y = i; z = j; }       
            else if (axis === 'Y') { x = i; y = sliceIndex; z = j; }  
            else { x = i; y = j; z = sliceIndex; }                    

            const val = gameCube[x][y][z];
            const cx = offset + (i * step);
            const cy = offset + (j * step);

            if (val !== 0) {
                // In 2D we stick to full circles for clarity
                const radius = step * 0.35; 
                ctx.fillStyle = (val === 1) ? redColor : greenColor;
                ctx.beginPath();
                ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
                ctx.fill();
            } else if (showHints && validMoves.includes(`${x},${y},${z}`)) {
                const radius = step * 0.15; 
                ctx.fillStyle = eligibleColor;
                ctx.beginPath();
                ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
                ctx.fill();
            }
        }
    }
}

function handleCanvasClick(event, axis) {
    const rect = event.target.getBoundingClientRect();
    const size = event.target.width;
    const step = size / N; 
    const offset = step / 2;
    const i = Math.round((event.clientX - rect.left - offset) / step);
    const j = Math.round((event.clientY - rect.top - offset) / step);

    if (i >= 0 && i < N && j >= 0 && j < N) {
        let x, y, z, sliceIndex = currentSlices[axis];
        if (axis === 'X') { x = sliceIndex; y = i; z = j; }
        else if (axis === 'Y') { x = i; y = sliceIndex; z = j; }
        else { x = i; y = j; z = sliceIndex; }

        const moveKey = `${x},${y},${z}`;
        if (validMoves.includes(moveKey)) {
            executeMove(x, y, z);
        } else {
            log("Invalid move");
        }
    }
}

function redrawAllSlices() {
    ['X', 'Y', 'Z'].forEach(axis => {
        const canvas = document.getElementById(`canvas-${axis}`);
        if (canvas) drawSlice(canvas, axis, currentSlices[axis]);
    });
}

// --- 4. 3D LOGIC (Three.js) ---

function init3D() {
    const container = document.getElementById('view3d-container');
    const size = 23 * S;

    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }
    
    if (renderer) {
        renderer.dispose();
    }

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000); 

    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    camera.position.set(N*1.5, N*1.5, N*2.5);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(size, size);
    container.appendChild(renderer.domElement);
    
    renderer.domElement.addEventListener('click', on3DClick);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; 

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(10, 20, 10);
    scene.add(dirLight);

    // Setup Groups
    gridGroup = new THREE.Group();
    // Center the grid
    const offset = (N - 1) / 2;
    gridGroup.position.set(-offset, -offset, -offset);
    scene.add(gridGroup);

    stoneGroup = new THREE.Group();
    stoneGroup.position.set(-offset, -offset, -offset); 
    scene.add(stoneGroup);
    
    // Axes Helper
    axesHelper = new THREE.AxesHelper(N);
    // Position axes at corner of grid
    axesHelper.position.set(-offset - 1, -offset - 1, -offset - 1);
    scene.add(axesHelper);

    update3DGrid();
    animate();
    update3D();
}

function update3DGrid() {
    // Clear old grid
    while(gridGroup.children.length > 0) gridGroup.remove(gridGroup.children[0]);

    if (gridMode === 0) return; // No Grid

    const material = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3 });
    const points = [];

    // Orthogonal Grid (Mode 1 & 2)
    for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
            // X-lines
            points.push(new THREE.Vector3(0, i, j), new THREE.Vector3(N-1, i, j));
            // Y-lines
            points.push(new THREE.Vector3(i, 0, j), new THREE.Vector3(i, N-1, j));
            // Z-lines
            points.push(new THREE.Vector3(i, j, 0), new THREE.Vector3(i, j, N-1));
        }
    }

    // All 26 Directions (Mode 2 only)
    if (gridMode === 2) {
        // We connect every point to its neighbors. 
        // To avoid duplicate lines, we only draw forward-facing vectors.
        for (let x = 0; x < N; x++) {
            for (let y = 0; y < N; y++) {
                for (let z = 0; z < N; z++) {
                    const origin = new THREE.Vector3(x,y,z);
                    // Check neighbors in positive directions to avoid dupes
                    // Vectors: (1,0,0), (0,1,0), (0,0,1) are already done above.
                    // We need diagonals.
                    const diags = [
                        [1,1,0], [1,-1,0], 
                        [1,0,1], [1,0,-1], 
                        [0,1,1], [0,1,-1], 
                        [1,1,1], [1,1,-1], [1,-1,1], [1,-1,-1] 
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
    
    // 1. Update Axes Visibility
    if (axesHelper) axesHelper.visible = showAxes;

    // 2. Rebuild Grid if mode changed (checked roughly via simple flag or just rebuild)
    update3DGrid(); 

    // 3. Rebuild Stones
    while(stoneGroup.children.length > 0) stoneGroup.remove(stoneGroup.children[0]);

    // Calculate radii based on sliders (slider value 0.1 to 1.0 represents Diameter)
    // So Radius = Diameter / 2
    const pRadius = playerBallSize / 2;
    const hRadius = hintBallSize / 2;

    const stoneGeo = new THREE.SphereGeometry(pRadius, 32, 32);
    const hintGeo = new THREE.SphereGeometry(hRadius, 16, 16);
    
    // Glassy Materials
    const glassParams = { 
        roughness: 0.1, 
        metalness: 0.1, 
        transparent: true, 
        opacity: 0.8 // Slightly more opaque than hints
    };
    
    const redMat = new THREE.MeshStandardMaterial({ color: 0xff0000, ...glassParams });
    const greenMat = new THREE.MeshStandardMaterial({ color: 0x00ff00, ...glassParams });
    const hintMat = new THREE.MeshStandardMaterial({ 
        color: 0xffff00, 
        transparent: true, 
        opacity: 0.5,
        roughness: 0.2 
    });

    // Draw Stones
    for(let x=0; x<N; x++) {
        for(let y=0; y<N; y++) {
            for(let z=0; z<N; z++) {
                const val = gameCube[x][y][z];
                if (val !== 0) {
                    const mesh = new THREE.Mesh(stoneGeo, val === 1 ? redMat : greenMat);
                    mesh.position.set(x, y, z);
                    mesh.userData = { isHint: false };
                    stoneGroup.add(mesh);
                }
            }
        }
    }

    // Draw Hints
    if (showHints) {
        validMoves.forEach(moveStr => {
            const [x, y, z] = moveStr.split(',').map(Number);
            const mesh = new THREE.Mesh(hintGeo, hintMat);
            mesh.position.set(x, y, z);
            mesh.userData = { isHint: true, x: x, y: y, z: z };
            stoneGroup.add(mesh);
        });
    }
}

function on3DClick(event) {
    if (!showHints) return; // Can't click what you can't see

    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(stoneGroup.children);

    for (let i = 0; i < intersects.length; i++) {
        const obj = intersects[i].object;
        if (obj.userData.isHint) {
//            log(`Clicked 3D Hint at (${obj.userData.x}, ${obj.userData.y}, ${obj.userData.z})`);
            executeMove(obj.userData.x, obj.userData.y, obj.userData.z);
            return; 
        }
    }
}

function animate() {
    animationId = requestAnimationFrame(animate); 
    controls.update();
    renderer.render(scene, camera);
}

// --- 5. UI LAYOUT ---

function initLayout() {
    if (gameCube.length !== N) initGameData();

    const root = document.getElementById('gameTable');
    if (!root) return;
    root.innerHTML = '';

    root.style.display = 'flex';
    root.style.flexDirection = 'row';
    root.style.gap = `${S}px`; 
    root.style.padding = `${S}px`;
    root.style.fontFamily = 'sans-serif';

    // --- COLUMN 1: CONTROLS (Mill Style) ---
    const col1 = el('div', { class: 'col-controls', style: 'min-width: 220px; max-width: 220px; display: flex; flex-direction: column; gap: 8px;' },
        
        // 1. Status / Info Box
        el('div', { 
            id: 'game-info',
            style: `background-color: rgb(200,255,255); color: navy; padding: 10px; border-radius: 4px; text-align: center; border: 1px solid navy;`
        }, "Initializing..."),

        // 2. Status Log (Scrolling)
        el('div', { 
            id: 'status-box',
            style: `background-color: rgb(200,255,255); color: navy; height: 100px; overflow-y: auto; padding: 5px; font-size: 0.8em; border: 1px solid navy; font-family: monospace;`
        }),

        // 3. Main Game Controls
        el('button', { 
            text: 'Reset Game', 
            style: 'background-color: red; color: yellow; font-size: 16px; font-weight: bold; padding: 5px;',
            onclick: () => resetGame() 
        }),

        // 4. History Navigation
        el('div', { style: 'display: flex; gap: 5px; align-items: center;' },
            el('button', { text: '<', style: 'flex:1; font-weight:bold;', onclick: () => loadHistoryState(currentMoveIndex - 1) }),
            el('input', { 
                id: 'nav-move-num', type: 'text', value: '0', 
                style: 'width: 40px; text-align: center;', readonly: true 
            }),
            el('button', { text: '>', style: 'flex:1; font-weight:bold;', onclick: () => loadHistoryState(currentMoveIndex + 1) })
        ),

//        createSpacer(0),
//        el('hr', { style: 'width:100%; border:0; border-top:1px solid #ccc;' }),
		    // 5. Configuration (S and N)
        el('div', { style: 'display: flex; justify-content: space-between; align-items: center;' },
            el('label', { text: 'Scale:' }),
            el('input', { 
                type: 'number', min: '15', max: '40', value: S, style: 'width: 40px;',
                onchange: (e) => { S = parseInt(e.target.value); initLayout(); }
            }),
            el('label', { text: 'Size:' }),
            el('select', { 
                style: 'width: 40px;',
                onchange: (e) => { N = parseInt(e.target.value); resetGame(); } 
            },
                el('option', { value: '4', text: '4', ...(N===4 ? {selected: 'true'} : {}) }),
                el('option', { value: '6', text: '6', ...(N===6 ? {selected: 'true'} : {}) }),
                el('option', { value: '8', text: '8', ...(N===8 ? {selected: 'true'} : {}) })
            )
        ),
//        el('hr', { style: 'width:100%; border:0; border-top:1px solid #ccc;' }),
//		    el('div', { text: 'Visualization', style: 'font-weight: bold; text-align: center;' }),

        // 6. Toggles (Colored Buttons)
        el('div', { style: 'display: flex; gap: 5px;' },
            el('button', { 
                text: 'Hints', 
                id: 'btn-hints',
                style: `flex:1; background-color: ${showHints?'green':'grey'}; color: white; border: none; padding: 5px; cursor: pointer;`,
                onclick: (e) => { 
                    showHints = !showHints; 
                    e.target.style.backgroundColor = showHints?'green':'grey';
                    redrawAllSlices(); 
                    update3D(); 
                } 
            }),
            el('button', { 
                text: 'Axes', 
                id: 'btn-axes',
                style: `flex:1; background-color: ${showAxes?'green':'grey'}; color: white; border: none; padding: 5px; cursor: pointer;`,
                onclick: (e) => { 
                    showAxes = !showAxes; 
                    e.target.style.backgroundColor = showAxes?'green':'grey';
                    update3D(); 
                } 
            })
        ),

        // 7. Grid Menu
        el('div', { style: 'display: flex; align-items: center; gap: 5px;' },
            el('label', { text: 'Grid:' }),
            el('select', { 
                style: 'flex: 1;',
                onchange: (e) => { gridMode = parseInt(e.target.value); update3D(); }
            },
                el('option', { value: '0', text: 'None' }),
                el('option', { value: '1', text: 'Orthogonal', selected: 'true' }),
                el('option', { value: '2', text: 'All 26' })
            )
        ),

        // 8. Sliders
        el('div', { style: 'font-size: 0.9em; margin-top: 5px;' }, "PBS"),
        el('input', { 
            type: 'range', min: '0.1', max: '0.9', step: '0.05', value: playerBallSize,
            style: 'width: 100%;',
            oninput: (e) => { playerBallSize = parseFloat(e.target.value); update3D(); }
        }),

        el('div', { style: 'font-size: 0.9em;' }, "Hint Ball Size"),
        el('input', { 
            type: 'range', min: '0.05', max: '0.5', step: '0.05', value: hintBallSize,
            style: 'width: 100%;',
            oninput: (e) => { hintBallSize = parseFloat(e.target.value); update3D(); }
        })
    );

    // --- COLUMN 2: SLICES ---
    const col2 = el('div', { class: 'col-slices' });
    const sliceWidth = 5 * S; 

    ['X', 'Y', 'Z'].forEach(axis => {
        const cvs = el('canvas', { 
            id: `canvas-${axis}`, 
            width: sliceWidth, 
            height: sliceWidth, 
            style: `border: 1px solid #333; background: ${backgroundColor}; display: block; cursor: pointer;`,
            onclick: (e) => handleCanvasClick(e, axis)
        });

        const radioContainer = el('div', { 
            style: `display: flex; justify-content: space-between; width: ${sliceWidth}px; margin-top: 3px;` 
        });
        
        for (let i = 0; i < N; i++) {
            const radio = el('input', { 
                type: 'radio', 
                name: `slice-${axis}`, 
                value: i,
                title: `Index ${i}`,
                style: 'cursor: pointer; margin: 0; padding: 0; transform: scale(0.7);',
                onchange: (e) => {
                    currentSlices[axis] = parseInt(e.target.value);
                    drawSlice(cvs, axis, currentSlices[axis]);
                }
            });
            if (i === currentSlices[axis]) radio.checked = true;
            radioContainer.appendChild(radio);
        }

        col2.appendChild(el('div', { style: `margin-bottom: ${S}px` },
            el('div', { text: `${axis}-Axis`, style: 'text-align: center; font-size: 0.8em; margin-bottom: 2px;' }),
            cvs,
            radioContainer
        ));
    });

    // --- COLUMN 3: 3D VIEW ---
    const col3 = el('div', { class: 'col-3d' },
        el('div', { text: '3D View', style: 'text-align: center; margin-bottom: 5px;' }),
        el('div', { id: 'view3d-container' })
    );

    root.appendChild(col1);
    root.appendChild(col2);
    root.appendChild(col3);

    updateGameState();
    redrawAllSlices();
    init3D();
}

// --- 6. START THE GAME ---
initGameData();
initLayout();
