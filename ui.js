// UI Controller for SPIELZUG

let game = null;

// Initialize game with selected mode
document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        const mode = this.dataset.mode;
        initializeGame(mode);
    });
});

function initializeGame(mode) {
    game = new SPIELZUGGame(mode);
    
    // Hide mode selector, show game board
    document.getElementById('modeSelector').style.display = 'none';
    document.getElementById('gameBoard').style.display = 'block';
    
    // Log draft info
    game.log.push(`🎮 Spiel gestartet - Modus: ${GAME_MODES[mode].name}`);
    game.log.push(`👤 Dein Trainer: ${game.playerCoach}`);
    game.log.push(`🤖 Computer-Trainer: ${game.aiCoach}`);
    game.log.push(`─────────────────────────`);
    
    updateUI();
    nextPhase();
}

function updateUI() {
    // Update scores
    document.getElementById('playerScore').textContent = game.playerScore;
    document.getElementById('aiScore').textContent = game.aiScore;
    
    // Update half info
    document.getElementById('halfInfo').textContent = `${game.currentHalf}. Halbzeit`;
    document.getElementById('playerHalfInfo').textContent = `Angriffe: ${game.attacksThisHalf.player}/${game.maxAttacksPerHalf}`;
    document.getElementById('aiHalfInfo').textContent = `Angriffe: ${game.attacksThisHalf.ai}/${game.maxAttacksPerHalf}`;
    
    // Update battle log
    const logContent = document.getElementById('logContent');
    logContent.innerHTML = game.log.map(entry => {
        let className = '';
        if (entry.includes('⚽') || entry.includes('TOR')) className = 'goal';
        else if (entry.includes('Abwehr') || entry.includes('Block')) className = 'defend';
        else if (entry.includes('Schuss daneben')) className = 'miss';
        return `<div class="log-entry ${className}">${entry}</div>`;
    }).reverse().join('');
    logContent.parentElement.scrollTop = logContent.parentElement.scrollHeight;
}

function nextPhase() {
    if (game.isGameOver()) {
        endGame();
        return;
    }
    
    if (game.isHalfOver()) {
        if (!game.startNextHalf()) {
            endGame();
            return;
        }
        game.log.push(`⏱️ Halbzeit vorbei! Start 2. Halbzeit!`);
        updateUI();
    }
    
    // Alternating turns: player first
    game.isPlayerTurn = !game.isPlayerTurn;
    
    if (game.isPlayerTurn) {
        showPlayerAttackSelection();
    } else {
        setTimeout(() => {
            executeAITurn();
        }, 1500);
    }
}

// ============ PLAYER TURN ============

function showPlayerAttackSelection() {
    document.getElementById('currentPhase').textContent = 'Wähle deinen Angreifer';
    
    const attackers = game.getAvailableAttackers(true);
    
    if (attackers.length === 0) {
        game.log.push(`❌ Keine Angreifer mehr verfügbar - Angriff abgebrochen`);
        updateUI();
        game.isPlayerTurn = false;
        nextPhase();
        return;
    }
    
    const html = `
        <div class="game-state">
            <h3>⚽ Dein Angriff</h3>
            <p>Wähle einen Offensivspieler:</p>
            <div class="card-selection">
                ${attackers.map((p, i) => `
                    <div class="tactic-card" onclick="selectPlayerAttacker(${i})">
                        ${p.name}<br>
                        <small>ATT: ${p.attack} | DEF: ${p.defense}</small>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    
    document.getElementById('gameState').innerHTML = html;
    document.getElementById('actionArea').innerHTML = '';
}

function selectPlayerAttacker(index) {
    const attackers = game.getAvailableAttackers(true);
    game.selectedAttacker = attackers[index];
    
    game.log.push(`👤 Dein Angreifer: ${game.selectedAttacker.name}`);
    
    showPlayerTacticSelection('attack');
}

function showPlayerTacticSelection(type) {
    const tactics = type === 'attack' 
        ? game.getAvailableAttackTactics(true)
        : game.getAvailableDefenseTactics(true);
    
    const title = type === 'attack' ? 'Wähle deine Angriffstaktik:' : 'Wähle deine Verteidigungstaktik:';
    
    const html = `
        <div class="game-state">
            <h3>${title}</h3>
            <div class="card-selection">
                ${tactics.map((t, i) => `
                    <div class="tactic-card" onclick="selectPlayerTactic(${i}, '${type}')">
                        ${t.name}
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    
    document.getElementById('gameState').innerHTML = html;
}

function selectPlayerTactic(index, type) {
    const tactics = type === 'attack'
        ? game.getAvailableAttackTactics(true)
        : game.getAvailableDefenseTactics(true);
    
    if (type === 'attack') {
        game.selectedAttackTactic = tactics[index];
        game.log.push(`🎯 Taktik: ${game.selectedAttackTactic.name}`);
        
        // Now AI selects defender
        setTimeout(() => {
            game.selectedDefender = game.makeAIDecision('defender');
            game.selectedDefenseTactic = game.makeAIDecision('defenseTactic');
            
            game.log.push(`🤖 Computer-Verteidiger: ${game.selectedDefender.name}`);
            game.log.push(`🤖 Computer-Taktik: ${game.selectedDefenseTactic.name}`);
            
            resolveFieldDuel();
        }, 1000);
    }
}

function resolveFieldDuel() {
    const result = game.resolveFieldDuel(
        game.selectedAttacker,
        game.selectedAttackTactic,
        game.selectedDefender,
        game.selectedDefenseTactic
    );
    
    const html = `
        <div class="game-state">
            <h3>⚔️ Feldduell</h3>
            <div class="player-info">
                <strong>${game.selectedAttacker.name}</strong> (${result.attackTactic})<br>
                Wert: ${result.attackValue}
            </div>
            <div class="player-info">
                <strong>${game.selectedDefender.name}</strong> (${result.defenseTactic})<br>
                Wert: ${result.defenseValue}
            </div>
            <div style="margin-top: 20px; padding: 15px; background: ${result.isSuccess ? '#d4edda' : '#f8d7da'}; border-radius: 8px; text-align: center; font-weight: bold;">
                ${result.isSuccess ? '✅ Angriff erfolgreich! Torchance!' : '❌ Angriff abgewehrt!'}
            </div>
        </div>
    `;
    
    document.getElementById('gameState').innerHTML = html;
    document.getElementById('actionArea').innerHTML = '';
    
    if (result.isSuccess) {
        setTimeout(() => {
            showGoalChance(true);
        }, 2000);
    } else {
        game.log.push(`❌ Angriff abgewehrt - Kein Tor`);
        game.endTurn(game.selectedAttacker, true);
        updateUI();
        setTimeout(() => nextPhase(), 2000);
    }
}

function showGoalChance(isPlayerAttacking) {
    const goalChance = game.resolveGoalChance(isPlayerAttacking);
    
    const html = `
        <div class="game-state">
            <h3>🎯 Strafraum-Drama (Torchance)</h3>
            <p>Wähle eine Momentum-Karte:</p>
            <div class="card-selection">
                ${goalChance.playerCards.map((card, i) => `
                    <div class="momentum-card" onclick="selectPlayerMomentum(${i})">
                        ${card.name}<br>
                        <small>${card.value > 0 ? '+' : ''}${card.value}</small>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    
    document.getElementById('gameState').innerHTML = html;
    document.getElementById('actionArea').innerHTML = '';
    
    // Store for later use
    window.currentGoalChance = goalChance;
    window.isPlayerAttackingGoal = isPlayerAttacking;
}

function selectPlayerMomentum(index) {
    const goalChance = window.currentGoalChance;
    const playerCard = goalChance.playerCards[index];
    
    // AI selects randomly
    const aiIndex = Math.floor(Math.random() * goalChance.aiCards.length);
    const aiCard = goalChance.aiCards[aiIndex];
    
    // Calculate goal
    let playerValue = game.selectedAttacker.attack + playerCard.value;
    let aiValue = game.selectedDefender.defense + aiCard.value;
    
    // Add mode bonus
    if (GAME_MODES[game.mode].strikerBonus && game.selectedAttacker.role === 'ST') {
        playerValue += GAME_MODES[game.mode].strikerBonus;
    }
    
    const isGoal = playerValue > aiValue;
    
    const html = `
        <div class="game-state">
            <h3>🥅 Schussversuch</h3>
            <div class="player-info">
                <strong>Dein Schuss:</strong> ${game.selectedAttacker.name} (${playerCard.name})<br>
                Wert: ${playerValue}
            </div>
            <div class="player-info">
                <strong>Torwart:</strong> ${game.selectedDefender.name} (${aiCard.name})<br>
                Wert: ${aiValue}
            </div>
            <div style="margin-top: 20px; padding: 15px; background: ${isGoal ? '#d4edda' : '#f8d7da'}; border-radius: 8px; text-align: center; font-weight: bold; font-size: 1.3em;">
                ${isGoal ? '⚽ TOOOOOR!' : '🧤 Gehalten!'}
            </div>
        </div>
    `;
    
    document.getElementById('gameState').innerHTML = html;
    
    if (isGoal) {
        game.playerScore++;
        game.log.push(`⚽ TOR für Spieler! (${game.playerScore}:${game.aiScore})`);
    } else {
        game.log.push(`🧤 Torwart hielt! Kein Tor.`);
    }
    
    game.endTurn(game.selectedAttacker, true);
    updateUI();
    
    setTimeout(() => nextPhase(), 2500);
}

// ============ AI TURN ============

function executeAITurn() {
    document.getElementById('currentPhase').textContent = '🤖 Computer spielt...';
    
    const attackers = game.getAvailableAttackers(false);
    
    if (attackers.length === 0) {
        game.log.push(`❌ Computer hat keine Angreifer mehr - Angriff abgebrochen`);
        updateUI();
        game.isPlayerTurn = true;
        nextPhase();
        return;
    }
    
    game.selectedAttacker = game.makeAIDecision('attacker');
    game.selectedAttackTactic = game.makeAIDecision('attackTactic');
    game.selectedDefender = game.makeAIDecision('defender');
    game.selectedDefenseTactic = game.makeAIDecision('defenseTactic');
    
    game.log.push(`🤖 Computer-Angreifer: ${game.selectedAttacker.name}`);
    game.log.push(`🤖 Computer-Taktik: ${game.selectedAttackTactic.name}`);
    
    setTimeout(() => {
        const result = game.resolveFieldDuel(
            game.selectedAttacker,
            game.selectedAttackTactic,
            game.selectedDefender,
            game.selectedDefenseTactic
        );
        
        if (result.isSuccess) {
            game.log.push(`✅ Computer Angriff erfolgreich!`);
            
            setTimeout(() => {
                showGoalChanceAI();
            }, 1500);
        } else {
            game.log.push(`❌ Computer Angriff abgewehrt`);
            game.endTurn(game.selectedAttacker, false);
            updateUI();
            
            setTimeout(() => {
                game.isPlayerTurn = true;
                nextPhase();
            }, 1500);
        }
    }, 1500);
}

function showGoalChanceAI() {
    const goalChance = game.resolveGoalChance(false);
    
    // AI selects randomly
    const playerIndex = Math.floor(Math.random() * goalChance.playerCards.length);
    const aiIndex = Math.floor(Math.random() * goalChance.aiCards.length);
    
    const playerCard = goalChance.playerCards[playerIndex];
    const aiCard = goalChance.aiCards[aiIndex];
    
    // Calculate goal
    let playerValue = game.selectedAttacker.attack + aiCard.value;
    let aiValue = game.selectedDefender.defense + playerCard.value;
    
    const isGoal = playerValue > aiValue;
    
    game.log.push(`🎯 Strafraum: ${game.selectedAttacker.name} vs ${game.selectedDefender.name}`);
    
    if (isGoal) {
        game.aiScore++;
        game.log.push(`⚽ TOR für Computer! (${game.playerScore}:${game.aiScore})`);
    } else {
        game.log.push(`🧤 Du hieltest! Kein Tor.`);
    }
    
    game.endTurn(game.selectedAttacker, false);
    updateUI();
    
    setTimeout(() => {
        game.isPlayerTurn = true;
        nextPhase();
    }, 2000);
}

// ============ GAME END ============

function endGame() {
    document.getElementById('gameBoard').style.display = 'none';
    document.getElementById('gameEnd').style.display = 'flex';
    
    const winner = game.getWinner();
    const endTitle = document.getElementById('endTitle');
    const endStats = document.getElementById('endStats');
    
    if (winner === 'player') {
        endTitle.textContent = '🎉 Du gewinnst!';
        endTitle.style.color = '#4CAF50';
    } else if (winner === 'ai') {
        endTitle.textContent = '🤖 Computer gewinnt!';
        endTitle.style.color = '#ff6b6b';
    } else {
        endTitle.textContent = '🤝 Unentschieden!';
        endTitle.style.color = '#FFA500';
    }
    
    endStats.innerHTML = `
        <div style="font-size: 1.5em; margin: 20px 0;">
            <strong>Endergebnis:</strong><br>
            Du: ${game.playerScore} Tore<br>
            Computer: ${game.aiScore} Tore
        </div>
        <div style="font-size: 1em; margin: 20px 0; color: #666;">
            <strong>Trainer:</strong><br>
            Du: ${game.playerCoach}<br>
            Computer: ${game.aiCoach}
        </div>
    `;
}
