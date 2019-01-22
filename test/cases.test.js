const assert = require('assert');
const mysql2 = require('mysql2/promise');
const { Manager } = require('node-norm');

const config = {
  adapter: require('../'),
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_DATABASE || 'testing',
};

async function query (sql, params) {
  let { host, user, password, database } = config;
  let conn = await mysql2.createConnection({ host, user, password, database });
  let [ results, fields ] = await conn.query(sql, params);
  await conn.end();
  return { results, fields };
}

describe('cases', () => {
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
    await query('INSERT INTO foo (foo) VALUES (?), (?)', ['pre3', 'pre4']);
    await query('INSERT INTO foo (foo) VALUES (?), (?)', ['pre5', 'pre6']);
  });

  afterEach(async () => {
    await query('DROP TABLE foo');
  });

  it('create new record', async () => {
    let manager = new Manager({ connections: [ config ] });

    try {
      await manager.runSession(async session => {
        let { affected, rows } = await session.factory('foo')
          .insert({ foo: 'bar' })
          .insert({ foo: 'baz' })
          .save();
        assert.strictEqual(affected, 2);
        assert.strictEqual(rows.length, 2);
      });

      let { results } = await query('SELECT * from foo');
      assert.strictEqual(results.length, 8);
    } finally {
      await manager.end();
    }
  });

  it('read record', async () => {
    let manager = new Manager({ connections: [ config ] });
    try {
      await manager.runSession(async session => {
        let foos = await session.factory('foo').all();
        assert.strictEqual(foos.length, 6);
      });
    } finally {
      await manager.end();
    }
  });

  it('update record', async () => {
    let manager = new Manager({ connections: [ config ] });
    try {
      await manager.runSession(async session => {
        let { affected } = await session.factory('foo', 2).set({ foo: 'bar' }).save();
        assert.strictEqual(affected, 1);
      });

      let { results } = await query('SELECT * FROM foo WHERE id = 2');
      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].foo, 'bar');
    } finally {
      await manager.end();
    }
  });

  it('delete record', async () => {
    let manager = new Manager({ connections: [ config ] });
    try {
      await manager.runSession(async session => {
        await session.factory('foo').delete();
      });

      let { results } = await query('SELECT * FROM foo');
      assert.strictEqual(results.length, 0);
    } finally {
      await manager.end();
    }
  });

  it('count record', async () => {
    let manager = new Manager({ connections: [ config ] });
    try {
      await manager.runSession(async session => {
        let count = await session.factory('foo').count();
        assert.strictEqual(count, 6);
      });
    } finally {
      await manager.end();
    }
  });

  it('check limit and offset', async () => {
    let manager = new Manager({ connections: [ config ] });
    try {
      await manager.runSession(async session => {
        let data = await session.factory('foo').limit(1).skip(3).all();
        assert.strictEqual(data.length, 1);
      });
    } finally {
      await manager.end();
    }
  });

  it('check  offset without limit', async () => {
    let manager = new Manager({ connections: [ config ] });
    try {
      await manager.runSession(async session => {
        let data = await session.factory('foo').skip(3).all();
        assert.strictEqual(data.length, 3);
      });
    } finally {
      await manager.end();
    }
  });
  it('check  without offset without limit', async () => {
    let manager = new Manager({ connections: [ config ] });
    try {
      await manager.runSession(async session => {
        let data = await session.factory('foo').all();
        assert.strictEqual(data.length, 6);
      });
    } finally {
      await manager.end();
    }
  });
});
