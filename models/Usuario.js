const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Usuario = sequelize.define('Usuario', {
    US_CD: {
      type: DataTypes.STRING(50),
      primaryKey: true,
      allowNull: false,
    },
    US_EMAIL: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
    US_ACESSO: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    US_NM: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
  }, {
    tableName: 'USUARIO', 
    schema: 'dbo', // Esquema padrão do SQL Server; ajuste se for diferente
    timestamps: false, // Desativar createdAt/updatedAt, se não existirem
  });

  module.exports = Usuario;
};