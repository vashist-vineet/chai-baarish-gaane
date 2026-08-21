import re

with open('script.js', 'r') as f:
    content = f.read()

# Add nextZone tracking to constructor
init_pattern = re.compile(r'this\.timeSinceLastSpawn = 0;\n\s+this\.breezeActive = false;')
init_replacement = """this.timeSinceLastSpawn = 0;
      this.breezeActive = false;
      this.nextZone = "center";"""
content = init_pattern.sub(init_replacement, content)

# Reset nextZone when spring becomes active
update_start_pattern = re.compile(r'if \(\!active\) \{\n\s+if \(this\.butterflies\.length > 0\) \{\n\s+this\.butterflies\.forEach\(b => b\.el\.remove\(\)\);\n\s+this\.butterflies = \[\];\n\s+\}')
update_start_replacement = """if (!active) {
        if (this.butterflies.length > 0) {
          this.butterflies.forEach(b => b.el.remove());
          this.butterflies = [];
        }
        this.nextZone = "center";"""
content = update_start_pattern.sub(update_start_replacement, content)

# Update makeButterfly
make_pattern = re.compile(r'makeButterfly\(\) \{\n\s+// Anchored mainly to the plant(.*?)\n\s+el\.style\.setProperty\("--b-size", `\$\{sizePx\}px`\);\n\s+const leftWing(.*?)\n\s+return \{(.*?)\n\s+\};\n\s+\}', re.DOTALL)

def make_repl(m):
    return """makeButterfly() {
      const zone = this.nextZone || "center";
      this.nextZone = (zone === "center") ? "plant" : "center";

      const plantX = this.width * 0.60;
      const plantY = this.height * 0.65;
      
      const depth = 0.5 + Math.random() * 0.5; 
      const sizePx = reducedMotion ? 12 : (16 + depth * 14 + Math.random() * 8);
      
      const el = document.createElement("div");
      el.className = "butterfly-wrapper";
      
      const palettes = [
        { p: "#c0e0ff", s: "#e8f0f8" },
        { p: "#e09040", s: "#ffc080" },
        { p: "#50a0a0", s: "#80c0c0" },
        { p: "#d0a0c0", s: "#f0d0e0" },
        { p: "#b0d0ff", s: "#ffffff" }
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
      
      const fromLeft = Math.random() > 0.35;
      const startX = zone === "plant" ? plantX - 50 + Math.random() * 100 : (fromLeft ? -sizePx * 2 : Math.random() * this.width);
      const startY = zone === "plant" ? plantY - 30 + Math.random() * 60 : (this.height * 0.38 + Math.random() * (this.height * 0.44));
      
      return {
        el,
        leftWing,
        rightWing,
        svg,
        zone,
        x: startX,
        y: startY,
        vx: zone === "plant" ? -30 + Math.random() * 60 : (fromLeft ? 1 : (Math.random() > 0.5 ? 1 : -1)) * (16 + depth * 18 + Math.random() * 8),
        vy: zone === "plant" ? -30 + Math.random() * 60 : -4 - Math.random() * 8,
        targetX: plantX,
        targetY: plantY - 50,
        hoverTimer: 0,
        isHovering: false,
        phaseX: Math.random() * Math.PI * 2,
        phaseY: Math.random() * Math.PI * 2,
        ampX: 8 + Math.random() * 14,
        ampY: 5 + Math.random() * 9,
        wobbleX: 0.3 + Math.random() * 0.5,
        wobbleY: 0.18 + Math.random() * 0.35,
        flapPhase: Math.random() * Math.PI * 2,
        flapSpeed: 2.2 + Math.random() * 1.5,
        opacity: 0,
        lifeSecs: 15 + Math.random() * 20,
        age: 0,
        angle: 0
      };
    }"""

content = make_pattern.sub(make_repl, content)

# Update the loop in update()
loop_pattern = re.compile(r'for \(let i = this\.butterflies\.length - 1; i >= 0; i--\) \{(.*?)b\.x \+= b\.vx \* delta;', re.DOTALL)

def loop_repl(m):
    return """for (let i = this.butterflies.length - 1; i >= 0; i--) {
        const b = this.butterflies[i];
        b.age += delta;
        b.flapPhase += delta * b.flapSpeed * Math.PI * 2;

        if (b.zone === "plant") {
          b.hoverTimer -= delta;
          if (b.hoverTimer <= 0) {
            b.isHovering = !b.isHovering;
            if (b.isHovering) {
              b.hoverTimer = 0.5 + Math.random() * 1.5; // hover for 0.5-2s
              b.targetX = plantX - 80 + Math.random() * 160;
              b.targetY = plantY - 120 + Math.random() * 120;
            } else {
              b.hoverTimer = 2 + Math.random() * 4; // fly for 2-6s
              b.targetX = plantX - 180 + Math.random() * 360;
              b.targetY = plantY - 200 + Math.random() * 250;
            }
          }

          if (b.isHovering) {
            b.vx += (b.targetX - b.x) * 0.8 * delta;
            b.vy += (b.targetY - b.y) * 0.8 * delta;
            b.vx *= (1 - delta * 2.5);
            b.vy *= (1 - delta * 2.5);
            b.flapSpeed = 3.5 + Math.sin(now/200)*0.5;
          } else {
            b.vx += (b.targetX - b.x) * 0.2 * delta;
            b.vy += (b.targetY - b.y) * 0.2 * delta;
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
          
        } else {
          // Center zone: original organic drift logic
          b.phaseX += delta * b.wobbleX;
          b.phaseY += delta * b.wobbleY;

          b.x += (b.vx + Math.sin(b.phaseX) * b.ampX) * delta;
          b.y += (b.vy + Math.sin(b.phaseY) * b.ampY) * delta;

          // Very gentle gravity pull back toward mid-height
          const midY = this.height * 0.58;
          b.vy += (midY - b.y) * 0.008 * delta;
          // Dampen vx/vy so it doesn't accelerate indefinitely
          b.vx *= (1 - delta * 0.18);
          b.vy *= (1 - delta * 0.28);
          
          b.flapSpeed = 2.2 + Math.sin(now/800)*0.3;
        }"""

content = loop_pattern.sub(loop_repl, content)

with open('script.js', 'w') as f:
    f.write(content)
