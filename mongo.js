const { MongoClient } = require('mongodb');

const client = new MongoClient(process.env.MONGO_URL)

client.connect()

module.exports = client