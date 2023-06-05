const { ApolloServer, gql } = require('apollo-server-express');

const express = require('express');
require("dotenv").config();
const client = require('./mongo')

const { Mutation, Query, getUser } = require('./mutations')
const typeDefs = require('./schema')
const { EmailAddressResolver, DateTimeResolver, JWTResolver } = require('graphql-scalars');
const cors = require('cors')

const Users = require('./data-sources/users.js')


const resolvers = {
    EmailAddress: EmailAddressResolver,
    DateTime: DateTimeResolver,
    JWT: JWTResolver,
    User: {
        async spaces(user, args, contextValue, info) {
            const s = await client.db().collection("spaces").find({ "members.user_id": user._id }).toArray();
            return await Promise.all(s.map(
                async (space) => {
                    return {
                        space,
                        owner: space.members.filter(e => e.user_id == user._id)[0].owner,
                        user
                    }
                }
            ))
        }
    },
    Space: {
        async members(space) {
            const x = space.members;
            return await Promise.all(x.map(
                async ({ owner, user_id }) => {
                    return {
                        owner,
                        space,
                        user: await client.db().collection("users").findOne({ _id: user_id })
                    }
                }
            ))
        },
        async rootNotes(space) {
            return await client.db().collection("notes").find({ parentNoteID: space._id }).toArray()
        }
    },
    Note: {
        async parentNote(note) {
            const indicator = note.parentNoteID.split(".")[0]
            const collection = indicator == "N" ? "notes" : "spaces"
            return await client.db().collection(collection).findOne({ _id: note.parentNoteID })
        },
        async space(note){
            return await client.db().collection("spaces").findOne({ _id: note.spaceID })
        },
        async subNotes({ _id }){
            return await client.db().collection("notes").find({ parentNoteID: _id }).toArray()
        }
    },
    Parent: {
        __resolveType(parent) {
            const indicator = parent._id.split(".")[0]
            switch (indicator) {
                case "N":
                    return "Note"
                case "S":
                    return "Space"
            }
        }
    },
    Query,
    Mutation
};


async function startApolloServer(typeDefs, resolvers) {
    const server = new ApolloServer({
        typeDefs, resolvers,
        context: async ({ req, res }) => {
            // Get the user token from the headers.
            const token = (req.headers.authorization || '').split(' ')[1];

            // Try to retrieve a user with the token
            const user = await getUser(token, client);
            // Add the user to the context
            return { user };
        },
        dataSources: () => ({
            users: new Users(client.db().collection('users'))
        }),
        introspection: true
    })
    const app = express();
    await server.start();
    app.use(cors({ origin: ['http://localhost:3000', "https://hwc.vercel.app", "https://studio.apollographql.com"], credentials: true }))
    /*app.use((req, res, next)=>{
        console.log(req.path, " from ", req.origin)
        next()
    })*/
    server.applyMiddleware({ app, path: '/', cors: false });


    const listener = app.listen(process.env.PORT || 4000, () => {
        console.log(`🚀 Server is listening on port ${process.env.PORT || 4000}${server.graphqlPath}`);
    })
    //nginx uses a 650 second keep-alive timeout on GAE. Setting it to a bit more here to avoid a race condition between the two timeouts.
    listener.keepAliveTimeout = 700000;

    //ensure the headersTimeout is set higher than the keepAliveTimeout due to this nodejs regression bug: https://github.com/nodejs/node/issues/27363
    listener.headersTimeout = 701000;
}

startApolloServer(typeDefs, resolvers);
