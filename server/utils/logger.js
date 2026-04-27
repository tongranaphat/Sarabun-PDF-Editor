const logger = {
    info: (message, ...args) => {
        console.info(`[INFO] ${new Date().toISOString()} - ${message}`, ...args);
    },
    error: (message, error) => {
        console.error(`[ERROR] ${new Date().toISOString()} - ${message}`);
        if (error) {
            console.error('Error details:', error.message || error);
            if (error.stack) {
                console.error('Stack trace:', error.stack);
            }
        }
    },
    warn: (message, ...args) => {
        console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, ...args);
    },
    success: (message, ...args) => {
        console.info(`[SUCCESS] ${new Date().toISOString()} - ${message}`, ...args);
    }
};

module.exports = logger;
