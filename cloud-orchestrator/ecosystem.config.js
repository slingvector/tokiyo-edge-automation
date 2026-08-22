module.exports = {
  apps: [{
    name: "tokiyo-orchestrator",
    script: "npx",
    args: "tsx src/server.ts",
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: "1G",
    env: {
      NODE_ENV: "production",
      PORT: 3000
    }
  }]
}
