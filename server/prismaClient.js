const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

let databaseUrl = process.env.DATABASE_URL;

const isDocker = () => {
    try {
        if (fs.existsSync('/.dockerenv')) return true;

        if (fs.existsSync('/proc/1/cgroup')) {
            const cgroup = fs.readFileSync('/proc/1/cgroup', 'utf8');
            if (cgroup.includes('docker')) return true;
        }
    } catch (e) {
    }
    return false;
};

if (isDocker() && databaseUrl && databaseUrl.includes('@localhost:')) {
    databaseUrl = databaseUrl.replace('@localhost:', '@db:');
    console.log('Docker environment detected: Auto-switching DATABASE_URL from "localhost" to "db"');
}

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: databaseUrl,
        },
    },
});

module.exports = prisma;
