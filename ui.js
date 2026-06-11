// UI Controller for SPIELZUG - COMPLETE REWRITE

let game = null;

document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        const mode = this.dataset.mode;
        startGame(mode);
    });
});

function startGame(mode) {
    game = new SPIELZUGGame(mode);
    game.initializeDraft();
    
    document.getElementById('modeSelector').style.display = 'none';
    document.getElementById('gameBoard').style.display = 'block';
    
    game.log.push(`🎮 Spiel gestartet - Modus: ${GAME_MODES[mode].name}`);
    game.log.push(`👤 Dein Trainer: ${game.playerCoach}`);
    game.log.push(`🤖 Computer-Trainer: ${game.aiCoach}`);
    game.log.push(`─────────────────────────`);
    game.log.push(`📋 DRAFT PHASE: Abwechselnd Spieler wählen!`);
    
    updateUI();
    showDraftPhase();
}

function updateUI() {
    document.getElementById('playerScore').textContent = game.playerScore;
    document.getElementById('aiScore').textContent = game.aiScore;
    document.getElementById('halfInfo').textContent = `${game.currentHalf}. Halbzeit`;
    document.getElementById('playerHalfInfo').textContent = `Angriffe: ${game.attacksThisHalf.player}/${game.maxAttacksPerHalf}`;
    document.getElementById('aiHalfInfo').textContent = `Angriffe: ${game.attacksThisHalf.ai}/${game.maxAttacksPerHalf}`;
    
    const logContent = document.getElementById('logContent');
    logContent.innerHTML = game.log.map(entry => {
        let className = '';
        if (entry.includes('⚽') || entry.includes('TOR')) className = 'goal';
        else if (entry.includes('❌')) className = 'miss';
        return `<div class="log-entry ${className}">${entry}</div>`;
    }).reverse().join('');
    logContent.parentElement.scrollTop = logContent.parentElement.scrollHeight;
}

// ============ DRAFT PHASE ============

function showDraftPhase() {
    const currentTurn = game.getDraftCurrentPlayer();
    
    if (!currentTurn) {
        startFirstHalf();
        return;
    }
    
    if (currentTurn === 'ai') {
        document.getElementById('currentPhase').textContent = '🤖 Computer wählt...';
        const playerIndex = Math.floor(Math.random() * game.availablePlayers.length);
        const player = game.availablePlayers[playerIndex];
        
        game.log.push(`🤖 Computer wählt: ${player.name}`);
        updateUI();
        
        game.selectPlayerInDraft(playerIndex);
        
        setTimeout(() => showDraftPhase(), 2000);
    } else {
        document.getElementById('currentPhase').textContent = '👤 Du wählst...';
        const draftCount = game.draftIndex + 1;
        
        const html = `
            <div class="game-state">
                <h3>📋 DRAFT (${draftCount}/6)</h3>
                <p><strong>Wähle einen Spieler:</strong></p>
                <div class="card-selection" style="max-height: 400px; overflow-y: auto;">
                    ${game.availablePlayers.map((p, i) => `
                        <div class="tactic-card" onclick="draftSelectPlayer(${i})" style="cursor: pointer; background: #e3f2fd; border: 2px solid #2196F3; padding: 15px;">
                            <strong>${p.name}</strong><br>
                            <small>${p.role} | ATT: ${p.attack} | DEF: ${p.defense}</small>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        document.getElementById('gameState').innerHTML = html;
        document.getElementById('actionArea').innerHTML = '';
    }
}

function draftSelectPlayer(index) {
    const player = game.availablePlayers[index];
    game.log.push(`👤 Du wählst: ${player.name}`);
    updateUI();
    
    const isDraftFinished = game.selectPlayerInDraft(index);
    
    if (isDraftFinished) {
        game.log.push(`✅ Draft abgeschlossen!`);
        updateUI();
        setTimeout(() => startFirstHalf(), 1500);
    } else {
        setTimeout(() => showDraftPhase(), 1500);
    }
}

function startFirstHalf() {
    game.draftPhase = false;
    game.log.push(`─────────────────────────`);
    game.log.push(`⚽ 1. HALBZEIT BEGINNT!`);
    updateUI();
    
    setTimeout(() => {
        startPlayerAttack();
    }, 1500);
}

// ============ GAME PHASES ============

function startPlayerAttack() {
    if (game.isGameOver()) {
        endGame();
        return;
    }
    
    if (game.isHalfOver()) {
        if (!game.startNextHalf()) {
            endGame();
            return;
        }
        game.log.push(`─────────────────────────`);
        game.log.push(`⏱️ HALBZEIT VORBEI!`);
        game.log.push(`2. HALBZEIT BEGINNT!`);
        updateUI();
        setTimeout(() => startPlayerAttack(), 2000);
        return;
    }
    
    document.getElementById('currentPhase').textContent = '👤 Dein Angriff';
    const attackers = game.getAvailableAttackers(true);
    
    if (attackers.length === 0) {
        game.log.push(`❌ Keine Angreifer mehr - übergeben`);
        game.updateAttackCount(true);
        updateUI();
        setTimeout(() => startAIAttack(), 1500);
        return;
    }
    
    const html = `
        <div class="game-state">
            <h3>⚽ Dein Angriff (${game.attacksThisHalf.player + 1}/3)</h3>
            <p><strong>1. Wähle Angreifer:</strong></p>
            <div class="card-selection">
                ${attackers.map((p, i) => `
                    <div class="tactic-card" onclick="playerSelectAttacker(${i})" style="cursor: pointer; background: #e3f2fd; border: 2px solid #2196F3;">
                        <strong>${p.name}</strong><br>
                        <small>${p.role} | ATT: <strong>${p.attack}</strong></small>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
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
    document.getElementById('currentPhase').textContent = '🎯 Angriffstaktik';
    const tactics = game.getAvailableAttackTactics(true);
    
    const html = `
        <div class="game-state">
            <h3>🎯 2. Wähle Angriffstaktik</h3>
            <div class="card-selection">
                ${tactics.map((t, i) => `
                    <div class="tactic-card" onclick="playerSelectAttackTactic(${i})" style="cursor: pointer; background: #fff3e0; border: 2px solid #FF9800; padding: 15px;">
                        <strong>${t.name}</strong><br>
                        <small>✅ Stark: ${t.strong.join(', ')}</small><br>
                        <small style="color: red;">❌ Schwach: ${t.weak.join(', ')}</small>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    document.getElementById('gameState').innerHTML = html;
}

function playerSelectAttackTactic(index) {
    const tactics = game.getAvailableAttackTactics(true);
    game.selectedAttackTactic = tactics[index];
    game.log.push(`🎯 Taktik: ${game.selectedAttackTactic.name}`);
    updateUI();
    
    setTimeout(() => {
        game.selectedDefender = game.makeAIDecision('defender');
        game.selectedDefenseTactic = game.makeAIDecision('defenseTactic');
        
        game.log.push(`🤖 Verteidiger: ${game.selectedDefender.name}`);
        game.log.push(`🤖 Verteidigungstaktik: ${game.selectedDefenseTactic.name}`);
        updateUI();
        
        setTimeout(() => {
            playFieldDuel();
        }, 1500);
    }, 1000);
}

function playFieldDuel() {
    const result = game.resolveFieldDuel(
        game.selectedAttacker,
        game.selectedAttackTactic,
        game.selectedDefender,
        game.selectedDefenseTactic
    );
    
    const bonusText = result.bonus > 0 ? `+${result.bonus}` : result.bonus < 0 ? `${result.bonus}` : '0';
    
    const html = `
        <div class="game-state">
            <h3>⚔️ FELDDUELL</h3>
            <div class="player-info">
                <strong>Angreifer:</strong> ${result.attacker.name}<br>
                ATT: ${result.attacker.attack} + Taktik-Bonus: ${bonusText}<br>
                <strong>Gesamtwert: ${result.attackValue}</strong>
            </div>
            <div class="player-info">
                <strong>Verteidiger:</strong> ${result.defender.name}<br>
                DEF: ${result.defender.defense} + Taktik-Bonus: ${bonusText}<br>
                <strong>Gesamtwert: ${result.defenseValue}</strong>
            </div>
            <div style="margin-top: 20px; padding: 20px; background: ${result.isSuccess ? '#c8e6c9' : '#ffcdd2'}; border-radius: 8px; text-align: center; font-weight: bold; font-size: 1.3em;">
                ${result.isSuccess ? '✅ ANGRIFF ERFOLGREICH!' : '❌ ABGEWEHRT!'}
            </div>
        </div>
    `;
    document.getElementById('gameState').innerHTML = html;
    
    if (result.isSuccess) {
        game.log.push(`✅ Angriff erfolgreich!`);
        updateUI();
        
        setTimeout(() => {
            playGoalChance(true);
        }, 2500);
    } else {
        game.log.push(`❌ Angriff abgewehrt!`);
        game.markPlayerAsUsed(game.selectedAttacker, true);
        game.updateAttackCount(true);
        updateUI();
        
        setTimeout(() => {
            startAIAttack();
        }, 2500);
    }
}

function playGoalChance(isPlayer) {
    const goalChance = game.resolveGoalChance();
    
    if (isPlayer) {
        document.getElementById('currentPhase').textContent = '🎯 Strafraum-Drama';
        const html = `
            <div class="game-state">
                <h3>🎯 STRAFRAUM-DRAMA (Torchance)</h3>
                <p><strong>Wähle eine Momentum-Karte:</strong></p>
                <div class="card-selection">
                    ${goalChance.playerCards.map((card, i) => `
                        <div class="momentum-card" onclick="playerSelectMomentum(${i})" style="cursor: pointer; padding: 15px;">
                            <strong>${card.name}</strong><br>
                            <small>${card.value > 0 ? '+' : ''}${card.value}</small>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        document.getElementById('gameState').innerHTML = html;
        window.currentGoalChance = goalChance;
    } else {
        setTimeout(() => {
            resolveAIGoal(goalChance);
        }, 1500);
    }
}

function playerSelectMomentum(index) {
    const goalChance = window.currentGoalChance;
    const playerCard = goalChance.playerCards[index];
    const aiIndex = Math.floor(Math.random() * goalChance.aiCards.length);
    const aiCard = goalChance.aiCards[aiIndex];
    
    let playerValue = game.selectedAttacker.attack + playerCard.value;
    let defenderValue = game.selectedDefender.defense + aiCard.value;
    
    if (GAME_MODES[game.mode].strikerBonus && game.selectedAttacker.role === 'ST') {
        playerValue += GAME_MODES[game.mode].strikerBonus;
    }
    
    const isGoal = playerValue > defenderValue;
    
    const html = `
        <div class="game-state">
            <h3>🥅 SCHUSSVERSUCH</h3>
            <div class="player-info">
                <strong>Dein Schuss:</strong> ${game.selectedAttacker.name}<br>
                ATT: ${game.selectedAttacker.attack} + Momentum (${playerCard.name}): ${playerCard.value}<br>
                <strong>Gesamtwert: ${playerValue}</strong>
            </div>
            <div class="player-info">
                <strong>Torwart:</strong> ${game.selectedDefender.name}<br>
                DEF: ${game.selectedDefender.defense} + Gegner Momentum (${aiCard.name}): ${aiCard.value}<br>
                <strong>Gesamtwert: ${defenderValue}</strong>
            </div>
            <div style="margin-top: 20px; padding: 20px; background: ${isGoal ? '#c8e6c9' : '#ffcdd2'}; border-radius: 8px; text-align: center; font-weight: bold; font-size: 1.4em;">
                ${isGoal ? '⚽⚽⚽ TOOOOR! ⚽⚽⚽' : '🧤 GEHALTEN!'}
            </div>
        </div>
    `;
    document.getElementById('gameState').innerHTML = html;
    
    if (isGoal) {
        game.playerScore++;
        game.log.push(`⚽ TOR! ${game.playerScore}:${game.aiScore}`);
    } else {
        game.log.push(`🧤 Kein Tor`);
    }
    
    game.markPlayerAsUsed(game.selectedAttacker, true);
    game.updateAttackCount(true);
    updateUI();
    
    setTimeout(() => {
        startAIAttack();
    }, 3000);
}

// ============ AI ATTACK ============

function startAIAttack() {
    if (game.isGameOver()) {
        endGame();
        return;
    }
    
    if (game.isHalfOver()) {
        if (!game.startNextHalf()) {
            endGame();
            return;
        }
        game.log.push(`─────────────────────────`);
        game.log.push(`⏱️ HALBZEIT VORBEI!`);
        game.log.push(`2. HALBZEIT BEGINNT!`);
        updateUI();
        setTimeout(() => startPlayerAttack(), 2000);
        return;
    }
    
    document.getElementById('currentPhase').textContent = '🤖 Computer greift an...';
    
    const attackers = game.getAvailableAttackers(false);
    
    if (attackers.length === 0) {
        game.log.push(`❌ Computer hat keine Angreifer - übergeben`);
        game.updateAttackCount(false);
        updateUI();
        setTimeout(() => startPlayerAttack(), 1500);
        return;
    }
    
    game.selectedAttacker = game.makeAIDecision('attacker');
    game.selectedAttackTactic = game.makeAIDecision('attackTactic');
    game.selectedDefender = game.makeAIDecision('defender');
    game.selectedDefenseTactic = game.makeAIDecision('defenseTactic');
    
    game.log.push(`🤖 Angreifer: ${game.selectedAttacker.name}`);
    game.log.push(`🤖 Taktik: ${game.selectedAttackTactic.name}`);
    updateUI();
    
    setTimeout(() => {
        const result = game.resolveFieldDuel(
            game.selectedAttacker,
            game.selectedAttackTactic,
            game.selectedDefender,
            game.selectedDefenseTactic
        );
        
        if (result.isSuccess) {
            game.log.push(`✅ Computer erfolgreich!`);
            updateUI();
            
            setTimeout(() => {
                playGoalChance(false);
            }, 1500);
        } else {
            game.log.push(`❌ Computer abgewehrt!`);
            game.markPlayerAsUsed(game.selectedAttacker, false);
            game.updateAttackCount(false);
            updateUI();
            
            setTimeout(() => {
                startPlayerAttack();
            }, 1500);
        }
    }, 2000);
}

function resolveAIGoal(goalChance) {
    const playerIndex = Math.floor(Math.random() * goalChance.playerCards.length);
    const aiIndex = Math.floor(Math.random() * goalChance.aiCards.length);
    
    const playerCard = goalChance.playerCards[playerIndex];
    const aiCard = goalChance.aiCards[aiIndex];
    
    let aiValue = game.selectedAttacker.attack + aiCard.value;
    let playerValue = game.selectedDefender.defense + playerCard.value;
    
    if (GAME_MODES[game.mode].strikerBonus && game.selectedAttacker.role === 'ST') {
        aiValue += GAME_MODES[game.mode].strikerBonus;
    }
    
    const isGoal = aiValue > playerValue;
    
    const html = `
        <div class="game-state">
            <h3>🥅 COMPUTER SCHUSSVERSUCH</h3>
            <div class="player-info">
                <strong>Computer Schuss:</strong> ${game.selectedAttacker.name}<br>
                ATT: ${game.selectedAttacker.attack} + Momentum (${aiCard.name}): ${aiCard.value}<br>
                <strong>Gesamtwert: ${aiValue}</strong>
            </div>
            <div class="player-info">
                <strong>Torwart:</strong> ${game.selectedDefender.name}<br>
                DEF: ${game.selectedDefender.defense} + Gegner Momentum (${playerCard.name}): ${playerCard.value}<br>
                <strong>Gesamtwert: ${playerValue}</strong>
            </div>
            <div style="margin-top: 20px; padding: 20px; background: ${isGoal ? '#ffcdd2' : '#c8e6c9'}; border-radius: 8px; text-align: center; font-weight: bold; font-size: 1.4em;">
                ${isGoal ? '⚽ COMPUTER TOOOR!' : '🧤 DU HIELTEST!'}
            </div>
        </div>
    `;
    document.getElementById('gameState').innerHTML = html;
    
    if (isGoal) {
        game.aiScore++;
        game.log.push(`⚽ COMPUTER TOR! ${game.playerScore}:${game.aiScore}`);
    } else {
        game.log.push(`🧤 Du hieltest!`);
    }
    
    game.markPlayerAsUsed(game.selectedAttacker, false);
    game.updateAttackCount(false);
    updateUI();
    
    setTimeout(() => {
        startPlayerAttack();
    }, 3000);
}

// ============ GAME END ============

function endGame() {
    document.getElementById('gameBoard').style.display = 'none';
    document.getElementById('gameEnd').style.display = 'flex';
    
    const winner = game.getWinner();
    const endTitle = document.getElementById('endTitle');
    const endStats = document.getElementById('endStats');
    
    if (winner === 'player') {
        endTitle.textContent = '🎉 DU GEWINNST!';
        endTitle.style.color = '#4CAF50';
    } else if (winner === 'ai') {
        endTitle.textContent = '🤖 COMPUTER GEWINNT!';
        endTitle.style.color = '#ff6b6b';
    } else {
        endTitle.textContent = '🤝 UNENTSCHIEDEN!';
        endTitle.style.color = '#FFA500';
    }
    
    endStats.innerHTML = `
        <div style="font-size: 1.5em; margin: 20px 0; line-height: 2;">
            <strong>Endergebnis:</strong><br>
            Du: <strong style="color: #4CAF50;">${game.playerScore}</strong> Tore<br>
            Computer: <strong style="color: #ff6b6b;">${game.aiScore}</strong> Tore
        </div>
        <div style="font-size: 1em; margin: 20px 0; color: #666;">
            <strong>Trainer:</strong><br>
            Du: ${game.playerCoach}<br>
            Computer: ${game.aiCoach}
        </div>
        <div style="font-size: 0.95em; margin: 20px 0; color: #999;">
            <strong>Dein Team:</strong><br>
            ${game.playerTeam.iv.map(p => p.name).join(', ')} (IV)<br>
            ${game.playerTeam.zm.name} (ZM)<br>
            ${game.playerTeam.st.map(p => p.name).join(', ')} (ST)
        </div>
    `;
}
