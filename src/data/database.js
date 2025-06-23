const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'database.json');
const loansPath = path.join(__dirname, 'loans.json');

function readDb() {
    try {
        const data = fs.readFileSync(dbPath, 'utf8');
        
        // Check if file is empty or contains only whitespace
        if (!data.trim()) {
            console.log('Database file is empty, initializing with default structure...');
            const defaultData = { users: {} };
            writeDb(defaultData);
            return defaultData;
        }
        
        const parsedData = JSON.parse(data);
        
        // Ensure the data has the required structure
        if (!parsedData.users) {
            parsedData.users = {};
            writeDb(parsedData);
        }
        
        return parsedData;
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log('Database file not found, creating new one...');
            const defaultData = { users: {} };
            writeDb(defaultData);
            return defaultData;
        }
        
        if (error instanceof SyntaxError) {
            console.log('Database file corrupted, resetting to default structure...');
            const defaultData = { users: {} };
            writeDb(defaultData);
            return defaultData;
        }
        
        console.error('Error reading database file:', error);
        return { users: {} }; // Return default structure as fallback
    }
}

function writeDb(data) {
    try {
        fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error writing to database file:', error);
    }
}

function checkOverdueLoans(userId) {
    try {
        const data = fs.readFileSync(loansPath, 'utf8');
        const loans = JSON.parse(data);
        
        const activeLoans = loans.loans.filter(l => 
            l.borrowerId === userId && 
            l.status === 'active' && 
            Date.now() > l.deadline
        );
        
        return {
            hasOverdueLoans: activeLoans.length > 0,
            overdueLoans: activeLoans
        };
    } catch (error) {
        return { hasOverdueLoans: false, overdueLoans: [] };
    }
}

module.exports = { readDb, writeDb, checkOverdueLoans }; 