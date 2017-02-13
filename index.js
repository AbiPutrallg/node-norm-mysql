const Connection = require('node-norm/connection');
const mysql = require('mysql');

const TYPES = {
  'string': 'varchar(255)',
  'integer': 'int',
  'boolean': 'int',
  'reference': 'int',
  'double': 'double',
};

const OPERATORS = {
  'eq': '=',
  'gt': '>',
  'lt': '<',
  'gte': '>=',
  'lte': '<=',
};

class Mysql extends Connection {
  constructor ({ manager, name, schemas, host = '127.0.0.1', user = 'root', password, database }) {
    super({ manager, name, schemas });

    this.host = host;
    this.user = user;
    this.password = password;
    this.database = database;
  }

  async initialize () {
    for (let name in this.schemas) {
      await this.prepareTable(this.schemas[name]);
    }
  }

  async prepareTable (schema) {
    try {
      await this.query(`DESCRIBE ${schema.name}`);
    } catch (err) {
      if (err.code !== 'ER_NO_SUCH_TABLE') {
        throw err;
      }
      let fieldDefinitions = [ 'id INT AUTO_INCREMENT' ];
      for (let index in schema.fields) {
        let field = schema.fields[index];
        let type = TYPES[field.kind] || 'varchar(255)';
        fieldDefinitions.push(`${field.name} ${type}`);
      }
      await this.query(`CREATE TABLE ${schema.name} (\n  ${fieldDefinitions.join(',\n  ')},\n  PRIMARY KEY(id)\n)`);
    }
  }

  async persist (query, callback = () => {}) {
    switch (query._method) {
      case 'insert':
        return await this.insert(query, callback);
      case 'update':
        return await this.update(query, callback);
      case 'truncate':
        await this.truncate(query);
        return;
      case 'drop':
        await this.drop(query);
        return;
      default:
        throw new Error(`Unimplemented persist ${query._method}`);
    }
  }

  async update (query, callback) {
    let [ wheres, data ] = this.getWhere(query);
    let sql = `UPDATE ${query.schema.name} SET ? ${wheres}`;

    data.unshift(query._sets);

    await this.query(sql, data);
  }

  getWhere (query) {
    let wheres = [];
    let data = [];
    for (let key in query._criteria) {
      let value = query._criteria[key];
      let [ field, operator = 'eq' ] = key.split('!');
      data.push(value);
      wheres.push(`${field} ${OPERATORS[operator]} ?`);
    }

    if (!wheres.length) {
      return [];
    }

    return [ `WHERE ${wheres.join(' AND ')}`, data ];
  }

  getOrderBy (query) {
    let orderBys = [];
    for (let key in query._sorts) {
      let val = query._sorts[key];

      orderBys.push(`${key} ${val ? 'ASC' : 'DESC'}`);
    }

    if (!orderBys.length) {
      return;
    }

    return `ORDER BY ${orderBys.join(', ')}`;
  }

  async load (query, callback = () => {}) {
    let sqlArr = [ 'SELECT *', `FROM ${query.schema.name}` ];
    let [ wheres, data ] = this.getWhere(query);
    if (wheres) {
      sqlArr.push(wheres);
    }

    let orderBys = this.getOrderBy(query);
    if (orderBys) {
      sqlArr.push(orderBys);
    }

    if (query._limit >= 0) {
      sqlArr.push(`LIMIT ${query._limit}`);

      if (query._skip > 0) {
        sqlArr.push(`OFFSET ${query._skip}`);
      }
    }

    let sql = sqlArr.join(' ');
    let { results } = await this.query(sql, data);
    return results.map(row => {
      callback(row);
      return row;
    });
  }

  async truncate (query) {
    await this.query(`TRUNCATE TABLE ${query.schema.name}`);
  }

  async drop (query) {
    await this.query(`DROP TABLE ${query.schema.name}`);
  }

  async insert (query, callback) {
    return Promise.all(await query._inserts.map(async insert => {
      let row = Object.assign({}, insert);
      let { results: { insertId } } = await this.query(`INSERT INTO ${query.schema.name} SET ?`, row);
      row.id = insertId;
      callback(row);
      return row;
    }));
  }

  query (sql, data) {
    return new Promise((resolve, reject) => {
      console.log('SQL:', sql, 'DATA:', data ? JSON.stringify(data) : '');
      let conn = this.getConnection();
      conn.query(sql, data, (err, results, fields) => {
        if (err) {
          let newErr = new Error(`MYSQL_ERROR: ${err.message} SQL[${sql}] PARAMS[${JSON.stringify(data)}]`);
          newErr.code = err.code;
          newErr.originalError = err;
          return reject(newErr);
        }

        resolve({ results, fields });
      });
    });
  }

  getConnection () {
    if (!this._connection) {
      this._connection = mysql.createConnection(this);

      this._connection.connect();
    }

    return this._connection;
  }
}

module.exports = Mysql;
