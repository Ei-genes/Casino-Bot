const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'casino.json');

// Default database structure
const defaultDb = {
    users: {},
    casino: {
        jackpot: 10000, // Slots jackpot
        totalPlayed: 0,
        totalWinnings: 0,
        dailyResets: {}
    },
    lottery: {
        jackpot: 10000 // Separate lottery jackpot
    },
    leaderboard: {
        richest: [],
        biggestWins: [],
        mostPlayed: []
    },
    settings: {
        dailyAmount: 1000,
        dailyCooldown: 86400000, // 24 hours in ms
        maxLoanAmount: 5000,
        loanInterestRate: 0.1 // 10%
    }
};

// Read database
function readDb() {
    try {
        if (!fs.existsSync(dbPath)) {
            writeDb(defaultDb);
            return defaultDb;
        }
        const data = fs.readFileSync(dbPath, 'utf8');
        const db = JSON.parse(data);
        
        // Ensure all required properties exist
        if (!db.users) db.users = {};
        if (!db.casino) db.casino = defaultDb.casino;
        if (!db.lottery) db.lottery = defaultDb.lottery;
        if (!db.leaderboard) db.leaderboard = defaultDb.leaderboard;
        if (!db.settings) db.settings = defaultDb.settings;
        
        return db;
    } catch (error) {
        console.error('Error reading database:', error);
        return defaultDb;
    }
}

// Write database
function writeDb(data) {
    try {
        fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error writing database:', error);
    }
}

// Get or create user
function getUser(userId) {
    const db = readDb();
    if (!db.users[userId]) {
        db.users[userId] = {
            balance: 1000, // Starting balance
            stats: {
                gamesPlayed: 0,
                gamesWon: 0,
                totalWinnings: 0,
                totalLost: 0,
                biggestWin: 0,
                winStreak: 0,
                currentStreak: 0
            },
            daily: {
                lastClaim: 0,
                streak: 0
            },
            loans: {
                borrowed: [],
                lent: []
            },
            achievements: [],
            joinedAt: Date.now()
        };
        writeDb(db);
    }
    return db.users[userId];
}

// Update user data
function updateUser(userId, userData) {
    const db = readDb();
    db.users[userId] = { ...db.users[userId], ...userData };
    writeDb(db);
    return db.users[userId];
}

// Add money to user
function addMoney(userId, amount, reason = 'Unknown') {
    const db = readDb();
    const user = getUser(userId);
    user.balance += amount;
    
    if (amount > 0) {
        user.stats.totalWinnings += amount;
        if (amount > user.stats.biggestWin) {
            user.stats.biggestWin = amount;
        }
    } else {
        user.stats.totalLost += Math.abs(amount);
    }
    
    db.users[userId] = user;
    writeDb(db);
    return user;
}

// Remove money from user
function removeMoney(userId, amount) {
    return addMoney(userId, -amount, 'Expense');
}

// Check if user can afford something
function canAfford(userId, amount) {
    const user = getUser(userId);
    return user.balance >= amount;
}

// Update casino stats
function updateCasinoStats(played = 0, winnings = 0) {
    const db = readDb();
    db.casino.totalPlayed += played;
    db.casino.totalWinnings += winnings;
    writeDb(db);
}

// Update jackpot
function updateJackpot(amount) {
    const db = readDb();
    db.casino.jackpot += amount;
    writeDb(db);
    return db.casino.jackpot;
}

// Reset jackpot
function resetJackpot() {
    const db = readDb();
    const oldJackpot = db.casino.jackpot;
    db.casino.jackpot = 10000;
    writeDb(db);
    return oldJackpot;
}

// Get jackpot amount
function getJackpot() {
    const db = readDb();
    return db.casino.jackpot;
}

// Update leaderboard
function updateLeaderboard() {
    const db = readDb();
    const users = Object.entries(db.users).map(([id, data]) => ({
        id,
        ...data
    }));
    
    // Richest users
    db.leaderboard.richest = users
        .sort((a, b) => b.balance - a.balance)
        .slice(0, 10)
        .map(user => ({ id: user.id, balance: user.balance }));
    
    // Biggest wins
    db.leaderboard.biggestWins = users
        .sort((a, b) => b.stats.biggestWin - a.stats.biggestWin)
        .slice(0, 10)
        .map(user => ({ id: user.id, amount: user.stats.biggestWin }));
    
    // Most played
    db.leaderboard.mostPlayed = users
        .sort((a, b) => b.stats.gamesPlayed - a.stats.gamesPlayed)
        .slice(0, 10)
        .map(user => ({ id: user.id, games: user.stats.gamesPlayed }));
    
    writeDb(db);
}

// Lottery jackpot functions
function getLotteryJackpot() {
    const db = readDb();
    return db.lottery.jackpot;
}

function addToLotteryJackpot(amount) {
    const db = readDb();
    db.lottery.jackpot += amount;
    writeDb(db);
    return db.lottery.jackpot;
}

function resetLotteryJackpot() {
    const db = readDb();
    const oldJackpot = db.lottery.jackpot;
    db.lottery.jackpot = 10000;
    writeDb(db);
    return oldJackpot;
}

// Function to contribute to lottery from game bets
function contributeLotteryFromBet(betAmount) {
    const contribution = Math.floor(betAmount * 0.1); // 10% of bet
    addToLotteryJackpot(contribution);
    return contribution;
}

// Loan system functions
function createLoan(lenderId, borrowerId, amount) {
    const db = readDb();
    const lender = getUser(lenderId);
    const borrower = getUser(borrowerId);
    
    if (!canAfford(lenderId, amount)) {
        return { success: false, message: 'Lender cannot afford this loan' };
    }
    
    const loan = {
        id: Date.now().toString(),
        lenderId,
        borrowerId,
        amount,
        interest: Math.floor(amount * db.settings.loanInterestRate),
        totalOwed: amount + Math.floor(amount * db.settings.loanInterestRate),
        createdAt: Date.now(),
        dueAt: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
    };
    
    // Remove money from lender
    removeMoney(lenderId, amount);
    
    // Add money to borrower
    addMoney(borrowerId, amount);
    
    // Update loan records
    lender.loans.lent.push(loan);
    borrower.loans.borrowed.push(loan);
    
    db.users[lenderId] = lender;
    db.users[borrowerId] = borrower;
    writeDb(db);
    
    return { success: true, loan };
}

function repayLoan(borrowerId, loanId) {
    const db = readDb();
    const borrower = getUser(borrowerId);
    
    const loanIndex = borrower.loans.borrowed.findIndex(loan => loan.id === loanId);
    if (loanIndex === -1) {
        return { success: false, message: 'Loan not found' };
    }
    
    const loan = borrower.loans.borrowed[loanIndex];
    
    if (!canAfford(borrowerId, loan.totalOwed)) {
        return { success: false, message: 'Cannot afford to repay loan' };
    }
    
    // Remove money from borrower
    removeMoney(borrowerId, loan.totalOwed);
    
    // Add money to lender
    addMoney(loan.lenderId, loan.totalOwed);
    
    // Remove loan from both users
    borrower.loans.borrowed.splice(loanIndex, 1);
    
    const lender = getUser(loan.lenderId);
    const lenderLoanIndex = lender.loans.lent.findIndex(l => l.id === loanId);
    if (lenderLoanIndex !== -1) {
        lender.loans.lent.splice(lenderLoanIndex, 1);
    }
    
    db.users[borrowerId] = borrower;
    db.users[loan.lenderId] = lender;
    writeDb(db);
    
    return { success: true, loan };
}

function getOverdueLoans(userId) {
    const user = getUser(userId);
    const now = Date.now();
    
    return user.loans.borrowed.filter(loan => now > loan.dueAt);
}

function isBlockedFromGambling(userId) {
    const overdueLoans = getOverdueLoans(userId);
    return overdueLoans.length > 0;
}

function getAllUserLoans(userId) {
    const user = getUser(userId);
    return {
        borrowed: user.loans.borrowed,
        lent: user.loans.lent,
        overdue: getOverdueLoans(userId)
    };
}

module.exports = {
    readDb,
    writeDb,
    getUser,
    updateUser,
    addMoney,
    removeMoney,
    canAfford,
    updateCasinoStats,
    updateJackpot,
    resetJackpot,
    getJackpot,
    updateLeaderboard,
    getLotteryJackpot,
    addToLotteryJackpot,
    resetLotteryJackpot,
    contributeLotteryFromBet,
    createLoan,
    repayLoan,
    getOverdueLoans,
    isBlockedFromGambling,
    getAllUserLoans
}; 