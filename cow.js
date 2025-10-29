// --- UI Selectors ---
const runtimeDisplay = document.getElementById('runtime-display'), fpsDisplay = document.getElementById('fps-display');
const targetXDisplay = document.getElementById('target-x'), targetYDisplay = document.getElementById('target-y'), targetZDisplay = document.getElementById('target-z');
const interceptorYDisplay = document.getElementById('interceptor-y');
const turretAzimuthDisplay = document.getElementById('turret-azimuth'), turretElevationDisplay = document.getElementById('turret-elevation');
const statusDisplay = document.getElementById('status-display');
const simulationScreen = document.getElementById('simulation-screen');

const TARGET_ART = ["( ͡° ͜ʖ ͡°)"]
const WRECKAGE_ART = ["#"];

// --- Physics stuff ---
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
        // -Use proper counter-clockwise rotation for elevation -
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