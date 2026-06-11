// UI Controller for SPIELZUG

let game = null;
let pendingSpecial = null; // für Sonderkarten-Handling

document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        startGame(this.dataset.mode);
    });
});

function startGame(mode) {
    game = new SPIELZUGGame(mode);
    game.initializeDraft();

    document.getElementById('modeSelector').style.display = 'none';
    document.getElementById('gameBoard').style.display = 'block';

    game.log.push(`🎮 Spiel gestartet – Modus: ${GAME_MODES[mode].name}`);
    game.log.push(`👤 Dein Trainer: ${game.playerCoach} – ${COACHES[game.playerCoach].advantage}`);
    game.log.push(`🤖 Computer-Trainer: ${game.aiCoach}`);
    game.log.push(`─────────────────────────`);
    game.log.push(`📋 DRAFT: Du wählst zuerst!`);

    updateUI();
    showDraftPhase();
}

function updateUI() {
    document.getElementById('playerScore').textContent = game.playerScore;
    document.getElementById('aiScore').textContent = game.aiScore;
    document.getElementById('halfInfo').textContent = `${game.currentHalf}. Halbzeit`;
    document.getElementById('playerHalfInfo').textContent = `Angriffe: ${game.attacksThisHalf.player}/${game.getMaxAttacks(true)}`;
    document.getElementById('aiHalfInfo').textContent = `Angriffe: ${game.attacksThisHalf.ai}/${game.getMaxAttacks(false)}`;

    const logContent = document.getElementById('logContent');
    logContent.innerHTML = game.log.slice().reverse().map(entry => {
        let cls = '';
        if (entry.includes('⚽') || entry.includes('TOR')) cls = 'goal';
        else if (entry.includes('❌') || entry.includes('🧤')) cls = 'miss';
        return `<div class="log-entry ${cls}">${entry}</div>`;
    }).join('');
}

// ============ DRAFT ============

function showDraftPhase() {
    const currentTurn = game.getDraftCurrentPlayer();
    if (!currentTurn) { finishDraft(); return; }

    if (currentTurn === 'ai') {
        document.getElementById('currentPhase').textContent = '🤖 Computer wählt...';
        // KI wählt einen passenden Spieler je nach Teambedarf
        const aiNeeds = getTeamNeed(false);
        const suited = game.availablePlayers.filter(p => p.role === aiNeeds);
        const pool = suited.length > 0 ? suited : game.availablePlayers;
        const idx = Math.floor(Math.random() * pool.length);
        const player = pool[idx];
        const realIdx = game.availablePlayers.indexOf(player);

        game.log.push(`🤖 Computer wählt: ${player.name} (${player.role})`);
        updateUI();
        game.selectPlayerInDraft(realIdx);
        setTimeout(() => showDraftPhase(), 1200);
    } else {
        document.getElementById('currentPhase').textContent = '👤 Du wählst...';
        const need = getTeamNeed(true);
        const pick = game.draftIndex + 1;

        const html = `
            <div class="game-state">
                <h3>📋 DRAFT (${pick}/6) – Brauche: ${need}</h3>
                <div class="card-selection" style="max-height:380px;overflow-y:auto;">
                    ${game.availablePlayers.map((p, i) => `
                        <div class="tactic-card" onclick="draftSelectPlayer(${i})" style="cursor:pointer;background:#e3f2fd;border:2px solid #2196F3;padding:12px;">
                            <strong>${p.name}</strong> <span style="color:#666;">(${p.role})</span><br>
                            <small>ATT: ${p.attack} | DEF: ${p.defense}</small><br>
                            <small style="color:#555;">📌 ${p.specialDesc}</small>
                        </div>
                    `).join('')}
                </div>
            </div>`;
        document.getElementById('gameState').innerHTML = html;
        document.getElementById('actionArea').innerHTML = '';
    }
}

function getTeamNeed(isPlayer) {
    const team = isPlayer ? game.playerTeam : game.aiTeam;
    if (team.iv.length < 2) return 'IV';
    if (!team.zm) return 'ZM';
    return 'ST';
}

function draftSelectPlayer(index) {
    const player = game.availablePlayers[index];
    game.log.push(`👤 Du wählst: ${player.name} (${player.role})`);
    updateUI();
    const done = game.selectPlayerInDraft(index);
    if (done) {
        game.log.push(`✅ Draft abgeschlossen!`);
        updateUI();
        setTimeout(finishDraft, 1000);
    } else {
        setTimeout(() => showDraftPhase(), 800);
    }
}

function finishDraft() {
    game.applyCoachPassives();
    game.draftPhase = false;
    game.log.push(`─────────────────────────`);
    game.log.push(`⚽ 1. HALBZEIT BEGINNT!`);
    updateUI();
    setTimeout(() => nextTurn(), 1200);
}

// ============ SPIELFLUSS: abwechselnd ============

// Entscheidet wer als nächstes angreift (abwechselnd, Spieler fängt an)
function nextTurn() {
    if (game.isGameOver()) { endGame(); return; }

    if (game.isHalfOver()) {
        if (!game.startNextHalf()) { endGame(); return; }
        game.log.push(`─────────────────────────`);
        game.log.push(`⏱️ HALBZEIT! 2. HALBZEIT BEGINNT!`);
        updateUI();
        setTimeout(() => nextTurn(), 1800);
        return;
    }

    const playerDone = game.playerHalfDone();
    const aiDone = game.aiHalfDone();

    if (playerDone && !aiDone) { startAIAttack(); return; }
    if (aiDone && !playerDone) { startPlayerAttack(); return; }

    // Abwechselnd: Spieler beginnt jede Halbzeit
    const totalDone = game.attacksThisHalf.player + game.attacksThisHalf.ai;
    if (totalDone % 2 === 0) startPlayerAttack();
    else startAIAttack();
}

// ============ SPIELER ANGREIFT ============

function startPlayerAttack() {
    document.getElementById('currentPhase').textContent = '👤 Dein Angriff';
    const attackers = game.getAvailableAttackers(true);

    if (attackers.length === 0) {
        game.log.push(`⚠️ Keine Angreifer verfügbar – wird übersprungen`);
        game.updateAttackCount(true);
        updateUI();
        setTimeout(() => nextTurn(), 1000);
        return;
    }

    const num = game.attacksThisHalf.player + 1;
    const max = game.getMaxAttacks(true);

    // Dinosaurier: erster Angriff muss offen ausgespielt werden
    const dinoOpen = COACHES[game.playerCoach].special === 'dinosaurier' && !game.playerCoachState.dinosaurierFirstAttackDone;

    const html = `
        <div class="game-state">
            <h3>⚽ Dein Angriff (${num}/${max})</h3>
            ${dinoOpen ? '<p style="color:orange;">🦕 Dinosaurier: Erster Angriff wird offen gespielt!</p>' : ''}
            <p><strong>Wähle deinen Angreifer:</strong></p>
            <div class="card-selection">
                ${attackers.map((p, i) => `
                    <div class="tactic-card" onclick="playerSelectAttacker(${i})" style="cursor:pointer;background:#e3f2fd;border:2px solid #2196F3;">
                        <strong>${p.name}</strong> (${p.role})<br>
                        <small>ATT: ${p.attack} | DEF: ${p.defense}</small><br>
                        <small style="color:#555;">📌 ${p.specialDesc}</small>
                    </div>`).join('')}
            </div>
        </div>`;
    document.getElementById('gameState').innerHTML = html;
    document.getElementById('actionArea').innerHTML = '';
}

function playerSelectAttacker(index) {
    const attackers = game.getAvailableAttackers(true);
    game.selectedAttacker = attackers[index];
    game.log.push(`👤 Angreifer: ${game.selectedAttacker.name}`);
    updateUI();
    showPlayerAttackTactic();
}

function showPlayerAttackTactic() {
    document.getElementById('currentPhase').textContent = '🎯 Angriffstaktik wählen';
    const tactics = game.getAvailableAttackTactics(true);

    // Theoretiker: 1x pro Halbzeit Taktik des Gegners sehen
    const canPeek = COACHES[game.playerCoach].special === 'theoretiker' && !game.playerCoachState.theoretikerPeekUsedThisHalf;
    let peekHint = '';
    if (canPeek) {
        const aiDefTactic = game.makeAIDecision('defenseTactic');
        peekHint = `<p style="color:purple;">🧠 Theoretiker-Einblick: Computer spielt voraussichtlich <strong>${aiDefTactic.name}</strong></p>`;
        game.playerCoachState.theoretikerPeekUsedThisHalf = true;
    }

    const html = `
        <div class="game-state">
            <h3>🎯 Angriffstaktik wählen</h3>
            ${peekHint}
            <div class="card-selection">
                ${tactics.map((t, i) => `
                    <div class="tactic-card" onclick="playerSelectAttackTactic('${t.name}')" style="cursor:pointer;background:#fff3e0;border:2px solid #FF9800;padding:12px;">
                        <strong>${t.name}</strong><br>
                        <small style="color:green;">✅ Stark gegen: ${t.strong.join(', ')}</small><br>
                        <small style="color:red;">❌ Schwach gegen: ${t.weak.join(', ')}</small>
                    </div>`).join('')}
            </div>
        </div>`;
    document.getElementById('gameState').innerHTML = html;
}

function playerSelectAttackTactic(tacticName) {
    game.selectedAttackTactic = TACTICS.attack.find(t => t.name === tacticName);
    game.log.push(`🎯 Angriffstaktik: ${tacticName}`);
    updateUI();

    // KI wählt Verteidiger und Taktik
    game.selectedDefender = game.makeAIDecision('defender');
    game.selectedDefenseTactic = game.makeAIDecision('defenseTactic');

    // Dinosaurier: erster Angriff offen – Taktik direkt anzeigen
    const dinoOpen = COACHES[game.playerCoach].special === 'dinosaurier' && !game.playerCoachState.dinosaurierFirstAttackDone;
    if (dinoOpen) game.playerCoachState.dinosaurierFirstAttackDone = true;

    game.log.push(`🤖 Verteidiger: ${game.selectedDefender.name} | Taktik: ${game.selectedDefenseTactic.name}`);
    updateUI();

    setTimeout(() => playFieldDuel(true), 1200);
}

// ============ KI ANGREIFT ============

function startAIAttack() {
    document.getElementById('currentPhase').textContent = '🤖 Computer greift an...';

    const attackers = game.getAvailableAttackers(false);
    if (attackers.length === 0) {
        game.log.push(`⚠️ Computer hat keine Angreifer – wird übersprungen`);
        game.updateAttackCount(false);
        updateUI();
        setTimeout(() => nextTurn(), 1000);
        return;
    }

    game.selectedAttacker = game.makeAIDecision('attacker');
    game.selectedAttackTactic = game.makeAIDecision('attackTactic');
    game.selectedDefender = game.makeAIDecision('defender');
    game.selectedDefenseTactic = game.makeAIDecision('defenseTactic');

    game.log.push(`🤖 Angreifer: ${game.selectedAttacker.name} | Taktik: ${game.selectedAttackTactic.name}`);
    game.log.push(`👤 Verteidiger: ${game.selectedDefender.name} | Taktik: ${game.selectedDefenseTactic.name}`);
    updateUI();

    setTimeout(() => playFieldDuel(false), 1500);
}

// ============ FELDDUELL ============

function playFieldDuel(isPlayerAttacking) {
    const result = game.resolveFieldDuel(
        game.selectedAttacker, game.selectedAttackTactic,
        game.selectedDefender, game.selectedDefenseTactic,
        isPlayerAttacking
    );

    const attackerLabel = isPlayerAttacking ? '👤 Du' : '🤖 Computer';
    const defenderLabel = isPlayerAttacking ? '🤖 Computer' : '👤 Du';

    let bonusHTML = result.bonusLog.length
        ? `<div style="margin:8px 0;font-size:0.85em;color:#555;">${result.bonusLog.join('<br>')}</div>` : '';

    const html = `
        <div class="game-state">
            <h3>⚔️ FELDDUELL</h3>
            <div class="player-info">
                <strong>${attackerLabel} – ${result.attacker.name}</strong><br>
                Taktik: <em>${result.attackTactic}</em> | ATT-Wert: <strong>${result.attackValue}</strong>
            </div>
            <div class="player-info">
                <strong>${defenderLabel} – ${result.defender.name}</strong><br>
                Taktik: <em>${result.defenseTactic}</em> | DEF-Wert: <strong>${result.defenseValue}</strong>
            </div>
            ${bonusHTML}
            <div style="margin-top:16px;padding:16px;background:${result.isSuccess ? '#c8e6c9' : '#ffcdd2'};border-radius:8px;text-align:center;font-weight:bold;font-size:1.3em;">
                ${result.isSuccess ? '✅ ANGRIFF ERFOLGREICH!' : '❌ ABGEWEHRT!'}
            </div>
        </div>`;
    document.getElementById('gameState').innerHTML = html;

    if (result.isSuccess) {
        game.log.push(`✅ Feldduell gewonnen! (ATT ${result.attackValue} vs DEF ${result.defenseValue})`);

        // Offensiv-Fanatiker: Bonus für Torchance aktivieren
        if (isPlayerAttacking && COACHES[game.playerCoach].special === 'offensive_fanatic') {
            game.playerCoachState.fanatikerGoalBonusActive = true;
        }
        if (!isPlayerAttacking && COACHES[game.aiCoach].special === 'offensive_fanatic') {
            game.aiCoachState.fanatikerGoalBonusActive = true;
        }

        game.lastWinningAttackTactic = result.attackTactic;
        updateUI();
        setTimeout(() => startGoalChance(isPlayerAttacking), 2000);
    } else {
        game.log.push(`❌ Feldduell verloren! (ATT ${result.attackValue} vs DEF ${result.defenseValue})`);
        game.markPlayerAsUsed(game.selectedAttacker, isPlayerAttacking);
        game.updateAttackCount(isPlayerAttacking);
        updateUI();
        setTimeout(() => nextTurn(), 2000);
    }
}

// ============ STRAFRAUM ============

function startGoalChance(isPlayerAttacking) {
    document.getElementById('currentPhase').textContent = '🥅 Strafraum-Drama!';

    const attackerCoach = isPlayerAttacking ? game.playerCoach : game.aiCoach;
    // Mentalitäts-Monster bei Rückstand: 3 Karten
    const isDown = isPlayerAttacking
        ? game.playerScore < game.aiScore
        : game.aiScore < game.playerScore;
    const drawCount = (COACHES[attackerCoach].special === 'mental_monster' && isDown) ? 3 : 2;

    const attackerCards = game.drawMomentumCards(drawCount);
    const defenderCards = game.drawMomentumCards(2);

    window.currentGoalChance = { isPlayerAttacking, attackerCards, defenderCards };

    if (isPlayerAttacking) {
        showPlayerMomentumChoice(attackerCards, defenderCards);
    } else {
        // KI wählt ihre Karte
        const aiIdx = game.makeAIDecision('momentum', attackerCards);
        const aiCard = attackerCards[aiIdx];
        const defIdx = Math.floor(Math.random() * defenderCards.length);
        const defCard = defenderCards[defIdx];
        setTimeout(() => resolveGoalChance(false, aiCard, defCard), 1200);
    }
}

function showPlayerMomentumChoice(attackerCards, defenderCards) {
    const coach = game.playerCoach;
    const isPraesi = COACHES[coach].special === 'praesidenten_kumpel';

    const html = `
        <div class="game-state">
            <h3>🎯 STRAFRAUM-DRAMA – Wähle eine Momentum-Karte</h3>
            ${isPraesi ? '<p style="color:orange;">👑 Präsidenten-Kumpel: Du musst negative Karten zwingend spielen!</p>' : ''}
            <div class="card-selection">
                ${attackerCards.map((card, i) => {
                    const isNeg = card.value < 0;
                    const mustPlay = isPraesi && isNeg;
                    const disabled = isPraesi && attackerCards.some(c => c.value < 0) && !isNeg ? 'opacity:0.4;pointer-events:none;' : '';
                    return `
                        <div class="momentum-card" onclick="playerSelectMomentum(${i})" style="cursor:pointer;padding:14px;${disabled}">
                            <strong>${card.name}</strong><br>
                            <span style="font-size:1.2em;color:${card.value >= 0 ? 'green' : 'red'};">${card.value >= 0 ? '+' : ''}${card.value}</span>
                            ${card.special ? `<br><small style="color:purple;">✨ ${card.special}</small>` : ''}
                            ${mustPlay ? '<br><small style="color:orange;">Pflicht!</small>' : ''}
                        </div>`;
                }).join('')}
            </div>
            <p style="font-size:0.85em;color:#888;">Die andere Karte kommt zurück unter den Stapel.</p>
        </div>`;
    document.getElementById('gameState').innerHTML = html;
}

function playerSelectMomentum(index) {
    const { attackerCards, defenderCards } = window.currentGoalChance;
    const selectedCard = attackerCards[index];
    // Andere Karte zurück
    attackerCards.forEach((c, i) => { if (i !== index) game.momentumDeck.unshift(c); });

    // Verteidiger-Karte: KI wählt zufällig
    const defIdx = Math.floor(Math.random() * defenderCards.length);
    const defCard = defenderCards[defIdx];
    defenderCards.forEach((c, i) => { if (i !== defIdx) game.momentumDeck.unshift(c); });

    // VAR: Verteidiger muss die abgelehnte Karte spielen
    if (selectedCard.special === 'var') {
        game.log.push(`📺 VAR-Entscheidung! Computer muss abgelehnte Karte spielen.`);
        // Hier spielen wir das einfachste: Defender bekommt die schlechtere Karte
        // (bei Spieler-VAR: AI's second card wird gespielt - bereits zufällig)
    }

    resolveGoalChance(true, selectedCard, defCard);
}

function resolveGoalChance(isPlayerAttacking, attackerCard, defenderCard) {
    const result = game.resolveGoalChance(isPlayerAttacking, attackerCard, defenderCard, game.lastWinningAttackTactic);

    // Sonderkarten-Spezialbehandlung vor normaler Auflösung
    if (attackerCard.special === 'penalty' || defenderCard.special === 'penalty') {
        handlePenalty(isPlayerAttacking, result);
        return;
    }

    const gk = result.goalkeeper;
    const att = result.attacker;
    const attackerLabel = isPlayerAttacking ? '👤 Du' : '🤖 Computer';
    const defenderLabel = isPlayerAttacking ? '🤖 Torwart' : '👤 Torwart';

    let extraInfo = '';
    if (result.nutmegActive) extraInfo += `<p style="color:purple;font-weight:bold;">🪄 TUNNEL! Tor zählt doppelt!</p>`;
    if (result.aluminumActive) extraInfo += `<p style="color:#888;">🥅 Aluminium – Gleichstand = Abwehr!</p>`;

    const html = `
        <div class="game-state">
            <h3>🥅 STRAFRAUM-DRAMA</h3>
            <div class="player-info">
                <strong>${attackerLabel} – ${att.name}</strong><br>
                ATT: ${att.attack} + Momentum (${attackerCard.name} ${attackerCard.value >= 0 ? '+' : ''}${attackerCard.value}) = <strong>${result.attackValue}</strong>
            </div>
            <div class="player-info">
                <strong>${defenderLabel} – ${gk.name}</strong><br>
                DEF: ${gk.defense} + Momentum (${defenderCard.name} ${defenderCard.value >= 0 ? '+' : ''}${defenderCard.value}) = <strong>${result.defenseValue}</strong>
            </div>
            ${extraInfo}
            <div style="margin-top:16px;padding:16px;background:${result.isGoal ? (isPlayerAttacking ? '#c8e6c9' : '#ffcdd2') : (isPlayerAttacking ? '#ffcdd2' : '#c8e6c9')};border-radius:8px;text-align:center;font-weight:bold;font-size:1.4em;">
                ${result.isGoal
                    ? (isPlayerAttacking ? `⚽ TOOOOR!${result.nutmegActive ? ' x2!' : ''}` : `⚽ COMPUTER TOOOR!${result.nutmegActive ? ' x2!' : ''}`)
                    : (isPlayerAttacking ? '🧤 GEHALTEN!' : '🧤 DU HIELTEST!')}
            </div>
        </div>`;
    document.getElementById('gameState').innerHTML = html;

    // Abpraller: Nachschuss wenn Torwart hält
    if (!result.isGoal && (attackerCard.special === 'rebound' || defenderCard.special === 'rebound')) {
        game.log.push(`🏃 ABPRALLER! Nachschuss möglich!`);
        updateUI();
        setTimeout(() => handleRebound(isPlayerAttacking), 2500);
        return;
    }

    if (result.isGoal) {
        if (isPlayerAttacking) {
            game.playerScore += result.goals;
            game.log.push(`⚽ TOR! ${game.playerScore}:${game.aiScore}${result.goals === 2 ? ' (doppelt durch Tunnel!)' : ''}`);
        } else {
            game.aiScore += result.goals;
            game.log.push(`⚽ COMPUTER TOR! ${game.playerScore}:${game.aiScore}`);
        }
    } else {
        game.log.push(isPlayerAttacking ? `🧤 Kein Tor` : `🧤 Du hieltest!`);

        // Flutlicht: Gegner muss nächste Taktik offen zeigen
        if (attackerCard.special === 'floodlight' || defenderCard.special === 'floodlight') {
            game.log.push(`💡 Blendendes Flutlicht! Nächste Taktik wird offen gespielt.`);
            if (isPlayerAttacking) game.aiCoachState.floodlightPendingFor = 'ai';
            else game.playerCoachState.floodlightPendingFor = 'player';
        }

        // Zweiter Ball: erschöpften Spieler reaktivieren
        if ((attackerCard.special === 'second_ball' || defenderCard.special === 'second_ball')) {
            const revived = game.reviveExhaustedPlayer(isPlayerAttacking);
            if (revived) game.log.push(`🔄 Zweiter Ball: ${revived.name} wieder einsatzbereit!`);
        }
    }

    game.markPlayerAsUsed(game.selectedAttacker, isPlayerAttacking);
    game.updateAttackCount(isPlayerAttacking);
    updateUI();
    setTimeout(() => nextTurn(), 2800);
}

function handleRebound(isPlayerAttacking) {
    game.log.push(`🎯 NACHSCHUSS-Duell!`);
    // Nur Angreifer zieht 1 neue Karte
    const attackerCard = game.drawMomentumCards(1)[0];
    const defenderCard = game.drawMomentumCards(1)[0]; // Torwart zieht auch 1 zur Fairness

    if (isPlayerAttacking) {
        const html = `
            <div class="game-state">
                <h3>🏃 NACHSCHUSS – Wähle deine Karte</h3>
                <div class="card-selection">
                    <div class="momentum-card" onclick="resolveRebound(true, '${JSON.stringify(attackerCard).replace(/'/g,"&#39;")}', '${JSON.stringify(defenderCard).replace(/'/g,"&#39;")}')" style="cursor:pointer;padding:14px;">
                        <strong>${attackerCard.name}</strong><br>
                        <span style="color:${attackerCard.value >= 0 ? 'green' : 'red'};">${attackerCard.value >= 0 ? '+' : ''}${attackerCard.value}</span>
                    </div>
                </div>
            </div>`;
        document.getElementById('gameState').innerHTML = html;
        window.reboundCards = { attackerCard, defenderCard };
        document.getElementById('gameState').querySelector('.momentum-card').onclick = () => {
            const att = game.selectedAttacker;
            const gk = game.aiTeam.tw;
            const av = att.attack + attackerCard.value;
            const dv = gk.defense + defenderCard.value;
            const isGoal = av > dv;
            if (isGoal) { game.playerScore++; game.log.push(`⚽ NACHSCHUSS-TOR! ${game.playerScore}:${game.aiScore}`); }
            else game.log.push(`🧤 Nachschuss gehalten.`);
            game.markPlayerAsUsed(game.selectedAttacker, true);
            game.updateAttackCount(true);
            updateUI();
            setTimeout(() => nextTurn(), 2000);
        };
    } else {
        const att = game.selectedAttacker;
        const gk = game.playerTeam.tw;
        const av = att.attack + attackerCard.value;
        const dv = gk.defense + defenderCard.value;
        const isGoal = av > dv;
        game.log.push(`🏃 Computer Nachschuss: ATT ${av} vs DEF ${dv}`);
        if (isGoal) { game.aiScore++; game.log.push(`⚽ COMPUTER NACHSCHUSS-TOR! ${game.playerScore}:${game.aiScore}`); }
        else game.log.push(`🧤 Nachschuss gehalten.`);
        game.markPlayerAsUsed(game.selectedAttacker, false);
        game.updateAttackCount(false);
        updateUI();
        setTimeout(() => nextTurn(), 2000);
    }
}

function handlePenalty(isPlayerAttacking, result) {
    const attackerLabel = isPlayerAttacking ? '👤 Du schießt' : '🤖 Computer schießt';
    const options = ['Links', 'Mitte', 'Rechts'];

    if (isPlayerAttacking) {
        const html = `
            <div class="game-state">
                <h3>🟡 ELFMETER!</h3>
                <p>${attackerLabel} – wähle deine Ecke:</p>
                <div class="card-selection">
                    ${options.map(o => `
                        <div class="tactic-card" onclick="resolvePenalty('${o}', true)" style="cursor:pointer;background:#fff9c4;border:2px solid #FFC107;font-size:1.2em;text-align:center;padding:20px;">
                            ${o}
                        </div>`).join('')}
                </div>
            </div>`;
        document.getElementById('gameState').innerHTML = html;
    } else {
        const shootDir = options[Math.floor(Math.random() * 3)];
        resolvePenalty(shootDir, false);
    }
}

function resolvePenalty(shootDir, isPlayerShooting) {
    const options = ['Links', 'Mitte', 'Rechts'];
    const keeperDir = options[Math.floor(Math.random() * 3)];
    const saved = shootDir === keeperDir;

    game.log.push(`🟡 Elfmeter: Schuss ${shootDir} | Torwart ${keeperDir} → ${saved ? 'GEHALTEN!' : 'TOR!'}`);

    const html = `
        <div class="game-state">
            <h3>🟡 ELFMETER</h3>
            <p>Schuss: <strong>${shootDir}</strong></p>
            <p>Torwart: <strong>${keeperDir}</strong></p>
            <div style="padding:20px;background:${!saved ? (isPlayerShooting ? '#c8e6c9' : '#ffcdd2') : (isPlayerShooting ? '#ffcdd2' : '#c8e6c9')};border-radius:8px;text-align:center;font-weight:bold;font-size:1.4em;">
                ${saved ? '🧤 GEHALTEN!' : '⚽ TOR!'}
            </div>
        </div>`;
    document.getElementById('gameState').innerHTML = html;

    if (!saved) {
        if (isPlayerShooting) { game.playerScore++; game.log.push(`⚽ ELFMETER-TOR! ${game.playerScore}:${game.aiScore}`); }
        else { game.aiScore++; game.log.push(`⚽ COMPUTER ELFMETER-TOR! ${game.playerScore}:${game.aiScore}`); }
    }

    game.markPlayerAsUsed(game.selectedAttacker, isPlayerShooting);
    game.updateAttackCount(isPlayerShooting);
    updateUI();
    setTimeout(() => nextTurn(), 2500);
}

// ============ SPIELENDE ============

function endGame() {
    document.getElementById('gameBoard').style.display = 'none';
    document.getElementById('gameEnd').style.display = 'flex';

    const winner = game.getWinner();
    const endTitle = document.getElementById('endTitle');
    const endStats = document.getElementById('endStats');

    if (winner === 'player') { endTitle.textContent = '🎉 DU GEWINNST!'; endTitle.style.color = '#4CAF50'; }
    else if (winner === 'ai') { endTitle.textContent = '🤖 COMPUTER GEWINNT!'; endTitle.style.color = '#ff6b6b'; }
    else { endTitle.textContent = '🤝 UNENTSCHIEDEN!'; endTitle.style.color = '#FFA500'; }

    const pt = game.playerTeam;
    endStats.innerHTML = `
        <div style="font-size:1.5em;margin:20px 0;line-height:2;">
            <strong>Endergebnis:</strong><br>
            👤 Du: <strong style="color:#4CAF50;">${game.playerScore}</strong> Tore<br>
            🤖 Computer: <strong style="color:#ff6b6b;">${game.aiScore}</strong> Tore
        </div>
        <div style="font-size:0.95em;margin:10px 0;color:#444;">
            <strong>Dein Trainer:</strong> ${game.playerCoach}<br>
            <em>${COACHES[game.playerCoach].advantage}</em>
        </div>
        <div style="font-size:0.9em;margin:10px 0;color:#666;">
            <strong>Dein Team:</strong><br>
            🥅 ${pt.tw.name}<br>
            🛡️ ${pt.iv.map(p => p.name).join(', ')} (IV)<br>
            🎯 ${pt.zm ? pt.zm.name : '–'} (ZM)<br>
            ⚽ ${pt.st.map(p => p.name).join(', ')} (ST)
        </div>`;
}
