module.exports = {
  apps: [
    {
      name: 'timebank-frontend',
      cwd: '/home/openclaw/.openclaw/workspace/timebank-app/dist',
      script: 'npx',
      args: 'serve -l 5173 --cors',
      interpreter: 'none',
      autorestart: true,
      max_memory_restart: '256M',
      out_file: '../logs/pm2-frontend.out.log',
      error_file: '../logs/pm2-frontend.err.log',
      merge_logs: true,
    },
    {
      name: 'timebank-backend',
      cwd: '/home/openclaw/.openclaw/workspace/timebank-app',
      script: 'server/server.js',
      interpreter: 'node',
      autorestart: true,
      max_memory_restart: '256M',
      out_file: 'logs/pm2-backend.out.log',
      error_file: 'logs/pm2-backend.err.log',
      merge_logs: true,
    },
  ],
};
