
const {AuthMutations, getUser} = require('./mutations/auth')

module.exports = {
    getUser,
    Mutation: {
        ...AuthMutations
    }
}