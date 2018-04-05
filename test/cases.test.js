/* globals describe it beforeEach afterEach */

const assert = require('assert');
const mysql = require('mysql');
const Manager = require('node-norm');
const Model = require('node-norm/model');
const util = require('util');
const config = {
  adapter: require('../'),
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_DATABASE || 'testing',
};

const conn = mysql.createConnection(config);

function query (sql, params) {
  return new Promise((resolve, reject) => {
    conn.query(sql, params, (err, results, fields) => {
      if (err) return reject(err);

      resolve({ results, fields });
    });
  });
}

describe('cases', () => {
  let manager;

  beforeEach(async () => {
    await query('DROP TABLE IF EXISTS foo');
    await query(`
      CREATE TABLE foo (
        id INT AUTO_INCREMENT,
        foo VARCHAR(100),
        bar VARCHAR(100),
        PRIMARY KEY (id)
      )
    `);

    await query('INSERT INTO foo (foo) VALUES (?), (?)', ['pre1', 'pre2']);

    manager = new Manager({ connections: [ config ] });
  });

  afterEach(async () => {
    await query('DROP TABLE foo');
  });

  it('create new record', async () => {
    await manager.runSession(async session => {
      let { inserted, rows } = await session.factory('foo').insert({ foo: 'bar' }).insert({ foo: 'bar1' }).save();
      assert.equal(inserted, 2);
      assert.equal(rows.length, 2);

      let { results } = await query('SELECT * from foo');
      assert.equal(results.length, 4);
    });
  });

  it('read record', async () => {
    await manager.runSession(async session => {
      let foos = await session.factory('foo').all();
      assert.equal(foos.length, 2);
    });
  });

  it('update record', async () => {
    await manager.runSession(async session => {
      let { affected } = await session.factory('foo', 2).set({ foo: 'bar' }).save();
      assert.equal(affected, 1);
      let { results } = await query('SELECT * FROM foo WHERE id = 2');
      assert.equal(results.length, 1);
      assert.equal(results[0].foo, 'bar');
    });
  });

  it('delete record', async () => {
    await manager.runSession(async session => {
      await session.factory('foo').delete();

      let { results } = await query('SELECT * FROM foo');
      assert.equal(results.length, 0);
    });
  });
});
