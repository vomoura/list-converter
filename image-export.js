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
let cardImages = [];

const INK_COLORS = {
    Sapphire: '#2980B9',
    Steel: '#7F8C8D',
    Amber: '#E67E22',
    Emerald: '#27AE60',
    Ruby: '#C0392B',
    Amethyst: '#8E44AD'
};

async function imageToBase64(url) {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        // Convert to PNG via canvas to ensure html2canvas compatibility
        const img = new Image();
        img.crossOrigin = 'anonymous';
        const objectUrl = URL.createObjectURL(blob);
        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = objectUrl;
        });
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(objectUrl);
        return canvas.toDataURL('image/png');
    } catch {
        return null;
    }
}

async function fetchCardImages(inputText) {
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
    if (inks.length === 0) return 'linear-gradient(135deg, #1C1C1A 0%, #2a2a28 100%)';
    if (inks.length === 1) {
        const c = INK_COLORS[inks[0]] || '#1C1C1A';
        return `linear-gradient(135deg, ${c} 0%, ${c}80 100%)`;
    }
    const c1 = INK_COLORS[inks[0]] || '#1C1C1A';
    const c2 = INK_COLORS[inks[1]] || '#2a2a28';
    return `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)`;
}

function renderImagePreview() {
    if (cardImages.length === 0) {
        imagePreview.innerHTML = '<p style="color:#7a7a78;text-align:center;padding:40px;">Nenhuma carta carregada.</p>';
        return;
    }

    const gradient = getGradient(cardImages);
    imagePreview.style.background = gradient;
    imagePreview.style.borderRadius = '8px';

    let html = `<div class="image-grid" style="grid-template-columns: repeat(${columns}, 1fr);">`;
    for (const card of cardImages) {
        const src = card.base64 || card.imageUrl;
        html += `
            <div class="image-card">
                <img src="${src}" alt="${card.name}">
                <div class="image-card-qty">${card.qty}x</div>
            </div>
        `;
    }
    html += '</div>';
    imagePreview.innerHTML = html;
}

// Open modal
imageBtnEl.addEventListener('click', async () => {
    imageOverlay.classList.add('show');
    document.body.style.overflow = 'hidden';
    imagePreview.innerHTML = '<p style="color:#7a7a78;text-align:center;padding:40px;">Carregando imagens...</p>';
    downloadBtn.disabled = true;

    const inputText = document.getElementById('input').value;
    cardImages = await fetchCardImages(inputText);

    for (const card of cardImages) {
        card.base64 = await imageToBase64(card.imageUrl);
    }

    renderImagePreview();
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
        renderImagePreview();
    }
});

colPlus.addEventListener('click', () => {
    if (columns < 12) {
        columns++;
        colCountEl.textContent = columns;
        renderImagePreview();
    }
});

// Download PNG
downloadBtn.addEventListener('click', async () => {
    downloadBtn.disabled = true;
    downloadBtn.textContent = 'Gerando...';

    try {
        const canvas = await html2canvas(imagePreview, {
            useCORS: true,
            allowTaint: true,
            scale: 3,
            logging: false,
            backgroundColor: null
        });

        const link = document.createElement('a');
        link.download = 'decklist.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
    } catch (err) {
        console.error('Erro ao gerar imagem:', err);
    }

    downloadBtn.disabled = false;
    downloadBtn.textContent = 'Baixar PNG';
});
