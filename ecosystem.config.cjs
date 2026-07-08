module.exports = {
    apps: [
        {
            name: "game-tracker-service",
            cwd: __dirname,
            script: "dist/main.js",
            instances: 1,
            exec_mode: "fork",
            watch: false,
            autorestart: true,
            max_memory_restart: "600M",
            env: {
                NODE_ENV: "production",
                PORT: 3000,
                MONGODB_URI: "mongodb://localhost:27017/game_tracker",
                ADMIN_KEY: "change-me",
                TIMEZONE: "Asia/Hong_Kong",
            },
        },
    ],
};
