const jwt = require('jsonwebtoken');

module.exports = (sequelizePontoVenda, sequelizeUltraSyst) => {
  return (req, res, next) => {
    try {
      // 🔎 HEADER Authorization
      const authHeader = req.headers.authorization;

      if (!authHeader) {
        return res.status(401).json({
          error: 'Token não enviado'
        });
      }

      // 🔎 FORMATO: Bearer TOKEN
      if (!authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          error: 'Formato do token inválido (use Bearer TOKEN)'
        });
      }

      const token = authHeader.split(' ')[1];

      if (!token) {
        return res.status(401).json({
          error: 'Token não encontrado'
        });
      }

      // 🔐 VALIDA TOKEN
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // 🔎 DEBUG (pode remover depois)
      console.log('🔐 Token decodificado:', decoded);

      // 🔥 VALIDA CAMPOS OBRIGATÓRIOS
      if (!decoded.instancia) {
        return res.status(401).json({
          error: 'Token sem instância definida'
        });
      }

      // 🔥 DEFINE BANCO CORRETO
      let db;

      if (decoded.instancia === 'PontoVenda') {
        db = sequelizePontoVenda;
      } else if (decoded.instancia === 'UltraSyst') {
        db = sequelizeUltraSyst;
      } else {
        return res.status(401).json({
          error: `Instância inválida: ${decoded.instancia}`
        });
      }

      // 🔥 INJETA NA REQUISIÇÃO
      req.user = decoded;
      req.db = db;

      next();

    } catch (error) {
      console.error('❌ Erro no authMiddleware:', error.message);

      return res.status(401).json({
        error: 'Token inválido ou expirado'
      });
    }
  };
};