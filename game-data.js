// Game Data for SPIELZUG

const COACHES = {
    'Der Taktik-Fuchs': {
        advantage: '+1 bei "Kurzpass" & "Steilpass"',
        disadvantage: 'Verliert er ein Duell gegen "Pressing", kein Bonus beim nächsten Angriff',
        special: 'kurzpass_steilpass'
    },
    'Das Mentalitäts-Monster': {
        advantage: 'Darf bei Rückstand im Strafraum 3 statt 2 Momentum-Karten ziehen',
        disadvantage: 'Bei "Grätsche" und Unentschieden sofort Elfmeter',
        special: 'mental_monster'
    },
    'Der Defensiv-Guru': {
        advantage: '+1 für IVs bei "Tief stehen" & "Manndeckung"',
        disadvantage: 'Darf bei eigener Führung "Distanzschuss" und "Flügelspiel" nicht spielen',
        special: 'defensive_guru'
    },
    'Der Offensiv-Fanatiker': {
        advantage: 'Jeder gewonnene Angriff gibt Stürmer +1 für anschließende Torchance',
        disadvantage: 'IVs haben dauerhaft -1 Verteidigung',
        special: 'offensive_fanatic'
    }
};

const PLAYERS = {
    // Innenverteidiger (IV) - Verteidigung
    iv: [
        { name: 'Zweikampf-Monster', attack: 2, defense: 5, special: 'dribbling_counter' },
        { name: 'Abwehrchef', attack: 2, defense: 4, special: 'offside_trap' },
        { name: 'Lufthoheit-König', attack: 3, defense: 4, special: 'wing_counter' },
        { name: 'Stellungsspiel-Gott', attack: 2, defense: 4, special: 'zonal_defense' },
        { name: 'Aggressiver Abräumer', attack: 1, defense: 5, special: 'pressing_bonus' }
    ],
    // Zentrales Mittelfeld (ZM) - 1x angreifen pro Halbzeit
    zm: [
        { name: 'Spielmacher', attack: 4, defense: 3, special: 'through_pass' },
        { name: 'Box-to-Box Motor', attack: 3, defense: 4, special: 'short_pass' },
        { name: 'Maestro', attack: 5, defense: 2, special: 'dribbling' }
    ],
    // Stürmer (ST) - 1x angreifen pro Halbzeit
    st: [
        { name: 'Knipser', attack: 5, defense: 1, special: 'negative_momentum_to_zero' },
        { name: 'Sprinter', attack: 4, defense: 1, special: 'through_pass_bonus' },
        { name: 'Kopfballungeheuer', attack: 4, defense: 2, special: 'header_bonus' },
        { name: 'Distanzschütze', attack: 5, defense: 1, special: 'long_shot_bonus' },
        { name: 'Brecher (Wühler)', attack: 4, defense: 3, special: 'short_pass_bonus' }
    ]
};

const TACTICS = {
    attack: [
        { name: 'Steilpass', strong: ['Raumdeckung', 'Tief stehen'], weak: ['Abseitsfalle', 'Pressing'] },
        { name: 'Flügelspiel', strong: ['Pressing', 'Abseitsfalle'], weak: ['Raumdeckung', 'Manndeckung'] },
        { name: 'Kurzpass', strong: ['Tief stehen', 'Manndeckung'], weak: ['Pressing', 'Abseitsfalle'] },
        { name: 'Dribbling', strong: ['Raumdeckung', 'Pressing'], weak: ['Tief stehen', 'Manndeckung'] },
        { name: 'Distanzschuss', strong: ['Manndeckung', 'Abseitsfalle'], weak: ['Raumdeckung', 'Tief stehen'] }
    ],
    defense: [
        { name: 'Raumdeckung', strong: ['Steilpass', 'Dribbling'], weak: ['Flügelspiel', 'Distanzschuss'] },
        { name: 'Tief stehen', strong: ['Steilpass', 'Kurzpass'], weak: ['Flügelspiel', 'Distanzschuss'] },
        { name: 'Abseitsfalle', strong: ['Steilpass', 'Flügelspiel'], weak: ['Kurzpass', 'Dribbling'] },
        { name: 'Pressing', strong: ['Flügelspiel', 'Kurzpass'], weak: ['Steilpass', 'Dribbling'] },
        { name: 'Manndeckung', strong: ['Kurzpass', 'Dribbling'], weak: ['Flügelspiel', 'Distanzschuss'] }
    ]
};

const MOMENTUM = [
    { name: 'Fokus', value: 1, count: 4 },
    { name: 'Satter Schuss / Glanzparade', value: 2, count: 3 },
    { name: 'Standard-Situation', value: 0, count: 3 },
    { name: 'Nervosität', value: -1, count: 3 },
    { name: 'Riesenpatzer', value: -2, count: 2 },
    { name: 'Abpraller', value: 0, count: 2, special: 'rebound' },
    { name: 'Aluminium', value: 1, count: 2, special: 'aluminum' },
    { name: 'Traumtor / Unhaltbar', value: 3, count: 1, special: 'dream_goal' },
    { name: 'VAR-Entscheidung', value: 0, count: 1, special: 'var' },
    { name: 'Foul im Strafraum (Elfmeter)', value: 0, count: 1, special: 'penalty' },
    { name: 'Zweiter Ball', value: 1, count: 1, special: 'second_ball' },
    { name: 'Blendendes Flutlicht', value: -1, count: 1, special: 'floodlight' },
    { name: 'Tunnel / Nutmeg', value: 0, count: 1, special: 'nutmeg' }
];

const GAME_MODES = {
    A: { name: 'Der Realist', drawRule: 'defense', description: 'Abwehr gewinnt bei Gleichstand' },
    B: { name: 'Der Taktiker', drawRule: 'attacker', description: 'Angreifer gewinnt bei Gleichstand' },
    C: { name: 'Der Torjäger', drawRule: 'attacker', strikerBonus: 1, description: 'Stürmer erhalten +1 Basis-Bonus' }
};

// Helper function to build momentum deck
function buildMomentumDeck() {
    let deck = [];
    MOMENTUM.forEach(card => {
        for (let i = 0; i < card.count; i++) {
            deck.push({
                name: card.name,
                value: card.value,
                special: card.special || null
            });
        }
    });
    return deck;
}

// Helper function to shuffle array
function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// Helper function to get random coach
function getRandomCoach() {
    const coaches = Object.keys(COACHES);
    return coaches[Math.floor(Math.random() * coaches.length)];
}

// Helper function to get tactic bonus
function getTacticBonus(attackTactic, defenseTactic) {
    const attackCard = TACTICS.attack.find(t => t.name === attackTactic);
    if (attackCard.strong.includes(defenseTactic)) return 2;
    if (attackCard.weak.includes(defenseTactic)) return -2;
    return 0;
}
