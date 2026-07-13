// --- Image Export Feature ---
const imageBtnEl = document.getElementById('imageBtn');
const imageOverlay = document.getElementById('imageOverlay');
const imageClose = document.getElementById('imageClose');
const imagePreview = document.getElementById('imagePreview');
const downloadBtn = document.getElementById('downloadBtn');
const colMinus = document.getElementById('colMinus');
const colPlus = document.getElementById('colPlus');
const colCountEl = document.getElementById('colCount');

let columns = 8;
let cardData = []; // [{qty, name, imageUrl, ink}]

const INK_COLORS = {
    Sapphire: '#2980B9',
    Steel: '#7F8C8D',
    Amber: '#E67E22',
    Emerald: '#27AE60',
    Ruby: '#C0392B',
    Amethyst: '#8E44AD'
};

async function fetchCardData(inputText) {
    const lines = inputText.trim().split('\n').filter(l => l.trim());
    const parsed = lines.map(line => {
        const match = line.trim().match(/^(\d+)\s+(.+)$/);
        if (!match) return null;
        return { qty: parseInt(match[1], 10), fullName: match[2].trim() };
    }).filter(Boolean);

    parsed.sort((a, b) => b.qty - a.qty || a.fullName.localeCompare(b.fullName));

    const results = [];
    for (const { qty, fullName } of parsed) {
        const searchTerms = fullName.replace(/\s*-\s*/g, ' ');
        const query = encodeURIComponent(searchTerms);
        try {
            const response = await fetch(`https://api.lorcast.com/v0/cards/search?q=${query}`);
            const data = await response.json();
            if (data.results && data.results.length > 0) {
                const card = data.results[0];
                const imageUrl = card.image_uris?.digital?.normal || '';
                results.push({ qty, name: fullName, imageUrl, ink: card.ink || null });
            }
            await new Promise(r => setTimeout(r, 100));
        } catch {
            // Skip failed cards
        }
    }
    return results;
}

function getGradient(cards) {
    const inks = [...new Set(cards.map(c => c.ink).filter(Boolean))];
    if (inks.length === 0) return ['#1C1C1A', '#2a2a28'];
    if (inks.length === 1) {
        const c = INK_COLORS[inks[0]] || '#1C1C1A';
        return [c, c + '80'];
    }
    const c1 = INK_COLORS[inks[0]] || '#1C1C1A';
    const c2 = INK_COLORS[inks[1]] || '#2a2a28';
    return [c1, c2];
}

function getGradientCSS(cards) {
    const [c1, c2] = getGradient(cards);
    return `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)`;
}

// Load an image and return it as a loaded HTMLImageElement
function loadImage(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => {
            // Try without crossOrigin as fallback
            const img2 = new Image();
            img2.onload = () => resolve(img2);
            img2.onerror = reject;
            img2.src = url;
        };
        img.src = url;
    });
}

function renderPreviewHTML() {
    if (cardData.length === 0) {
        imagePreview.innerHTML = '<p style="color:#7a7a78;text-align:center;padding:40px;">Nenhuma carta carregada.</p>';
        return;
    }

    imagePreview.style.background = getGradientCSS(cardData);
    imagePreview.style.borderRadius = '8px';

    let html = `<div class="image-grid" style="grid-template-columns: repeat(${columns}, 1fr);">`;
    for (const card of cardData) {
        html += `
            <div class="image-card">
                <img src="${card.imageUrl}" alt="${card.name}">
                <div class="image-card-qty">${card.qty}x</div>
            </div>
        `;
    }
    html += '</div>';
    imagePreview.innerHTML = html;
}

// Generate the PNG using pure Canvas API (bypasses html2canvas CORS issues)
async function generateCanvasPNG() {
    const gap = 8;
    const padding = 24;
    const cardWidth = 200;
    const cardRatio = 1.4; // approximate card height/width ratio
    const cardHeight = Math.round(cardWidth * cardRatio);
    const badgeHeight = 22;
    const badgePadding = 6;

    const rows = Math.ceil(cardData.length / columns);
    const totalWidth = padding * 2 + columns * cardWidth + (columns - 1) * gap;
    const totalHeight = padding * 2 + rows * cardHeight + (rows - 1) * gap;

    const canvas = document.createElement('canvas');
    canvas.width = totalWidth;
    canvas.height = totalHeight;
    const ctx = canvas.getContext('2d');

    // Draw gradient background
    const [c1, c2] = getGradient(cardData);
    const grad = ctx.createLinearGradient(0, 0, totalWidth, totalHeight);
    grad.addColorStop(0, c1);
    grad.addColorStop(1, c2);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, totalWidth, totalHeight);

    // Draw cards
    for (let i = 0; i < cardData.length; i++) {
        const card = cardData[i];
        const col = i % columns;
        const row = Math.floor(i / columns);
        const x = padding + col * (cardWidth + gap);
        const y = padding + row * (cardHeight + gap);

        // Try to load and draw the image
        try {
            const img = await loadImage(card.imageUrl);
            // Draw with rounded corners
            const radius = 10;
            ctx.save();
            ctx.beginPath();
            ctx.roundRect(x, y, cardWidth, cardHeight, radius);
            ctx.clip();
            ctx.drawImage(img, x, y, cardWidth, cardHeight);
            ctx.restore();
        } catch {
            // Draw placeholder
            ctx.fillStyle = '#333';
            ctx.fillRect(x, y, cardWidth, cardHeight);
        }

        // Draw quantity badge
        const badgeText = `${card.qty}x`;
        ctx.font = 'bold 14px Inter, sans-serif';
        const textWidth = ctx.measureText(badgeText).width;
        const bw = textWidth + badgePadding * 2;
        const bx = x + cardWidth - bw - 6;
        const by = y + 6;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.beginPath();
        ctx.roundRect(bx, by, bw, badgeHeight, 5);
        ctx.fill();

        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(badgeText, bx + bw / 2, by + badgeHeight / 2);
    }

    return canvas;
}

// Open modal
imageBtnEl.addEventListener('click', async () => {
    imageOverlay.classList.add('show');
    document.body.style.overflow = 'hidden';
    imagePreview.innerHTML = '<p style="color:#7a7a78;text-align:center;padding:40px;">Carregando imagens...</p>';
    downloadBtn.disabled = true;

    const inputText = document.getElementById('input').value;
    cardData = await fetchCardData(inputText);

    renderPreviewHTML();
    downloadBtn.disabled = false;
});

// Close modal
imageClose.addEventListener('click', () => {
    imageOverlay.classList.remove('show');
    document.body.style.overflow = '';
});

imageOverlay.addEventListener('click', (e) => {
    if (e.target === imageOverlay) {
        imageOverlay.classList.remove('show');
        document.body.style.overflow = '';
    }
});

// Column controls
colMinus.addEventListener('click', () => {
    if (columns > 4) {
        columns--;
        colCountEl.textContent = columns;
        renderPreviewHTML();
    }
});

colPlus.addEventListener('click', () => {
    if (columns < 12) {
        columns++;
        colCountEl.textContent = columns;
        renderPreviewHTML();
    }
});

// Download PNG via Canvas API
downloadBtn.addEventListener('click', async () => {
    downloadBtn.disabled = true;
    downloadBtn.textContent = 'Gerando...';

    try {
        const canvas = await generateCanvasPNG();
        const link = document.createElement('a');
        link.download = 'decklist.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
    } catch (err) {
        console.error('Erro ao gerar imagem:', err);
        // Fallback: try html2canvas
        try {
            const canvas = await html2canvas(imagePreview, {
                useCORS: true,
                allowTaint: true,
                scale: 2,
                logging: false,
                backgroundColor: null
            });
            const link = document.createElement('a');
            link.download = 'decklist.png';
            link.href = canvas.toDataURL('image/png');
            link.click();
        } catch (err2) {
            console.error('Fallback também falhou:', err2);
        }
    }

    downloadBtn.disabled = false;
    downloadBtn.textContent = 'Baixar PNG';
});
