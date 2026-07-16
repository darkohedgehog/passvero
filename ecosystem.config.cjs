module.exports = {
  apps: [
    {
      name: "passvero",
      cwd: "/var/www/passvero",
      script: "npm",
      args: "start -- -H 127.0.0.1 -p 3000",
      interpreter: "none",

      env: {
        NODE_ENV: "production",
      },

      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",

      time: true,
      merge_logs: true,
    },
  ],
};
