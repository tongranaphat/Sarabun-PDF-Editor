const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

// โหลด DATABASE_URL จาก environment
let databaseUrl = process.env.DATABASE_URL;

/**
 * ตรวจสอบว่ากำลังรันอยู่ใน Docker หรือไม่
 */
const isDocker = () => {
    try {
        // เช็ค .dockerenv (Standard Linux Docker)
        if (fs.existsSync('/.dockerenv')) return true;
        
        // เช็คจาก cgroup (Alternative)
        if (fs.existsSync('/proc/1/cgroup')) {
            const cgroup = fs.readFileSync('/proc/1/cgroup', 'utf8');
            if (cgroup.includes('docker')) return true;
        }
    } catch (e) {
        // ละเว้น error หากไฟล์ไม่มี (เช่นใน Windows Local)
    }
    return false;
};

// หากตรวจพบว่ารันใน Docker แต่ URL ยังเป็น localhost ให้สลับเป็น 'db' อัตโนมัติ
// วิธีนี้ทำให้เราเขียน localhost ทิ้งไว้ใน .env ได้เลย และจะทำงานได้ทั้งคู่
if (isDocker() && databaseUrl && databaseUrl.includes('@localhost:')) {
    databaseUrl = databaseUrl.replace('@localhost:', '@db:');
    console.log('🐳 Docker environment detected: Auto-switching DATABASE_URL from "localhost" to "db"');
}

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: databaseUrl,
        },
    },
});

module.exports = prisma;
