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
const newTopicItemDisplay = document.getElementById('new-topic-item-display');
const newTopicItemHiragana = document.getElementById('new-topic-item-hiragana');
const newTopicItemAlt = document.getElementById('new-topic-item-alt');
const addTopicItemBtn = document.getElementById('add-topic-item-btn');
const newTopicItemList = document.getElementById('new-topic-item-list');
const newTopicCount = document.getElementById('new-topic-count');
const createTopicError = document.getElementById('create-topic-error');
const saveTopicBtn = document.getElementById('save-topic-btn');
const cancelTopicBtn = document.getElementById('cancel-topic-btn');

let pendingCustomAnswers = [];
let editingTopicId = null;

const aiPromptInput = document.getElementById('ai-prompt-input');
const aiGenerateBtn = document.getElementById('ai-generate-btn');

// --- Auth & Leaderboard Elements ---
const authBtn = document.getElementById('auth-btn');
const authModal = document.getElementById('auth-modal');
const authTitle = document.getElementById('auth-title');
const authUsername = document.getElementById('auth-username');
const authPassword = document.getElementById('auth-password');
const authError = document.getElementById('auth-error');
const authActionBtn = document.getElementById('auth-action-btn');
const authToggleBtn = document.getElementById('auth-toggle-btn');
const authCancelBtn = document.getElementById('auth-cancel-btn');

const mypageModal = document.getElementById('mypage-modal');
const mypageUsernameDisplay = document.getElementById('mypage-username-display');
const mypageTopicList = document.getElementById('mypage-topic-list');
const logoutBtn = document.getElementById('logout-btn');
const mypageCloseBtn = document.getElementById('mypage-close-btn');

const leaderboardModal = document.getElementById('leaderboard-modal');
const leaderboardTitle = document.getElementById('leaderboard-title');
const leaderboardList = document.getElementById('leaderboard-list');
const leaderboardCloseBtn = document.getElementById('leaderboard-close-btn');

// State for Auth
let currentUser = JSON.parse(localStorage.getItem('ierukana_user')) || null;
let isLoginMode = true;

// Initialize Portal List
async function initPortal() {
    portalView.style.display = 'flex';
    gameView.style.display = 'none';
    topicListEl.innerHTML = '<p>読み込み中...</p>';

    try {
        // Force the browser to fetch the latest version and never cache the result
        const response = await fetch('/api/topics?_t=' + Date.now(), { cache: 'no-store' });
        if (!response.ok) throw new Error('Failed to fetch topics');
        const allTopics = await response.json();

        topicListEl.innerHTML = '';
        allTopics.forEach(topic => {
            const btn = document.createElement('div');
            btn.className = 'topic-card';

            // Setup Card HTML (with delete button if custom)
            const isCustom = topic.id.startsWith('custom_');
            const authorSpan = topic.authorName ? `<span style="font-size: 0.8rem; opacity: 0.8; display: block; margin-top: 0.2rem;">✍️ 作者: ${topic.authorName}</span>` : '';
            const ownershipEdit = (isCustom && currentUser && topic.authorId === currentUser.id) ?
                `<div style="display:flex;gap:0.5rem;"><button class="edit-topic-btn" style="background:none;border:none;cursor:pointer;font-size:1.2rem;opacity:0.5;transition:opacity 0.2s;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.5" data-id="${topic.id}">✏️</button><button class="delete-topic-btn" data-id="${topic.id}">🗑️</button></div>` : '';

            btn.innerHTML = `
                <div class="topic-card-header">
                    <div>
                        <h3>${topic.title}</h3>
                        ${authorSpan}
                    </div>
                    <div style="display:flex;gap:0.5rem;align-items:center;">
                        <button class="rank-topic-btn" style="background:none;border:none;cursor:pointer;font-size:1.5rem;opacity:0.8;transition:opacity 0.2s;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.8" data-id="${topic.id || topic.title}" title="ランキング">🏆</button>
                        ${ownershipEdit}
                    </div>
                </div>
                <p>全 ${topic.answers.length} 問</p>
            `;

            // Click to play
            btn.addEventListener('click', (e) => {
                if (e.target.closest('.delete-topic-btn') || e.target.closest('.edit-topic-btn') || e.target.closest('.rank-topic-btn')) return; // handled separately
                initGame(topic);
            });

            // Ranking Logic
            const rankBtn = btn.querySelector('.rank-topic-btn');
            rankBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                showLeaderboard(topic.id || topic.title, topic.title);
            });

            // Delete Logic
            if (isCustom && currentUser && topic.authorId === currentUser.id) {
                const delBtn = btn.querySelector('.delete-topic-btn');
                delBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (confirm(`「${topic.title}」を削除しますか？`)) {
                        deleteCustomTopic(topic.id);
                    }
                });

                const editBtn = btn.querySelector('.edit-topic-btn');
                editBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openEditModal(topic);
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
        const response = await fetch(`/api/topics?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
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
        fireConfetti();

        // Submit to Leaderboard if logged in
        if (currentUser) {
            submitLeaderboard(currentData.id || currentData.title, timeDisplayEl.textContent);
        } else {
            resultMessage.textContent += ' (ログインするとランキングに登録できるよ！)';
        }
    } else if (reason === 'giveup') {
        resultTitle.textContent = 'ギブアップ';
        resultTitle.style.color = 'var(--giveup-text)';
        resultMessage.textContent = `答えを確認して、次はもっと答えよう！ タイム: ${timeDisplayEl.textContent}`;
    }

    setTimeout(() => {
        resultModal.classList.add('active');
    }, 1500); // Give a bit more time for the initial confetti burst
}

function fireConfetti() {
    var duration = 3000;
    var animationEnd = Date.now() + duration;
    var defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 2000 };

    function randomInRange(min, max) {
        return Math.random() * (max - min) + min;
    }

    var interval = setInterval(function () {
        var timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
            return clearInterval(interval);
        }

        var particleCount = 50 * (timeLeft / duration);
        // since particles fall down, start a bit higher than random
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
    }, 250);
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
function openEditModal(topic = null) {
    createTopicError.textContent = '';
    if (topic) {
        editingTopicId = topic.id;
        newTopicTitle.value = topic.title;
        // Deep copy the answers
        pendingCustomAnswers = JSON.parse(JSON.stringify(topic.answers));
        document.querySelector('#create-topic-modal h2').textContent = 'お題を編集する';
    } else {
        editingTopicId = null;
        newTopicTitle.value = '';
        pendingCustomAnswers = [];
        document.querySelector('#create-topic-modal h2').textContent = '新しいお題を作る';
    }

    newTopicItemDisplay.value = '';
    newTopicItemHiragana.value = '';
    newTopicItemAlt.value = '';
    aiPromptInput.value = '';

    renderPendingItems();
    createTopicModal.classList.add('active');
    setTimeout(() => newTopicTitle.focus(), 100);
}

openCreateModalBtn.addEventListener('click', () => openEditModal());

cancelTopicBtn.addEventListener('click', () => {
    createTopicModal.classList.remove('active');
});

function addPendingItem() {
    const displayVal = newTopicItemDisplay.value.trim();
    const hiraganaVal = newTopicItemHiragana.value.trim();
    const altVal = newTopicItemAlt.value.trim();

    if (!displayVal || !hiraganaVal) {
        createTopicError.textContent = '表示名とひらがなの両方を入力してください。';
        return;
    }

    createTopicError.textContent = '';
    const answerSet = [displayVal, hiraganaVal];
    if (altVal) {
        // Split by comma, trim whitespace, remove empty strings
        const alts = altVal.split(',').map(s => s.trim()).filter(s => s);
        answerSet.push(...alts);
    }

    pendingCustomAnswers.push(answerSet);

    newTopicItemDisplay.value = '';
    newTopicItemHiragana.value = '';
    newTopicItemAlt.value = '';
    renderPendingItems();
    newTopicItemDisplay.focus();
}

addTopicItemBtn.addEventListener('click', addPendingItem);

newTopicItemDisplay.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.isComposing) {
        e.preventDefault();
        newTopicItemHiragana.focus();
    }
});

newTopicItemHiragana.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.isComposing) {
        e.preventDefault();
        newTopicItemAlt.focus();
    }
});

newTopicItemAlt.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.isComposing) {
        e.preventDefault();
        addPendingItem();
    }
});

aiGenerateBtn.addEventListener('click', async () => {
    const promptText = aiPromptInput.value.trim();
    if (!promptText) {
        createTopicError.textContent = '自動生成するテーマ（例: ジブリ映画）を入力してください。';
        return;
    }

    aiGenerateBtn.disabled = true;
    const originalText = aiGenerateBtn.textContent;
    aiGenerateBtn.textContent = '✨ 生成中...';
    createTopicError.textContent = '';

    try {
        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: promptText })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || '生成に失敗しました');
        }

        if (data.title && Array.isArray(data.answers)) {
            newTopicTitle.value = data.title;
            // Merge or overwrite answers? Let's append to be safe or overwrite if empty
            if (pendingCustomAnswers.length === 0) {
                pendingCustomAnswers = data.answers;
            } else {
                pendingCustomAnswers.push(...data.answers);
            }
            renderPendingItems();
            aiPromptInput.value = '';
        } else {
            throw new Error('予期しないデータ形式が返されました');
        }

    } catch (e) {
        console.error(e);
        createTopicError.textContent = '生成エラー: ' + e.message;
    } finally {
        aiGenerateBtn.disabled = false;
        aiGenerateBtn.textContent = originalText;
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
        const hiraganaTerm = answerSet[1];

        const span = document.createElement('span');
        span.textContent = `${primaryTerm} (${hiraganaTerm})`;
        if (answerSet.length > 2) {
            span.textContent += ` [+別解${answerSet.length - 2}]`;
        }

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
        id: editingTopicId || ('custom_' + Date.now().toString()),
        title: title,
        answers: pendingCustomAnswers
    };

    if (currentUser) {
        newTopic.authorId = currentUser.id;
        newTopic.authorName = currentUser.username;
    }

    try {
        const method = editingTopicId ? 'PUT' : 'POST';
        const response = await fetch('/api/topics', {
            method: method,
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
// --- Auth and Leaderboard Logic ---
updateAuthUI();

function updateAuthUI() {
    if (currentUser) {
        authBtn.textContent = '🏠 マイページ';
    } else {
        authBtn.textContent = '🔑 ログイン';
    }
}

authBtn.addEventListener('click', () => {
    if (currentUser) {
        showMyPage();
    } else {
        isLoginMode = true;
        updateAuthModalUI();
        authModal.classList.add('active');
        authUsername.focus();
    }
});

function updateAuthModalUI() {
    authTitle.textContent = isLoginMode ? 'ログイン' : '新規登録';
    authActionBtn.textContent = isLoginMode ? 'ログインする' : '登録する';
    authToggleBtn.textContent = isLoginMode ? 'アカウントが無い方は 新規登録' : 'すでにアカウントをお持ちの方は ログイン';
    authError.textContent = '';
    authUsername.value = '';
    authPassword.value = '';
}

authToggleBtn.addEventListener('click', () => {
    isLoginMode = !isLoginMode;
    updateAuthModalUI();
});

authCancelBtn.addEventListener('click', () => {
    authModal.classList.remove('active');
});

authActionBtn.addEventListener('click', async () => {
    const un = authUsername.value.trim();
    const pw = authPassword.value.trim();
    if (!un || !pw) {
        authError.textContent = 'ユーザーネームとパスワードを入力してください。';
        return;
    }

    authActionBtn.disabled = true;
    authError.textContent = '通信中...';
    try {
        const action = isLoginMode ? 'login' : 'register';
        const res = await fetch(`/api/auth?action=${action}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: un, password: pw })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'エラーが発生しました');

        currentUser = data.user;
        localStorage.setItem('ierukana_user', JSON.stringify(currentUser));
        updateAuthUI();
        authModal.classList.remove('active');
        initPortal(); // Refresh to show editing rights etc.
    } catch (e) {
        authError.textContent = e.message;
    } finally {
        authActionBtn.disabled = false;
    }
});

function showMyPage() {
    mypageUsernameDisplay.textContent = currentUser.username;
    mypageModal.classList.add('active');

    // Fetch and filter user's topics
    mypageTopicList.innerHTML = '<p>読み込み中...</p>';
    fetch('/api/topics?_t=' + Date.now())
        .then(res => res.json())
        .then(topics => {
            const myTopics = topics.filter(t => t.authorId === currentUser.id);
            if (myTopics.length === 0) {
                mypageTopicList.innerHTML = '<p>作成したお題はまだありません。</p>';
                return;
            }
            mypageTopicList.innerHTML = '';
            myTopics.forEach(t => {
                const item = document.createElement('div');
                item.className = 'topic-card';
                item.style.padding = '1rem';
                item.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <strong>${t.title}</strong>
                        <div>
                            <button class="btn btn-secondary btn-sm" onclick="openEditModal(${JSON.stringify(t).replace(/"/g, '&quot;')})">編集</button>
                            <button class="btn btn-secondary btn-sm" onclick="if(confirm('削除しますか？')) deleteCustomTopic('${t.id}')">削除</button>
                        </div>
                    </div>
                `;
                mypageTopicList.appendChild(item);
            });
        })
        .catch(() => mypageTopicList.innerHTML = '<p>読み込みエラー</p>');
}

mypageCloseBtn.addEventListener('click', () => mypageModal.classList.remove('active'));

logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('ierukana_user');
    currentUser = null;
    mypageModal.classList.remove('active');
    updateAuthUI();
    initPortal(); // Refresh display
});

leaderboardCloseBtn.addEventListener('click', () => leaderboardModal.classList.remove('active'));

async function showLeaderboard(topicId, topicTitle) {
    leaderboardTitle.textContent = `${topicTitle} - ランキング`;
    leaderboardList.innerHTML = '<p style="text-align:center;">読み込み中...</p>';
    leaderboardModal.classList.add('active');

    try {
        const res = await fetch(`/api/leaderboard?action=get&topicId=${encodeURIComponent(topicId)}&_t=` + Date.now(), { cache: 'no-store' });
        const data = await res.json();
        leaderboardList.innerHTML = '';

        if (data.length === 0) {
            leaderboardList.innerHTML = '<p style="text-align:center; opacity:0.7;">まだ記録がありません。一番乗りを目指そう！</p>';
            return;
        }

        data.forEach((run, index) => {
            const timeStr = formatMsAsTime(run.clearTime);
            const dateStr = new Date(run.date).toLocaleDateString();
            const li = document.createElement('li');
            li.style.padding = '0.75rem';
            li.style.background = 'rgba(255,255,255,0.05)';
            li.style.borderRadius = '8px';
            li.style.display = 'flex';
            li.style.justifyContent = 'space-between';
            li.style.alignItems = 'center';

            let rankMedal = `${index + 1}位`;
            if (index === 0) rankMedal = '🥇 1位';
            if (index === 1) rankMedal = '🥈 2位';
            if (index === 2) rankMedal = '🥉 3位';

            li.innerHTML = `
                <div><span style="font-weight:bold; color:var(--secondary-color); margin-right:0.5rem;">${rankMedal}</span> ${run.username}</div>
                <div style="text-align:right;">
                    <div style="font-weight:bold; font-family:monospace; font-size:1.1rem;">${timeStr}</div>
                    <div style="font-size:0.7rem; opacity:0.6;">${dateStr}</div>
                </div>
            `;
            leaderboardList.appendChild(li);
        });
    } catch (e) {
        leaderboardList.innerHTML = '<p style="color:#ff5555; text-align:center;">ランキングの取得に失敗しました。</p>';
    }
}

// Convert "MM:SS.ms" to milliseconds integer for storing
function parseTimeStr(timeStr) {
    const parts = timeStr.split(':');
    const min = parseInt(parts[0], 10);
    const secParts = parts[1].split('.');
    const sec = parseInt(secParts[0], 10);
    const ms10 = parseInt(secParts[1], 10); // it's hundreths (0-99) roughly
    return (min * 60000) + (sec * 1000) + (ms10 * 10);
}

// Convert milliseconds integer back to "MM:SS.ms"
function formatMsAsTime(elapsed) {
    const minutes = Math.floor(elapsed / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);
    const ms = Math.floor((elapsed % 1000) / 10);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}

async function submitLeaderboard(topicId, timeStr) {
    const timeMs = parseTimeStr(timeStr);
    try {
        await fetch(`/api/leaderboard?action=submit&topicId=${encodeURIComponent(topicId)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUser.id, username: currentUser.username, clearTime: timeMs })
        });
        // Wait a small bit, then show leaderboard
        setTimeout(() => {
            showLeaderboard(topicId, currentData.title);
        }, 1500);
    } catch (e) {
        console.error('Failed to submit score to leaderboard', e);
    }
}

// Start initially with the portal screen
initPortal();
