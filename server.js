require('dotenv').config();
console.log('JWT_SECRET carregado:', process.env.JWT_SECRET);
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const axios = require('axios');
const multer = require('multer');
const session = require('express-session');
const bcrypt = require('bcrypt');
const path = require('path');
const jwt = require('jsonwebtoken');

// --- Importação dos middlewares de autenticação ---
const { requireJwtAuth } = require('./middleware/jwtAuth');
const { requireAuthAndFilter } = require('./middleware/authAndFilter');

const app = express();
const port = process.env.PORT || 3666;
const JWT_SECRET = process.env.JWT_SECRET;

// --- Configuração do Pool do Banco de Dados ---
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

// --- Configuração do Multer para Upload de Arquivos ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    },
});
const upload = multer({ storage: storage });

// --- Middlewares Globais ---
app.use(cors({
    origin: '*',
    credentials: true
}));
app.use(express.json());
app.use('/uploads', express.static('uploads'));
app.use(session({
    secret: process.env.SESSION_SECRET || 'secreto-super-seguro',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false,
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000
    }
}));
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] Requisição recebida: ${req.method} ${req.originalUrl}`);
    next();
});

// Aplicação dos middlewares de autenticação
// O middleware para '/app/motorista' já está definido nas rotas, como em 'app.get('/app/motorista/trips', requireJwtAuth, ...)'
app.use('/api', requireAuthAndFilter);
app.use('/gestao', requireAuthAndFilter);

// =============================================================================
// ROTAS DE AUTENTICAÇÃO
// =============================================================================

app.post('/auth/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email e senha são obrigatórios.' });
    }
    try {
        const traccarAuth = await axios.post(`${process.env.TRACCAR_API_URL}/session`, new URLSearchParams({ email, password }), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        req.session.traccarCookie = traccarAuth.headers['set-cookie'];
        req.session.userEmail = email;
        res.status(200).json({ message: 'Autenticação bem-sucedida.' });
    } catch (error) {
        console.error('Erro de autenticação com Traccar:', error.response ? error.response.data : error.message);
        res.status(401).json({ error: 'Credenciais inválidas.' });
    }
});

app.post('/auth/driver-login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Usuário e senha são obrigatórios.' });
    }
    try {
        const userResult = await pool.query('SELECT driver_id, password_hash FROM driver_users WHERE username = $1 AND is_active = TRUE', [username]);
        if (userResult.rowCount === 0) {
            return res.status(401).json({ error: 'Credenciais inválidas.' });
        }
        const user = userResult.rows[0];
        const passwordMatch = await bcrypt.compare(password, user.password_hash);
        if (!passwordMatch) {
            return res.status(401).json({ error: 'Credenciais inválidas.' });
        }
        const token = jwt.sign({ driverId: user.driver_id }, JWT_SECRET, { expiresIn: '24h' });
        res.status(200).json({ message: 'Login do motorista bem-sucedido.', token });
    } catch (error) {
        console.error('Erro no login do motorista:', {
            message: error.message,
            stack: error.stack
        });
        res.status(500).json({ error: 'Erro interno no servidor. Tente novamente mais tarde.' });
    }
});

app.post('/auth/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ error: 'Não foi possível encerrar a sessão.' });
        }
        res.status(200).json({ message: 'Sessão encerrada com sucesso.' });
    });
});

app.post('/auth/driver-logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ error: 'Não foi possível encerrar a sessão do motorista.' });
        }
        res.status(200).json({ message: 'Sessão de motorista encerrada com sucesso.' });
    });
});

app.get('/auth/user', (req, res) => {
    if (req.session.userEmail) {
        return res.json({ user: req.session.userEmail });
    }
    res.status(401).json({ user: null });
});

// =============================================================================
// ROTAS DE GERENCIAMENTO DE FROTA (GESTÃO)
// =============================================================================

app.get('/', (req, res) => {
    res.send('Servidor da API de Gestão está no ar e acessível!');
});

// Rotas de Sincronização e Gerenciamento de Veículos
app.get('/api/devices', async (req, res) => {
    try {
        const devices = req.userVehicleIds;
        res.json(devices);
    } catch (error) {
        console.error('Erro ao buscar dispositivos do Traccar:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Erro ao conectar com a API do Traccar.' });
    }
});

app.get('/api/reports/route', async (req, res) => {
    const { deviceId, from, to } = req.query;
    if (!deviceId || !from || !to) {
        return res.status(400).json({ error: 'deviceId, from e to são obrigatórios.' });
    }
    try {
        if (!req.userVehicleIds.includes(Number(deviceId))) {
            return res.status(403).json({ error: 'Acesso negado. Você não tem permissão para acessar a rota deste veículo.' });
        }
        const fromDate = new Date(from).toISOString();
        const toDate = new Date(to).toISOString();
        const response = await axios.get(`${process.env.TRACCAR_API_URL}/reports/route`, {
            params: {
                deviceId: deviceId,
                from: fromDate,
                to: toDate
            },
            headers: { 'Cookie': req.headers.cookie }
        });
        res.json(response.data);
    } catch (error) {
        console.error('Erro ao buscar rota do Traccar:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Erro ao conectar com a API do Traccar ou buscar a rota.' });
    }
});

app.get('/gestao/vehicles/sync', async (req, res) => {
    try {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            let newVehiclesCount = 0;
            let updatedVehiclesCount = 0;

            for (const deviceId of req.userVehicleIds) {
                const deviceResponse = await axios.get(`${process.env.TRACCAR_API_URL}/devices/${deviceId}`, {
                    headers: { 'Cookie': req.headers.cookie }
                });
                const device = deviceResponse.data;

                // Consulta para verificar se o veículo já existe
                const checkQuery = `SELECT id FROM vehicles WHERE id = $1;`;
                const checkResult = await client.query(checkQuery, [device.id]);
                
                if (checkResult.rowCount > 0) {
                    // O veículo existe, vamos atualizá-lo
                    const updateQuery = `
                        UPDATE vehicles
                        SET name = $1
                        WHERE id = $2;
                    `;
                    await client.query(updateQuery, [device.name, device.id]);
                    updatedVehiclesCount++;
                } else {
                    // O veículo não existe, vamos inseri-lo
                    const insertQuery = `
                        INSERT INTO vehicles (id, name)
                        VALUES ($1, $2);
                    `;
                    await client.query(insertQuery, [device.id, device.name]);
                    newVehiclesCount++;
                }
            }
            await client.query('COMMIT');
            res.status(200).json({ 
                message: 'Sincronização concluída!', 
                new_vehicles: newVehiclesCount, 
                updated_vehicles: updatedVehiclesCount,
                total_traccar: req.userVehicleIds.length 
            });
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Erro ao sincronizar veículos do Traccar:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Erro interno ao sincronizar veículos.' });
    }
});

app.get('/gestao/vehicles', async (req, res) => {
    try {
        const query = `
            SELECT * FROM vehicles 
            WHERE id = ANY($1)
            ORDER BY name ASC;
        `;
        const result = await pool.query(query, [req.userVehicleIds]);
        res.json(result.rows);
    } catch (error) {
        console.error('Erro ao buscar veículos:', error);
        res.status(500).json({ error: 'Erro interno ao buscar veículos.' });
    }
});

app.put('/gestao/vehicles/:id', async (req, res) => {
    const { id } = req.params; 
    const { tank_capacity } = req.body;
    if (!req.userVehicleIds.includes(Number(id))) {
        return res.status(403).json({ error: 'Acesso negado. Você não tem permissão para editar este veículo.' });
    }
    if (tank_capacity !== null && tank_capacity !== undefined && isNaN(tank_capacity)) {
        return res.status(400).json({ error: 'A capacidade do tanque deve ser um número.' });
    }
    try {
        const query = `
            UPDATE vehicles
            SET tank_capacity = $1
            WHERE id = $2 
            RETURNING *;
        `;
        const result = await pool.query(query, [tank_capacity, Number(id)]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Veículo não encontrado.' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Erro ao atualizar veículo:', error);
        res.status(500).json({ error: 'Erro interno ao atualizar veículo.' });
    }
});

// Rotas de Gerenciamento de Motoristas
app.post('/gestao/drivers', async (req, res) => {
    const { name, cpf, cnh_number, cnh_category, cnh_validity, phone, username, password } = req.body;
    if (!name || !username || !password) {
        return res.status(400).json({ error: 'Nome, nome de usuário e senha são obrigatórios.' });
    }
    try {
        const client = await pool.connect();
        await client.query('BEGIN');
        try {
            const passwordHash = await bcrypt.hash(password, 10);
            const driverQuery = `
                INSERT INTO drivers (name, cpf, cnh_number, cnh_category, cnh_validity, phone)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING id;
            `;
            const driverResult = await client.query(driverQuery, [name, cpf, cnh_number, cnh_category, cnh_validity, phone]);
            const newDriverId = driverResult.rows[0].id;
            const userQuery = `
                INSERT INTO driver_users (username, password_hash, driver_id)
                VALUES ($1, $2, $3)
                RETURNING *;
            `;
            const userResult = await client.query(userQuery, [username, passwordHash, newDriverId]);
            await client.query('COMMIT');
            const driverData = { ...req.body, id: newDriverId, username: userResult.rows[0].username };
            res.status(201).json(driverData);
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Erro ao cadastrar motorista:', error);
        if (error.code === '23505' && error.constraint === 'driver_users_username_key') {
            return res.status(400).json({ error: 'Nome de usuário já existe.' });
        }
        res.status(500).json({ error: 'Erro interno ao cadastrar motorista.' });
    }
});

app.post('/gestao/drivers/:id/create-user', async (req, res) => {
    const { id } = req.params;
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Nome de usuário e senha são obrigatórios.' });
    }
    try {
        const driverExists = await pool.query('SELECT id FROM drivers WHERE id = $1', [id]);
        if (driverExists.rowCount === 0) {
            return res.status(404).json({ error: 'Motorista não encontrado.' });
        }
        const userExists = await pool.query('SELECT driver_id FROM driver_users WHERE driver_id = $1', [id]);
        if (userExists.rowCount > 0) {
            return res.status(409).json({ error: 'Já existe uma conta de usuário para este motorista.' });
        }
        const passwordHash = await bcrypt.hash(password, 10);
        const query = `
            INSERT INTO driver_users (username, password_hash, driver_id)
            VALUES ($1, $2, $3)
            RETURNING *;
        `;
        const result = await pool.query(query, [username, passwordHash, id]);
        res.status(201).json({ message: 'Conta de usuário criada com sucesso!', user: result.rows[0] });
    } catch (error) {
        console.error('Erro ao criar conta de usuário para motorista:', error);
        if (error.code === '23505' && error.constraint === 'driver_users_username_key') {
            return res.status(400).json({ error: 'Nome de usuário já existe.' });
        }
        res.status(500).json({ error: 'Erro interno ao criar conta de usuário.' });
    }
});

app.put('/gestao/drivers/:id/vehicles', async (req, res) => {
    const { id } = req.params;
    const { vehicle_ids } = req.body;
    if (!Array.isArray(vehicle_ids)) {
        return res.status(400).json({ error: 'vehicle_ids deve ser um array.' });
    }
    // Verificação de permissão
    const invalidVehicles = vehicle_ids.filter(vId => !req.userVehicleIds.includes(Number(vId)));
    if (invalidVehicles.length > 0) {
        return res.status(403).json({ error: 'Acesso negado. Você não tem permissão para associar um ou mais desses veículos.' });
    }
    try {
        const client = await pool.connect();
        await client.query('BEGIN');
        try {
            // Remove todas as associações antigas para este motorista
            await client.query('DELETE FROM driver_vehicles WHERE driver_id = $1', [id]);
            // Adiciona as novas associações
            if (vehicle_ids.length > 0) {
                const values = vehicle_ids.map(vId => `(${id}, ${vId})`).join(', ');
                await client.query(`INSERT INTO driver_vehicles (driver_id, vehicle_id) VALUES ${values}`);
            }
            await client.query('COMMIT');
            res.status(200).json({ message: 'Associações de veículos atualizadas com sucesso.' });
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Erro ao associar veículos ao motorista:', error);
        res.status(500).json({ error: 'Erro interno ao associar veículos.' });
    }
});

app.get('/gestao/drivers/:id/vehicles', async (req, res) => {
    const { id } = req.params;
    try {
        const query = `
            SELECT v.id, v.name
            FROM vehicles v
            JOIN driver_vehicles dv ON v.id = dv.vehicle_id
            WHERE dv.driver_id = $1
            ORDER BY v.name ASC;
        `;
        const result = await pool.query(query, [id]);
        
        // Verifica se os veículos encontrados estão na lista de permissões do usuário principal
        const allowedVehicles = result.rows.filter(vehicle => req.userVehicleIds.includes(Number(vehicle.id)));

        res.json(allowedVehicles);
    } catch (error) {
        console.error('Erro ao buscar veículos do motorista:', error);
        res.status(500).json({ error: 'Erro interno ao buscar veículos do motorista.' });
    }
});

app.put('/gestao/drivers/:id/password', async (req, res) => {
    const { id } = req.params;
    const { new_password } = req.body;
    console.log(`[SUCESSO] Rota de alteração de senha acessada para o motorista ID: ${id}`);
    if (!new_password || new_password.length < 6) {
        return res.status(400).json({ error: 'A nova senha deve ter no mínimo 6 caracteres.' });
    }
    try {
        const userResult = await pool.query('SELECT driver_id FROM driver_users WHERE driver_id = $1', [id]);
        if (userResult.rowCount === 0) {
            console.error(`[ERRO] Motorista ID ${id} não encontrado na tabela driver_users.`);
            return res.status(404).json({ error: 'Motorista não encontrado ou sem credenciais de login.' });
        }
        const passwordHash = await bcrypt.hash(new_password, 10);
        const query = `
            UPDATE driver_users
            SET password_hash = $1
            WHERE driver_id = $2;
        `;
        const result = await pool.query(query, [passwordHash, id]);
        if (result.rowCount === 0) {
            console.error(`[ERRO] Usuário do motorista ID ${id} não foi atualizado.`);
            return res.status(404).json({ error: 'Usuário do motorista não encontrado.' });
        }
        console.log(`[SUCESSO] Senha do motorista ID ${id} alterada com sucesso.`);
        res.status(200).json({ message: 'Senha atualizada com sucesso.' });
    } catch (error) {
        console.error('--- ERRO DETALHADO NA ALTERAÇÃO DE SENHA ---');
        console.error('Mensagem:', error.message);
        console.error('Stack:', error.stack);
        console.error('Objeto do Erro:', JSON.stringify(error, null, 2));
        console.error('-------------------------------------------');
        res.status(500).json({ error: 'Erro interno ao atualizar senha.' });
    }
});

app.get('/gestao/drivers', async (req, res) => {
    try {
        const query = `
            SELECT d.id, d.name, d.cpf, d.cnh_number, d.cnh_category, d.cnh_validity, d.phone, du.username,
                   (SELECT COUNT(*) FROM driver_vehicles dv WHERE dv.driver_id = d.id) as vehicle_count
            FROM drivers d
            LEFT JOIN driver_users du ON d.id = du.driver_id
            ORDER BY d.name ASC;
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (error) {
        console.error('Erro ao buscar motoristas:', error);
        res.status(500).json({ error: 'Erro interno ao buscar motoristas.' });
    }
});

app.put('/gestao/drivers/:id', async (req, res) => {
    const { id } = req.params;
    const { name, cpf, cnh_number, cnh_category, cnh_validity, phone, username } = req.body;
    
    // NOTA: O frontend precisa enviar o campo 'username' para esta rota.
    if (!name || !username) {
        return res.status(400).json({ error: 'Nome e nome de usuário são obrigatórios.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN'); // Inicia a transação

        // 1. Atualiza a tabela 'drivers'
        const driverUpdateQuery = `
            UPDATE drivers
            SET name = $1, cpf = $2, cnh_number = $3, cnh_category = $4, cnh_validity = $5, phone = $6
            WHERE id = $7
            RETURNING *;
        `;
        const driverValues = [name, cpf, cnh_number, cnh_category, cnh_validity, phone, id];
        const driverResult = await client.query(driverUpdateQuery, driverValues);
        
        if (driverResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Motorista não encontrado.' });
        }

        // 2. Atualiza a tabela 'driver_users'
        const userUpdateQuery = `
            UPDATE driver_users
            SET username = $1
            WHERE driver_id = $2;
        `;
        const userValues = [username, id];
        await client.query(userUpdateQuery, userValues);

        await client.query('COMMIT'); // Finaliza a transação

        // 3. Busca o registro completo para retornar ao frontend
        const updatedDriverQuery = `
            SELECT d.id, d.name, d.cpf, d.cnh_number, d.cnh_category, d.cnh_validity, d.phone, du.username
            FROM drivers d
            LEFT JOIN driver_users du ON d.id = du.driver_id
            WHERE d.id = $1;
        `;
        const updatedDriverResult = await pool.query(updatedDriverQuery, [id]);

        res.status(200).json(updatedDriverResult.rows[0]);
    } catch (error) {
        await client.query('ROLLBACK'); // Desfaz as alterações se algo der errado
        console.error('Erro ao atualizar motorista:', error);
        if (error.code === '23505' && error.constraint === 'driver_users_username_key') {
            return res.status(400).json({ error: 'Nome de usuário já existe.' });
        }
        res.status(500).json({ error: 'Erro interno ao atualizar motorista.' });
    } finally {
        client.release();
    }
});

app.delete('/gestao/drivers/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const query = 'DELETE FROM drivers WHERE id = $1 RETURNING *;';
        const result = await pool.query(query, [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Motorista não encontrado.' });
        }
        res.status(200).json({ message: 'Motorista excluído com sucesso.' });
    } catch (error) {
        console.error('Erro ao excluir motorista:', error);
        res.status(500).json({ error: 'Erro interno ao excluir motorista.' });
    }
});

// Rotas de Gerenciamento de Arquivos e Abastecimentos
app.post('/gestao/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    }
    const filePath = `/uploads/${req.file.filename}`;
    res.status(200).json({ filePath });
});

app.post('/gestao/refuelings', async (req, res) => {
    const { 
        vehicle_id, 
        driver_id, 
        refuel_date, 
        odometer, 
        liters_filled, 
        total_cost, 
        is_full_tank,
        foto_bomba,
        foto_odometro,
        posto_nome,
        cidade,
        viagem_id
    } = req.body;
    if (!req.userVehicleIds.includes(Number(vehicle_id))) {
        return res.status(403).json({ error: 'Acesso negado. Você não tem permissão para registrar um abastecimento para este veículo.' });
    }
    if (!vehicle_id || !refuel_date || !odometer || !liters_filled || is_full_tank === undefined) {
        return res.status(400).json({ error: 'Campos obrigatórios: vehicle_id, refuel_date, odometer, liters_filled, is_full_tank.' });
    }
    try {
        const query = `
            INSERT INTO refuelings (
                vehicle_id, 
                driver_id, 
                refuel_date, 
                odometer, 
                liters_filled, 
                total_cost, 
                is_full_tank,
                foto_bomba,
                foto_odometro,
                posto_nome,
                cidade,
                viagem_id
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING *;
        `;
        const values = [
            vehicle_id, 
            driver_id || null, 
            refuel_date, 
            odometer, 
            liters_filled, 
            total_cost || null, 
            is_full_tank,
            foto_bomba || null,
            foto_odometro || null,
            posto_nome || null,
            cidade || null,
            viagem_id || null
        ];
        const result = await pool.query(query, values);
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Erro ao registrar abastecimento:', error);
        res.status(500).json({ error: 'Erro interno ao registrar abastecimento.' });
    }
});

app.put('/gestao/abastecimentos/:id', async (req, res) => {
    const { id } = req.params;
    const { refuel_date, odometer, liters_filled, total_cost, is_full_tank, posto_nome, cidade } = req.body;
    try {
        const checkPermissionQuery = `SELECT vehicle_id FROM refuelings WHERE id = $1`;
        const permissionResult = await pool.query(checkPermissionQuery, [id]);
        if (permissionResult.rowCount === 0) {
            return res.status(404).json({ error: 'Abastecimento não encontrado.' });
        }
        const vehicleId = permissionResult.rows[0].vehicle_id;
        if (!req.userVehicleIds.includes(Number(vehicleId))) {
            return res.status(403).json({ error: 'Acesso negado. Você não tem permissão para editar este abastecimento.' });
        }
        const query = `
            UPDATE refuelings
            SET 
                refuel_date = $1, 
                odometer = $2, 
                liters_filled = $3, 
                total_cost = $4, 
                is_full_tank = $5,
                posto_nome = $6,
                cidade = $7
            WHERE id = $8
            RETURNING *;
        `;
        const values = [
            refuel_date,
            odometer,
            liters_filled,
            total_cost,
            is_full_tank,
            posto_nome || null,
            cidade || null,
            id
        ];
        const result = await pool.query(query, values);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Abastecimento não encontrado.' });
        }
        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error('Erro ao editar abastecimento:', error);
        res.status(500).json({ error: 'Erro interno ao editar abastecimento.' });
    }
});

app.get('/gestao/abastecimentos/todos', async (req, res) => {
    try {
        const query = `
            SELECT id, vehicle_id, driver_id, refuel_date, odometer, liters_filled, price_per_liter, 
                   total_cost, is_full_tank, foto_bomba, foto_odometro, posto_nome, cidade 
            FROM refuelings
            WHERE vehicle_id = ANY($1)
            ORDER BY refuel_date DESC;
        `;
        const result = await pool.query(query, [req.userVehicleIds]);
        res.json(result.rows);
    } catch (error) {
        console.error('Erro ao buscar todos os abastecimentos:', error);
        res.status(500).json({ error: 'Erro interno ao buscar abastecimentos.' });
    }
});

app.delete('/gestao/abastecimentos/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const query = 'DELETE FROM refuelings WHERE id = $1 RETURNING *;';
        const result = await pool.query(query, [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Abastecimento não encontrado.' });
        }
        res.status(200).json({ message: 'Abastecimento excluído com sucesso.' });
    } catch (error) {
        console.error('Erro ao excluir abastecimento:', error);
        res.status(500).json({ error: 'Erro interno ao excluir abastecimento.' });
    }
});

app.get('/gestao/refuelings/vehicle/:vehicleId', async (req, res) => {
    const { vehicleId } = req.params;
    if (!req.userVehicleIds.includes(Number(vehicleId))) {
        return res.status(403).json({ error: 'Acesso negado. Você não tem permissão para acessar este veículo.' });
    }
    try {
        const query = `
            SELECT r.*, d.name as driver_name
            FROM refuelings r
            LEFT JOIN drivers d ON r.driver_id = d.id
            WHERE r.vehicle_id = $1
            ORDER BY r.refuel_date DESC;
        `;
        const result = await pool.query(query, [vehicleId]);
        res.json(result.rows);
    } catch (error) {
        console.error('Erro ao buscar abastecimentos do veículo:', error);
        res.status(500).json({ error: 'Erro interno ao buscar abastecimentos.' });
    }
});

// Rotas de Gerenciamento de Custos e Viagens
app.post('/gestao/custos', async (req, res) => {
    const { vehicle_id, viagem_id, tipo_custo, descricao, valor } = req.body;
    if (vehicle_id && !req.userVehicleIds.includes(Number(vehicle_id))) {
        return res.status(403).json({ error: 'Acesso negado. Você não tem permissão para registrar um custo para este veículo.' });
    }
    if (!tipo_custo || !descricao || !valor) {
        return res.status(400).json({ error: 'Campos obrigatórios: tipo_custo, descricao, valor.' });
    }
    try {
        const query = `
            INSERT INTO custos (vehicle_id, viagem_id, tipo_custo, descricao, valor)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *;
        `;
        const result = await pool.query(query, [vehicle_id || null, viagem_id || null, tipo_custo, descricao, valor]);
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Erro ao registrar custo:', error);
        res.status(500).json({ error: 'Erro interno ao registrar custo.' });
    }
});

app.post('/gestao/maintenances', async (req, res) => {
    const { vehicle_id, maintenance_date, description, cost, odometer, provider_name } = req.body;
    if (!req.userVehicleIds.includes(Number(vehicle_id))) {
        return res.status(403).json({ error: 'Acesso negado. Você não tem permissão para registrar uma manutenção para este veículo.' });
    }
    if (!vehicle_id || !maintenance_date || !description || !cost) {
        return res.status(400).json({ error: 'Campos obrigatórios: vehicle_id, maintenance_date, description, cost.' });
    }
    try {
        const query = `
            INSERT INTO maintenances (vehicle_id, maintenance_date, description, cost, odometer, provider_name)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *;
        `;
        const values = [vehicle_id, maintenance_date, description, cost, odometer || null, provider_name || null];
        const result = await pool.query(query, values);
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Erro ao registrar manutenção:', error);
        res.status(500).json({ error: 'Erro interno ao registrar manutenção.' });
    }
});

app.post('/gestao/trips/iniciar', async (req, res) => {
    const { vehicle_id, driver_id, start_city, end_city, is_round_trip } = req.body;
    if (!req.userVehicleIds.includes(Number(vehicle_id))) {
        return res.status(403).json({ error: 'Acesso negado. Você não tem permissão para iniciar uma viagem com este veículo.' });
    }
    if (!vehicle_id || !driver_id || !start_city || !end_city) {
        return res.status(400).json({ error: 'Campos obrigatórios: vehicle_id, driver_id, start_city, end_city.' });
    }
    try {
        const query = `
            INSERT INTO trips (vehicle_id, driver_id, start_city, end_city, is_round_trip)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *;
        `;
        const values = [
            vehicle_id,
            driver_id,
            start_city,
            end_city,
            is_round_trip || false
        ];
        const result = await pool.query(query, values);
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Erro ao iniciar viagem:', error);
        res.status(500).json({ error: 'Erro interno ao iniciar viagem.' });
    }
});

app.get('/gestao/trips', async (req, res) => {
    const { status } = req.query; 
    try {
        let query = `
            SELECT t.id, t.vehicle_id, t.driver_id, t.start_city, t.end_city, t.is_round_trip,
                   t.start_date, t.end_date, t.status, t.distancia_total,
                   v.name as vehicle_name, 
                   d.name as driver_name 
            FROM trips t
            LEFT JOIN vehicles v ON t.vehicle_id = v.id
            LEFT JOIN drivers d ON t.driver_id = d.id
            WHERE t.vehicle_id = ANY($1)
        `;
        const values = [req.userVehicleIds];
        if (status) {
            query += ` AND t.status = $2`;
            values.push(status);
        }
        query += ` ORDER BY t.start_date DESC;`; 
        const result = await pool.query(query, values);
        res.json(result.rows);
    } catch (error) {
        console.error('Erro ao buscar viagens:', error);
        res.status(500).json({ error: 'Erro interno ao buscar viagens.' });
    }
});

app.put('/gestao/trips/:id/finalizar', async (req, res) => {
    const { id } = req.params;
    const { distancia_total } = req.body; 
    try {
        const checkPermissionQuery = `SELECT vehicle_id FROM trips WHERE id = $1 AND vehicle_id = ANY($2)`;
        const permissionResult = await pool.query(checkPermissionQuery, [id, req.userVehicleIds]);
        if (permissionResult.rowCount === 0) {
            return res.status(403).json({ error: 'Acesso negado. Você não tem permissão para finalizar esta viagem.' });
        }
    } catch (error) {
        return res.status(500).json({ error: 'Erro ao verificar permissão.' });
    }
    if (!distancia_total) {
        return res.status(400).json({ error: 'A distância total é obrigatória para finalizar a viagem.' });
    }
    try {
        const query = `
            UPDATE trips
            SET status = 'FINALIZADA',
                end_date = CURRENT_TIMESTAMP,
                distancia_total = $1
            WHERE id = $2
            RETURNING *;
        `;
        const result = await pool.query(query, [distancia_total, id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Viagem não encontrada.' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Erro ao finalizar viagem:', error);
        res.status(500).json({ error: 'Erro interno ao finalizar viagem.' });
    }
});

app.put('/gestao/trips/:id/cancelar', async (req, res) => {
    const { id } = req.params;
    try {
        const checkPermissionQuery = `SELECT vehicle_id FROM trips WHERE id = $1 AND vehicle_id = ANY($2)`;
        const permissionResult = await pool.query(checkPermissionQuery, [id, req.userVehicleIds]);
        if (permissionResult.rowCount === 0) {
            return res.status(403).json({ error: 'Acesso negado. Você não tem permissão para cancelar esta viagem.' });
        }
    } catch (error) {
        return res.status(500).json({ error: 'Erro ao verificar permissão.' });
    }
    try {
        const query = `
            UPDATE trips
            SET status = 'CANCELADA'
            WHERE id = $1
            RETURNING *;
        `;
        const result = await pool.query(query, [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Viagem não encontrada.' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Erro ao cancelar viagem:', error);
        res.status(500).json({ error: 'Erro interno ao cancelar viagem.' });
    }
});

// =============================================================================
// ROTAS DE RELATÓRIOS
// =============================================================================

// Função auxiliar para obter os IDs de veículos com segurança
const getVehicleIdsForReport = (req, deviceId) => {
    if (!deviceId || deviceId === 'all') {
        return req.userVehicleIds;
    }
    const idNumber = Number(deviceId);
    if (isNaN(idNumber)) {
        throw new Error('ID do veículo inválido. Deve ser um número ou "all".');
    }
    if (!req.userVehicleIds.includes(idNumber)) {
        throw new Error('Acesso negado. Você não tem permissão para acessar este veículo.');
    }
    return [idNumber];
};

// RELATÓRIO DE CUSTOS EXTRAS
app.get('/gestao/relatorios/custos-extras', async (req, res) => {
    try {
        const { periodo, deviceId } = req.query;
        const vehicleIds = getVehicleIdsForReport(req, deviceId);
        
        let dateClause = '';
        if (periodo === 'mensal') {
            dateClause = 'AND data_custo >= NOW() - INTERVAL \'30 days\'';
        } else if (periodo === 'semanal') {
            dateClause = 'AND data_custo >= NOW() - INTERVAL \'7 days\'';
        }

        const query = `
            SELECT id, vehicle_id, data_custo, tipo_custo, descricao, valor 
            FROM custos 
            WHERE viagem_id IS NULL AND vehicle_id = ANY($1) ${dateClause}
            ORDER BY data_custo DESC;
        `;
        const values = [vehicleIds];
        
        const result = await pool.query(query, values);
        res.json(result.rows);
    } catch (error) {
        console.error('Erro ao buscar relatório de custos extras:', error);
        if (error.message.includes('Acesso negado') || error.message.includes('ID do veículo inválido')) {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: 'Erro interno ao buscar relatório de custos extras.' });
    }
});

// RELATÓRIO DE CUSTOS POR VIAGEM
app.get('/gestao/relatorios/custos-por-viagem', async (req, res) => {
    try {
        const { periodo, deviceId } = req.query;
        const vehicleIds = getVehicleIdsForReport(req, deviceId);
        
        let dateClause = '';
        if (periodo === 'mensal') {
            dateClause = 'AND t.end_date >= NOW() - INTERVAL \'30 days\'';
        } else if (periodo === 'semanal') {
            dateClause = 'AND t.end_date >= NOW() - INTERVAL \'7 days\'';
        }

        const query = `
            SELECT 
                t.id, 
                t.vehicle_id, 
                t.start_city, 
                t.end_city, 
                t.is_round_trip,
                t.end_date,
                t.distancia_total,
                (SELECT SUM(valor) FROM custos WHERE viagem_id = t.id) as custo_total,
                (SELECT SUM(liters_filled) FROM refuelings WHERE viagem_id = t.id) as litros_abastecidos,
                (t.distancia_total / (SELECT SUM(liters_filled) FROM refuelings WHERE viagem_id = t.id)) as consumo_medio_viagem
            FROM trips t
            WHERE t.status = 'FINALIZADA' AND t.vehicle_id = ANY($1) ${dateClause}
            ORDER BY t.end_date DESC;
        `;
        const values = [vehicleIds];
        const result = await pool.query(query, values);
        res.json(result.rows);
    } catch (error) {
        console.error('Erro ao buscar relatório de custos por viagem:', error);
        if (error.message.includes('Acesso negado') || error.message.includes('ID do veículo inválido')) {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: 'Erro interno ao buscar relatório de custos por viagem.' });
    }
});

// RELATÓRIO DE CUSTOS POR CATEGORIA
app.get('/gestao/relatorios/custos-por-categoria', async (req, res) => {
    try {
        const { periodo, deviceId } = req.query;
        const vehicleIds = getVehicleIdsForReport(req, deviceId);
        
        let dateClause = '';
        if (periodo === 'mensal') {
            dateClause = 'AND data_custo >= NOW() - INTERVAL \'30 days\'';
        } else if (periodo === 'semanal') {
            dateClause = 'AND data_custo >= NOW() - INTERVAL \'7 days\'';
        }

        const query = `
            SELECT tipo_custo, SUM(valor) as total 
            FROM custos 
            WHERE vehicle_id = ANY($1) ${dateClause}
            GROUP BY tipo_custo
            ORDER BY tipo_custo ASC;
        `;
        const values = [vehicleIds];
        const result = await pool.query(query, values);
        res.json(result.rows);
    } catch (error) {
        console.error('Erro ao buscar relatório de custos por categoria:', error);
        if (error.message.includes('Acesso negado') || error.message.includes('ID do veículo inválido')) {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: 'Erro interno ao buscar relatório de custos por categoria.' });
    }
});

// RELATÓRIO DE CONSUMO MÉDIO GERAL
app.get('/gestao/relatorios/consumo-medio', async (req, res) => {
    try {
        const { deviceId } = req.query;
        const vehicleIds = getVehicleIdsForReport(req, deviceId);

        const query = `
            SELECT 
                SUM(distancia_total) as total_km,
                SUM(litros_abastecidos) as total_litros
            FROM (
                SELECT 
                    t.distancia_total,
                    (SELECT SUM(liters_filled) FROM refuelings WHERE viagem_id = t.id) as litros_abastecidos
                FROM trips t
                WHERE t.status = 'FINALIZADA' AND t.vehicle_id = ANY($1)
            ) as subquery;
        `;
        const values = [vehicleIds];
        const result = await pool.query(query, values);
        const data = result.rows[0];
        const consumo_medio = (data.total_litros && data.total_litros > 0) ? (data.total_km / data.total_litros) : 0;
        res.json({ consumo_medio: consumo_medio || 0 });
    } catch (error) {
        console.error('Erro ao buscar consumo médio:', error);
        if (error.message.includes('Acesso negado') || error.message.includes('ID do veículo inválido')) {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: 'Erro interno ao buscar consumo médio.' });
    }
});

// RELATÓRIO DE DISTÂNCIA POR ABASTECIMENTO (com hodômetro)
app.get('/gestao/relatorios/distancia-abastecimentos', async (req, res) => {
    try {
        let { vehicleId, periodo, startDate, endDate } = req.query;
        const vehicleIds = getVehicleIdsForReport(req, vehicleId);
        
        let dateClause = '';
        let values = [vehicleIds];
        let queryIndex = 1;

        if (periodo === 'mensal') {
            dateClause = `AND r.refuel_date >= NOW() - INTERVAL '30 days'`;
        } else if (periodo === 'semanal') {
            dateClause = `AND r.refuel_date >= NOW() - INTERVAL '7 days'`;
        } else if (periodo === 'personalizado' && startDate && endDate) {
            dateClause = `AND r.refuel_date BETWEEN $2 AND $3`;
            values.push(startDate, endDate);
            queryIndex = 3;
        }

        const query = `
            WITH RankedRefuelings AS (
                SELECT
                    id,
                    vehicle_id,
                    odometer,
                    refuel_date,
                    liters_filled,
                    posto_nome,
                    cidade,
                    viagem_id,
                    LAG(odometer) OVER (PARTITION BY vehicle_id ORDER BY refuel_date) AS odometer_anterior,
                    foto_bomba,
                    foto_odometro
                FROM refuelings
                WHERE vehicle_id = ANY($1)
            )
            SELECT
                id,
                vehicle_id,
                refuel_date,
                odometer as odometer_atual,
                liters_filled,
                posto_nome,
                cidade,
                viagem_id,
                odometer_anterior,
                (odometer - odometer_anterior) AS distancia_percorrida,
                ((odometer - odometer_anterior) / liters_filled) AS consumo_por_trecho,
                foto_bomba,
                foto_odometro
            FROM RankedRefuelings r
            WHERE r.odometer_anterior IS NOT NULL ${dateClause}
            ORDER BY refuel_date DESC;
        `;
        const result = await pool.query(query, values);
        res.json(result.rows);
    } catch (error) {
        console.error('Erro ao buscar relatório de distância por abastecimento:', error);
        if (error.message.includes('Acesso negado') || error.message.includes('ID do veículo inválido')) {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: 'Erro interno ao buscar relatório de distância por abastecimento.' });
    }
});

// RELATÓRIO DE CUSTO TOTAL DE ABASTECIMENTO
app.get('/gestao/relatorios/custo-abastecimento-total', async (req, res) => {
    try {
        let { vehicleId, periodo, startDate, endDate } = req.query;
        const vehicleIds = getVehicleIdsForReport(req, vehicleId);
        
        let dateClause = '';
        let values = [vehicleIds];
        
        if (periodo === 'mensal') {
            dateClause = 'AND refuel_date >= NOW() - INTERVAL \'30 days\'';
        } else if (periodo === 'semanal') {
            dateClause = 'AND refuel_date >= NOW() - INTERVAL \'7 days\'';
        } else if (periodo === 'personalizado' && startDate && endDate) {
            dateClause = 'AND refuel_date BETWEEN $2 AND $3';
            values.push(startDate, endDate);
        }

        const query = `
            SELECT SUM(total_cost) as total
            FROM refuelings
            WHERE vehicle_id = ANY($1) ${dateClause};
        `;
        const result = await pool.query(query, values);
        const total = result.rows[0]?.total || 0;
        res.json({ total });
    } catch (error) {
        console.error('Erro ao buscar custo total de abastecimento:', error);
        if (error.message.includes('Acesso negado') || error.message.includes('ID do veículo inválido')) {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: 'Erro interno ao buscar custo total de abastecimento.' });
    }
});

// =============================================================================
// ROTAS PARA O APLICATIVO DO MOTORISTA
// =============================================================================

app.get('/app/motorista/trips', requireJwtAuth, async (req, res) => {
    console.log('Executando query para driverId:', req.driverId);
    try {
      const { status } = req.query;
      const result = await pool.query(
        'SELECT t.*, v.name as vehicle_name FROM trips t LEFT JOIN vehicles v ON t.vehicle_id = v.id WHERE t.driver_id = $1 AND t.status = $2 ORDER BY t.start_date DESC',
        [req.driverId, status]
      );
      console.log('Resultado da query:', result.rows.length, 'linhas');
      res.json(result.rows);
    } catch (error) {
      console.error('Erro ao buscar viagens do motorista:', error);
      res.status(500).json({ error: 'Erro interno ao buscar viagens.' });
    }
});

app.post('/app/motorista/custos', requireJwtAuth, async (req, res) => {
    const { vehicle_id, viagem_id, tipo_custo, descricao, valor } = req.body;
    const driverId = req.driverId;
    if (!tipo_custo || !descricao || !valor || !viagem_id) {
        return res.status(400).json({ error: 'Campos obrigatórios: viagem_id, tipo_custo, descricao, valor.' });
    }
    try {
        const checkPermissionQuery = `SELECT driver_id FROM trips WHERE id = $1`;
        const permissionResult = await pool.query(checkPermissionQuery, [viagem_id]);
        if (permissionResult.rowCount === 0 || permissionResult.rows[0].driver_id !== driverId) {
            return res.status(403).json({ error: 'Acesso negado. Você não tem permissão para adicionar custos a esta viagem.' });
        }
        const query = `
            INSERT INTO custos (vehicle_id, viagem_id, tipo_custo, descricao, valor)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *;
        `;
        const result = await pool.query(query, [vehicle_id, viagem_id, tipo_custo, descricao, valor]);
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Erro ao registrar custo do motorista:', error);
        res.status(500).json({ error: 'Erro interno ao registrar custo.' });
    }
});

app.put('/app/motorista/trips/:id/finalizar', requireJwtAuth, async (req, res) => {
    const { id } = req.params;
    const { distancia_total } = req.body;
    const driverId = req.driverId;
    if (!distancia_total) {
        return res.status(400).json({ error: 'A distância total é obrigatória para finalizar a viagem.' });
    }
    try {
        const checkPermissionQuery = `SELECT driver_id FROM trips WHERE id = $1`;
        const permissionResult = await pool.query(checkPermissionQuery, [id]);
        if (permissionResult.rowCount === 0 || permissionResult.rows[0].driver_id !== driverId) {
            return res.status(403).json({ error: 'Acesso negado. Você não tem permissão para finalizar esta viagem.' });
        }
        const query = `
            UPDATE trips
            SET status = 'FINALIZADA',
                end_date = CURRENT_TIMESTAMP,
                distancia_total = $1
            WHERE id = $2
            RETURNING *;
        `;
        const result = await pool.query(query, [distancia_total, id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Viagem não encontrada.' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Erro ao finalizar viagem do motorista:', error);
        res.status(500).json({ error: 'Erro interno ao finalizar viagem.' });
    }
});

// ⚠️ CORREÇÃO IMPORTANTE APLICADA AQUI ⚠️
app.post('/app/motorista/refuelings', requireJwtAuth, async (req, res) => {
    const { vehicle_id, refuel_date, odometer, liters_filled, total_cost, is_full_tank, posto_nome, cidade, foto_bomba, foto_odometro, viagem_id } = req.body;
    const driverId = req.driverId;

    // A VALIDAÇÃO foi ALTERADA para que as fotos NÃO sejam mais obrigatórias.
    if (!vehicle_id || !refuel_date || !odometer || !liters_filled || is_full_tank === undefined) {
        return res.status(400).json({ error: 'Campos obrigatórios: vehicle_id, refuel_date, odometer, liters_filled, is_full_tank.' });
    }
    
    try {
        const permissionQuery = `SELECT driver_id FROM driver_vehicles WHERE driver_id = $1 AND vehicle_id = $2`;
        const permissionResult = await pool.query(permissionQuery, [driverId, vehicle_id]);
        if (permissionResult.rowCount === 0) {
            return res.status(403).json({ error: 'Acesso negado. Você não tem permissão para registrar abastecimento para este veículo.' });
        }
        const query = `
            INSERT INTO refuelings (
                vehicle_id,
                driver_id,
                refuel_date,
                odometer,
                liters_filled,
                total_cost,
                is_full_tank,
                posto_nome,
                cidade,
                foto_bomba,
                foto_odometro,
                viagem_id
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING *;
        `;
        const values = [
            vehicle_id,
            driverId,
            refuel_date,
            odometer,
            liters_filled,
            total_cost || null,
            is_full_tank,
            posto_nome || null,
            cidade || null,
            // Passa os campos, que podem ser null
            foto_bomba || null,
            foto_odometro || null,
            viagem_id || null
        ];
        const result = await pool.query(query, values);
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Erro ao registrar abastecimento do motorista:', error);
        res.status(500).json({ error: 'Erro interno ao registrar abastecimento.' });
    }
});

app.get('/app/motorista/profile', requireJwtAuth, async (req, res) => {
    try {
        const query = `
            SELECT 
                d.id, 
                d.name,
                COALESCE(
                    (SELECT JSON_AGG(JSON_BUILD_OBJECT('id', v.id, 'name', v.name))
                     FROM driver_vehicles dv
                     JOIN vehicles v ON dv.vehicle_id = v.id
                     WHERE dv.driver_id = d.id),
                    '[]'::json
                ) as associated_vehicles
            FROM drivers d
            WHERE d.id = $1
            GROUP BY d.id;
        `;
        const result = await pool.query(query, [req.driverId]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Motorista não encontrado.' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Erro ao buscar perfil do motorista:', error);
        res.status(500).json({ error: 'Erro interno ao buscar perfil.' });
    }
});
// Rota de Upload para o Aplicativo do Motorista (protegida por JWT)
app.post('/app/motorista/upload', requireJwtAuth, upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    }
    const filePath = `/uploads/${req.file.filename}`;
    res.status(200).json({ filePath });
});

app.listen(port, () => {
    console.log(`✅ Servidor da API de Gestão (V2) rodando na porta ${port}`);
});