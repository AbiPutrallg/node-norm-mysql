const assert = require('assert');
const mysql2 = require('mysql2/promise');
const { Manager } = require('node-norm');
const Big = require('big.js');
const {
  NBig,
  NBoolean,
  NDatetime,
  NDouble,
  NInteger,
  NList,
  NMap,
  NString,
} = require('node-norm/schemas');

const config = {
  adapter: require('..'),
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_DATABASE || 'testing',
  schemas: [
    {
      name: 'foo',
      fields: [
        new NBig('nbig'),
        new NBoolean('nboolean'),
        new NDatetime('ndatetime'),
        new NDouble('ndouble'),
        new NInteger('ninteger'),
        new NList('nlist'),
        new NMap('nmap'),
        new NString('nstring'),
      ],
    },
  ],
};

async function query (sql, params) {
  let { host, user, password, database } = config;
  let conn = await mysql2.createConnection({ host, user, password, database });
  let [ results, fields ] = await conn.query(sql, params);
  await conn.end();
  return { results, fields };
}

describe('cases with schema', () => {
  beforeEach(async () => {
    await query('DROP TABLE IF EXISTS foo');
    await query(`
CREATE TABLE foo (
  id INT AUTO_INCREMENT,
  nbig VARCHAR(100),
  nboolean INT,
  ndatetime DATETIME,
  ndouble DOUBLE,
  ninteger INT,
  nlist TEXT,
  nmap TEXT,
  nstring VARCHAR(100),
  nfield VARCHAR(100),
  PRIMARY KEY (id)
)
    `);
    await query(
      `
INSERT INTO foo (nbig, nboolean, ndatetime, ndouble, ninteger, nlist, nmap, nstring, nfield)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ? )
      `,
      [
        '123.456',
        true,
        '2018-11-21',
        12.34,
        1234,
        '["foo", "bar"]',
        '{"foo":"bar"}',
        'foobar',
        'custom-field',
      ]
    );
  });

  afterEach(async () => {
    await query('DROP TABLE foo');
  });

  it('create new record', async () => {
    let manager = new Manager({ connections: [ config ] });

    try {
      await manager.runSession(async session => {
        let { affected, rows } = await session.factory('foo')
          .insert({
            nbig: 12.34,
            nboolean: '',
            ndatetime: new Date(),
            ndouble: 1.234,
            ninteger: 1234,
            nlist: ['foo', 'bar'],
            nmap: { foo: 'bar' },
            nstring: 'foobar',
            nfield: 'foobar-field',
          })
          .save();

        assert.strictEqual(affected, 1);
        assert.strictEqual(rows.length, 1);
      });

      let { results } = await query('SELECT * from foo');
      assert.strictEqual(results.length, 2);
    } finally {
      await manager.end();
    }
  });

  it('read record', async () => {
    let manager = new Manager({ connections: [ config ] });
    try {
      await manager.runSession(async session => {
        let foos = await session.factory('foo').all();
        assert.strictEqual(foos.length, 1);
        assert(foos[0].nbig instanceof Big);
        assert.strictEqual(foos[0].nboolean, true);
        assert.strictEqual(foos[0].ndatetime.toISOString(), new Date('2018-11-21 00:00:00').toISOString());
        assert.strictEqual(foos[0].ndouble, 12.34);
        assert.strictEqual(foos[0].ninteger, 1234);
        assert.deepStrictEqual(foos[0].nlist, ['foo', 'bar']);
        assert.deepStrictEqual(foos[0].nmap, { foo: 'bar' });
        assert.strictEqual(foos[0].nfield, 'custom-field');
      });
    } finally {
      await manager.end();
    }
  });

  it('update record', async () => {
    let manager = new Manager({ connections: [ config ] });
    try {
      await manager.runSession(async session => {
        let { affected } = await session.factory('foo', 1).set({ nboolean: false }).save();
        assert.strictEqual(affected, 1);
      });

      let { results } = await query('SELECT * FROM foo WHERE id = 1');
      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].nboolean, 0);
    } finally {
      await manager.end();
    }
  });
});
