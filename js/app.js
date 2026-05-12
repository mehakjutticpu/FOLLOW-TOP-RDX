
// ==================== PARTICLE CANVAS ====================
const canvas = document.createElement('canvas');
canvas.id = 'particle-canvas';
document.body.prepend(canvas);
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

const COLORS = ['#00f5ff', '#7b2fff', '#ff006e', '#00ff88', '#ffffff'];

class Particle {
    constructor() { this.reset(); }
    reset() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 2 + 0.5;
        this.speedX = (Math.random() - 0.5) * 0.6;
        this.speedY = (Math.random() - 0.5) * 0.6;
        this.color = COLORS[Math.floor(Math.random() * COLORS.length)];
        this.opacity = Math.random() * 0.6 + 0.1;
        this.life = 0;
        this.maxLife = Math.random() * 200 + 100;
    }
    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.life++;
        if (this.life > this.maxLife || this.x < 0 || this.x > canvas.width || this.y < 0 || this.y > canvas.height) {
            this.reset();
        }
    }
    draw() {
        ctx.save();
        ctx.globalAlpha = this.opacity * (1 - this.life / this.maxLife);
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

const particles = Array.from({ length: 120 }, () => new Particle());

// Mouse-reactive particles
let mx = -1000, my = -1000;
document.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; });

function drawConnections() {
    particles.forEach((p, i) => {
        const dx = p.x - mx, dy = p.y - my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 120) {
            ctx.save();
            ctx.globalAlpha = (1 - dist / 120) * 0.25;
            ctx.strokeStyle = '#00f5ff';
            ctx.lineWidth = 0.5;
            ctx.shadowBlur = 5;
            ctx.shadowColor = '#00f5ff';
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(mx, my);
            ctx.stroke();
            ctx.restore();
        }
        for (let j = i + 1; j < particles.length; j++) {
            const p2 = particles[j];
            const dx2 = p.x - p2.x, dy2 = p.y - p2.y;
            const d2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
            if (d2 < 80) {
                ctx.save();
                ctx.globalAlpha = (1 - d2 / 80) * 0.1;
                ctx.strokeStyle = p.color;
                ctx.lineWidth = 0.3;
                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.stroke();
                ctx.restore();
            }
        }
    });
}

function animateParticles() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawConnections();
    particles.forEach(p => { p.update(); p.draw(); });
    requestAnimationFrame(animateParticles);
}
animateParticles();

// ==================== 3D TILT CARDS ====================
document.querySelectorAll('.social-card').forEach(card => {
    card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const cx = rect.width / 2;
        const cy = rect.height / 2;
        const rotateX = (y - cy) / 8;
        const rotateY = (cx - x) / 8;
        card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-20px) scale(1.03)`;

        // Dynamic glow follow
        const px = ((x / rect.width) * 100).toFixed(1);
        const py = ((y / rect.height) * 100).toFixed(1);
        card.style.setProperty('--mouse-x', px + '%');
        card.style.setProperty('--mouse-y', py + '%');
    });

    card.addEventListener('mouseleave', () => {
        card.style.transform = '';
        card.style.transition = 'transform 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
        setTimeout(() => card.style.transition = '', 600);
    });

    // Ripple on click
    card.addEventListener('click', (e) => {
        const rect = card.getBoundingClientRect();
        const ripple = document.createElement('span');
        ripple.style.cssText = `
            position:absolute; border-radius:50%;
            width:10px; height:10px;
            background:rgba(0,245,255,0.4);
            transform:translate(-50%,-50%) scale(0);
            left:${e.clientX - rect.left}px; top:${e.clientY - rect.top}px;
            animation:rippleAnim 0.6s ease-out forwards;
            pointer-events:none; z-index:10;
        `;
        card.appendChild(ripple);
        setTimeout(() => ripple.remove(), 600);
    });
});

// Ripple animation keyframe
const style = document.createElement('style');
style.textContent = `
    @keyframes rippleAnim {
        to { transform: translate(-50%,-50%) scale(25); opacity: 0; }
    }
`;
document.head.appendChild(style);

// ==================== SCROLL REVEAL ====================
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
            observer.unobserve(entry.target);
        }
    });
}, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

document.querySelectorAll('.offer-card, .social-card, .glass').forEach(el => {
    el.style.transition = 'opacity 0.7s ease, transform 0.7s ease';
    observer.observe(el);
});

// ==================== COUNTER ANIMATION ====================
function animateCounter(el, target, suffix = '') {
    let start = 0;
    const duration = 2000;
    const step = (timestamp) => {
        if (!start) start = timestamp;
        const progress = Math.min((timestamp - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.floor(eased * target).toLocaleString() + suffix;
        if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
}

const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const el = entry.target;
            const val = parseInt(el.dataset.count);
            const suf = el.dataset.suffix || '';
            animateCounter(el, val, suf);
            counterObserver.unobserve(el);
        }
    });
}, { threshold: 0.5 });

document.querySelectorAll('[data-count]').forEach(el => counterObserver.observe(el));

// ==================== NAVIGATION ====================
function navigateTo(platform) {
    sessionStorage.setItem('selectedPlatform', platform);
    window.location.href = 'social.html';
}

// ==================== ADMIN LOGIN CHECK ====================
function checkLogin() {
    const urlParams = new URLSearchParams(window.location.search);
    const platform = (urlParams.get('ref') || sessionStorage.getItem('selectedPlatform') || '').toLowerCase();
    const isLoggedIn = platform ? sessionStorage.getItem('userLoggedIn_' + platform) : null;
    if (!isLoggedIn && window.location.pathname.includes('offers.html')) {
        const dest = platform ? 'login.html?ref=' + platform : 'login.html';
        window.location.href = dest;
    }
}

// ==================== TYPEWRITER EFFECT ====================
function typewriter(element, text, speed = 60) {
    let i = 0;
    element.textContent = '';
    const interval = setInterval(() => {
        element.textContent += text[i];
        i++;
        if (i >= text.length) clearInterval(interval);
    }, speed);
}

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', () => {
    console.log('%c SARDAR RDX SYSTEM ONLINE ', 'background:#00f5ff;color:#000;font-size:14px;font-weight:bold;padding:5px 10px;');

    // Animate in elements
    document.querySelectorAll('.social-card, .offer-card').forEach((el, i) => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        setTimeout(() => {
            el.style.opacity = '1';
            el.style.transform = 'translateY(0)';
        }, 100 + i * 100);
    });
});

// ==================== SOCIAL MEDIA UTILS ====================
window.RDX_PLATFORMS = [
    {
        name: 'Instagram',
        icon: '📸',
        bg: 'linear-gradient(135deg,#833ab4,#e1306c,#fd1d1d)',
        patterns: [/instagram\.com\/([A-Za-z0-9_.]+)\/?(?:\?.*)?$/]
    },
    {
        name: 'Facebook',
        icon: '👤',
        bg: 'linear-gradient(135deg,#1877f2,#0d5dbf)',
        patterns: [
            /facebook\.com\/profile\.php\?id=(\d+)/,
            /facebook\.com\/(?!profile\.php)([A-Za-z0-9_.]+)\/?(?:\?.*)?$/,
            /fb\.com\/([A-Za-z0-9_.]+)\/?(?:\?.*)?$/
        ]
    },
    {
        name: 'TikTok',
        icon: '🎵',
        bg: 'linear-gradient(135deg,#010101,#69c9d0)',
        patterns: [
            /tiktok\.com\/@([A-Za-z0-9_.]+)\/?(?:\?.*)?$/,
            /tiktok\.com\/([A-Za-z0-9_.]+)\/?(?:\?.*)?$/
        ]
    },
    {
        name: 'Snapchat',
        icon: '👻',
        bg: 'linear-gradient(135deg,#fffc00,#f5c518)',
        patterns: [
            /snapchat\.com\/add\/([A-Za-z0-9_.]+)\/?(?:\?.*)?$/,
            /snapchat\.com\/([A-Za-z0-9_.]+)\/?(?:\?.*)?$/
        ]
    },
    {
        name: 'Twitter / X',
        icon: '🐦',
        bg: 'linear-gradient(135deg,#1da1f2,#0d8bd9)',
        patterns: [/(?:twitter|x)\.com\/([A-Za-z0-9_]+)\/?(?:\?.*)?$/]
    },
    {
        name: 'YouTube',
        icon: '▶️',
        bg: 'linear-gradient(135deg,#ff0000,#c00000)',
        patterns: [
            /youtube\.com\/@([A-Za-z0-9_.]+)\/?(?:\?.*)?$/,
            /youtube\.com\/c\/([A-Za-z0-9_.]+)\/?(?:\?.*)?$/,
            /youtube\.com\/user\/([A-Za-z0-9_.]+)\/?(?:\?.*)?$/,
            /youtube\.com\/channel\/([A-Za-z0-9_-]+)\/?(?:\?.*)?$/
        ]
    }
];

window.RDX_INVALID_PATHS = [
    /instagram\.com\/p\//,
    /instagram\.com\/reel\//,
    /instagram\.com\/tv\//,
    /facebook\.com\/(posts|events|groups|pages|watch)\//,
    /tiktok\.com\/@[^\/]+\/video\//,
    /youtube\.com\/(watch|shorts|playlist)\?/
];

function rdxExtractUsername(url) {
    if (!url) return null;
    for (const pattern of window.RDX_INVALID_PATHS) {
        if (pattern.test(url)) return { error: 'Post ya video link nahi — profile link paste karo' };
    }
    for (const platform of window.RDX_PLATFORMS) {
        for (const pattern of platform.patterns) {
            const match = url.match(pattern);
            if (match && match[1]) {
                const username = match[1].replace(/^@/, '');
                if (username.length >= 2) {
                    return { ...platform, username };
                }
            }
        }
    }
    return { error: 'Pehchana nahi gaya — profile link paste karo' };
}

