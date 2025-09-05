require('dotenv').config();

const { Pool } = require('pg');

// Imprime as variáveis para termos certeza de que foram carregadas
console.log('--- Verificando Variáveis de Ambiente ---');
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_DATABASE:', process.env.DB_DATABASE);
console.log('DB_PASSWORD:', process.env.DB_PASSWORD); 
console.log('DB_PORT:', process.env.DB_PORT);
console.log('-----------------------------------------');

// Configura o pool com as variáveis carregadas
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

console.log('\nTentando conectar ao banco de dados...');

// Tenta conectar
pool.connect()
  .then(client => {
    console.log('✅ SUCESSO! A conexão com o banco de dados funcionou.');
    client.release();
    pool.end(); // Fecha a conexão
  })
  .catch(err => {
    console.error('❌ FALHA! Erro de conexão com o banco de dados:');
    console.error(err.stack);
    pool.end();
  });
