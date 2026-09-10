const pool = require("../database/db");

const createAuditLog = async (auditData) => {
  const query = `
    INSERT INTO audit_logs
    (user_id, action, entity_type, entity_id, changes, ip_address, user_agent)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *;
  `;

  const result = await pool.query(query, [
    auditData.userId || null,
    auditData.action,
    auditData.entityType,
    auditData.entityId || null,
    JSON.stringify(auditData.changes || {}),
    auditData.ipAddress || null,
    auditData.userAgent || null,
  ]);

  return result.rows[0];
};

const getAuditLogs = async (filters = {}) => {
  let query = `
    SELECT
      a.*,
      u.employee_id,
      u.first_name,
      u.last_name
    FROM audit_logs a
    LEFT JOIN users u ON a.user_id = u.id
    WHERE 1 = 1
  `;

  const params = [];
  let paramCount = 1;

  if (filters.entityType) {
    query += ` AND a.entity_type = $${paramCount}`;
    params.push(filters.entityType);
    paramCount++;
  }

  if (filters.entityId) {
    query += ` AND a.entity_id = $${paramCount}`;
    params.push(filters.entityId);
    paramCount++;
  }

  if (filters.action) {
    query += ` AND a.action = $${paramCount}`;
    params.push(filters.action);
    paramCount++;
  }

  if (filters.userId) {
    query += ` AND a.user_id = $${paramCount}`;
    params.push(filters.userId);
    paramCount++;
  }

  if (filters.startDate) {
    query += ` AND a.created_at >= $${paramCount}`;
    params.push(filters.startDate);
    paramCount++;
  }

  if (filters.endDate) {
    query += ` AND a.created_at <= $${paramCount}`;
    params.push(filters.endDate);
    paramCount++;
  }

  query += ` ORDER BY a.created_at DESC LIMIT 1000;`;

  const result = await pool.query(query, params);
  return result.rows;
};

const getAuditLogsByEntity = async (entityType, entityId) => {
  const query = `
    SELECT
      a.*,
      u.employee_id,
      u.first_name,
      u.last_name
    FROM audit_logs a
    LEFT JOIN users u ON a.user_id = u.id
    WHERE a.entity_type = $1 AND a.entity_id = $2
    ORDER BY a.created_at DESC;
  `;

  const result = await pool.query(query, [entityType, entityId]);
  return result.rows;
};

const getAuditLogsByUser = async (userId, limit = 100) => {
  const query = `
    SELECT * FROM audit_logs
    WHERE user_id = $1
    ORDER BY created_at DESC
    LIMIT $2;
  `;

  const result = await pool.query(query, [userId, limit]);
  return result.rows;
};

module.exports = {
  createAuditLog,
  getAuditLogs,
  getAuditLogsByEntity,
  getAuditLogsByUser,
};
