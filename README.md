# node-norm-mysql

Mysql adapter for [node-norm](https://github.com/xinix-technology/node-norm)

```sh
npm i node-norm-mysql
```

## Usage

```js
const { Manager } = require('node-norm');
const manager = new Manager({
  connections: [
    {
      adapter: require('node-norm-mysql'),
      host: 'localhost',
      user: 'root',
      password: 'secret',
      database: 'foo',
    },
  ],
});

// then you can use node-norm manager to run session
```

## Test

```sh
npm test
```

You can use ephemeral mysql server courtesy to docker to test this package. Run command below

```sh
docker-compose up -d
npm test
docker-compose down
```
