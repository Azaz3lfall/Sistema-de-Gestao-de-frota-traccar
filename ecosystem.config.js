module.exports = {
  apps: [{
    name: "gestao-api",
    script: "server.js",
    // A linha mais importante: define a pasta de trabalho correta
    cwd: "/root/sistema-gestao-frota/",
    watch: false, // Desativar o 'watch' por agora para simplificar
    env: {
      "NODE_ENV": "production",
    }
  }]
};
