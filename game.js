const BOARD_SIZE = 6;
const COLORS = ['bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-purple-500'];
let board = [];
let score = 0;
let selectedCell = null;

// ステージ定義
const stages = [
    { name: "スライム", hp: 200, attack: 10, attackTurn: 4, image: "enemy1.png" },
    { name: "ゴーレム", hp: 500, attack: 20, attackTurn: 3, image: "enemy2.png" },
    { name: "ドラゴン", hp: 800, attack: 25, attackTurn: 3, image: "enemy.png" }
];
let currentStageIndex = 0;

// HP管理変数
let playerMaxHP = 100;
let playerHP = 100;
let enemyMaxHP = stages[currentStageIndex].hp;
let enemyHP = enemyMaxHP;

let turnsCount = 0;
let poisonTurns = 0;
let isProcessingTurn = false;
let matchHappenedInTurn = false;
let comboCount = 0;

const boardElement = document.getElementById('game-board');
const scoreElement = document.getElementById('score');

// --- Audio System ---
let audioCtx = null;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function playTone(freq, type, duration, vol = 0.1) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    
    gainNode.gain.setValueAtTime(vol, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
    
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

function playSwapSound() {
    playTone(400, 'sine', 0.1, 0.05);
}

function playMatchSound(combo) {
    // コンボごとに音程が上がる
    const freq = 440 * Math.pow(1.059463, combo * 2); 
    playTone(freq, 'square', 0.15, 0.08);
}

function playDamageSound() {
    // ダメージ用のノイズっぽい音（低いノコギリ波を短く）
    playTone(100, 'sawtooth', 0.2, 0.15);
    setTimeout(() => playTone(120, 'sawtooth', 0.2, 0.15), 50);
}

function playHealSound() {
    // ピロリロンという回復音
    setTimeout(() => playTone(523.25, 'sine', 0.1, 0.1), 0); // C5
    setTimeout(() => playTone(659.25, 'sine', 0.1, 0.1), 100); // E5
    setTimeout(() => playTone(783.99, 'sine', 0.2, 0.1), 200); // G5
}
// --------------------

function initBoard() {
    for (let r = 0; r < BOARD_SIZE; r++) {
        board[r] = [];
        for (let c = 0; c < BOARD_SIZE; c++) {
            board[r][c] = COLORS[Math.floor(Math.random() * COLORS.length)];
        }
    }
    renderBoard();
}

function startGame() {
    initAudio();
    const bgm = document.getElementById('bgm');
    if (bgm) {
        bgm.volume = 0.3;
        bgm.play().catch(e => console.log("BGM file not found or autoplay blocked."));
    }

    document.getElementById('title-screen').classList.add('hidden');
    document.getElementById('title-screen').classList.remove('flex');
    document.getElementById('result-screen').classList.add('hidden');
    document.getElementById('result-screen').classList.remove('flex');
    document.getElementById('game-screen').classList.remove('hidden');
    document.getElementById('game-screen').classList.add('flex');
    
    score = 0;
    currentStageIndex = 0;
    playerHP = playerMaxHP;
    document.getElementById('score').innerText = score;
    initStage();
}

function showResult(isWin) {
    document.getElementById('game-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('flex');
    document.getElementById('result-screen').classList.remove('hidden');
    document.getElementById('result-screen').classList.add('flex');
    
    const title = document.getElementById('result-title');
    if (isWin) {
        title.innerText = "GAME CLEAR!";
        title.className = "text-6xl font-black mb-6 text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.8)]";
    } else {
        title.innerText = "GAME OVER...";
        title.className = "text-6xl font-black mb-6 text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]";
    }
    document.getElementById('result-score').innerText = score;
}

function returnToTitle() {
    const bgm = document.getElementById('bgm');
    if (bgm) {
        bgm.pause();
        bgm.currentTime = 0;
    }
    document.getElementById('result-screen').classList.add('hidden');
    document.getElementById('result-screen').classList.remove('flex');
    document.getElementById('title-screen').classList.remove('hidden');
    document.getElementById('title-screen').classList.add('flex');
}

function initStage() {
    const stageData = stages[currentStageIndex];
    enemyMaxHP = stageData.hp;
    enemyHP = enemyMaxHP;
    poisonTurns = 0;
    turnsCount = 0;
    isProcessingTurn = false;
    matchHappenedInTurn = false;
    comboCount = 0;
    
    document.getElementById('enemy-img').src = stageData.image;
    document.getElementById('enemy-name').innerText = stageData.name;
    document.getElementById('stage-indicator').innerText = `Stage ${currentStageIndex + 1}/${stages.length}`;
    
    initBoard();
    updateHP();
    updateStatusUI();
}

function updateHP() {
    document.getElementById('player-hp-bar').style.width = `${Math.max(0, (playerHP / playerMaxHP) * 100)}%`;
    document.getElementById('player-hp-text').innerText = `${Math.max(0, playerHP)} / ${playerMaxHP}`;
    
    document.getElementById('enemy-hp-bar').style.width = `${Math.max(0, (enemyHP / enemyMaxHP) * 100)}%`;
    document.getElementById('enemy-hp-text').innerText = `${Math.max(0, enemyHP)} / ${enemyMaxHP}`;
}

function renderBoard() {
    boardElement.innerHTML = '';
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            const cell = document.createElement('div');
            cell.className = `cell ${board[r][c]}`;
            cell.dataset.r = r;
            cell.dataset.c = c;
            cell.onclick = () => handleCellClick(r, c, cell);
            boardElement.appendChild(cell);
        }
    }
}

function handleCellClick(r, c, el) {
    if (!selectedCell) {
        selectedCell = { r, c, el };
        el.classList.add('selected');
    } else {
        const prev = selectedCell;
        selectedCell.el.classList.remove('selected');
        selectedCell = null;

        const dr = Math.abs(prev.r - r);
        const dc = Math.abs(prev.c - c);

        if ((dr === 1 && dc === 0) || (dr === 0 && dc === 1)) {
            swap(prev.r, prev.c, r, c);
        }
    }
}

function swap(r1, c1, r2, c2) {
    [board[r1][c1], board[r2][c2]] = [board[r2][c2], board[r1][c1]];
    playSwapSound();
    renderBoard();
    isProcessingTurn = true;
    setTimeout(checkMatches, 300);
}

function checkMatches() {
    let found = false;
    let toRemove = Array.from({length: BOARD_SIZE}, () => Array(BOARD_SIZE).fill(false));

    // 横チェック
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE - 2; c++) {
            if (board[r][c] === board[r][c+1] && board[r][c] === board[r][c+2]) {
                toRemove[r][c] = toRemove[r][c+1] = toRemove[r][c+2] = true;
                found = true;
            }
        }
    }
    // 縦チェック
    for (let c = 0; c < BOARD_SIZE; c++) {
        for (let r = 0; r < BOARD_SIZE - 2; r++) {
            if (board[r][c] === board[r+1][c] && board[r][c] === board[r+2][c]) {
                toRemove[r][c] = toRemove[r+1][c] = toRemove[r+2][c] = true;
                found = true;
            }
        }
    }

    if (found) {
        comboCount++;
        let damage = 0;
        let healAmount = 0;
        let poisonCount = 0;

        for(let r=0; r<BOARD_SIZE; r++) {
            for(let c=0; c<BOARD_SIZE; c++) {
                if(toRemove[r][c]) {
                    const color = board[r][c];
                    if (color === 'bg-green-500') healAmount += 5;
                    else if (color === 'bg-purple-500') poisonCount += 1;
                    else if (color === 'bg-red-500') damage += 7.5; // 赤は1.5倍ダメージ
                    else damage += 5;
                    
                    board[r][c] = null;
                    score += 10;
                    matchHappenedInTurn = true;
                }
            }
        }
        
        // コンボによる倍率 (1コンボ増えるごとに+30%ボーナス)
        const comboMultiplier = 1 + (comboCount - 1) * 0.3;
        damage *= comboMultiplier;
        healAmount = Math.floor(healAmount * comboMultiplier);
        
        if (comboCount > 1) {
            showPopup('player-container', `${comboCount} COMBO!`, '#ffff00');
        }
        playMatchSound(comboCount);
        
        scoreElement.innerText = score;

        // プレイヤー回復
        if (healAmount > 0) {
            playerHP += healAmount;
            if (playerHP > playerMaxHP) playerHP = playerMaxHP;
            updateHP();
            playHealSound();
            showPopup('player-container', `+${healAmount}`, '#33ff33');
        }

        // 毒付与
        if (poisonCount > 0) {
            poisonTurns += 3; // 3ターン毒
            updateStatusUI();
        }

        // 敵にダメージを与える
        if (damage > 0 && enemyHP > 0) {
            const finalDamage = Math.floor(damage);
            enemyHP -= finalDamage;
            if (enemyHP <= 0) enemyHP = 0;
            updateHP();
            
            playPlayerAttackAnimation(finalDamage);
            
            if (enemyHP === 0) {
                setTimeout(handleEnemyDefeat, 1500);
            }
        }

        dropBlocks();
        renderBoard();
        if (enemyHP > 0) {
            setTimeout(checkMatches, 300);
        }
    } else {
        if (isProcessingTurn) {
            isProcessingTurn = false;
            comboCount = 0; // コンボ数リセット
            turnsCount++;
            updateStatusUI();
            matchHappenedInTurn = false;
            
            // ターン終了処理
            setTimeout(processTurnEnd, 500);
        }
    }
}

function dropBlocks() {
    for (let c = 0; c < BOARD_SIZE; c++) {
        let writeRow = BOARD_SIZE - 1;
        for (let r = BOARD_SIZE - 1; r >= 0; r--) {
            if (board[r][c] !== null) {
                board[writeRow][c] = board[r][c];
                if (writeRow !== r) board[r][c] = null;
                writeRow--;
            }
        }
        for (let r = writeRow; r >= 0; r--) {
            board[r][c] = COLORS[Math.floor(Math.random() * COLORS.length)];
        }
    }
}

function processTurnEnd() {
    if (enemyHP <= 0 || playerHP <= 0) return;

    let delay = 0;

    // 毒ダメージ処理
    if (poisonTurns > 0) {
        poisonTurns--;
        enemyHP -= 10;
        if (enemyHP <= 0) enemyHP = 0;
        updateHP();
        updateStatusUI();
        
        playEnemyDamageAnimation(10, true);
        delay = 800;

        if (enemyHP === 0) {
            setTimeout(handleEnemyDefeat, 1000);
            return;
        }
    }

    // 敵の攻撃
    const stageData = stages[currentStageIndex];
    if (turnsCount > 0 && turnsCount % stageData.attackTurn === 0) {
        setTimeout(() => {
            const enemyDamage = stageData.attack;
            playerHP -= enemyDamage;
            if (playerHP <= 0) playerHP = 0;
            updateHP();
            
            playEnemyAttackAnimation(enemyDamage);
            
            if (playerHP === 0) {
                setTimeout(() => showResult(false), 1500);
            }
        }, delay);
    }
}

function handleEnemyDefeat() {
    if (currentStageIndex < stages.length - 1) {
        alert(`${stages[currentStageIndex].name}を倒した！\nプレイヤーのHPが全回復し、次のステージへ進みます！`);
        currentStageIndex++;
        playerHP = playerMaxHP; // 全回復
        initStage();
    } else {
        showResult(true);
    }
}

function updateStatusUI() {
    const statusEl = document.getElementById('enemy-status');
    if (statusEl) {
        if (poisonTurns > 0) {
            statusEl.innerText = `毒(${poisonTurns})`;
        } else {
            statusEl.innerText = '';
        }
    }
    const turnEl = document.getElementById('turn-counter');
    if (turnEl) turnEl.innerText = `Turn: ${turnsCount}`;
}

function showPopup(containerId, text, color) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const popup = document.createElement('div');
    popup.className = 'damage-popup';
    popup.innerText = text;
    popup.style.color = color;
    container.appendChild(popup);
    setTimeout(() => popup.remove(), 1000);
}

function playPlayerAttackAnimation(damage) {
    const playerImg = document.getElementById('player-img');
    if (playerImg) {
        playerImg.classList.remove('anim-attack');
        void playerImg.offsetWidth;
        playerImg.classList.add('anim-attack');
    }
    setTimeout(() => playEnemyDamageAnimation(damage, false), 150);
}

function showSlashEffect(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const slash = document.createElement('div');
    slash.className = 'slash-effect';
    container.appendChild(slash);
    setTimeout(() => slash.remove(), 300);
}

function playEnemyDamageAnimation(damage, isPoison) {
    const enemyImg = document.getElementById('enemy-img');
    if (enemyImg) {
        enemyImg.classList.remove('anim-damage');
        void enemyImg.offsetWidth;
        enemyImg.classList.add('anim-damage');
    }
    if (!isPoison) {
        showSlashEffect('enemy-container');
        playDamageSound();
    }
    showPopup('enemy-container', `-${damage}`, isPoison ? '#a855f7' : '#ff3333');
}

function playEnemyAttackAnimation(damage) {
    const enemyImg = document.getElementById('enemy-img');
    const playerImg = document.getElementById('player-img');
    
    if (enemyImg) {
        enemyImg.style.animation = 'none';
        void enemyImg.offsetWidth;
        enemyImg.style.animation = 'attack 0.3s ease-in-out reverse';
    }
    
    setTimeout(() => {
        if (playerImg) {
            playerImg.classList.remove('anim-damage');
            void playerImg.offsetWidth;
            playerImg.classList.add('anim-damage');
        }
        showSlashEffect('player-container');
        playDamageSound();
        showPopup('player-container', `-${damage}`, '#ff3333');
    }, 150);
}
