require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors'); 

const app = express();
const port = process.env.PORT || 3666;

// --- Configuração do Pool do Banco de Dados ---
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

// --- Middlewares ---
app.use(cors()); 
app.use(express.json()); 

// --- Rotas da API de Gestão ---

// Rota para buscar todas as viagens
app.get('/gestao/viagens', async (req, res) => { 
    try {
        const result = await pool.query('SELECT * FROM viagens ORDER BY data_viagem DESC, id DESC');
        res.json(result.rows);
    } catch (error) {
        console.error('Erro ao buscar viagens:', error);
        res.status(500).json({ error: 'Erro interno ao buscar as viagens.' });
    }
});

// Rota para criar uma nova viagem
app.post('/gestao/viagens', async (req, res) => { 
    const { deviceid, nome_veiculo, hodometro_inicial, hodometro_final, litros_abastecidos, valor_abastecimento } = req.body;
    if (!deviceid || !nome_veiculo || !hodometro_inicial || !hodometro_final) {
        return res.status(400).json({ error: 'Campos obrigatórios (deviceid, nome_veiculo, hodometros) não foram preenchidos.' });
    }
    const distancia = parseFloat(hodometro_final) - parseFloat(hodometro_inicial);
    if (distancia < 0) {
        return res.status(400).json({ error: 'Hodômetro final não pode ser menor que o inicial.' });
    }
    try {
        const query = 'INSERT INTO viagens (deviceid, nome_veiculo, hodometro_inicial, hodometro_final, distancia_percorrida, litros_abastecidos, valor_abastecimento) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *';
        const values = [deviceid, nome_veiculo, hodometro_inicial, hodometro_final, distancia, litros_abastecidos || null, valor_abastecimento || null];
        const result = await pool.query(query, values);
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Erro ao salvar viagem:', error);
        res.status(500).json({ error: 'Erro interno ao salvar a viagem.' });
    }
});

// Rota para buscar todos os custos extras
app.get('/gestao/custos', async (req, res) => { 
    try {
        const result = await pool.query('SELECT * FROM custos_extras ORDER BY data_custo DESC, id DESC');
        res.json(result.rows);
    } catch (error) {
        console.error('Erro ao buscar custos extras:', error);
        res.status(500).json({ error: 'Erro interno ao buscar custos extras.' });
    }
});

// Rota para criar um novo custo extra
app.post('/gestao/custos', async (req, res) => { 
    const { deviceid, descricao, valor } = req.body;
    if (!deviceid || !descricao || !valor) {
        return res.status(400).json({ error: 'Campos obrigatórios (deviceid, descricao, valor) não foram preenchidos.' });
    }
    try {
        const query = 'INSERT INTO custos_extras (deviceid, descricao, valor) VALUES ($1, $2, $3) RETURNING *';
        const result = await pool.query(query, [deviceid, descricao, valor]);
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Erro ao salvar custo extra:', error);
        res.status(500).json({ error: 'Erro interno ao salvar custo extra.' });
    }
});

// Rota para buscar os custos de uma viagem específica
app.get('/gestao/viagens/:viagemId/custos', async (req, res) => { 
    const { viagemId } = req.params;
    try {
        const query = 'SELECT * FROM custos_viagem WHERE viagem_id = $1 ORDER BY data_custo ASC, id ASC';
        const result = await pool.query(query, [viagemId]);
        res.json(result.rows);
    } catch (error) {
        console.error('Erro ao buscar custos da viagem:', error);
        res.status(500).json({ error: 'Erro interno ao buscar custos da viagem.' });
    }
});

// Rota para adicionar um custo a uma viagem específica
app.post('/gestao/viagens/:viagemId/custos', async (req, res) => { 
    const { viagemId } = req.params;
    const { descricao, valor } = req.body;
    if (!descricao || !valor) {
        return res.status(400).json({ error: 'Descrição e valor são obrigatórios.' });
    }
    try {
        const query = 'INSERT INTO custos_viagem (viagem_id, descricao, valor) VALUES ($1, $2, $3) RETURNING *';
        const result = await pool.query(query, [viagemId, descricao, valor]);
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Erro ao adicionar custo à viagem:', error);
        res.status(500).json({ error: 'Erro interno ao adicionar custo à viagem.' });
    }
});


// --- Inicia o servidor ---
app.listen(port, '0.0.0.0', () => {
    console.log(`✅ Servidor da API de Gestão rodando em http://localhost:${port}`);
});
/*
// 1. CARREGAR VARIÁVEIS DE AMBIENTE (SEMPRE PRIMEIRO)
require('dotenv').config();

// 2. IMPORTAR MÓDULOS
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

// 3. CONFIGURAR O EXPRESS
const app = express();
app.use(cors());
app.use(express.json()); // Essencial para ler o corpo da requisição

const port = process.env.PORT || 3666;

// 4. CONFIGURAR O POOL DO BANCO DE DADOS
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// 5. DEFINIR AS ROTAS DA API
app.get('/gestao/custos', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM custos ORDER BY data DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Erro ao executar query de busca:', err.stack);
    res.status(500).json({ error: 'Erro no servidor ao buscar custos' });
  }
});

app.post('/gestao/custos', async (req, res) => {
  // A linha de diagnóstico que precisamos ver
  console.log('Corpo da requisição recebido:', req.body);
  
  const { descricao, valor } = req.body;
  if (!descricao || valor == null) {
    return res.status(400).json({ error: 'Descrição e valor são obrigatórios.' });
  }
  try {
    const result = await pool.query(
      'INSERT INTO custos (descricao, valor, data) VALUES ($1, $2, NOW()) RETURNING *',
      [descricao, parseFloat(valor)]
    );
    console.log('Custo inserido com sucesso:', result.rows[0]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Erro ao executar query de inserção:', err.stack);
    res.status(500).json({ error: 'Erro no servidor ao inserir custo' });
  }
});

// 6. INICIAR O SERVIDOR EXPRESS
app.listen(port, '0.0.0.0', () => {
  console.log(`✅ Servidor rodando e escutando na porta ${port}.`);
  console.log('   Aguardando requisições...');
});
*/