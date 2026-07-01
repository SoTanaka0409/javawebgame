const BOARD_SIZE = 6;
const COLORS = ['bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-pink-500', 'bg-purple-500'];
let board = [];
let score = 0;
let selectedCell = null;

// ステージ定義 (属性を追加)
const stages = [
    { name: "スライム", hp: 200, attack: 10, attackTurn: 4, image: "enemy1.png", element: "water" },
    { name: "ゴーレム", hp: 500, attack: 20, attackTurn: 3, image: "enemy2.png", element: "wood" },
    { name: "ドラゴン", hp: 800, attack: 25, attackTurn: 3, image: "enemy.png", element: "fire" }
];
let currentStageIndex = 0;

// HP管理変数
let playerMaxHP = 100;
let playerHP = 100;
let playerMaxMP = 100;
let playerMP = 0;
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
    const freq = 440 * Math.pow(1.059463, combo * 2); 
    playTone(freq, 'square', 0.15, 0.08);
}

function playDamageSound() {
    playTone(100, 'sawtooth', 0.2, 0.15);
    setTimeout(() => playTone(120, 'sawtooth', 0.2, 0.15), 50);
}

function playHealSound() {
    setTimeout(() => playTone(523.25, 'sine', 0.1, 0.1), 0); 
    setTimeout(() => playTone(659.25, 'sine', 0.1, 0.1), 100); 
    setTimeout(() => playTone(783.99, 'sine', 0.2, 0.1), 200); 
}
// --------------------

function createCell(color) {
    return { color: color, locked: false, burning: false };
}

function initBoard() {
    for (let r = 0; r < BOARD_SIZE; r++) {
        board[r] = [];
        for (let c = 0; c < BOARD_SIZE; c++) {
            board[r][c] = createCell(COLORS[Math.floor(Math.random() * COLORS.length)]);
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
    playerMP = 0;
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
    document.getElementById('result-score').innerText = Math.floor(score);
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
    updateMP();
    updateStatusUI();
}

function updateHP() {
    document.getElementById('player-hp-bar').style.width = `${Math.max(0, (playerHP / playerMaxHP) * 100)}%`;
    document.getElementById('player-hp-text').innerText = `HP: ${Math.max(0, playerHP)}`;
    
    document.getElementById('enemy-hp-bar').style.width = `${Math.max(0, (enemyHP / enemyMaxHP) * 100)}%`;
    document.getElementById('enemy-hp-text').innerText = `${Math.max(0, enemyHP)} / ${enemyMaxHP}`;
}

function updateMP() {
    document.getElementById('player-mp-bar').style.width = `${Math.max(0, (playerMP / playerMaxMP) * 100)}%`;
    document.getElementById('player-mp-text').innerText = `MP: ${Math.max(0, playerMP)}`;
    
    // スキルボタンの状態更新
    const btn1 = document.getElementById('skill-btn-1');
    const btn2 = document.getElementById('skill-btn-2');
    const btn3 = document.getElementById('skill-btn-3');
    
    if (playerMP >= 30 && !isProcessingTurn) { btn1.classList.remove('opacity-50', 'cursor-not-allowed'); } 
    else { btn1.classList.add('opacity-50', 'cursor-not-allowed'); }
    
    if (playerMP >= 40 && !isProcessingTurn) { btn2.classList.remove('opacity-50', 'cursor-not-allowed'); } 
    else { btn2.classList.add('opacity-50', 'cursor-not-allowed'); }
    
    if (playerMP >= 20 && !isProcessingTurn) { btn3.classList.remove('opacity-50', 'cursor-not-allowed'); } 
    else { btn3.classList.add('opacity-50', 'cursor-not-allowed'); }
}

function renderBoard() {
    renderBoardWithDrops(null);
}

function renderBoardWithDrops(dropDistances) {
    boardElement.innerHTML = '';
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            const cellData = board[r][c];
            const cell = document.createElement('div');
            cell.className = `cell ${cellData.color}`;
            
            if (cellData.locked) cell.classList.add('locked');
            if (cellData.burning) cell.classList.add('burning');
            
            cell.dataset.r = r;
            cell.dataset.c = c;
            cell.onclick = () => handleCellClick(r, c, cell);
            
            if (dropDistances && dropDistances[r][c] > 0) {
                cell.style.setProperty('--drop-dist', dropDistances[r][c]);
                cell.classList.add('anim-drop');
            }
            
            boardElement.appendChild(cell);
        }
    }
}

function handleCellClick(r, c, el) {
    if (isProcessingTurn) return;
    if (board[r][c].locked) return; // ロック状態は選択不可
    
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
            // 交換先のセルもロック確認
            if (board[r][c].locked) return;
            swap(prev.r, prev.c, r, c);
        }
    }
}

function swap(r1, c1, r2, c2) {
    // 炎上ギミック処理
    if (board[r1][c1].burning || board[r2][c2].burning) {
        playerHP -= 10;
        if (playerHP < 0) playerHP = 0;
        updateHP();
        showPopup('player-container', '-10', '#ff0000');
        playDamageSound();
    }

    [board[r1][c1], board[r2][c2]] = [board[r2][c2], board[r1][c1]];
    playSwapSound();
    renderBoard();
    isProcessingTurn = true;
    updateMP(); // ボタンを無効化
    setTimeout(processCombos, 300);
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function processCombos() {
    let found = false;
    let toRemove = Array.from({length: BOARD_SIZE}, () => Array(BOARD_SIZE).fill(false));

    // 横チェック
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE - 2; c++) {
            const c1 = board[r][c] ? board[r][c].color : null;
            const c2 = board[r][c+1] ? board[r][c+1].color : null;
            const c3 = board[r][c+2] ? board[r][c+2].color : null;
            if (c1 && c1 !== 'bg-stone-500' && c1 === c2 && c1 === c3) {
                toRemove[r][c] = toRemove[r][c+1] = toRemove[r][c+2] = true;
                found = true;
            }
        }
    }
    // 縦チェック
    for (let c = 0; c < BOARD_SIZE; c++) {
        for (let r = 0; r < BOARD_SIZE - 2; r++) {
            const c1 = board[r][c] ? board[r][c].color : null;
            const c2 = board[r+1][c] ? board[r+1][c].color : null;
            const c3 = board[r+2][c] ? board[r+2][c].color : null;
            if (c1 && c1 !== 'bg-stone-500' && c1 === c2 && c1 === c3) {
                toRemove[r][c] = toRemove[r+1][c] = toRemove[r+2][c] = true;
                found = true;
            }
        }
    }

    if (!found) {
        if (isProcessingTurn) {
            isProcessingTurn = false;
            comboCount = 0;
            turnsCount++;
            updateStatusUI();
            matchHappenedInTurn = false;
            setTimeout(processTurnEnd, 500);
        }
        return;
    }

    // 岩ブロックの爆風判定
    let newToRemove = Array.from({length: BOARD_SIZE}, () => Array(BOARD_SIZE).fill(false));
    for(let r=0; r<BOARD_SIZE; r++) {
        for(let c=0; c<BOARD_SIZE; c++) {
            newToRemove[r][c] = toRemove[r][c];
        }
    }
    for(let r=0; r<BOARD_SIZE; r++) {
        for(let c=0; c<BOARD_SIZE; c++) {
            if(toRemove[r][c]) {
                const adjs = [[r-1,c], [r+1,c], [r,c-1], [r,c+1]];
                for(let [ar, ac] of adjs) {
                    if (ar >= 0 && ar < BOARD_SIZE && ac >= 0 && ac < BOARD_SIZE) {
                        if (board[ar][ac] && board[ar][ac].color === 'bg-stone-500') {
                            newToRemove[ar][ac] = true;
                        }
                    }
                }
            }
        }
    }
    toRemove = newToRemove;

    // クラスターの抽出
    let clusters = [];
    let visited = Array.from({length: BOARD_SIZE}, () => Array(BOARD_SIZE).fill(false));
    
    function floodFill(r, c, color, currentCluster) {
        if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) return;
        if (!toRemove[r][c] || visited[r][c] || board[r][c].color !== color) return;
        visited[r][c] = true;
        currentCluster.push({r, c});
        floodFill(r+1, c, color, currentCluster);
        floodFill(r-1, c, color, currentCluster);
        floodFill(r, c+1, color, currentCluster);
        floodFill(r, c-1, color, currentCluster);
    }

    for(let r=0; r<BOARD_SIZE; r++) {
        for(let c=0; c<BOARD_SIZE; c++) {
            if (toRemove[r][c] && !visited[r][c]) {
                let cluster = [];
                floodFill(r, c, board[r][c].color, cluster);
                if (cluster.length > 0) {
                    cluster.color = board[r][c].color; 
                    clusters.push(cluster);
                }
            }
        }
    }

    let totalDamage = 0;
    let totalHeal = 0;
    let totalPoison = 0;

    for (let cluster of clusters) {
        // 岩ブロックの単独破壊はコンボに含めない
        if (cluster.color !== 'bg-stone-500') {
            comboCount++;
        }
        
        const color = cluster.color;
        let damage = 0;
        let healAmount = 0;
        let poisonCount = 0;

        for (let cell of cluster) {
            if (color === 'bg-pink-500') healAmount += 5;
            else if (color === 'bg-purple-500') poisonCount += 1;
            else if (color !== 'bg-stone-500') {
                // 属性ダメージ計算
                const enemyElem = stages[currentStageIndex].element;
                let base = 5;
                if (color === 'bg-red-500') {
                    if (enemyElem === 'wood') base *= 2;
                    else if (enemyElem === 'water') base *= 0.5;
                } else if (color === 'bg-green-500') {
                    if (enemyElem === 'water') base *= 2;
                    else if (enemyElem === 'fire') base *= 0.5;
                } else if (color === 'bg-blue-500') {
                    if (enemyElem === 'fire') base *= 2;
                    else if (enemyElem === 'wood') base *= 0.5;
                }
                damage += base;
            }
            
            // MP回復
            if (color !== 'bg-stone-500') {
                playerMP += 1;
            }
            
            const domCell = boardElement.querySelector(`[data-r="${cell.r}"][data-c="${cell.c}"]`);
            if (domCell) domCell.classList.add('anim-pop');
        }

        const comboMultiplier = 1 + (comboCount > 0 ? (comboCount - 1) * 0.3 : 0);
        totalDamage += damage * comboMultiplier;
        totalHeal += Math.floor(healAmount * comboMultiplier);
        totalPoison += poisonCount;
        
        score += cluster.length * 10 * comboMultiplier;
        matchHappenedInTurn = true;
        
        if (comboCount > 1 && color !== 'bg-stone-500') {
            const firstCell = cluster[0];
            showComboPopupOnBoard(firstCell.r, firstCell.c, `${comboCount} COMBO!`, '#ffff00');
        }
        if (color !== 'bg-stone-500') {
            playMatchSound(comboCount);
        } else {
            playDamageSound(); // 岩が壊れる音
        }
        scoreElement.innerText = Math.floor(score);

        await sleep(300);
    }

    if (playerMP > playerMaxMP) playerMP = playerMaxMP;
    updateMP();

    for(let r=0; r<BOARD_SIZE; r++) {
        for(let c=0; c<BOARD_SIZE; c++) {
            if(toRemove[r][c]) {
                board[r][c] = null;
            }
        }
    }

    if (totalHeal > 0) {
        playerHP += totalHeal;
        if (playerHP > playerMaxHP) playerHP = playerMaxHP;
        updateHP();
        playHealSound();
        showPopup('player-container', `+${totalHeal}`, '#33ff33');
    }
    if (totalPoison > 0) {
        poisonTurns += 3;
        updateStatusUI();
    }
    if (totalDamage > 0 && enemyHP > 0) {
        const finalDamage = Math.floor(totalDamage);
        enemyHP -= finalDamage;
        if (enemyHP <= 0) enemyHP = 0;
        updateHP();
        playPlayerAttackAnimation(finalDamage);
    }

    if (enemyHP === 0) {
        setTimeout(handleEnemyDefeat, 1500);
        return; 
    }

    let dropDistances = dropBlocks();
    renderBoardWithDrops(dropDistances);
    
    await sleep(400); 
    processCombos();
}

function dropBlocks() {
    let dropDistances = Array.from({length: BOARD_SIZE}, () => Array(BOARD_SIZE).fill(0));
    
    for (let c = 0; c < BOARD_SIZE; c++) {
        let writeRow = BOARD_SIZE - 1;
        let nullCount = 0;
        for (let r = BOARD_SIZE - 1; r >= 0; r--) {
            if (board[r][c] === null) {
                nullCount++;
            } else {
                board[writeRow][c] = board[r][c];
                if (writeRow !== r) {
                    board[r][c] = null;
                    dropDistances[writeRow][c] = writeRow - r;
                }
                writeRow--;
            }
        }
        for (let r = writeRow; r >= 0; r--) {
            board[r][c] = createCell(COLORS[Math.floor(Math.random() * COLORS.length)]);
            dropDistances[r][c] = nullCount;
        }
    }
    return dropDistances;
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

    // 敵の攻撃とギミック
    const stageData = stages[currentStageIndex];
    if (turnsCount > 0 && turnsCount % stageData.attackTurn === 0) {
        setTimeout(() => {
            const enemyDamage = stageData.attack;
            playerHP -= enemyDamage;
            if (playerHP <= 0) playerHP = 0;
            updateHP();
            
            playEnemyAttackAnimation(enemyDamage);
            
            setTimeout(applyEnemyGimmick, 500);

            if (playerHP === 0) {
                setTimeout(() => showResult(false), 2000);
            } else {
                updateMP(); // ターン終了時にボタン復帰
            }
        }, delay);
    } else {
        updateMP(); // ターン終了時にボタン復帰
    }
}

function applyEnemyGimmick() {
    const stageData = stages[currentStageIndex];
    let targets = [];
    while(targets.length < 3) {
        let r = Math.floor(Math.random() * BOARD_SIZE);
        let c = Math.floor(Math.random() * BOARD_SIZE);
        if (!targets.some(t => t.r === r && t.c === c) && board[r][c].color !== 'bg-stone-500') {
            targets.push({r, c});
        }
    }
    
    if (stageData.name === "スライム") {
        targets.forEach(t => board[t.r][t.c].locked = true);
        showPopup('enemy-container', '粘液バインド！', '#3b82f6');
    } else if (stageData.name === "ゴーレム") {
        targets.forEach(t => {
            board[t.r][t.c].color = 'bg-stone-500';
            board[t.r][t.c].locked = false;
            board[t.r][t.c].burning = false;
        });
        showPopup('enemy-container', '岩石落とし！', '#78716c');
    } else if (stageData.name === "ドラゴン") {
        targets.forEach(t => board[t.r][t.c].burning = true);
        showPopup('enemy-container', '炎上！', '#ef4444');
    }
    renderBoard();
}

function useSkill(type) {
    if (isProcessingTurn) return;
    
    if (type === 1 && playerMP >= 30) {
        playerMP -= 30;
        updateMP();
        isProcessingTurn = true;
        
        let toRemove = Array.from({length: BOARD_SIZE}, () => Array(BOARD_SIZE).fill(false));
        for(let i=0; i<BOARD_SIZE; i++) {
            toRemove[i][2] = toRemove[i][3] = true;
            toRemove[2][i] = toRemove[3][i] = true;
        }
        showSlashEffect('game-board');
        playDamageSound();
        executeSkillDestruction(toRemove, 50);
        
    } else if (type === 2 && playerMP >= 40) {
        playerMP -= 40;
        updateMP();
        playerHP += Math.floor(playerMaxHP / 2);
        if (playerHP > playerMaxHP) playerHP = playerMaxHP;
        updateHP();
        playHealSound();
        showPopup('player-container', 'HEAL!', '#f472b6');
        
    } else if (type === 3 && playerMP >= 20) {
        playerMP -= 20;
        updateMP();
        initBoard();
        playSwapSound();
        showPopup('player-container', 'SHUFFLE!', '#3b82f6');
    }
}

async function executeSkillDestruction(toRemove, extraDamage) {
    for(let r=0; r<BOARD_SIZE; r++) {
        for(let c=0; c<BOARD_SIZE; c++) {
            if(toRemove[r][c]) {
                const domCell = boardElement.querySelector(`[data-r="${r}"][data-c="${c}"]`);
                if (domCell) domCell.classList.add('anim-pop');
            }
        }
    }
    await sleep(300);
    
    for(let r=0; r<BOARD_SIZE; r++) {
        for(let c=0; c<BOARD_SIZE; c++) {
            if(toRemove[r][c]) {
                board[r][c] = null;
            }
        }
    }
    
    if (extraDamage > 0) {
        enemyHP -= extraDamage;
        if (enemyHP < 0) enemyHP = 0;
        updateHP();
        playPlayerAttackAnimation(extraDamage);
    }
    
    if (enemyHP === 0) {
        setTimeout(handleEnemyDefeat, 1500);
        return; 
    }
    
    let dropDistances = dropBlocks();
    renderBoardWithDrops(dropDistances);
    await sleep(400);
    processCombos();
}

function handleEnemyDefeat() {
    if (currentStageIndex < stages.length - 1) {
        alert(`${stages[currentStageIndex].name}を倒した！\nプレイヤーのHPが全回復し、次のステージへ進みます！`);
        currentStageIndex++;
        playerHP = playerMaxHP; 
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

function showComboPopupOnBoard(r, c, text, color) {
    const board = document.getElementById('game-board');
    if (!board) return;
    const popup = document.createElement('div');
    popup.className = 'combo-popup text-3xl font-black italic drop-shadow-[0_0_5px_rgba(0,0,0,1)]';
    popup.innerText = text;
    popup.style.color = color;
    
    const top = 33 + r * 54;
    const left = 33 + c * 54;
    popup.style.top = top + 'px';
    popup.style.left = left + 'px';
    
    board.appendChild(popup);
    setTimeout(() => popup.remove(), 800);
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
