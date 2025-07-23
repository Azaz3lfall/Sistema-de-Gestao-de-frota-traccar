/*
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

*/
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

// --- Rotas da API de Gestão (Originais) ---

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
        res.status(201).json(result.rows);
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
        res.status(201).json(result.rows[0]); // CORRIGIDO: Retornar apenas o objeto
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
        res.status(201).json(result.rows[0]); // CORRIGIDO: Retornar apenas o objeto
    } catch (error) {
        console.error('Erro ao adicionar custo à viagem:', error);
        res.status(500).json({ error: 'Erro interno ao adicionar custo à viagem.' });
    }
});


// --- NOVAS ROTAS DE RELATÓRIOS ---

// Rota para o SUMÁRIO de custos
app.get('/gestao/relatorios/sumario', async (req, res) => {
    const { deviceid } = req.query;

    try {
        const params = (deviceid && deviceid !== 'all') ? [deviceid] : []; // CORRIGIDO
        const whereClause = (deviceid && deviceid !== 'all') ? 'WHERE deviceid = $1' : '';

        const totalAbastecimentoQuery = `SELECT COALESCE(SUM(valor_abastecimento), 0) as total FROM viagens ${whereClause};`;
        const custosExtrasQuery = `SELECT COALESCE(SUM(valor), 0) as total_extras FROM custos_extras ${whereClause};`;

        let totalCustosViagemQuery;
        if (deviceid && deviceid !== 'all') {
            totalCustosViagemQuery = `
                SELECT COALESCE(SUM(cv.valor), 0) as total
                FROM custos_viagem cv
                JOIN viagens v ON cv.viagem_id = v.id
                WHERE v.deviceid = $1;
            `;
        } else {
            totalCustosViagemQuery = 'SELECT COALESCE(SUM(valor), 0) as total FROM custos_viagem;';
        }
        
        // CORRIGIDO: Desestruturação do Promise.all
        const [abastecimentoResult, custosViagemResult, extrasResult] = await Promise.all([
            pool.query(totalAbastecimentoQuery, params),
            pool.query(totalCustosViagemQuery, params),
            pool.query(custosExtrasQuery, params)
        ]);
        
        // CORRIGIDO: Acesso ao resultado da query com [0]
        const totalAbastecimento = parseFloat(abastecimentoResult.rows[0].total) || 0;
        const totalOutrosCustosViagem = parseFloat(custosViagemResult.rows[0].total) || 0;
        const totalExtras = parseFloat(extrasResult.rows[0].total_extras) || 0;

        const totalViagens = totalAbastecimento + totalOutrosCustosViagem;

        res.json({
            totalViagens,
            totalExtras,
            totalGeral: totalViagens + totalExtras
        });

    } catch (error) {
        console.error('Erro ao gerar sumário de custos:', error);
        res.status(500).json({ error: 'Erro interno ao gerar sumário de custos.' });
    }
});

// Rota para o RELATÓRIO DETALHADO de custos de viagem
app.get('/gestao/relatorios/custos-viagens', async (req, res) => {
    const { periodo, deviceid } = req.query;

    const params = []; // CORRIGIDO
    const conditions = []; // CORRIGIDO

    if (periodo === 'semanal') {
        conditions.push("v.data_viagem >= NOW() - INTERVAL '7 day'");
    } else if (periodo === 'mensal') {
        conditions.push("v.data_viagem >= NOW() - INTERVAL '1 month'");
    }

    if (deviceid && deviceid !== 'all') {
        params.push(deviceid);
        conditions.push(`v.deviceid = $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
        SELECT
            v.id as viagem_id,
            v.nome_veiculo,
            v.data_viagem,
            v.distancia_percorrida,
            COALESCE(v.valor_abastecimento, 0) as custo_abastecimento,
            COALESCE(SUM(cv.valor), 0) as outros_custos_viagem,
            (COALESCE(v.valor_abastecimento, 0) + COALESCE(SUM(cv.valor), 0)) as custo_total_viagem
        FROM
            viagens v
        LEFT JOIN
            custos_viagem cv ON v.id = cv.viagem_id
        ${whereClause}
        GROUP BY
            v.id
        ORDER BY
            v.data_viagem DESC;
    `;

    try {
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Erro ao gerar relatório de custos de viagem:', error);
        res.status(500).json({ error: 'Erro interno ao gerar relatório de custos de viagem.' });
    }
});


// --- Inicia o servidor ---
app.listen(port, '0.0.0.0', () => {
    console.log(`✅ Servidor da API de Gestão rodando em http://localhost:${port}`);
});

