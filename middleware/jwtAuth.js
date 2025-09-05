const jwt = require('jsonwebtoken');

const requireJwtAuth = (req, res, next) => {
  console.log('Middleware requireJwtAuth executado para:', req.originalUrl);
  const authHeader = req.headers.authorization;
  console.log('Cabeçalho Authorization recebido:', authHeader);
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('Erro: Token de autenticação não fornecido ou inválido');
    return res.status(401).json({ error: 'Token de autenticação não fornecido.' });
  }

  const token = authHeader.split(' ')[1];
  console.log('Token extraído:', token);
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Token decodificado:', decoded);
    req.driverId = decoded.driverId;
    next();
  } catch (error) {
    console.error('Erro na verificação do JWT:', {
      message: error.message,
      name: error.name,
      stack: error.stack
    });
    return res.status(401).json({ error: `Token de autenticação inválido: ${error.message}` });
  }
};

module.exports = { requireJwtAuth };