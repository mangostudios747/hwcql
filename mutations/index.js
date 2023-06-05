
const {AuthMutations, getUser, AuthQueries} = require('./auth')

const {SpacesQueries, SpacesMutations} = require('./spaces')

const {Queries, Mutations} = require('./notes')

module.exports = {
    getUser,
    Query: {
        ...AuthQueries,
        ...SpacesQueries,
        ...Queries
    },
    Mutation: {
        ...AuthMutations,
        ...SpacesMutations,
        ...Mutations
    },
}