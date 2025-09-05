const axios = require('axios');

const requireAuthAndFilter = async (req, res, next) => {
    const traccarCookie = req.headers.cookie;
    
    if (!traccarCookie || !traccarCookie.includes('JSESSIONID')) {
        return res.status(401).json({ error: 'Não autenticado. Faça login na plataforma de rastreamento.' });
    }

    try {
        const response = await axios.get(`${process.env.TRACCAR_API_URL}/devices`, {
            headers: { 'Cookie': traccarCookie }
        });
        
        req.userVehicleIds = response.data.map(device => device.id);

        if (req.userVehicleIds.length === 0) {
            return res.status(403).json({ error: 'Nenhum veículo associado a este usuário.' });
        }

        next();
    } catch (error) {
        console.error('Erro ao buscar dispositivos do Traccar para o usuário:', error.response ? error.response.data : error.message);
        req.session.destroy();
        return res.status(401).json({ error: 'Sessão expirada. Por favor, faça login na plataforma de rastreamento.' });
    }
};

module.exports = { requireAuthAndFilter };