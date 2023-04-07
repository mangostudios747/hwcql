const { MongoDataSource } = require('apollo-datasource-mongodb')

 class Users extends MongoDataSource {
  async getUserById(userId) {
    return this.findOneById(userId)
  }
  async getUserByEmail(email) {
    const oink = await this.findByFields({
        email
      })
    return oink[0]
  }



}

module.exports = Users