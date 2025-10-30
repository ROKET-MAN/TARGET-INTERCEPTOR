        // UI
        const runtimeDisplay = document.getElementById('runtime-display'), fpsDisplay = document.getElementById('fps-display');
        const targetXDisplay = document.getElementById('target-x'), targetYDisplay = document.getElementById('target-y'), targetZDisplay = document.getElementById('target-z');
        const interceptorYDisplay = document.getElementById('interceptor-y');
        const turretAzimuthDisplay = document.getElementById('turret-azimuth'), turretElevationDisplay = document.getElementById('turret-elevation');
        const statusDisplay = document.getElementById('status-display');
        const simulationScreen = document.getElementById('simulation-screen');

        const TARGET_ART = ["( ͡° ͜ʖ ͡°)"]
        const WRECKAGE_ART = ["#"];

        //Physics FACK
        class Point3D { constructor(x, y, z) { this.x = x; this.y = y; this.z = z; } }
        class Target {
            constructor(x, y, z, vx, vy, vz) { this.position = new Point3D(x, y, z); this.velocity = new Point3D(vx, vy, vz); this.isHit = false; }
            update(dt) { this.position.x += this.velocity.x * dt; this.position.z += this.velocity.z * dt; this.position.y += this.velocity.y * dt; this.velocity.y -= 9.81 * dt; }
            destroy() { this.isHit = true; }
        }
        class Interceptor {
            constructor(startX, startY, startZ) { this.position = new Point3D(startX, startY, startZ); this.velocity = new Point3D(0, 0, 0); }
            fire(leadPoint, startPosition, speed) { this.position = startPosition; const dx = leadPoint.x - this.position.x, dy = leadPoint.y - this.position.y, dz = leadPoint.z - this.position.z; const dist = Math.sqrt(dx*dx + dy*dy + dz*dz); if (dist > 0) { this.velocity.x = (dx/dist)*speed; this.velocity.y = (dy/dist)*speed; this.velocity.z = (dz/dist)*speed; } }
            update(dt) { this.position.x += this.velocity.x * dt; this.position.y += this.velocity.y * dt; this.position.z += this.velocity.z * dt; }
        }
        class Turret {
            constructor(x, y, z) { this.basePosition = new Point3D(x, y, z); this.gunLength = 8; this.azimuth = 0; this.elevation = 0; this.targetAzimuth = 0; this.targetElevation = 0; this.rotationSpeed = Math.PI; this.alignmentThreshold = 0.05; }
            getGunTipPosition() { 
                let tip = new Point3D(0, 0, this.gunLength); 
                let elevSin = Math.sin(this.elevation), elevCos = Math.cos(this.elevation); 
                //counter-clockwise rotation for elevation
                tip = new Point3D(tip.x, tip.y * elevCos + tip.z * elevSin, -tip.y * elevSin + tip.z * elevCos); 
                let azimSin = Math.sin(this.azimuth), azimCos = Math.cos(this.azimuth); 
                tip = new Point3D(tip.x * azimCos + tip.z * azimSin, tip.y, -tip.x * azimSin + tip.z * azimCos); 
                return new Point3D(this.basePosition.x + tip.x, this.basePosition.y + tip.y, this.basePosition.z + tip.z); 
            }
            calculateAimAngles(leadPoint) { const dx = leadPoint.x - this.basePosition.x, dy = leadPoint.y - this.basePosition.y, dz = leadPoint.z - this.basePosition.z; this.targetAzimuth = Math.atan2(dx, dz); const horizontalDist = Math.sqrt(dx*dx + dz*dz); this.targetElevation = Math.atan2(dy, horizontalDist); }
            update(dt) { const lerpAngle = (current, target, speed) => { let diff = target - current; while (diff < -Math.PI) diff += 2 * Math.PI; while (diff > Math.PI) diff -= 2 * Math.PI; const change = speed * dt; if (Math.abs(diff) < change) return target; return current + Math.sign(diff) * change; }; this.azimuth = lerpAngle(this.azimuth, this.targetAzimuth, this.rotationSpeed); this.elevation = lerpAngle(this.elevation, this.targetElevation, this.rotationSpeed); }
            isAligned() { const azimDiff = Math.abs(this.azimuth - this.targetAzimuth); const elevDiff = Math.abs(this.elevation - this.targetElevation); return azimDiff < this.alignmentThreshold && elevDiff < this.alignmentThreshold; }
            static calculateLeadPoint(target, turretPos, speed) { let t = 0; for (let i = 0; i < 10; i++) { const fTX = target.position.x + target.velocity.x * t, fTY = target.position.y + target.velocity.y * t - 0.5 * 9.81 * t*t, fTZ = target.position.z + target.velocity.z * t; const dx = fTX - turretPos.x, dy = fTY - turretPos.y, dz = fTZ - turretPos.z; if (speed <= 0) { t = Infinity; break; } t = Math.sqrt(dx*dx + dy*dy + dz*dz) / speed; } return new Point3D(target.position.x + target.velocity.x * t, target.position.y + target.velocity.y * t - 0.5 * 9.81 * t*t, target.position.z + target.velocity.z * t); }
        }
        
        //ASCII Renderer 
        const SCREEN_WIDTH = 180, SCREEN_HEIGHT = 55, cubeSize = 80;
        let angleX = 0.3, angleY = -0.5, zoom = 1.0;
        const vertices = [ new Point3D(-cubeSize, -cubeSize, -cubeSize), new Point3D(cubeSize, -cubeSize, -cubeSize), new Point3D(cubeSize, cubeSize, -cubeSize), new Point3D(-cubeSize, cubeSize, -cubeSize), new Point3D(-cubeSize, -cubeSize, cubeSize), new Point3D(cubeSize, -cubeSize, cubeSize), new Point3D(cubeSize, cubeSize, cubeSize), new Point3D(-cubeSize, cubeSize, cubeSize) ];
        const edges = [ [0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7] ];

        function rotate(p, ax, ay) { const sinX = Math.sin(ax), cosX = Math.cos(ax), sinY = Math.sin(ay), cosY = Math.cos(ay); let ry = { x: p.x * cosY - p.z * sinY, y: p.y, z: p.x * sinY + p.z * cosY }; return new Point3D(ry.x, ry.y * cosX - ry.z * sinX, ry.y * sinX + ry.z * cosX); }
        function project(p) { const fov = 350 * zoom, factor = fov / (400 + p.z); return { x: Math.round(p.x * factor + SCREEN_WIDTH / 2), y: Math.round(-p.y * factor + SCREEN_HEIGHT / 2), z: p.z }; }
        function drawLine(buffer, p1, p2, char) { let x0 = p1.x, y0 = p1.y, x1 = p2.x, y1 = p2.y; const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1, dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1; let err = dx + dy, e2; while (true) { if (x0 >= 0 && x0 < SCREEN_WIDTH && y0 >= 0 && y0 < SCREEN_HEIGHT) buffer[y0][x0] = char; if (x0 === x1 && y0 === y1) break; e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } } }

        function renderASCII(target, interceptor, turret) {
            let buffer = Array(SCREEN_HEIGHT).fill(null).map(() => Array(SCREEN_WIDTH).fill(' '));
            let zBuffer = Array(SCREEN_HEIGHT).fill(null).map(() => Array(SCREEN_WIDTH).fill(Infinity));
            const placeObject = (p, art) => { const rotated_p = rotate(p, angleX, angleY), proj = project(rotated_p); if (typeof art === 'string') { if (proj.x >= 0 && proj.x < SCREEN_WIDTH && proj.y >= 0 && proj.y < SCREEN_HEIGHT && proj.z < zBuffer[proj.y][proj.x]) { buffer[proj.y][proj.x] = art; zBuffer[proj.y][proj.x] = proj.z; } } else { const artH = art.length, artW = art[0].length, startY = proj.y - Math.floor(artH / 2), startX = proj.x - Math.floor(artW / 2); for (let i = 0; i < artH; i++) for (let j = 0; j < artW; j++) { const char = art[i][j]; if (char === ' ') continue; const y = startY + i, x = startX + j; if (x >= 0 && x < SCREEN_WIDTH && y >= 0 && y < SCREEN_HEIGHT && proj.z < zBuffer[y][x]) { buffer[y][x] = char; zBuffer[y][x] = proj.z; } } } };
            
            edges.forEach(edge => { drawLine(buffer, project(rotate(vertices[edge[0]], angleX, angleY)), project(rotate(vertices[edge[1]], angleX, angleY)), '.'); });
            
            //Turret Drawing Logic 
            const turretBaseRotated = rotate(turret.basePosition, angleX, angleY);
            const gunTipRotated = rotate(turret.getGunTipPosition(), angleX, angleY);
            const turretBaseProj = project(turretBaseRotated);
            const gunTipProj = project(gunTipRotated);

            const dx = gunTipProj.x - turretBaseProj.x;
            const dy = gunTipProj.y - turretBaseProj.y;
            const projLength = Math.sqrt(dx * dx + dy * dy);

            if (projLength < 1.0) { // Gun is foreshortened (pointing at camera)
                placeObject(turret.basePosition, "·");
            } else { // Gun is viewed from the side
                const angleDeg = Math.atan2(dy, dx) * 180 / Math.PI;
                let gunChar;
                if ((angleDeg > -112.5 && angleDeg < -67.5) || (angleDeg > 67.5 && angleDeg < 112.5)) gunChar = '|';
                else if ((angleDeg > -22.5 && angleDeg < 22.5) || (angleDeg > 157.5 || angleDeg < -157.5)) gunChar = '-';
                else if ((angleDeg >= 22.5 && angleDeg <= 67.5) || (angleDeg <= -112.5 && angleDeg > -157.5)) gunChar = '\\';
                else gunChar = '/';
                
                // 1. Draw the gun line
                drawLine(buffer, turretBaseProj, gunTipProj, gunChar);
                // 2. Draw the base, which will overwrite the start of the gun line
                placeObject(turret.basePosition, "ㅁ");
            }

            let targetArt = target.isHit ? WRECKAGE_ART : TARGET_ART;
            placeObject(target.position, targetArt);
            if (interceptor) placeObject(interceptor.position, '+');
            simulationScreen.textContent = buffer.map(row => row.join('')).join('\n');
        }
        
        let target, interceptor, turret, launchTime, hasFired;
        function resetSimulation() {
            let startX, startY, startZ, velX, velY, velZ; const spawnFace = Math.floor(Math.random() * 6); const posOffset = cubeSize + 10; const randomPosOnFace = () => (Math.random() - 0.5) * cubeSize * 1.5;
            switch (spawnFace) {
                case 0: startX = -posOffset; startY = randomPosOnFace(); startZ = randomPosOnFace(); velX = 30 + Math.random() * 20; velY = (Math.random() - 0.5) * 20; velZ = (Math.random() - 0.5) * 20; break;
                case 1: startX = posOffset; startY = randomPosOnFace(); startZ = randomPosOnFace(); velX = -30 - Math.random() * 20; velY = (Math.random() - 0.5) * 20; velZ = (Math.random() - 0.5) * 20; break;
                case 2: startX = randomPosOnFace(); startY = posOffset; startZ = randomPosOnFace(); velX = (Math.random() - 0.5) * 20; velY = -10 - Math.random() * 10; velZ = (Math.random() - 0.5) * 20; break;
                case 3: startX = randomPosOnFace(); startY = randomPosOnFace(); startZ = posOffset; velX = (Math.random() - 0.5) * 20; velY = (Math.random() - 0.5) * 20; velZ = -30 - Math.random() * 20; break;
                case 4: startX = randomPosOnFace(); startY = randomPosOnFace(); startZ = -posOffset; velX = (Math.random() - 0.5) * 20; velY = (Math.random() - 0.5) * 20; velZ = 30 + Math.random() * 20; break;
                default: startX = randomPosOnFace(); startY = -posOffset; startZ = randomPosOnFace(); velX = (Math.random() - 0.5) * 20; velY = 40 + Math.random() * 20; velZ = (Math.random() - 0.5) * 20; break;
            }
            target = new Target(startX, startY, startZ, velX, velY, velZ); turret = new Turret(0, -cubeSize, 0); interceptor = null; hasFired = false; launchTime = performance.now() + 2000; statusDisplay.textContent = "ACQUIRING";
        }

        resetSimulation();
        let lastFrameTime = performance.now(), startTime = Date.now(), frameCount = 0, lastFpsUpdate = 0;
        function animate() {
            const now = performance.now(), deltaTime = (now - lastFrameTime) / 1000;
            target.update(deltaTime); turret.update(deltaTime);
            if (!target.isHit) { const interceptorSpeed = 150; const leadPoint = Turret.calculateLeadPoint(target, turret.basePosition, interceptorSpeed); turret.calculateAimAngles(leadPoint); if (!hasFired && now >= launchTime && turret.isAligned()) { interceptor = new Interceptor(0,0,0); interceptor.fire(leadPoint, turret.getGunTipPosition(), interceptorSpeed); hasFired = true; statusDisplay.textContent = "FIRING"; } else if (!hasFired && now >= launchTime) { statusDisplay.textContent = "AIMING..."; } }
            if (interceptor) { interceptor.update(deltaTime); const distToTarget = Math.sqrt((interceptor.position.x - target.position.x)**2 + (interceptor.position.y - target.position.y)**2 + (interceptor.position.z - target.position.z)**2); if (!target.isHit && distToTarget < 5) { target.destroy(); interceptor = null; statusDisplay.textContent = "TARGET HIT"; } }
            renderASCII(target, interceptor, turret);
            const p = target.position; const outOfBounds = Math.abs(p.x) > cubeSize + 50 || Math.abs(p.z) > cubeSize + 50; const hitGround = p.y < -cubeSize - 10; if (outOfBounds || hitGround) { resetSimulation(); }
            targetXDisplay.textContent = p.x.toFixed(2); targetYDisplay.textContent = p.y.toFixed(2); targetZDisplay.textContent = p.z.toFixed(2); turretAzimuthDisplay.textContent = `${(turret.azimuth * 180 / Math.PI).toFixed(1)}°`; turretElevationDisplay.textContent = `${(turret.elevation * 180 / Math.PI).toFixed(1)}°`; interceptorYDisplay.textContent = interceptor ? interceptor.position.y.toFixed(2) : '--.--'; runtimeDisplay.textContent = `${Math.floor((Date.now() - startTime) / 1000)}s`; frameCount++; if (now >= lastFpsUpdate + 1000) { fpsDisplay.textContent = `${frameCount}`; frameCount = 0; lastFpsUpdate = now; } lastFrameTime = now;
            requestAnimationFrame(animate);
        }
        animate();
        // Mouse controls :D
        let isDragging = false, lastMouseX = 0, lastMouseY = 0;
        simulationScreen.addEventListener('mousedown', (e) => { isDragging = true; lastMouseX = e.clientX; lastMouseY = e.clientY; });
        window.addEventListener('mouseup', () => { isDragging = false; });
        window.addEventListener('mousemove', (e) => { if (isDragging) { const dx = e.clientX - lastMouseX, dy = e.clientY - lastMouseY; angleY += dx * 0.005; angleX += dy * 0.005; lastMouseX = e.clientX; lastMouseY = e.clientY; } });
        simulationScreen.addEventListener('wheel', (e) => { e.preventDefault(); if (e.deltaY < 0) zoom = Math.min(zoom + 0.1, 3.0); else zoom = Math.max(zoom - 0.1, 0.2); });