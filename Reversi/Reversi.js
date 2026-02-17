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

let S = 20;   // Scaling factor for 2D
let N = 4;    // Board size

// 0 = empty, 1 = Red, 2 = Green
let gameCube = []; 
let currentSlices = { X: 0, Y: 0, Z: 0 };
let validMoves = []; 

// --- 3D GLOBAL VARIABLES ---
let scene, camera, renderer, controls;
let stoneGroup; 
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

// --- 2. GAME LOGIC ---

function initGameData() {
    console.log("Initializing Game Data...");
    gameCube = new Array(N).fill(0).map(() => new Array(N).fill(0).map(() => new Array(N).fill(0)));
    
    const mid = (N / 2) - 1;
    currentSlices = { X: mid, Y: mid, Z: mid };

    const centerIndices = [mid, mid + 1];
    for (let x of centerIndices) {
        for (let y of centerIndices) {
            for (let z of centerIndices) {
                gameCube[x][y][z] = (x + y + z) % 2 === 0 ? 1 : 2;
            }
        }
    }
    updateGameState();
}

function resetGame() {
    console.log("--- RESETTING GAME ---");
    initGameData();
    initLayout();
}

function getCurrentPlayer() {
    let count = 0;
    for(let x=0; x<N; x++) 
        for(let y=0; y<N; y++) 
            for(let z=0; z<N; z++) 
                if(gameCube[x][y][z] !== 0) count++;
    return (count % 2 === 0) ? 1 : 2; 
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
    
    const statusBox = document.getElementById('status-box');
    if (statusBox) {
        const pName = player === 1 ? "Red" : "Green";
        statusBox.textContent = `Current Player: ${pName}`;
        statusBox.style.color = player === 1 ? redColor : greenColor;
    }
}

function executeMove(x, y, z) {
    const player = getCurrentPlayer();
    gameCube[x][y][z] = player;

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
                const radius = step * 0.35; 
                ctx.fillStyle = (val === 1) ? redColor : greenColor;
                ctx.beginPath();
                ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
                ctx.fill();
            } else if (validMoves.includes(`${x},${y},${z}`)) {
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
            console.log("Invalid move");
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

    renderer = new THREE.WebGLRenderer({ antialias: true });
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

    const gridGroup = new THREE.Group();
    const offset = (N - 1) / 2;
    gridGroup.position.set(-offset, -offset, -offset);

    const material = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3 });
    const points = [];

    for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
            points.push(new THREE.Vector3(0, i, j)); points.push(new THREE.Vector3(N-1, i, j));
            points.push(new THREE.Vector3(i, 0, j)); points.push(new THREE.Vector3(i, N-1, j));
            points.push(new THREE.Vector3(i, j, 0)); points.push(new THREE.Vector3(i, j, N-1));
        }
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const lineSegments = new THREE.LineSegments(geometry, material);
    gridGroup.add(lineSegments);
    scene.add(gridGroup);

    stoneGroup = new THREE.Group();
    stoneGroup.position.set(-offset, -offset, -offset); 
    scene.add(stoneGroup);

    animate();
    update3D();
}

function update3D() {
    if (!stoneGroup) return;
    
    while(stoneGroup.children.length > 0){ 
        stoneGroup.remove(stoneGroup.children[0]); 
    }

    // --- UPDATED GEOMETRIES ---
    const radius = 0.125; 
    const stoneGeo = new THREE.SphereGeometry(radius, 16, 16);
    // NEW: Hint geometry is half size
    const hintGeo = new THREE.SphereGeometry(radius / 2, 16, 16);
    
    const redMat = new THREE.MeshStandardMaterial({ 
        color: 0xff0000, roughness: 0.2, transparent: true, opacity: 0.6 
    });
    const greenMat = new THREE.MeshStandardMaterial({ 
        color: 0x00ff00, roughness: 0.2, transparent: true, opacity: 0.6
    });
    const hintMat = new THREE.MeshStandardMaterial({ 
        color: 0xffff00, transparent: true, opacity: 0.6, roughness: 0.2 
    });

    // 1. Draw Existing Stones (Full Size)
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

    // 2. Draw Hints (Half Size)
    validMoves.forEach(moveStr => {
        const [x, y, z] = moveStr.split(',').map(Number);
        const mesh = new THREE.Mesh(hintGeo, hintMat);
        mesh.position.set(x, y, z);
        mesh.userData = { isHint: true, x: x, y: y, z: z };
        stoneGroup.add(mesh);
    });
}

function on3DClick(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(stoneGroup.children);

    for (let i = 0; i < intersects.length; i++) {
        const obj = intersects[i].object;
        if (obj.userData.isHint) {
            console.log("Clicked 3D Hint:", obj.userData);
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

    // --- COLUMN 1: CONTROLS ---
    const col1 = el('div', { class: 'col-controls', style: 'min-width: 160px; max-width: 160px;' },
        el('h3', { text: 'Controls', style: 'margin-top:0' }),

        el('label', { text: 'Scale (S): ' }),
        el('input', { 
            type: 'number', min: '15', max: '40', value: S,
            style: 'width: 50px; margin-bottom: 10px;',
            onchange: (e) => {
                S = parseInt(e.target.value);
                initLayout(); 
            }
        }),
        el('br'),

        el('label', { text: 'Size (N): ' }),
        el('select', { 
            style: 'width: 50px;',
            onchange: (e) => {
                N = parseInt(e.target.value);
                resetGame(); 
            } 
        },
            el('option', { value: '4', text: '4', ...(N===4 ? {selected: 'true'} : {}) }),
            el('option', { value: '6', text: '6', ...(N===6 ? {selected: 'true'} : {}) }),
            el('option', { value: '8', text: '8', ...(N===8 ? {selected: 'true'} : {}) })
        ),

        createSpacer(S),
        el('button', { text: 'Reset Game', onclick: () => resetGame() }),
        createSpacer(S),
        el('div', { id: 'status-box', style: `border: 1px solid #333; padding: 5px; min-height: ${2*S}px; font-size: 0.9em; font-weight: bold;` },
            "Initializing..."
        )
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
