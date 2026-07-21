const inputEl = document.getElementById('input');
const outputEl = document.getElementById('output');
const convertBtn = document.getElementById('convertBtn');
const clearBtn = document.getElementById('clearBtn');
const copyBtn = document.getElementById('copyBtn');
const imageBtn = document.getElementById('imageBtn');
const statusEl = document.getElementById('status');
const toastEl = document.getElementById('toast');
const toastClose = document.getElementById('toastClose');
const toastProgress = document.getElementById('toastProgress');
const historyBtn = document.getElementById('historyBtn');
const historyOverlay = document.getElementById('historyOverlay');
const historyClose = document.getElementById('historyClose');
const historyList = document.getElementById('historyList');

const MAX_HISTORY = 5;

// --- History ---
function getHistory() {
    try {
        return JSON.parse(localStorage.getItem('conversionHistory') || '[]');
    } catch {
        return [];
    }
}

function saveToHistory(input, output) {
    const history = getHistory();
    history.unshift({
        date: new Date().toISOString(),
        input,
        output,
        cardCount: output.split('\n').length
    });
    if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
    localStorage.setItem('conversionHistory', JSON.stringify(history));
}

function renderHistory() {
    const history = getHistory();
    if (history.length === 0) {
        historyList.innerHTML = '<p class="empty-state">Nenhuma conversão salva ainda.</p>';
        return;
    }
    historyList.innerHTML = history.map((item, i) => {
        const date = new Date(item.date);
        const formatted = date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const firstLine = item.output.split('\n')[0] || '';
        return `
            <div class="history-item" data-index="${i}">
                <div class="history-item-date">${formatted}</div>
                <div class="history-item-preview">${firstLine}</div>
                <div class="history-item-count">${item.cardCount} carta${item.cardCount > 1 ? 's' : ''}</div>
            </div>
        `;
    }).join('');

    historyList.querySelectorAll('.history-item').forEach(el => {
        el.addEventListener('click', () => {
            const index = parseInt(el.dataset.index);
            const item = history[index];
            inputEl.value = item.input;
            renderOutput(item.output.split('\n'));
            copyBtn.disabled = false;
            imageBtn.disabled = false;
            historyOverlay.classList.remove('show');
            setStatus('Lista carregada do histórico.', 'success');
            updateClearBtn();
        });
    });
}

historyBtn.addEventListener('click', () => {
    renderHistory();
    historyOverlay.classList.add('show');
});

historyClose.addEventListener('click', () => {
    historyOverlay.classList.remove('show');
});

historyOverlay.addEventListener('click', (e) => {
    if (e.target === historyOverlay) {
        historyOverlay.classList.remove('show');
    }
});

// --- About ---
const aboutBtn = document.getElementById('aboutBtn');
const aboutOverlay = document.getElementById('aboutOverlay');
const aboutClose = document.getElementById('aboutClose');

aboutBtn.addEventListener('click', () => {
    aboutOverlay.classList.add('show');
});

aboutClose.addEventListener('click', () => {
    aboutOverlay.classList.remove('show');
});

aboutOverlay.addEventListener('click', (e) => {
    if (e.target === aboutOverlay) {
        aboutOverlay.classList.remove('show');
    }
});

// --- Copy Pix Key ---
const copyPixBtn = document.getElementById('copyPixBtn');
copyPixBtn.addEventListener('click', async () => {
    try {
        await navigator.clipboard.writeText('cafezinho@victormoura.dev');
    } catch {
        const temp = document.createElement('textarea');
        temp.value = 'cafezinho@victormoura.dev';
        document.body.appendChild(temp);
        temp.select();
        document.execCommand('copy');
        document.body.removeChild(temp);
    }
    copyPixBtn.style.color = '#6bcf7f';
    setTimeout(() => { copyPixBtn.style.color = ''; }, 1500);
});

let toastTimeout = null;

function showToast() {
    if (toastTimeout) {
        clearTimeout(toastTimeout);
    }
    toastProgress.style.animation = 'none';
    void toastProgress.offsetWidth; // force reflow
    toastProgress.style.animation = 'toast-timer 3s linear forwards';
    toastEl.classList.add('show');
    toastTimeout = setTimeout(() => {
        toastEl.classList.remove('show');
    }, 3000);
}

function hideToast() {
    if (toastTimeout) {
        clearTimeout(toastTimeout);
    }
    toastEl.classList.remove('show');
    toastProgress.style.animation = 'none';
}

toastClose.addEventListener('click', hideToast);

function setStatus(msg, type = '') {
    statusEl.textContent = msg;
    statusEl.className = 'status ' + type;
}

function parseLine(line) {
    line = line.trim();
    if (!line) return null;
    const match = line.match(/^(\d+)\s+(.+)$/);
    if (!match) return null;
    const qty = match[1];
    const fullName = match[2].trim();
    return { qty, fullName };
}

async function searchCard(fullName) {
    // Remove " - " pois a API trata "-" como operador de negação
    const searchTerms = fullName.replace(/\s*-\s*/g, ' ');
    const query = encodeURIComponent(searchTerms);
    const url = `https://api.lorcast.com/v0/cards/search?q=${query}`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Erro na API para "${fullName}": ${response.status}`);
    }
    const data = await response.json();
    if (!data.results || data.results.length === 0) {
        throw new Error(`Carta não encontrada: "${fullName}"`);
    }

    // Try to find exact match by name + version
    const parts = fullName.split(' - ');
    const cardName = parts[0].trim();
    const cardVersion = parts.length > 1 ? parts[1].trim() : null;

    let card = data.results[0];
    for (const result of data.results) {
        const nameMatch = result.name.toLowerCase() === cardName.toLowerCase();
        const versionMatch = cardVersion
            ? result.version && result.version.toLowerCase() === cardVersion.toLowerCase()
            : !result.version;
        if (nameMatch && versionMatch) {
            card = result;
            break;
        }
    }

    return card;
}

function formatSetCode(code) {
    return `LOR${code}`;
}

function formatOutputLine(qty, fullName, collectorNumber, setCode) {
    return `${qty} ${fullName} (${collectorNumber}) [QUALIDADE=NM][EDICAO=${formatSetCode(setCode)}]`;
}

function renderOutput(results) {
    outputEl.innerHTML = results.map(line => {
        const isError = line.includes('[ERRO:');
        const cls = isError ? 'output-line error' : 'output-line';
        return `<div class="${cls}">${escapeHtml(line)}</div>`;
    }).join('');
}

function clearOutput() {
    outputEl.innerHTML = '';
}

function getOutputText() {
    return Array.from(outputEl.querySelectorAll('.output-line'))
        .map(el => el.textContent)
        .join('\n');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// --- Clear button state management ---
function updateClearBtn() {
    clearBtn.disabled = !inputEl.value.trim();
}

inputEl.addEventListener('input', updateClearBtn);

convertBtn.addEventListener('click', async () => {
    const inputText = inputEl.value.trim();
    if (!inputText) {
        setStatus('Cole uma lista no campo de entrada.', 'error');
        return;
    }

    const lines = inputText.split('\n').filter(l => l.trim());
    const parsed = lines.map(parseLine).filter(Boolean);

    if (parsed.length === 0) {
        setStatus('Nenhuma linha válida encontrada.', 'error');
        return;
    }

    convertBtn.disabled = true;
    clearOutput();
    copyBtn.disabled = true;
    imageBtn.disabled = true;
    setStatus(`Convertendo ${parsed.length} cartas...`);

    const promises = parsed.map(async ({ qty, fullName }) => {
        try {
            const card = await searchCard(fullName);
            return formatOutputLine(qty, fullName, card.collector_number, card.set.code);
        } catch (err) {
            return `${qty} ${fullName} [ERRO: ${err.message}]`;
        }
    });

    const results = await Promise.all(promises);
    const errors = results.filter(r => r.includes('[ERRO:'));

    renderOutput(results);
    copyBtn.disabled = false;
    imageBtn.disabled = false;
    convertBtn.disabled = false;

    if (errors.length > 0) {
        setStatus(`Concluído com ${errors.length} erro(s).`, 'error');
    } else {
        setStatus(`Conversão concluída! ${parsed.length} cartas processadas.`, 'success');
    }

    // Save to history
    saveToHistory(inputText, results.join('\n'));
});

clearBtn.addEventListener('click', () => {
    inputEl.value = '';
    clearOutput();
    copyBtn.disabled = true;
    imageBtn.disabled = true;
    setStatus('');
    updateClearBtn();
});

copyBtn.addEventListener('click', async () => {
    try {
        await navigator.clipboard.writeText(getOutputText());
        showToast();
    } catch (err) {
        // Fallback: create temp textarea
        const temp = document.createElement('textarea');
        temp.value = getOutputText();
        document.body.appendChild(temp);
        temp.select();
        document.execCommand('copy');
        document.body.removeChild(temp);
        showToast();
    }
});
