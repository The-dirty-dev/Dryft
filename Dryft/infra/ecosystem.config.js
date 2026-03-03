module.exports = {
  apps: [
    {
      name: 'dryft-api',
      cwd: '/home/thedirtyadmin/api.dryft.site/opt/dryft',
      script: './dryft-api',
      interpreter: 'none',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,
      max_restarts: 10,
      min_uptime: '10s',
      env_file: '/home/thedirtyadmin/api.dryft.site/opt/dryft/.env.prod',
      out_file: '/home/thedirtyadmin/api.dryft.site/opt/dryft/dryft.log',
      error_file: '/home/thedirtyadmin/api.dryft.site/opt/dryft/dryft-error.log',
      merge_logs: true,
      time: true,
    },
  ],
};

