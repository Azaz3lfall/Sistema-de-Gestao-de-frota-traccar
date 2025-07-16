require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { Pool } = require('pg');

const app = express();
const port = 3666;

// --- CONFIGURAÇÃO DO BANCO DE DADOS ---
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

// --- MIDDLEWARES ---
app.use(express.json());
app.use(express.static('public'));

// --- ROTAS DA API ---
/*
// Rota para buscar veículos do Traccar
app.get('/api/veiculos', async (req, res) => {
    try {
        const response = await axios.get(`${process.env.TRACCAR_URL}/api/devices`, {
            auth: { username: process.env.TRACCAR_USER, password: process.env.TRACCAR_PASSWORD }
        });
        res.json(response.data);
    } catch (error) {
        console.error("Erro ao buscar veículos do Traccar:", error.message);
        res.status(500).json({ error: 'Erro ao conectar com o Traccar' });
    }
});*/
// Rota para buscar veículos do Traccar
app.get('/api/meus-veiculos', async (req, res) => {
    try {
        // Pega o ID do usuário logado no seu sistema de gestão (a partir da sessão/token)
        const gestaoUserId = req.user.id; 

        // Busca no banco de dados as credenciais Traccar associadas a esse usuário
        const traccarCredentials = await db.getTraccarCredentialsForUser(gestaoUserId);
        
        if (!traccarCredentials) {
            return res.status(403).json({ error: 'Usuário não associado a uma conta Traccar.' });
        }

        //Monta as credenciais para a chamada à API do Traccar
        const credentialsB64 = btoa(`${traccarCredentials.user}:${traccarCredentials.pass}`);
        const traccarApiUrl = 'https://tracker.rastreadorautoram.com.br/api/devices';

        //chama a API do Traccar com as credenciais específicas do cliente
        const response = await fetch(traccarApiUrl, {
            headers: {
                'Authorization': `Basic ${credentialsB64}`,
            }
        });

        if (!response.ok) {
            throw new Error('Falha ao autenticar ou buscar dados no Traccar.');
        }

        const veiculosDoCliente = await response.json();

        //Retorna a lista de veículos, que já vem filtrada pelo Traccar
        res.json(veiculosDoCliente);

    } catch (error) {
        console.error("Erro no proxy para o Traccar:", error);
        res.status(500).json({ error: 'Erro interno ao buscar veículos.' });
    }
});

// Rota para o Relatório Geral de Custos
app.get('/api/relatorio-custos-geral', async (req, res) => {
    try {
        const query = `
            SELECT id, 'Custo Extra' AS tipo, descricao, valor, data_custo AS data, deviceid FROM custos_extras
            UNION ALL
            SELECT id, 'Abastecimento' AS tipo, 'Abastecimento da viagem' AS descricao, valor_abastecimento AS valor, data_viagem AS data, deviceid FROM viagens WHERE valor_abastecimento IS NOT NULL AND valor_abastecimento > 0
            UNION ALL
            SELECT cv.id, 'Custo de Viagem' AS tipo, cv.descricao, cv.valor, cv.data_custo AS data, v.deviceid FROM custos_viagem cv JOIN viagens v ON cv.viagem_id = v.id
            ORDER BY data DESC;
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (error) {
        console.error('Erro ao gerar relatório geral de custos:', error);
        res.status(500).json({ error: 'Erro interno ao gerar relatório.' });
    }
});

// --- ROTAS DE CUSTOS EXTRAS ---
app.get('/api/custos', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM custos_extras ORDER BY data_custo DESC, id DESC');
        res.json(result.rows);
    } catch (error) {
        console.error('Erro ao buscar custos extras:', error);
        res.status(500).json({ error: 'Erro interno ao buscar os custos extras.' });
    }
});

app.post('/api/custos', async (req, res) => {
    const { deviceid, descricao, valor } = req.body;
    if (!deviceid || !descricao || !valor) { return res.status(400).json({ error: 'Campos obrigatórios não foram preenchidos.' }); }
    try {
        const query = 'INSERT INTO custos_extras (deviceid, descricao, valor) VALUES ($1, $2, $3) RETURNING *';
        const result = await pool.query(query, [deviceid, descricao, parseFloat(valor)]);
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Erro ao salvar custo extra:', error);
        res.status(500).json({ error: 'Erro interno ao salvar o custo extra.' });
    }
});

// --- ROTAS DE VIAGENS ---
app.get('/api/viagens', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM viagens ORDER BY data_viagem DESC, id DESC');
        res.json(result.rows);
    } catch (error) {
        console.error('Erro ao buscar viagens:', error);
        res.status(500).json({ error: 'Erro interno ao buscar as viagens.' });
    }
});

app.post('/api/viagens', async (req, res) => {
    const {
        deviceid, nome_veiculo, hodometro_inicial, hodometro_final,
        litros_abastecidos, valor_abastecimento
    } = req.body;

    if (!deviceid || !hodometro_inicial || !hodometro_final) {
        return res.status(400).json({ error: 'Campos de veículo e hodômetro são obrigatórios.' });
    }
    const distancia = parseFloat(hodometro_final) - parseFloat(hodometro_inicial);
    if (distancia < 0) { return res.status(400).json({ error: 'O hodômetro final não pode ser menor que o inicial.' }); }

    try {
        const query = `
            INSERT INTO viagens (deviceid, nome_veiculo, hodometro_inicial, hodometro_final, distancia_percorrida, litros_abastecidos, valor_abastecimento) 
            VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`;
        const values = [deviceid, nome_veiculo, hodometro_inicial, hodometro_final, distancia, litros_abastecidos || null, valor_abastecimento || null];
        const result = await pool.query(query, values);
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Erro ao inserir viagem:', error);
        res.status(500).json({ error: 'Erro interno ao salvar a viagem.' });
    }
});

// --- ROTAS PARA CUSTOS DA VIAGEM ---
app.get('/api/viagens/:viagemId/custos', async (req, res) => {
    const { viagemId } = req.params;
    try {
        const result = await pool.query('SELECT * FROM custos_viagem WHERE viagem_id = $1 ORDER BY id', [viagemId]);
        res.json(result.rows);
    } catch (error) {
        console.error('Erro ao buscar custos da viagem:', error);
        res.status(500).json({ error: 'Erro interno ao buscar custos da viagem.' });
    }
});

app.post('/api/viagens/:viagemId/custos', async (req, res) => {
    const { viagemId } = req.params;
    const { descricao, valor } = req.body;
    if (!descricao || !valor) { return res.status(400).json({ error: 'Descrição e valor são obrigatórios.' }); }
    try {
        const query = `INSERT INTO custos_viagem (viagem_id, descricao, valor) VALUES ($1, $2, $3) RETURNING *`;
        const result = await pool.query(query, [viagemId, descricao, valor]);
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Erro ao inserir custo de viagem:', error);
        res.status(500).json({ error: 'Erro interno ao salvar custo da viagem.' });
    }
});

// Inicia o servidor
app.listen(port, () => {
    console.log(`Servidor de gestão rodando em http://localhost:${port}`);
});
