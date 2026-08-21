import re

with open('script.js', 'r') as f:
    content = f.read()

# Replace els.butterflyCanvas
content = content.replace('butterflyCanvas: $("#butterflyCanvas"),', 'butterfliesContainer: $("#butterfliesContainer"),')

# Replace instantiation
content = content.replace('const butterflies = new ButterflyCanvas(els.butterflyCanvas);', 'const butterflies = new ButterflySystem(els.butterfliesContainer);')

# Replace the ButterflyCanvas class definition
class_pattern = re.compile(r'class ButterflyCanvas \{.*?\n  \}\n', re.DOTALL)
replacement = """class ButterflySystem {
    constructor(container) {
      this.container = container;
      this.butterflies = [];
      this.width = window.innerWidth;
      this.height = window.innerHeight;
      this.running = true;
      this.lastTime = performance.now();
      
      this.nextSpawnIn = 8000 + Math.random() * 8000;
      this.timeSinceLastSpawn = 0;
      this.breezeActive = false;
      
      this.resize = this.resize.bind(this);
      this.update = this.update.bind(this);
      window.addEventListener("resize", this.resize, { passive: true });
      requestAnimationFrame(this.update);
    }

    maxCount() {
      return reducedMotion ? 1 : 2;
    }

    resize() {
      this.width = window.innerWidth;
      this.height = window.innerHeight;
    }

    makeButterfly() {
      // Anchored mainly to the plant at right-mid (~60% X, ~65% Y)
      const plantX = this.width * 0.60;
      const plantY = this.height * 0.65;
      
      const depth = 0.5 + Math.random() * 0.5; 
      const sizePx = reducedMotion ? 12 : (16 + depth * 14 + Math.random() * 8); // ~16-38px
      
      const el = document.createElement("div");
      el.className = "butterfly-wrapper";
      
      const palettes = [
        { p: "#c0e0ff", s: "#e8f0f8" }, // soft blue + cream
        { p: "#e09040", s: "#ffc080" }, // muted orange + lighter
        { p: "#50a0a0", s: "#80c0c0" }, // turquoise + neutral
        { p: "#d0a0c0", s: "#f0d0e0" }, // soft pink/purple
        { p: "#b0d0ff", s: "#ffffff" }  // light blue + white
      ];
      const palette = palettes[Math.floor(Math.random() * palettes.length)];
      
      el.innerHTML = `
        <svg viewBox="0 0 100 100" class="butterfly-svg" preserveAspectRatio="xMidYMid meet" style="overflow: visible;">
          <defs>
            <radialGradient id="wingGrad1" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="${palette.s}" />
              <stop offset="100%" stop-color="${palette.p}" />
            </radialGradient>
          </defs>
          <g class="butterfly-wing left-wing" style="transform-origin: 50% 50%;">
            <path d="M 50 50 C 25 10, 5 20, 10 40 C 15 65, 35 55, 50 50" fill="url(#wingGrad1)" stroke="#221105" stroke-width="2.5" />
            <path d="M 38 42 C 22 22, 14 30, 20 40 C 25 48, 35 48, 38 42" fill="${palette.s}" opacity="0.8" />
            <circle cx="15" cy="30" r="2.5" fill="#fff" opacity="0.8"/>
            <circle cx="22" cy="20" r="1.5" fill="#fff" opacity="0.8"/>
            <path d="M 50 50 C 30 65, 20 85, 35 90 C 45 90, 48 70, 50 50" fill="${palette.p}" stroke="#221105" stroke-width="2" />
          </g>
          <g class="butterfly-wing right-wing" style="transform-origin: 50% 50%;">
            <path d="M 50 50 C 75 10, 95 20, 90 40 C 85 65, 65 55, 50 50" fill="url(#wingGrad1)" stroke="#221105" stroke-width="2.5" />
            <path d="M 62 42 C 78 22, 86 30, 80 40 C 75 48, 65 48, 62 42" fill="${palette.s}" opacity="0.8" />
            <circle cx="85" cy="30" r="2.5" fill="#fff" opacity="0.8"/>
            <circle cx="78" cy="20" r="1.5" fill="#fff" opacity="0.8"/>
            <path d="M 50 50 C 70 65, 80 85, 65 90 C 55 90, 52 70, 50 50" fill="${palette.p}" stroke="#221105" stroke-width="2" />
          </g>
          <path d="M 48 35 Q 50 15 52 35 Q 54 65 50 75 Q 46 65 48 35" fill="#2d1c10"/>
          <path d="M 50 35 Q 42 18 36 20 M 50 35 Q 58 18 64 20" stroke="#2d1c10" stroke-width="1.5" fill="none" stroke-linecap="round"/>
        </svg>
      `;
      
      el.style.setProperty("--b-size", `${sizePx}px`);
      
      const leftWing = el.querySelector('.left-wing');
      const rightWing = el.querySelector('.right-wing');
      const svg = el.querySelector('.butterfly-svg');
      
      this.container.appendChild(el);
      
      return {
        el,
        leftWing,
        rightWing,
        svg,
        x: plantX - 50 + Math.random() * 100,
        y: plantY - 30 + Math.random() * 60,
        vx: -30 + Math.random() * 60,
        vy: -30 + Math.random() * 60,
        targetX: plantX,
        targetY: plantY - 50,
        hoverTimer: 0,
        isHovering: false,
        phaseX: Math.random() * Math.PI * 2,
        phaseY: Math.random() * Math.PI * 2,
        flapPhase: Math.random() * Math.PI * 2,
        flapSpeed: 2.2 + Math.random() * 1.5,
        opacity: 0,
        lifeSecs: 15 + Math.random() * 20,
        age: 0,
        angle: 0
      };
    }

    breeze() {
      if (reducedMotion) return;
      this.breezeActive = true;
      for (const b of this.butterflies) {
        b.vy -= 15 + Math.random() * 10;
        b.flapSpeed += 1.8;
      }
      clearTimeout(this._breezeTimer);
      this._breezeTimer = setTimeout(() => {
        this.breezeActive = false;
        for (const b of this.butterflies) {
          b.flapSpeed = Math.max(2.2, b.flapSpeed - 1.8);
        }
      }, 4500);
    }

    update(now) {
      requestAnimationFrame(this.update);
      const active = state.entered && state.environment === "spring" && !state.environmentTransitioning;

      if (!this.running || document.hidden) {
        this.lastTime = now;
        return;
      }

      const delta = Math.min(0.05, (now - this.lastTime) / 1000);
      this.lastTime = now;

      if (!active) {
        if (this.butterflies.length > 0) {
          this.butterflies.forEach(b => b.el.remove());
          this.butterflies = [];
        }
        return;
      }

      this.timeSinceLastSpawn += delta * 1000;
      if (
        this.butterflies.length < this.maxCount() &&
        this.timeSinceLastSpawn >= this.nextSpawnIn
      ) {
        this.butterflies.push(this.makeButterfly());
        this.timeSinceLastSpawn = 0;
        this.nextSpawnIn = reducedMotion ? 25000 : 12000 + Math.random() * 12000;
      }

      const plantX = this.width * 0.60;
      const plantY = this.height * 0.65;

      for (let i = this.butterflies.length - 1; i >= 0; i--) {
        const b = this.butterflies[i];
        b.age += delta;
        b.flapPhase += delta * b.flapSpeed * Math.PI * 2;

        b.hoverTimer -= delta;
        if (b.hoverTimer <= 0) {
          b.isHovering = !b.isHovering;
          if (b.isHovering) {
            b.hoverTimer = 0.5 + Math.random() * 1.5; // hover for 0.5-2s
            b.targetX = plantX - 80 + Math.random() * 160;
            b.targetY = plantY - 120 + Math.random() * 120;
          } else {
            b.hoverTimer = 2 + Math.random() * 4; // fly for 2-6s
            // pick a new nearby target
            b.targetX = plantX - 180 + Math.random() * 360;
            b.targetY = plantY - 200 + Math.random() * 250;
          }
        }

        if (b.isHovering) {
          // Attract strongly to target, add friction
          b.vx += (b.targetX - b.x) * 0.8 * delta;
          b.vy += (b.targetY - b.y) * 0.8 * delta;
          b.vx *= (1 - delta * 2.5);
          b.vy *= (1 - delta * 2.5);
          b.flapSpeed = 3.5 + Math.sin(now/200)*0.5;
        } else {
          // Fly gently towards target
          b.vx += (b.targetX - b.x) * 0.2 * delta;
          b.vy += (b.targetY - b.y) * 0.2 * delta;
          // Organic drift
          b.phaseX += delta * 0.4;
          b.phaseY += delta * 0.3;
          b.vx += Math.sin(b.phaseX) * 12 * delta;
          b.vy += Math.cos(b.phaseY) * 12 * delta;
          b.vx *= (1 - delta * 0.8);
          b.vy *= (1 - delta * 0.8);
          b.flapSpeed = 2.2 + Math.sin(now/500)*0.5;
        }

        b.x += b.vx * delta;
        b.y += b.vy * delta;

        // Calculate facing angle based on velocity
        const targetAngle = Math.atan2(b.vy, b.vx) * (180 / Math.PI) + 90; 
        
        // Smoothly interpolate angle
        let dAngle = targetAngle - b.angle;
        while (dAngle > 180) dAngle -= 360;
        while (dAngle < -180) dAngle += 360;
        b.angle += dAngle * delta * 2;

        const wingScale = 0.2 + 0.8 * Math.abs(Math.cos(b.flapPhase));

        // Fade in/out
        if (b.age < 2) {
          b.opacity = b.age / 2;
        } else if (b.age > b.lifeSecs - 2) {
          b.opacity = (b.lifeSecs - b.age) / 2;
        } else {
          b.opacity = 1;
        }

        if (b.age >= b.lifeSecs) {
          b.el.remove();
          this.butterflies.splice(i, 1);
          continue;
        }

        // Apply transforms
        // Offset by half size to center
        b.el.style.transform = `translate3d(${b.x}px, ${b.y}px, 0)`;
        b.el.style.opacity = b.opacity * 0.95; // slightly transparent to blend
        b.svg.style.transform = `translate(-50%, -50%) rotate(${b.angle}deg)`;
        
        b.leftWing.style.transform = `scaleX(${wingScale})`;
        b.rightWing.style.transform = `scaleX(${wingScale})`;
      }
    }
}
"""

content = class_pattern.sub(replacement, content)

with open('script.js', 'w') as f:
    f.write(content)
