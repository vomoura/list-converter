const inputEl = document.getElementById('input');
const outputEl = document.getElementById('output');
const convertBtn = document.getElementById('convertBtn');
const copyBtn = document.getElementById('copyBtn');
const statusEl = document.getElementById('status');
const toastEl = document.getElementById('toast');
const toastClose = document.getElementById('toastClose');
const toastProgress = document.getElementById('toastProgress');

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
    outputEl.value = '';
    copyBtn.disabled = true;
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

    outputEl.value = results.join('\n');
    copyBtn.disabled = false;
    convertBtn.disabled = false;

    if (errors.length > 0) {
        setStatus(`Concluído com ${errors.length} erro(s).`, 'error');
    } else {
        setStatus(`Conversão concluída! ${parsed.length} cartas processadas.`, 'success');
    }
});

copyBtn.addEventListener('click', async () => {
    try {
        await navigator.clipboard.writeText(outputEl.value);
        showToast();
    } catch (err) {
        outputEl.select();
        document.execCommand('copy');
        showToast();
    }
});
