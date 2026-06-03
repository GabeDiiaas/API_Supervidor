function createMultiDb(sequelizeList) {
  return {
    QueryTypes: sequelizeList[0].QueryTypes,

    async query(sql, options) {
      for (const db of sequelizeList) {
        try {
          const result = await db.query(sql, options);

          if (Array.isArray(result) && result.length > 0) {
            return result;
          }

        } catch (err) {
          console.log(`Erro no banco:`, err.message);
        }
      }

      return [];
    }
  };
}

module.exports = createMultiDb;