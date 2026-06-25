// ─────────────────────────────────────────────
//  rhythm.js  –  Circuit Rhythm Minigame Logic
// ─────────────────────────────────────────────

let rhythmActive = false;
let resultSent   = false;  // guard: prevent double result firing
let rhythmNotes  = [];
let currentCombo = 0;
let maxCombo     = 0;
let totalScore   = 0;
let totalNotes   = 0;
let notesHit     = 0;
let wrongKeyCount = 0;
let missedNotes  = 0;
let lastHitTime  = 0;
let gameProgress = 0;

let noteSpeed    = 300;
let noteSpawnRate = 1000;
let requiredNotes = 20;
let maxWrongKeys  = 5;
let maxMissedNotes = 3;

let spawnInterval;
let animFrameId;
let lastFrameTime = 0;

// Timing windows (px distance from hit-zone center)
const timingWindows = { perfect: 10, great: 20, okay: 35 };
const scoreValues   = { perfect: 100, great: 50, okay: 20 };

let rhythmConfig = {
    lanes: 4,
    keys: ['A', 'S', 'D', 'J'],
    noteSpeed: 300,
    noteSpawnRate: 1000,
    requiredNotes: 20,
    maxWrongKeys: 5,
    maxMissedNotes: 3
};

// ── Setup ────────────────────────────────────

function setupRhythmGame(config) {
    rhythmConfig = {
        lanes:         config?.lanes         || 4,
        keys:          config?.keys          || ['A','S','D','J'],
        noteSpeed:     config?.noteSpeed     || 300,
        noteSpawnRate: config?.noteSpawnRate || 1000,
        requiredNotes: config?.requiredNotes || 20,
        maxWrongKeys:  config?.maxWrongKeys  || 5,
        maxMissedNotes:config?.maxMissedNotes|| 3
    };

    // Clamp keys array to lanes count
    while (rhythmConfig.keys.length < rhythmConfig.lanes)
        rhythmConfig.keys.push(String.fromCharCode(65 + rhythmConfig.keys.length));
    rhythmConfig.keys = rhythmConfig.keys.slice(0, rhythmConfig.lanes);

    noteSpeed      = rhythmConfig.noteSpeed;
    noteSpawnRate  = rhythmConfig.noteSpawnRate;
    requiredNotes  = rhythmConfig.requiredNotes;
    maxWrongKeys   = rhythmConfig.maxWrongKeys;
    maxMissedNotes = rhythmConfig.maxMissedNotes;

    resetRhythmGame();
}

function buildRhythmUI() {
    const highway      = document.querySelector('.rhythm-highway');
    const keyIndicators = document.querySelector('.key-indicators');
    if (!highway || !keyIndicators) return;

    highway.innerHTML      = '';
    keyIndicators.innerHTML = '';

    for (let i = 0; i < rhythmConfig.lanes; i++) {
        // Lane
        const lane = document.createElement('div');
        lane.className = 'rhythm-lane';
        lane.dataset.lane = i;

        const feedback = document.createElement('div');
        feedback.className = 'rhythm-feedback';
        feedback.dataset.lane = i;
        lane.appendChild(feedback);

        highway.appendChild(lane);

        // Key indicator
        const ki = document.createElement('div');
        ki.className = 'key-indicator';
        ki.dataset.lane = i;
        ki.textContent = rhythmConfig.keys[i];
        keyIndicators.appendChild(ki);
    }
}

function resetRhythmGame() {
    currentCombo  = 0;
    maxCombo      = 0;
    totalScore    = 0;
    totalNotes    = 0;
    notesHit      = 0;
    wrongKeyCount = 0;
    missedNotes   = 0;
    gameProgress  = 0;
    rhythmNotes   = [];

    const scoreEl = document.getElementById('rhythm-score');
    const comboEl = document.getElementById('combo-number');
    const msgEl   = document.getElementById('rhythm-message');
    const progEl  = document.querySelector('.rhythm-progress');

    if (scoreEl) scoreEl.textContent = '0';
    if (comboEl) comboEl.textContent = '0';
    if (msgEl)   msgEl.textContent   = 'Hit the notes in sync';
    if (progEl)  progEl.style.width  = '0%';
}

// ── Spawn & Movement ─────────────────────────

function spawnNote() {
    if (!rhythmActive) return;

    const lane     = Math.floor(Math.random() * rhythmConfig.lanes);
    const highway  = document.querySelector('.rhythm-highway');
    const laneEl   = highway?.querySelectorAll('.rhythm-lane')[lane];
    if (!laneEl) return;

    const note = document.createElement('div');
    note.className = 'rhythm-note';
    note.style.top = '-24px';
    laneEl.appendChild(note);

    rhythmNotes.push({ element: note, lane, position: -24, hit: false });
    totalNotes++;
}

function gameLoop(timestamp) {
    if (!rhythmActive) return;

    const delta = lastFrameTime ? (timestamp - lastFrameTime) / 1000 : 0;
    lastFrameTime = timestamp;

    const moveAmount = noteSpeed * delta;
    const hitZone    = document.querySelector('.hit-zone');
    if (!hitZone) { animFrameId = requestAnimationFrame(gameLoop); return; }

    const hitZoneTop = hitZone.offsetTop;

    for (let i = rhythmNotes.length - 1; i >= 0; i--) {
        const note = rhythmNotes[i];
        if (note.hit) continue;

        note.position += moveAmount;
        note.element.style.top = note.position + 'px';

        // Missed
        if (note.position > hitZoneTop + 55) {
            showFeedback(note.lane, 'miss');
            breakCombo();
            missedNotes++;

            const msgEl = document.getElementById('rhythm-message');
            if (msgEl) msgEl.textContent = `Missed ${missedNotes}/${maxMissedNotes} allowed`;

            note.element.remove();
            rhythmNotes.splice(i, 1);

            if (missedNotes >= maxMissedNotes) {
                stopRhythmGame(false);
                return;
            }
        }
    }

    animFrameId = requestAnimationFrame(gameLoop);
}

// ── Input ────────────────────────────────────

function handleRhythmKeyPress(e) {
    if (!rhythmActive) return;

    const key       = String.fromCharCode(e.keyCode).toUpperCase();
    const laneIndex = rhythmConfig.keys.indexOf(key);
    if (laneIndex === -1) return;

    // Visual key press
    const ki = document.querySelectorAll('.key-indicator')[laneIndex];
    if (ki) ki.classList.add('active');

    const hitZone    = document.querySelector('.hit-zone');
    const hitZoneTop = hitZone ? hitZone.offsetTop : 0;

    let closestNote  = null;
    let closestDist  = Infinity;
    let closestIdx   = -1;

    rhythmNotes.forEach((note, idx) => {
        if (note.lane === laneIndex && !note.hit) {
            const dist = Math.abs(note.position - hitZoneTop);
            if (dist < closestDist) {
                closestDist = dist;
                closestNote = note;
                closestIdx  = idx;
            }
        }
    });

    if (closestNote) {
        let timing = null;
        if (closestDist <= timingWindows.perfect)      timing = 'perfect';
        else if (closestDist <= timingWindows.great)   timing = 'great';
        else if (closestDist <= timingWindows.okay)    timing = 'okay';

        if (timing) {
            closestNote.hit = true;
            closestNote.element.remove();
            rhythmNotes.splice(closestIdx, 1);

            updateScore(timing);
            increaseCombo();
            showFeedback(laneIndex, timing);
            notesHit++;
            updateProgressBar();
            lastHitTime = Date.now();
        } else {
            // Key pressed but note too far — treat as wrong
            wrongKeyCount++;
            breakCombo();
            showFeedback(laneIndex, 'miss');
            if (wrongKeyCount >= maxWrongKeys) stopRhythmGame(false);
        }
    } else {
        // No note in lane
        wrongKeyCount++;
        breakCombo();
        showFeedback(laneIndex, 'miss');
        if (wrongKeyCount >= maxWrongKeys) stopRhythmGame(false);
    }
}

function handleRhythmKeyRelease(e) {
    if (!rhythmActive) return;
    const key       = String.fromCharCode(e.keyCode).toUpperCase();
    const laneIndex = rhythmConfig.keys.indexOf(key);
    if (laneIndex === -1) return;
    const ki = document.querySelectorAll('.key-indicator')[laneIndex];
    if (ki) ki.classList.remove('active');
}

// ── Score / Combo ────────────────────────────

function updateScore(timing) {
    const multiplier = Math.floor(currentCombo / 10) + 1;
    totalScore += scoreValues[timing] * multiplier;
    const el = document.getElementById('rhythm-score');
    if (el) el.textContent = totalScore;
}

function increaseCombo() {
    currentCombo++;
    if (currentCombo > maxCombo) maxCombo = currentCombo;
    const el = document.getElementById('combo-number');
    if (el) {
        el.textContent = currentCombo;
        if (currentCombo > 0 && currentCombo % 10 === 0) {
            el.classList.add('combo-highlight');
            setTimeout(() => el.classList.remove('combo-highlight'), 500);
        }
    }
}

function breakCombo() {
    currentCombo = 0;
    const el = document.getElementById('combo-number');
    if (el) el.textContent = '0';
}

function showFeedback(lane, timing) {
    const fb = document.querySelector(`.rhythm-feedback[data-lane="${lane}"]`);
    if (!fb) return;
    fb.textContent = timing.toUpperCase();
    fb.className   = `rhythm-feedback feedback-${timing} feedback-show`;
    fb.dataset.lane = lane;
    clearTimeout(fb._timer);
    fb._timer = setTimeout(() => fb.classList.remove('feedback-show'), 500);
}

function updateProgressBar() {
    gameProgress = Math.min(100, Math.round((notesHit / requiredNotes) * 100));
    const bar = document.querySelector('.rhythm-progress');
    if (bar) bar.style.width = gameProgress + '%';
    if (notesHit >= requiredNotes) stopRhythmGame(true);
}

// ── Start / Stop ─────────────────────────────

function startRhythmGame() {
    rhythmActive  = true;
    resultSent    = false;  // reset for new game
    lastFrameTime = 0;

    buildRhythmUI();
    resetRhythmGame();

    spawnInterval = setInterval(spawnNote, noteSpawnRate);
    animFrameId   = requestAnimationFrame(gameLoop);

    document.addEventListener('keydown', handleRhythmKeyPress);
    document.addEventListener('keyup',   handleRhythmKeyRelease);
}

function stopRhythmGame(success) {
    if (resultSent) return;  // already sent — ignore duplicate call
    rhythmActive = false;
    resultSent   = true;

    clearInterval(spawnInterval);
    cancelAnimationFrame(animFrameId);

    document.removeEventListener('keydown', handleRhythmKeyPress);
    document.removeEventListener('keyup',   handleRhythmKeyRelease);

    const msgEl = document.getElementById('rhythm-message');
    if (success) {
        if (msgEl) msgEl.textContent = 'SYNCHRONIZATION COMPLETE!';
    } else {
        if (msgEl) msgEl.textContent =
            missedNotes >= maxMissedNotes  ? 'FAILED — Too many missed notes.' :
            wrongKeyCount >= maxWrongKeys  ? 'FAILED — Too many wrong inputs.' :
                                             'FAILED — Circuit overloaded.';
    }

    setTimeout(() => {
        const accuracy = totalNotes > 0 ? Math.round((notesHit / totalNotes) * 100) : 0;
        const result   = { success, score: totalScore, maxCombo, notesHit, totalNotes, accuracy, _session: _sessionId };

        fetch(`https://${GetParentResourceName()}/rhythmResult`, {
            method: 'POST',
            body: JSON.stringify(result)
        });

        const container = document.getElementById('rhythm-container');
        if (container) container.style.opacity = '0';
        setTimeout(() => { if (container) container.style.display = 'none'; }, 500);
    }, 2000);
}

// ── postMessage listener (from test.html wrapper) ──
let _sessionId = null;

window.addEventListener('message', (event) => {
    if (event.data?.action === 'startRhythm') {
        // Hard-stop any running game before starting fresh
        if (rhythmActive) {
            rhythmActive = false;
            clearInterval(spawnInterval);
            cancelAnimationFrame(animFrameId);
            document.removeEventListener('keydown', handleRhythmKeyPress);
            document.removeEventListener('keyup', handleRhythmKeyRelease);
            // Remove any lingering notes
            document.querySelectorAll('.rhythm-note').forEach(n => n.remove());
        }

        _sessionId = event.data.sessionId || null;
        setupRhythmGame(event.data.config);
        startRhythmGame();

        const container = document.getElementById('rhythm-container');
        const idle      = document.getElementById('idle-screen');
        if (idle)      idle.style.display = 'none';
        if (container) {
            container.style.display = 'flex';
            container.style.opacity = '1';
        }
    }
});
