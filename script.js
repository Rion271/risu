let scene, camera, renderer;
let rubikGroup;
let cubes = [];
let isAnimating = false;
const moveHistory = [];
let historyIndex = 0;

// Kontrol Kamera & Interaksi Mouse
let isRightMouseDown = false;
let mouseX = 0, mouseY = 0;
let leftDragStart = null;
let cameraAngleX = 0.5, cameraAngleY = 0.8;
let cameraRadius = 7;

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Standar Warna (Atas: Kuning, Bawah: Putih, Depan: Merah, Belakang: Oranye, Kanan: Hijau, Kiri: Biru)
const COLORS = {
    U: 0xffd700, // Kuning (Atas)
    D: 0xffffff, // Putih (Bawah)
    F: 0xdc2626, // Merah (Depan)
    B: 0xf97316, // Oranye (Belakang)
    R: 0x16a34a, // Hijau (Kanan)
    L: 0x2563eb, // Biru (Kiri)
    C: 0x111111  // Warna bagian dalam
};

init();
animate();

function init() {
    const container = document.getElementById('canvas-container');

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf1f3f5);

    camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
    updateCameraPosition();

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 15);
    scene.add(directionalLight);

    createRubikCube();
    updateHistoryButtons();

    container.addEventListener('contextmenu', onContextMenu);
    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    window.addEventListener('resize', onWindowResize);
}

function createRubikCube() {
    rubikGroup = new THREE.Group();
    scene.add(rubikGroup);

    const size = 0.95;
    const geometry = new THREE.BoxGeometry(size, size, size);

    for (let x = -1; x <= 1; x++) {
        for (let y = -1; y <= 1; y++) {
            for (let z = -1; z <= 1; z++) {
                const materials = [
                    new THREE.MeshStandardMaterial({ color: x === 1 ? COLORS.R : COLORS.C }), // Kanan
                    new THREE.MeshStandardMaterial({ color: x === -1 ? COLORS.L : COLORS.C }), // Kiri
                    new THREE.MeshStandardMaterial({ color: y === 1 ? COLORS.U : COLORS.C }), // Atas (Kuning)
                    new THREE.MeshStandardMaterial({ color: y === -1 ? COLORS.D : COLORS.C }), // Bawah (Putih)
                    new THREE.MeshStandardMaterial({ color: z === 1 ? COLORS.F : COLORS.C }), // Depan
                    new THREE.MeshStandardMaterial({ color: z === -1 ? COLORS.B : COLORS.C })  // Belakang
                ];

                const cube = new THREE.Mesh(geometry, materials);
                cube.position.set(x, y, z);
                rubikGroup.add(cube);
                cubes.push(cube);
            }
        }
    }
}

// Klik kiri + geser pada stiker untuk memutar layer; klik kanan + geser mengatur kamera.
function onMouseDown(e) {
    if (e.button === 2) {
        isRightMouseDown = true;
        mouseX = e.clientX;
        mouseY = e.clientY;
    } else if (e.button === 0 && !isAnimating) {
        const hit = getCubeHit(e);
        leftDragStart = hit ? {
            cube: hit.object,
            normal: hit.face.normal.clone().transformDirection(hit.object.matrixWorld),
            x: e.clientX,
            y: e.clientY
        } : null;
    }
}

function onMouseMove(e) {
    if (!isRightMouseDown) return;

    const deltaX = e.clientX - mouseX;
    const deltaY = e.clientY - mouseY;
    cameraAngleY -= deltaX * 0.008;
    cameraAngleX -= deltaY * 0.008;
    cameraAngleX = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, cameraAngleX));

    mouseX = e.clientX;
    mouseY = e.clientY;
    updateCameraPosition();
}

function onMouseUp(e) {
    if (e.button === 2) isRightMouseDown = false;
    if (e.button === 0 && leftDragStart) {
        const drag = leftDragStart;
        leftDragStart = null;
        const dx = e.clientX - drag.x;
        const dy = e.clientY - drag.y;
        if (Math.hypot(dx, dy) >= 8) rotateFromDrag(drag, dx, dy);
    }
}

function onContextMenu(e) {
    e.preventDefault();
}

function getCubeHit(e) {
    const container = document.getElementById('canvas-container');
    const rect = container.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    return raycaster.intersectObjects(cubes)[0] || null;
}

function rotateFromDrag(drag, dx, dy) {
    if (isAnimating) return;

    const cameraRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    const cameraUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
    const swipe = cameraRight.multiplyScalar(dx).add(cameraUp.multiplyScalar(-dy));
    const normal = drag.normal;
    swipe.addScaledVector(normal, -swipe.dot(normal));
    if (swipe.lengthSq() < 0.001) return;
    swipe.normalize();

    // Rotasi positif mengikuti arah geser pada bidang stiker.
    const rotationAxis = new THREE.Vector3().crossVectors(normal, swipe);
    const axisNames = ['x', 'y', 'z'];
    let axisIndex = 0;
    if (Math.abs(rotationAxis.y) > Math.abs(rotationAxis.x)) axisIndex = 1;
    if (Math.abs(rotationAxis.z) > Math.abs(rotationAxis.getComponent(axisIndex))) axisIndex = 2;

    const axis = axisNames[axisIndex];
    const direction = Math.sign(rotationAxis.getComponent(axisIndex));
    if (!direction) return;
    const layer = Math.round(drag.cube.position[axis]);
    animateRotation(axis, layer, direction);
}

function updateCameraPosition() {
    camera.position.x = cameraRadius * Math.sin(cameraAngleY) * Math.cos(cameraAngleX);
    camera.position.y = cameraRadius * Math.sin(cameraAngleX);
    camera.position.z = cameraRadius * Math.cos(cameraAngleY) * Math.cos(cameraAngleX);
    camera.lookAt(0, 0, 0);
}

function resetCamera() {
    cameraAngleX = 0.5;
    cameraAngleY = 0.8;
    updateCameraPosition();
}

// --- SOLUSI BUG WARNA HITAM: ATTACH/DETACH KE GROUP SEMENTARA ---
function rotateMove(moveType) {
    if (isAnimating) return;
    
    let axis, layer, direction;
    switch (moveType) {
        case 'R': axis = 'x'; layer = 1; direction = -1; break;
        case 'RPrime': axis = 'x'; layer = 1; direction = 1; break;
        case 'L': axis = 'x'; layer = -1; direction = 1; break;
        case 'LPrime': axis = 'x'; layer = -1; direction = -1; break;
        case 'U': axis = 'y'; layer = 1; direction = -1; break;
        case 'UPrime': axis = 'y'; layer = 1; direction = 1; break;
        case 'D': axis = 'y'; layer = -1; direction = 1; break;
        case 'DPrime': axis = 'y'; layer = -1; direction = -1; break;
        case 'F': axis = 'z'; layer = 1; direction = -1; break;
        case 'FPrime': axis = 'z'; layer = 1; direction = 1; break;
        case 'B': axis = 'z'; layer = -1; direction = 1; break;
        case 'BPrime': axis = 'z'; layer = -1; direction = -1; break;
    }

    if (axis) animateRotation(axis, layer, direction);
}

function undoMove() {
    if (isAnimating || historyIndex === 0) return;
    const move = moveHistory[historyIndex - 1];
    historyIndex--;
    updateHistoryButtons();
    animateRotation(move.axis, move.layer, -move.direction, false);
}

function redoMove() {
    if (isAnimating || historyIndex >= moveHistory.length) return;
    const move = moveHistory[historyIndex];
    historyIndex++;
    updateHistoryButtons();
    animateRotation(move.axis, move.layer, move.direction, false);
}

function updateHistoryButtons() {
    const buttons = document.querySelectorAll('.history-controls button');
    buttons[0].disabled = isAnimating || historyIndex === 0;
    buttons[1].disabled = isAnimating || historyIndex >= moveHistory.length;
}

function animateRotation(axis, layer, direction, recordHistory = true) {
    isAnimating = true;
    updateHistoryButtons();
    const targetRotation = (Math.PI / 2) * direction;
    let currentRotation = 0;
    const speed = 0.15;

    // Filter kubus yang berada di layer tersebut
    const affectedCubes = cubes.filter(cube => {
        const pos = Math.round(cube.position[axis]);
        return pos === layer;
    });

    // Masukkan ke pivot group sementara agar rotasi matriks bersih (mencegah bug warna hitam)
    const pivotGroup = new THREE.Group();
    scene.add(pivotGroup);
    affectedCubes.forEach(cube => pivotGroup.attach(cube));

    function step() {
        currentRotation += speed * direction;

        if ((direction > 0 && currentRotation >= targetRotation) || 
            (direction < 0 && currentRotation <= targetRotation)) {
            
            const remainder = targetRotation - (currentRotation - speed * direction);
            pivotGroup.rotation[axis] += remainder;

            // Kembalikan kubus dari pivot group utama ke rubikGroup
            affectedCubes.forEach(cube => {
                rubikGroup.attach(cube);
                cube.position.round();
            });

            scene.remove(pivotGroup);
            isAnimating = false;
            if (recordHistory) {
                moveHistory.splice(historyIndex);
                moveHistory.push({ axis, layer, direction });
                historyIndex = moveHistory.length;
            }
            updateHistoryButtons();
            return;
        }

        pivotGroup.rotation[axis] += speed * direction;
        requestAnimationFrame(step);
    }

    requestAnimationFrame(step);
}

const possibleMoves = ['R', 'RPrime', 'L', 'LPrime', 'U', 'UPrime', 'D', 'DPrime', 'F', 'FPrime', 'B', 'BPrime'];
function scrambleCube() {
    if (isAnimating) return;
    let count = 0;
    const interval = setInterval(() => {
        const randomMove = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
        rotateMove(randomMove);
        count++;
        if (count >= 12) clearInterval(interval);
    }, 200);
}

function resetCube() {
    if (isAnimating) return;
    scene.remove(rubikGroup);
    cubes = [];
    moveHistory.length = 0;
    historyIndex = 0;
    createRubikCube();
    updateHistoryButtons();
}

function onWindowResize() {
    const container = document.getElementById('canvas-container');
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
}

function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}