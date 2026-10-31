module.exports = {
  apps: [
    {
      name: "xtbang-api",
      cwd: __dirname,
      script: "dist/server/xtbang",
      interpreter: "none",
      instances: 1,
      exec_mode: "fork",
      watch: false,
      kill_timeout: 12000,
      env: { HOST: "127.0.0.1", PORT: "8081" },
    },
    {
      name: "xtbang-frontend",
      cwd: __dirname,
      script: "/usr/sbin/nginx",
      args: ["-e", "stderr", "-p", `${__dirname}/`, "-c", "deploy/frontend.nginx.conf", "-g", "daemon off;"],
      interpreter: "none",
      instances: 1,
      exec_mode: "fork",
      watch: false,
      kill_timeout: 5000,
    },
  ],
};
