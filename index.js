const Connection = require('node-norm/connection');

class Mongo extends Connection {
  async fetch (collection) {
    console.log('xx', collection.name);
    // const data = this.data[collection.name] || [];
    // return await data[collection._offset];
  }
}

module.exports = Mongo;
