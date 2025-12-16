// ============================= 【全局變數與配置】 =============================
let bgm = null;
let amp = null;
const BASE_FRAME_DELAY = 6;
const GROUND_Y_RATIO = 0.85;  // ✨ 修正：將地面比例設定為 85%
let GROUND_Y;
let players = {};

// 【攝影機相關新增】
let cameraOffset = { x: 0, y: 0 };
const SCROLL_DEADZONE = 150; // 角色距離畫面邊緣 150 像素時開始捲動
const WORLD_WIDTH = 4000;    // 假設遊戲世界的總寬度為 4000 像素
// ===================================

// 【背景新增】
let backgroundImage;
// 暫存需在畫面座標繪製的對話框
let pendingDialogs = [];

// 遊戲狀態與計分
let gameStarted = false;
let score = 0;
let showInstructions = true;

function startGame() {
	gameStarted = true;
	showInstructions = false;
	score = 0;
	// 將主角放到世界中央附近並重設攝影機
	const initialCenter = WORLD_WIDTH / 2;
	if (players["1c"]) players["1c"].x = initialCenter - 250;
	if (players["3c"]) players["3c"].x = initialCenter + 50;
	if (players["4c"]) players["4c"].x = initialCenter + 250;
	cameraOffset.x = players["1c"].x - width / 2;
}

// 物理參數 (共同使用)
const MOVEMENT_SPEED = 5;
const JUMP_FORCE = -18;
const GRAVITY = 1.2;

// ====== 對話和題庫變數 ======
let quizTable;
let quizData = [];
let currentQuiz = null;
let quizResult = '';
const T_KEY = 84;
const N_KEY = 78; // N 鍵 (Next) 用於下一題/繼續
const E_KEY = 69; // E 鍵 (End) 用於結束對話 (立即)
// 狀態機：IDLE -> QUESTION -> WAITING_ANSWER -> FEEDBACK (3c 問答專用)
let dialogState = 'IDLE';
let inputElement;

// 3c 問答邏輯：追蹤是否答錯一次
let hasAnsweredWrong = false;

// 對話冷卻時間 (毫秒)
const DIALOG_COOLDOWN_MS = 1000;
let dialogCooldownEndTime = 0;

// === 4c (神奇橘子) 對話邏輯 ===
let is4cTalking = false;
const PROXIMITY_RANGE = 150;
const ORANGE_DIALOG = "我是神奇橘子";
// ===================================

// ****** 角色資料結構：CHARACTERS ******
const CHARACTERS = {
    "1c": {
        displayName: "角色 1",
        controlKeys: { left: 37, right: 39, jump: 38, run: 16, shoot: 32, fallen: 70, smile: 83, dialogTrigger: T_KEY },
        animData: {
            "idle": { path: '1c/idle/all.png', numFrames: 8, frameW: 61, frameH: 70, frames: [] },
            "run": { path: '1c/run/all.png', numFrames: 8, frameW: 61, frameH: 70, frames: [] },
            "walk": { path: '1c/walk/all.png', numFrames: 8, frameW: 61, frameH: 70, frames: [] },
            "stop": { path: '1c/idle/all.png', numFrames: 8, frameW: 61, frameH: 70, frames: [] },
            "shoot": { path: '1c/shoot/all.png', numFrames: 15, frameW: 134, frameH: 97, frames: [] },
            "jump": { path: '1c/ju/all.png', numFrames: 10, frameW: 61, frameH: 63, frames: [] },
            "fallen": { path: '1c/idle/all.png', numFrames: 8, frameW: 61, frameH: 70, frames: [] },
            "smile": { path: '1c/idle/all.png', numFrames: 8, frameW: 61, frameH: 70, frames: [] },
        }
    },
    "3c": {
        displayName: "角色 3c",
        controlKeys: { left: 65, right: 68, jump: 87, run: 82, shoot: -1, fallen: -1, smile: -1 },
        animData: {
            "idle": { path: '3c/stop/all.png', numFrames: 8, frameW: 0, frameH: 0, frames: [] },
            "walk": { path: '3c/walk/all.png', numFrames: 8, frameW: 0, frameH: 0, frames: [] },
            "stop": { path: '3c/stop/all.png', numFrames: 8, frameW: 0, frameH: 0, frames: [] },
            "run": { path: '3c/run/all.png', numFrames: 6, frameW: 0, frameH: 0, frames: [] },
            "jump": { path: '3c/jump/all.png', numFrames: 14, frameW: 0, frameH: 0, frames: [] },
            "fallen": { path: '3c/fallen/all.png', numFrames: 14, frameW: 0, frameH: 0, frames: [] },
            "smile": { path: '3c/smile/all.png', numFrames: 13, frameW: 0, frameH: 0, frames: [] },
            "shoot": { path: '3c/stop/all.png', numFrames: 8, frameW: 0, frameH: 0, frames: [] },
        }
    },
    "4c": {
        displayName: "角色 4c",
        controlKeys: { left: 74, right: 76, run: 75, jump: -1, shoot: -1, fallen: -1, smile: -1 },
        animData: {
            "idle": { path: '4c/idle/all.png', numFrames: 9, frameW: 0, frameH: 0, frames: [] },
            "walk": { path: '4c/walk/all.png', numFrames: 5, frameW: 0, frameH: 0, frames: [] },
            "stop": { path: '4c/idle/all.png', numFrames: 9, frameW: 0, frameH: 0, frames: [] },
            "run": { path: '4c/run/all.png', numFrames: 10, frameW: 0, frameH: 0, frames: [] },
        }
    }
};

// 角色類別 (Character Class)
class Character {
    constructor(key, initialX) {
        this.key = key;
        this.animSet = CHARACTERS[key].animData;
        this.controls = CHARACTERS[key].controlKeys;

        this.x = initialX; // 世界絕對 X 座標
        this.y = GROUND_Y;
        this.yVelocity = 0;

        this.isJumping = false;
        this.isShooting = false;
        this.isFallen = false;

        this.facingRight = (key === "1c");
        this.state = "idle";

        for (let animKey in this.animSet) {
            this.animSet[animKey].frameCounter = 0;
            this.animSet[animKey].currentFrame = 0;
        }
    }

    getBounds() {
        const anim = this.animSet[this.state];
        let defaultW = (this.key === "4c") ? 32 : 60;
        let defaultH = (this.key === "4c") ? 32 : 70;

        const w = anim.frameW || defaultW;
        const h = anim.frameH || defaultH;
        return {
            x: this.x - w / 2,
            y: this.y - h,
            w: w,
            h: h
        };
    }

    display(effectiveDelay) {
        const anim = this.animSet[this.state];

        if (!anim || anim.frames.length === 0) {
             if (this.state !== "idle" && this.animSet["idle"]) {
                 this.state = "idle";
                 this.animSet["idle"].currentFrame = 0;
                 this.animSet["idle"].frameCounter = 0;
             }
             return;
        }

        anim.frameCounter++;
        if (anim.frameCounter >= effectiveDelay) {
            anim.frameCounter = 0;

            if (this.state === "walk" || this.state === "idle" || this.state === "run" || this.state === "stop") {
                anim.currentFrame = (anim.currentFrame + 1) % anim.numFrames;
            } else if (this.state === "jump") {
                if (anim.currentFrame < anim.numFrames - 1) anim.currentFrame++;
            } else if (this.state === "shoot" || this.state === "fallen" || this.state === "smile") {
                anim.currentFrame++;
                if (anim.currentFrame >= anim.numFrames) {
                    if (this.state === "shoot") {
                             this.isShooting = false;
                             this.state = "idle";
                    }
                    anim.currentFrame = anim.numFrames - 1;
                }
            }
        }

        const img = anim.frames[anim.currentFrame || 0];
        const displayW = anim.frameW;
        const displayH = anim.frameH;

        push();
        // 修正 2-A: 將 X 座標取整數，消除浮點數微動
        translate(round(this.x), this.y);

        if ((this.key === "3c" || this.key === "4c") && this.state === "fallen") {
             translate(0, -displayH * 0.1);
        } else {
             translate(0, -displayH / 2);
        }

        let flip = !this.facingRight;

        if (this.key === "4c") {
             flip = this.facingRight;
        }

        if (flip) {
            scale(-1, 1);
        }

        let scaleFactor = (this.key === "4c") ? 1.5 : 1;
        image(img, 0, 0, displayW * scaleFactor, displayH * scaleFactor);

        pop();

        // 修正 2-B: 邊界約束改為針對 WORLD_WIDTH
        const halfSpriteW = (anim.frameW > 0) ? floor(anim.frameW * 0.5) : 50;
        
        // 【關鍵修正】限制角色 X 軸在世界寬度內
        this.x = constrain(this.x, halfSpriteW, WORLD_WIDTH - halfSpriteW);
    }
}

// 輔助函式：動態計算 frameW (用於 3c, 4c)
function extractFramesDynamic(anim) {
    if (!anim.sheet || anim.sheet.width < 10) return;
    anim.frameH = anim.sheet.height;

    // 修正 1: 使用 floor() 確保 frameW 是整數
    anim.frameW = floor(anim.sheet.width / anim.numFrames);

    try { anim.sheet.loadPixels(); } catch (e) { return; }
    const actualNumFrames = Math.floor(anim.sheet.width / anim.frameW);
    anim.numFrames = Math.min(anim.numFrames, actualNumFrames);
    for (let i = 0; i < anim.numFrames; i++) {
          try { anim.frames.push(anim.sheet.get(i * anim.frameW, 0, anim.frameW, anim.frameH)); } catch(e) { return; }
    }
}

// 輔助函式：固定 frameW/frameH (用於 1c)
function extractFramesFixed(anim) {
    if (!anim.sheet || anim.sheet.width < anim.frameW) return;
    try { anim.sheet.loadPixels(); } catch (e) { return; }
    const actualNumFrames = Math.floor(anim.sheet.width / anim.frameW);
    anim.numFrames = Math.min(anim.numFrames, actualNumFrames);
    for (let i = 0; i < anim.numFrames; i++) {
        try { anim.frames.push(anim.sheet.get(i * anim.frameW, 0, anim.frameW, anim.frameH)); } catch(e) { return; }
    }
}


// ============================= 【載入】 =============================
function preload() {
    // 載入背景圖片 (假設檔名為 background.png)
    try {
        backgroundImage = loadImage('background.png',
            () => console.log('背景圖片載入成功!'),
            (err) => console.error("[ERROR] 載入 background.png 失敗，將使用純色背景。", err)
        );
    } catch (e) {
        console.error("loadImage function failed or background.png is missing.", e);
    }

    // 載入角色圖
    for (let charKey in CHARACTERS) {
        const charData = CHARACTERS[charKey];
        for (let animKey in charData.animData) {
            let anim = charData.animData[animKey];
            anim.sheet = loadImage(anim.path,
                (img) => {
                    if (charKey === "3c" || charKey === "4c") { extractFramesDynamic(anim); }
                    else { extractFramesFixed(anim); }
                },
                (err) => {
                    console.error(`[ERROR] 載入失敗: ${charKey}/${animKey} - ${anim.path}`, err);
                }
            );
        }
    }
    // 載入 CSV 題庫檔案
    try {
        quizTable = loadTable('questions.csv', 'csv', 'header');
    } catch (e) {
        console.error("載入 questions.csv 失敗:", e);
    }

    // 載入音效 
    try { bgm = loadSound('music.mp3'); } catch (e) { console.warn('loadSound not available', e); }
}

// ============================= 【設定】 =============================
function setup() {
    createCanvas(windowWidth, windowHeight);
    imageMode(CENTER);
    smooth();

    GROUND_Y = height * GROUND_Y_RATIO;
    
    // 【關鍵修正】將初始位置設定在 WORLD_WIDTH 的中央附近
    const initialCenter = WORLD_WIDTH / 2; 

    players["1c"] = new Character("1c", initialCenter - 250);
    players["3c"] = new Character("3c", initialCenter + 50);
    players["4c"] = new Character("4c", initialCenter + 250);

    // 將 CSV 轉換為 JS 陣列
    if (quizTable && quizTable.getRowCount() > 0) {
        for (let i = 0; i < quizTable.getRowCount(); i++) {
            const row = quizTable.getRow(i);
            quizData.push({
                question: row.getString('題目'),
                answer: row.getString('答案'),
                feedback_correct: row.getString('答對回饋'),
                feedback_wrong: row.getString('答錯回饋'),
                hint: row.getString('提示')
            });
        }
    }

    // 創建 HTML 輸入框
    inputElement = createInput();
    inputElement.position(-1000, -1000);
    inputElement.attribute('placeholder', '請輸入答案...');
    inputElement.elt.onkeydown = function(e) {
        if (e.keyCode === ENTER || e.keyCode === RETURN) e.preventDefault();
    };

    if (bgm && bgm.setVolume) bgm.setVolume(0.6);
    try {
        amp = new p5.Amplitude();
        if (bgm) amp.setInput(bgm);
    } catch (e) {
        amp = null;
    }
}

// ============================= 【繪圖循環】 =============================
function draw() {
    const p1 = players["1c"]; // 鎖定 1c 作為主角 (攝影機追蹤對象)

    // A. 更新攝影機偏移量 (Camera Offset Update)
    
    // 1. 計算世界邊界
    const minCameraX = 0;
    const maxCameraX = WORLD_WIDTH - width;

	// 2. 讓 1c 永遠置中：攝影機直接跟隨 1c，使其在畫面中心
	cameraOffset.x = p1.x - width / 2;
	// 3. 限制攝影機偏移量 (防止捲出世界邊界)
	cameraOffset.x = constrain(cameraOffset.x, minCameraX, maxCameraX);
    
	// B. 繪製背景：先以背景色填滿畫布以避免黑邊，再繪製背景圖片，並根據 cameraOffset.x 平移背景（背景看起來在動）
	background('#FFD2D2');
	if (backgroundImage) {
		const canvasRatio = width / height;
		const imageRatio = backgroundImage.width / backgroundImage.height;
		let drawW, drawH, offsetX, offsetY;

		if (canvasRatio > imageRatio) {
			drawW = width;
			drawH = width / imageRatio;
			offsetX = 0;
			offsetY = (height - drawH) / 2;
		} else {
			drawH = height;
			drawW = height * imageRatio;
			offsetX = (width - drawW) / 2;
			offsetY = 0;
		}

		push();
		imageMode(CORNER);
		// 將背景依 cameraOffset.x 平移並水平平鋪，確保在畫面左右邊緣複製背景以填滿走道
		const drawX = offsetX - cameraOffset.x;
		// 找到一個起始 X，確保從畫面最左側開始平鋪
		let startX = drawX;
		while (startX > 0) startX -= drawW;
		for (let x = startX - drawW; x < width; x += drawW) {
			image(backgroundImage, x, offsetY, drawW, drawH);
		}
		imageMode(CENTER);
		pop();
	}

		// 若遊戲尚未開始，顯示說明並停在開始畫面
		if (!gameStarted) {
			push();
			fill(0, 160);
			rect(0, 0, width, height);
			fill(255);
			textAlign(CENTER, CENTER);
			textSize(28);
			text('遊玩方式：使用方向鍵移動、空白鍵開始、T 與 NPC 對話', width/2, height/2 - 40);
			textSize(18);
			text('與 3c 對話按 T，輸入答案後按 Enter；靠近 4c 可獲提示（答錯後）', width/2, height/2);
			textSize(20);
			text('按 空白 鍵開始遊戲', width/2, height/2 + 60);
			pop();
			return;
		}

    // C. 應用攝影機平移 (所有後續繪製都會被平移)
    // 【關鍵步驟】將整個畫布向左平移 cameraOffset.x 的距離
    push();
    translate(-cameraOffset.x, 0);

	// D. 處理地面線（已移除黑色實線，若需要可改用其他色或圖層）

    // E. 繪製所有角色 (角色仍在其世界絕對座標 this.x 上移動)
    const p3 = players["3c"];
    const p4 = players["4c"];

    const effectiveDelay = BASE_FRAME_DELAY;

    // 1. 更新角色邏輯
    updatePlayer(p1);
    updatePlayer(p3);
    updatePlayer(p4);

    // 2. 處理 3c 的朝向和狀態
    updatePlayerOrientationForDialog(p3, p1);

    // 3. 繪製角色
    p1.display(effectiveDelay);
    p3.display(effectiveDelay);
    p4.display(effectiveDelay);

    // F. 處理對話 (對話框、輸入框也應被平移)
    handleOrangeDialog(p1, p4);
    if (!is4cTalking) {
        handleQuizDialog(p1, p3);
    }

    // G. 恢復畫布狀態 (平移結束)
    pop();

	// H0. 在畫面座標繪製暫存的對話框（使對話框固定在角色上方，與攝影機無關）
	if (pendingDialogs.length > 0) {
		for (let d of pendingDialogs) {
			const screenX = d.x - cameraOffset.x;
			const screenY = d.y; // world y; we'll place dialog above this top
			drawDialogBox(screenX, screenY, d.text, d.alignment, 'top');
		}
		pendingDialogs.length = 0;
	}

    // H. 顯示提示文字 (此部分不應被平移，所以放在 pop() 之後)
    push();
    noStroke();
    fill(0, 120);
    textAlign(CENTER, TOP);
    textSize(14);
    
    let cooldownText = '';
    const isOnCooldown = millis() < dialogCooldownEndTime;
    if (isOnCooldown) {
        let remaining = ceil((dialogCooldownEndTime - millis()) / 1000);
        cooldownText = ` [冷卻中: ${remaining}s]`;
    }

	let interactionHint = (isColliding(p1, p3) && dialogState === 'IDLE' && !isOnCooldown && !is4cTalking)
											? '按 T 鍵開始對話' : '';

	let controlText = `1c (←↑→/Shift/Space/F/S/T/N/E) | 3c (W/A/D/R) | 4c (J/L/K) | 狀態: ${dialogState} | ${interactionHint} ${cooldownText} | 偏移量: ${floor(cameraOffset.x)}`;
	text(controlText, width / 2, 8);

	// 計分顯示（畫面右上）
	push();
	fill(0);
	textAlign(RIGHT, TOP);
	textSize(16);
	text(`分數: ${score}`, width - 12, 8);
	pop();
    pop();

    // I. 修正 HTML 輸入框的位置 (不受 translate 影響，需手動定位)
    if (dialogState === 'WAITING_ANSWER' && inputElement.elt.style.display !== 'none') {
        const inputW = 150;
        // 角色在畫布上的中心點 X = 角色世界 X - 攝影機偏移 X
        const canvasInputX = p1.x - cameraOffset.x - inputW / 2; 
        const canvasInputY = p1.y + 10;
        inputElement.position(canvasInputX, canvasInputY);
    }
}

// === 處理 4c 的自動對話邏輯 ===
function handleOrangeDialog(p1, p4) {
    const dist_x = abs(p1.x - p4.x);
    const DIALOG_OFFSET = 120;

    if (dist_x < PROXIMITY_RANGE) {
        is4cTalking = true;
		p4.facingRight = (p4.x < p1.x);
		// 只有在已答錯（hasAnsweredWrong）且仍在回答或回饋階段時，4c 顯示提示；否則顯示一般對話
		if (currentQuiz && hasAnsweredWrong && (dialogState === 'WAITING_ANSWER' || dialogState === 'FEEDBACK')) {
			const hintText = `提示: ${currentQuiz.hint}`;
			// 使用角色邊界頂端作為對話框基準，避免蓋住角色
			const b4 = p4.getBounds();
			pendingDialogs.push({ x: p4.x, y: b4.y - 8, text: hintText, alignment: p4.facingRight ? 'RIGHT' : 'LEFT' });
		} else {
			const b4b = p4.getBounds();
			pendingDialogs.push({ x: p4.x, y: b4b.y - 8, text: ORANGE_DIALOG, alignment: p4.facingRight ? 'RIGHT' : 'LEFT' });
		}
    } else {
        is4cTalking = false;
    }
}

// 處理單一角色的狀態/物理更新 (已整合 4c 可動修正)
function updatePlayer(player) {
    const canMove = (!player.isFallen);
    const controls = player.controls;

    // A. 物理 (跳躍和重力)
    if (player.isJumping) {
        player.y += player.yVelocity;
        player.yVelocity += GRAVITY;

        if (player.y >= GROUND_Y) {
            player.y = GROUND_Y;
            player.isJumping = false;
            player.yVelocity = 0;
            if (canMove) {
                player.state = (keyIsDown(controls.left) || keyIsDown(controls.right)) ? "walk" : "idle";
            } else {
                player.state = "idle";
            }
        }
    }

    if (!canMove) {
        if (player.state === "walk" || player.state === "run") player.state = "idle";
        return;
    }

    // B. 水平移動
    let moving = false;

    if (player.key === "4c") {
        if (keyIsDown(controls.left)) {
            player.x -= MOVEMENT_SPEED;
            player.facingRight = false;
            moving = true;
        }
        if (keyIsDown(controls.right)) {
            player.x += MOVEMENT_SPEED;
            player.facingRight = true;
            moving = true;
        }
    } else {
        if (keyIsDown(controls.left)) {
            player.x -= MOVEMENT_SPEED;
            player.facingRight = false;
            moving = true;
        }
        if (keyIsDown(controls.right)) {
            player.x += MOVEMENT_SPEED;
            player.facingRight = true;
            moving = true;
        }
    }

    // C. 狀態轉換
    const is3cInDialog = (player.key === "3c" && dialogState !== 'IDLE');

    if (player.isJumping) {
        player.state = "jump";
    } else if (player.isShooting && player.key === "1c") {
        player.state = "shoot";
    } else if (keyIsDown(controls.run) && moving) {
        player.state = "run";
    } else if (moving) {
        player.state = "walk";
    } else if (player.state !== "smile" && player.state !== "fallen" && !is3cInDialog) {

        if (player.key === "4c" && is4cTalking) {
            player.state = "idle";
        } else {
            player.state = "idle";
        }
    }

    if (player.key === "4c" && player.state !== "idle" && player.state !== "walk" && player.state !== "run" && player.state !== "stop" && !is4cTalking) {
        player.state = "idle";
    }
}

// 角色轉向邏輯 (3c)
function updatePlayerOrientationForDialog(playerToUpdate, playerReference) {
    if (playerToUpdate.key === "3c") {
        if (dialogState !== 'IDLE') {
            if (playerToUpdate.x < playerReference.x) {
                playerToUpdate.facingRight = true;
            } else if (playerToUpdate.x > playerReference.x) {
                playerToUpdate.facingRight = false;
            }

            if (!playerToUpdate.isJumping &&
                !keyIsDown(playerToUpdate.controls.left) &&
                !keyIsDown(playerToUpdate.controls.right)) {

                if (dialogState === 'FEEDBACK') {
                    playerToUpdate.state = "smile";
                } else {
                    playerToUpdate.state = "idle";
                }
            }
        }
    }
}

// 碰撞偵測函式 (AABB 碰撞)
function isColliding(pA, pB) {
    const rectA = pA.getBounds();
    const rectB = pB.getBounds();

    return (
        rectA.x < rectB.x + rectB.w &&
        rectA.x + rectA.w > rectB.x &&
        rectA.y < rectB.y + rectB.h &&
        rectA.y + rectA.h > rectB.y
    );
}

// 處理 3c 的問答系統
function handleQuizDialog(p1, p3) {
	// 允許 3c 繼續問答，即使 4c 也在附近提供提示

    const isTouching = isColliding(p1, p3);
    const DIALOG_OFFSET = 120;

	if (dialogState !== 'WAITING_ANSWER') {
		inputElement.position(-1000, -1000);
		inputElement.hide();
	}

    if (!isTouching && dialogState !== 'IDLE') {
        if (dialogState === 'QUESTION' || dialogState === 'WAITING_ANSWER' || dialogState === 'FEEDBACK') {
             dialogState = 'IDLE';
             dialogCooldownEndTime = millis() + 500;
             currentQuiz = null;
             inputElement.value('');
             hasAnsweredWrong = false;
        }
    }

    let dialogText = "";

    if (dialogState === 'IDLE') {
        const isOnCooldown = millis() < dialogCooldownEndTime;
        if (isTouching && !isOnCooldown) {
            dialogText = "按 T 鍵與我對話！";
			// 使用角色邊界頂端作為對話框基準，避免蓋住角色
			const b3 = p3.getBounds();
			pendingDialogs.push({ x: p3.x, y: b3.y - 8, text: dialogText, alignment: p3.facingRight ? 'RIGHT' : 'LEFT' });
        }
        return;
    }

    if (currentQuiz) {
        if (dialogState === 'QUESTION') {
            dialogText = currentQuiz.question;
            setTimeout(() => {
                if (dialogState === 'QUESTION') dialogState = 'WAITING_ANSWER';
            }, 500);

		} else if (dialogState === 'WAITING_ANSWER') {
			dialogText = currentQuiz.question + ` (請輸入答案)`;
			// 顯示並聚焦 HTML 輸入框，draw() 會負責把它定位到角色下方
			try { inputElement.show(); inputElement.elt.focus(); } catch (e) {}

            // HTML 輸入框定位邏輯已移至 draw() 的結尾 (I 區塊)

        } else if (dialogState === 'FEEDBACK') {

            if (hasAnsweredWrong) {
                dialogText = quizResult + ' (按 Enter 繼續)';
            } else {
                dialogText = quizResult + ' (按 Enter 結束對話或 N 鍵下一題)';
            }
        }

		const b3b = p3.getBounds();
		pendingDialogs.push({ x: p3.x, y: b3b.y - 8, text: dialogText, alignment: p3.facingRight ? 'RIGHT' : 'LEFT' });
    }
}

// 繪製對話框的輔助函式 (在世界座標中繪製)
function drawDialogBox(x, y, textContent, alignment = 'LEFT', anchor = 'center') {
	const padding = 12;
	const maxBoxW = 320;
	push();
	textSize(16);
	const lineHeight = textAscent() + textDescent() + 6;

	// 將文字做簡單換行，根據 maxBoxW 決定每行寬度
	const words = ('' + textContent).split(/\s+/);
	const lines = [];
	let cur = '';
	for (let i = 0; i < words.length; i++) {
		const w = words[i];
		const candidate = cur ? (cur + ' ' + w) : w;
		if (textWidth(candidate) + padding * 2 > maxBoxW) {
			if (cur) lines.push(cur);
			cur = w;
		} else {
			cur = candidate;
		}
	}
	if (cur) lines.push(cur);

	// 計算實際寬度與高度
	let maxLineW = 0;
	for (let l of lines) maxLineW = max(maxLineW, textWidth(l));
	const boxW = constrain(maxLineW + padding * 2, 120, maxBoxW);
	const boxH = lines.length * lineHeight + padding * 2;

	rectMode(CENTER);
	textAlign(CENTER, CENTER);

	let centerY = y;
	if (anchor === 'top') {
		// 將 y 視為角色上邊界，將對話框放在此上方
		centerY = y - boxH / 2 - 6;
	}

	fill(255, 255, 200, 240);
	stroke(0);
	strokeWeight(2);
	rect(x, centerY, boxW, boxH, 10);

	// 箭頭位置（在框底部中間偏左或偏右）
	const triY = centerY + boxH / 2;
	if (alignment === 'LEFT') {
		triangle(x - boxW / 2 + 14, triY, x - 12, triY, x - 22, triY + 10);
	} else {
		triangle(x + boxW / 2 - 14, triY, x + 12, triY, x + 22, triY + 10);
	}

	// 繪製每一行文字（從上到下）
	fill(0);
	const startY = centerY - boxH / 2 + padding + lineHeight / 2;
	for (let i = 0; i < lines.length; i++) {
		text(lines[i], x, startY + i * lineHeight);
	}
	pop();
}

// ============================= 【鍵盤輸入】 =============================
function keyPressed() {
    if (bgm && !bgm.isPlaying()) {
        try { bgm.loop(); } catch (e) { bgm.play(); }
    }

	// 若尚未開始遊戲，按空白開始
	if (!gameStarted && keyCode === 32) {
		startGame();
		return false;
	}

    const p1 = players["1c"];
    const p3 = players["3c"];

    const isTouching = isColliding(p1, p3);
    const isOnCooldown = millis() < dialogCooldownEndTime;

    // --- E 鍵處理結束對話 (立即) ---
    if (keyCode === E_KEY) {
        if (dialogState !== 'IDLE') {
            dialogState = 'IDLE';
            currentQuiz = null;
            hasAnsweredWrong = false;
            inputElement.value('');
            dialogCooldownEndTime = millis() + DIALOG_COOLDOWN_MS; // 預設 1 秒冷卻
            p3.state = "idle";
            return false;
        }
    }

    // --- N 鍵處理下一題 ---
    if (keyCode === N_KEY) {
        if (dialogState === 'FEEDBACK' && currentQuiz && hasAnsweredWrong === false) {
            if (quizData.length > 0) {
                const randomIndex = floor(random(quizData.length));
                currentQuiz = quizData[randomIndex];

                dialogState = 'QUESTION';
                hasAnsweredWrong = false;
                inputElement.value('');
                dialogCooldownEndTime = millis();
            } else {
                dialogState = 'IDLE';
                currentQuiz = null;
                dialogCooldownEndTime = millis() + DIALOG_COOLDOWN_MS;
            }
            return false;
        }
    }

    // --- T 鍵觸發對話 ---
    if (keyCode === p1.controls.dialogTrigger) {
        if (!is4cTalking) {
            if (isTouching && dialogState === 'IDLE' && !isOnCooldown && quizData.length > 0) {
                const randomIndex = floor(random(quizData.length));
                currentQuiz = quizData[randomIndex];
                dialogState = 'QUESTION';

                hasAnsweredWrong = false;

                p1.state = "idle";
                inputElement.value('');
                inputElement.elt.focus();
                return false;
            }
        }
    }

    // --- ENTER 鍵處理答案和回饋 (關鍵修正區塊) ---
    if (keyCode === ENTER || keyCode === RETURN || keyCode === 13) {
        if (dialogState === 'WAITING_ANSWER' && currentQuiz) {
            const userAnswer = inputElement.value().trim();
            // 修正：確保答案比對也使用 trim()，避免空白字元影響
            const correctAnswer = currentQuiz.answer.trim(); 

            if (userAnswer.length > 0) {
				if (userAnswer === correctAnswer) {
					quizResult = currentQuiz.feedback_correct;
					dialogState = 'FEEDBACK';
					inputElement.elt.blur();
					hasAnsweredWrong = false; // 答對
					score += 1; // 增加分數
				} else {
					hasAnsweredWrong = true;
					quizResult = currentQuiz.feedback_wrong;
					dialogState = 'FEEDBACK';
					inputElement.elt.blur();
				}
            }
            return false;
        } else if (dialogState === 'FEEDBACK') {

            if (hasAnsweredWrong) {
                // 答錯 -> 按 Enter -> 回到 WAITING_ANSWER (顯示提示/重試)
                dialogState = 'WAITING_ANSWER';
                inputElement.elt.focus();
                inputElement.value('');
            } else {
                // 答對 (hasAnsweredWrong=false) -> 按 Enter -> 結束對話並冷卻 3 秒
                dialogState = 'IDLE';
                currentQuiz = null;
                dialogCooldownEndTime = millis() + 3000; // 3 秒冷卻
                inputElement.value('');
            }
            return false;
        }
    }

    // --- 角色控制輸入 (保持不變) ---
    // ------------------ 1c 動作 ------------------
    if (!p1.isFallen) {
        if (keyCode === p1.controls.jump && !p1.isJumping) {
            p1.isJumping = true;
            p1.yVelocity = JUMP_FORCE;
            p1.state = "jump";
            p1.animSet["jump"].currentFrame = 0;
            if (p1.isShooting) p1.isShooting = false;
        }
        if (keyCode === p1.controls.shoot && !p1.isShooting) {
            p1.isShooting = true;
            p1.animSet["shoot"].currentFrame = 0;
        }
        if (keyCode === p1.controls.fallen) {
            p1.isFallen = true;
            p1.state = "fallen";
            p1.animSet["fallen"].currentFrame = 0;
        }
        if (keyCode === p1.controls.smile) {
            p1.state = "smile";
            p1.animSet["smile"].currentFrame = 0;
            p1.isShooting = false;
        }
    }

    // ------------------ 3c 動作 ------------------
    if (!p3.isFallen) {
        if (keyCode === p3.controls.jump && !p3.isJumping) {
            p3.isJumping = true;
            p3.yVelocity = JUMP_FORCE;
            p3.state = "jump";
            p3.animSet["jump"].currentFrame = 0;
        }
    }

    // ------------------ 4c 動作 ------------------
    const p4 = players["4c"];
    if (!p4.isFallen) {
        if (keyCode === p4.controls.jump && !p4.isJumping) {
            p4.isJumping = true;
            p4.yVelocity = JUMP_FORCE;
            p4.state = "jump";
            if(p4.animSet["jump"]) p4.animSet["jump"].currentFrame = 0;
        }
    }

    // ESC 鍵重設倒下狀態
    if (keyCode === ESCAPE || keyCode === 27) {
        if (p1.isFallen) {
            p1.isFallen = false;
            p1.state = "idle";
            if (!p1.isJumping) p1.y = GROUND_Y;
        }
        if (p3.isFallen) {
            p3.isFallen = false;
            p3.state = "idle";
            if (!p3.isJumping) p3.y = GROUND_Y;
        }
        if (p4.isFallen) {
            p4.isFallen = false;
            p4.state = "idle";
            if (!p4.isJumping) p4.y = GROUND_Y;
        }
    }
}

function keyReleased() {
    const p1 = players["1c"];
    const p3 = players["3c"];
    const p4 = players["4c"];

    if (!p1.isJumping && p1.state !== "smile" && !p1.isShooting) {
             if (keyCode === p1.controls.left || keyCode === p1.controls.right || keyCode === p1.controls.run) {
                 if (!keyIsDown(p1.controls.left) && !keyIsDown(p1.controls.right)) {
                     p1.state = "idle";
                 }
             }
    }

    if (!p3.isJumping && p3.state !== "smile") {
             if (keyCode === p3.controls.left || keyCode === p3.controls.right || keyCode === p3.controls.run) {
                 if (!keyIsDown(p3.controls.left) && !keyIsDown(p3.controls.right)) {
                     p3.state = "idle";
                 }
             }
    }

    if (!p4.isJumping) {
        if (p4.state !== "idle" && p4.state !== "jump") {
             if (keyCode === p4.controls.left || keyCode === p4.controls.right || keyCode === p4.controls.run) {
                 if (!keyIsDown(p4.controls.left) && !keyIsDown(p4.controls.right)) {
                     p4.state = "idle";
                 }
             }
        }
    }
}

function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
    
    // 重新計算地面位置
    GROUND_Y = height * GROUND_Y_RATIO;
    for (let key in players) {
        if (!players[key].isJumping) players[key].y = GROUND_Y;
    }
    
    // 窗口大小改變時，重新計算攝影機偏移量的限制
    const maxCameraX = WORLD_WIDTH - width;
    cameraOffset.x = constrain(cameraOffset.x, 0, maxCameraX);
}