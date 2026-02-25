// Game State
let currentData = null;
let solvedIndices = new Set();
let timerInterval = null;
let startTime = 0;
let isPlaying = false;

// DOM Elements
const portalView = document.getElementById('portal-view');
const gameView = document.getElementById('game-view');
const topicListEl = document.getElementById('topic-list');
const backToPortalBtns = document.querySelectorAll('.back-to-portal-btn');
const topicTitleEls = document.querySelectorAll('#topic-title, #start-topic-desc');
const timeDisplayEl = document.getElementById('time-display');
const scoreDisplayEl = document.getElementById('score-display');
const answerInputEl = document.getElementById('answer-input');
const answersGridEl = document.getElementById('answers-grid');
const giveupBtn = document.getElementById('giveup-btn');

// Modals
const startModal = document.getElementById('start-modal');
const startBtn = document.getElementById('start-btn');
const resultModal = document.getElementById('result-modal');
const resultTitle = document.getElementById('result-title');
const resultScore = document.getElementById('result-score');
const resultTotal = document.getElementById('result-total');
const resultMessage = document.getElementById('result-message');
const retryBtn = document.getElementById('retry-btn');
const closeResultBtn = document.getElementById('close-result-btn');

// Create Topic Elements
const openCreateModalBtn = document.getElementById('open-create-modal-btn');
const createTopicModal = document.getElementById('create-topic-modal');
const newTopicTitle = document.getElementById('new-topic-title');
const newTopicItem = document.getElementById('new-topic-item');
const newTopicItemList = document.getElementById('new-topic-item-list');
const newTopicCount = document.getElementById('new-topic-count');
const createTopicError = document.getElementById('create-topic-error');
const saveTopicBtn = document.getElementById('save-topic-btn');
const cancelTopicBtn = document.getElementById('cancel-topic-btn');

let pendingCustomAnswers = [];

// Initialize Portal List
async function initPortal() {
    portalView.style.display = 'flex';
    gameView.style.display = 'none';
    topicListEl.innerHTML = '<p>読み込み中...</p>';

    try {
        const response = await fetch('/api/topics');
        if (!response.ok) throw new Error('Failed to fetch topics');
        const allTopics = await response.json();

        topicListEl.innerHTML = '';
        allTopics.forEach(topic => {
            const btn = document.createElement('div');
            btn.className = 'topic-card';

            // Setup Card HTML (with delete button if custom)
            const isCustom = topic.id.startsWith('custom_');
            btn.innerHTML = `
                <div class="topic-card-header">
                    <h3>${topic.title}</h3>
                    ${isCustom ? `<button class="delete-topic-btn" data-id="${topic.id}">🗑️</button>` : ''}
                </div>
                <p>全 ${topic.answers.length} 問</p>
            `;

            // Click to play
            btn.addEventListener('click', (e) => {
                if (e.target.closest('.delete-topic-btn')) return; // handled separately
                initGame(topic);
            });

            // Delete Logic
            if (isCustom) {
                const delBtn = btn.querySelector('.delete-topic-btn');
                delBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (confirm(`「${topic.title}」を削除しますか？`)) {
                        deleteCustomTopic(topic.id);
                    }
                });
            }

            topicListEl.appendChild(btn);
        });
    } catch (e) {
        console.error("Failed to load topics", e);
        topicListEl.innerHTML = '<p class="error-text">お題の読み込みに失敗しました。サーバーが起動しているか確認してください。</p>';
    }
}

async function deleteCustomTopic(id) {
    try {
        const response = await fetch(`/api/topics/${id}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Failed to delete topic');
        initPortal(); // Refresh UI
    } catch (e) {
        console.error("Failed to delete topic", e);
        alert('削除に失敗しました。');
    }
}

function initGame(data) {
    portalView.style.display = 'none';
    gameView.style.display = 'flex';

    currentData = data;
    solvedIndices.clear();
    isPlaying = false;
    clearInterval(timerInterval);

    // Update UI text
    topicTitleEls.forEach(el => el.textContent = `お題：${data.title} (${data.answers.length}個)`);
    timeDisplayEl.textContent = "00:00.00";
    updateStatusUI();

    // Generate Grid
    answersGridEl.innerHTML = '';
    data.answers.forEach((_, index) => {
        const cell = document.createElement('div');
        cell.className = 'answer-cell';
        cell.dataset.index = index;
        cell.textContent = '?';
        answersGridEl.appendChild(cell);
    });

    answerInputEl.value = '';
    answerInputEl.disabled = true;
    giveupBtn.disabled = true;

    // Show start modal
    startModal.classList.add('active');
    resultModal.classList.remove('active');
}

function startGame() {
    startModal.classList.remove('active');
    isPlaying = true;
    answerInputEl.disabled = false;
    giveupBtn.disabled = false;
    answerInputEl.focus();

    // Remove placeholder '?'
    const cells = answersGridEl.querySelectorAll('.answer-cell');
    cells.forEach(cell => cell.textContent = '');

    startTimer();
}

function startTimer() {
    startTime = Date.now();
    updateTimeDisplay();
    timerInterval = setInterval(() => {
        updateTimeDisplay();
    }, 10);
}

function updateTimeDisplay() {
    const elapsed = Date.now() - startTime;
    const minutes = Math.floor(elapsed / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);
    const ms = Math.floor((elapsed % 1000) / 10);
    timeDisplayEl.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}

function updateStatusUI() {
    scoreDisplayEl.textContent = `${solvedIndices.size} / ${currentData.answers.length}`;
}

function handleInput(e) {
    if (!isPlaying) return;

    const inputValue = e.target.value.trim();
    if (!inputValue) return;

    for (let i = 0; i < currentData.answers.length; i++) {
        if (solvedIndices.has(i)) continue;

        const answerVariations = currentData.answers[i];
        if (answerVariations.some(variation => variation === inputValue || variation === inputValue.replace(/\s+/g, ''))) {
            markAsSolved(i);

            // Clear input and FIX IME leftover bug by briefly bluring and refocusing
            e.target.value = '';
            e.target.blur();
            setTimeout(() => {
                if (isPlaying) e.target.focus();
            }, 10);

            if (solvedIndices.size === currentData.answers.length) {
                endGame('clear');
            }
            return;
        }
    }
}

function markAsSolved(index) {
    solvedIndices.add(index);
    const cell = answersGridEl.querySelector(`.answer-cell[data-index="${index}"]`);
    if (cell) {
        cell.textContent = currentData.answers[index][0];
        cell.classList.add('solved');
    }
    updateStatusUI();
}

function endGame(reason) {
    isPlaying = false;
    clearInterval(timerInterval);
    answerInputEl.disabled = true;
    giveupBtn.disabled = true;

    const cells = answersGridEl.querySelectorAll('.answer-cell');
    cells.forEach((cell, index) => {
        if (!solvedIndices.has(index)) {
            cell.textContent = currentData.answers[index][0];
            cell.classList.add('giveup');
        }
    });

    resultScore.textContent = solvedIndices.size;
    resultTotal.textContent = `/ ${currentData.answers.length}`;

    if (reason === 'clear') {
        resultTitle.textContent = '全問正解！';
        resultTitle.style.color = 'var(--secondary-color)';
        resultMessage.textContent = `素晴らしい！${currentData.title}をパーフェクトクリア！ クリアタイム: ${timeDisplayEl.textContent}`;
    } else if (reason === 'giveup') {
        resultTitle.textContent = 'ギブアップ';
        resultTitle.style.color = 'var(--giveup-text)';
        resultMessage.textContent = `答えを確認して、次はもっと答えよう！ タイム: ${timeDisplayEl.textContent}`;
    }

    setTimeout(() => {
        resultModal.classList.add('active');
    }, 1000);
}

// Event Listeners
startBtn.addEventListener('click', startGame);
answerInputEl.addEventListener('input', handleInput);
giveupBtn.addEventListener('click', () => {
    if (confirm('本当にギブアップしますか？未解答の答えが表示されます。')) {
        endGame('giveup');
    }
});

retryBtn.addEventListener('click', () => {
    initGame(currentData);
});
closeResultBtn.addEventListener('click', () => {
    resultModal.classList.remove('active');
});

backToPortalBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        clearInterval(timerInterval);
        isPlaying = false;
        resultModal.classList.remove('active');
        initPortal();
    });
});

// Create Topic Logic
openCreateModalBtn.addEventListener('click', () => {
    // Reset Form
    newTopicTitle.value = '';
    newTopicItem.value = '';
    pendingCustomAnswers = [];
    renderPendingItems();
    createTopicError.textContent = '';
    createTopicModal.classList.add('active');
    setTimeout(() => newTopicTitle.focus(), 100);
});

cancelTopicBtn.addEventListener('click', () => {
    createTopicModal.classList.remove('active');
});

newTopicItem.addEventListener('keydown', (e) => {
    // If user presses Enter without composing IME, or if it's Enter and the input is blurred, we catch it.
    // simpler approach: look for 'Enter' and prevent default if there's text. (IME usually halts the pure Enter until resolved, but checking isComposing is safer).
    if (e.key === 'Enter' && !e.isComposing) {
        e.preventDefault();
        const rawValue = newTopicItem.value.trim();
        if (rawValue) {
            // Add as an array containing the single term as its only valid answer representation
            pendingCustomAnswers.push([rawValue]);
            newTopicItem.value = '';
            renderPendingItems();
        }
    }
});

function renderPendingItems() {
    newTopicItemList.innerHTML = '';
    newTopicCount.textContent = pendingCustomAnswers.length;

    pendingCustomAnswers.forEach((answerSet, index) => {
        const li = document.createElement('li');
        li.className = 'item-tag';
        // The first element is the display/primary answer
        const primaryTerm = answerSet[0];

        const span = document.createElement('span');
        span.textContent = primaryTerm;

        const closeBtn = document.createElement('button');
        closeBtn.className = 'remove-tag-btn';
        closeBtn.innerHTML = '×';
        closeBtn.addEventListener('click', () => {
            pendingCustomAnswers.splice(index, 1);
            renderPendingItems();
        });

        li.appendChild(span);
        li.appendChild(closeBtn);
        newTopicItemList.appendChild(li);
    });
}

saveTopicBtn.addEventListener('click', async () => {
    saveTopicBtn.disabled = true;
    createTopicError.textContent = '保存中...';

    const title = newTopicTitle.value.trim();
    if (!title) {
        createTopicError.textContent = 'エラー: お題のタイトルを入力してください';
        saveTopicBtn.disabled = false;
        newTopicTitle.focus();
        return;
    }
    if (pendingCustomAnswers.length === 0) {
        createTopicError.textContent = 'エラー: 少なくとも1つの答えを追加してください';
        saveTopicBtn.disabled = false;
        newTopicItem.focus();
        return;
    }

    const newTopic = {
        id: 'custom_' + Date.now().toString(),
        title: title,
        answers: pendingCustomAnswers
    };

    try {
        const response = await fetch('/api/topics', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newTopic)
        });

        if (!response.ok) throw new Error('Failed to save topic');

        createTopicModal.classList.remove('active');
        initPortal(); // Refresh List
    } catch (e) {
        createTopicError.textContent = 'エラー: 保存に失敗しました（サーバー通信エラー等）';
        console.error(e);
    } finally {
        saveTopicBtn.disabled = false;
    }
});
// Start initially with the portal screen
initPortal();
