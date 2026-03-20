const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const statusContainer = document.getElementById('status-container');
const resultContainer = document.getElementById('result-container');
const transcriptionText = document.getElementById('transcription-text');
const copyBtn = document.getElementById('copy-btn');

dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    if (e.dataTransfer.files.length) {
        handleFile(e.dataTransfer.files[0]);
    }
});

fileInput.addEventListener('change', () => {
    if (fileInput.files.length) {
        handleFile(fileInput.files[0]);
    }
});

async function handleFile(file) {
    if (!file.type.startsWith('audio/')) {
        alert('Por favor, selecione um arquivo de áudio.');
        return;
    }

    // Reset UI
    statusContainer.classList.remove('hidden');
    resultContainer.classList.add('hidden');
    dropZone.classList.add('hidden');

    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch('/transcribe', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) throw new Error('Falha na transcrição');

        const data = await response.json();
        transcriptionText.textContent = data.text;
        resultContainer.classList.remove('hidden');
    } catch (err) {
        alert('Erro ao processar áudio: ' + err.message);
        dropZone.classList.remove('hidden');
    } finally {
        statusContainer.classList.add('hidden');
    }
}

copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(transcriptionText.textContent);
    copyBtn.textContent = 'Copiado!';
    setTimeout(() => copyBtn.textContent = 'Copiar', 2000);
});
