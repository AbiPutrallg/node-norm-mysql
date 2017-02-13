/* globals describe it beforeEach afterEach */

const assert = require('assert');
const mysql = require('mysql');
const Manager = require('node-norm');
const Model = require('node-norm/model');

const config = {
  adapter: require('../'),
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_DATABASE || 'testing',
};

const pool = mysql.createPool(config);

function getConnection () {
  return new Promise((resolve, reject) => {
    pool.getConnection((err, conn) => {
      if (err) return reject(err);

      resolve(conn);
    });
  });
}

function releaseConnection (conn) {
  conn.release();
}

function query (conn, sql, params) {
  return new Promise((resolve, reject) => {
    conn.query(sql, params, (err, results, fields) => {
      if (err) return reject(err);

      resolve({ results, fields });
    });
  });
}

describe('cases', () => {
  let conn;
  beforeEach(async () => {
    conn = await getConnection();

    await query(conn, 'DROP TABLE IF EXISTS foo');
    await query(conn, `
      CREATE TABLE foo (
        id INT AUTO_INCREMENT,
        foo INT,
        bar VARCHAR(100),
        PRIMARY KEY (id)
      )
    `);
  });

  afterEach(async () => {
    await query(conn, 'DROP TABLE foo');

    releaseConnection(conn);
  });

  describe('insert', () => {
    it('insert new row and return model', async () => {
      let manager = new Manager({ connections: [ config ] });
      let [ model ] = await manager.factory('foo').insert({ foo: 1, bar: 'satu' }).save();

      assert(model instanceof Model);

      let { results } = await query(conn, 'SELECT * FROM foo');
      assert.strictEqual(results.length, 1);
    });

    it('insert multiple rows at once', async () => {
      let manager = new Manager({ connections: [ config ] });

      await manager.factory('foo')
        .insert({ foo: 1, bar: 'satu' })
        .insert({ foo: 2, bar: 'dua' })
        .insert({ foo: 3, bar: 'tiga' })
        .save();

      let { results } = await query(conn, 'SELECT * FROM foo');
      assert.strictEqual(results.length, 3);
      assert.strictEqual(results[0].foo, 1);
      assert.strictEqual(results[1].bar, 'dua');
    });
  });

  describe('all', () => {
    it('get result as models', async () => {
      let manager = new Manager({ connections: [ config ] });
      let result = await manager.factory('foo').all();
      assert.strictEqual(result.length, 0);

      await query(conn, 'INSERT INTO foo SET ?', { foo: 1, bar: 'siji' });
      await query(conn, 'INSERT INTO foo SET ?', { foo: 2, bar: 'loro' });
      await query(conn, 'INSERT INTO foo SET ?', { foo: 3, bar: 'telu' });

      let [ model ] = await manager.factory('foo').all();
      assert(model instanceof Model);
    });
  });

  describe('single', () => {
    it('get result as model', async () => {
      await query(conn, 'INSERT INTO foo SET ?', { foo: 1, bar: 'siji' });
      await query(conn, 'INSERT INTO foo SET ?', { foo: 2, bar: 'loro' });
      await query(conn, 'INSERT INTO foo SET ?', { foo: 3, bar: 'telu' });

      let manager = new Manager({ connections: [ config ] });
      let model = await manager.factory('foo').single();
      assert(model instanceof Model);
    });
  });

  describe('find', () => {
    beforeEach(async () => {
      await query(conn, 'INSERT INTO foo SET ?', { foo: 1, bar: 'siji' });
      await query(conn, 'INSERT INTO foo SET ?', { foo: 2, bar: 'loro' });
      await query(conn, 'INSERT INTO foo SET ?', { foo: 3, bar: 'telu' });
    });

    it('define criteria with find', async () => {
      let manager = new Manager({ connections: [ config ] });
      let model = await manager.factory('foo').find({ foo: 2 }).single();
      assert.strictEqual(model.bar, 'loro');
    });

    it('call find implicit from factory method', async () => {
      let manager = new Manager({ connections: [ config ] });
      let model = await manager.factory('foo', { foo: 2 }).single();
      assert.strictEqual(model.bar, 'loro');
    });
  });

  describe('limit and skip', () => {
    beforeEach(async () => {
      await query(conn, 'INSERT INTO foo SET ?', { foo: 1, bar: 'siji' });
      await query(conn, 'INSERT INTO foo SET ?', { foo: 2, bar: 'loro' });
      await query(conn, 'INSERT INTO foo SET ?', { foo: 3, bar: 'telu' });
    });

    it('return all rows without limit and offset', async () => {
      let manager = new Manager({ connections: [ config ] });
      let models = await manager.factory('foo').all();
      assert.strictEqual(models.length, 3);
    });

    it('return 2 rows with limit 2', async () => {
      let manager = new Manager({ connections: [ config ] });
      let models = await manager.factory('foo').limit(2).all();
      assert.strictEqual(models.length, 2);
      assert.strictEqual(models[0].foo, 1);
      assert.strictEqual(models[1].bar, 'loro');
    });

    it('return 1 rows with limit 5 skip 2', async () => {
      let manager = new Manager({ connections: [ config ] });
      let models = await manager.factory('foo').limit(5).skip(2).all();
      assert.strictEqual(models.length, 1);
      assert.strictEqual(models[0].foo, 3);
    });
  });

  describe('sort', () => {
    beforeEach(async () => {
      await query(conn, 'INSERT INTO foo SET ?', { foo: 3, bar: 'a' });
      await query(conn, 'INSERT INTO foo SET ?', { foo: 1, bar: 'b' });
      await query(conn, 'INSERT INTO foo SET ?', { foo: 2, bar: 'c' });
    });

    it('results b, c, a sort by foo', async () => {
      let manager = new Manager({ connections: [ config ] });
      let models = await manager.factory('foo').sort({ foo: 1 }).all();
      assert.strictEqual(models.map(m => m.bar).join(', '), 'b, c, a');
    });
  });

  describe('set and save', () => {
    beforeEach(async () => {
      await query(conn, 'INSERT INTO foo SET ?', { foo: 1, bar: 'a' });
      await query(conn, 'INSERT INTO foo SET ?', { foo: 2, bar: 'b' });
      await query(conn, 'INSERT INTO foo SET ?', { foo: 3, bar: 'c' });
    });

    it('update foo:2 only', async () => {
      let manager = new Manager({ connections: [ config ] });
      await manager.factory('foo', { foo: 2 }).set({ bar: 'bb' }).save();

      let { results } = await query(conn, 'SELECT * FROM foo');
      assert.strictEqual(results[0].bar, 'a');
      assert.strictEqual(results[1].bar, 'bb');
      assert.strictEqual(results[2].bar, 'c');
    });
  });
});
