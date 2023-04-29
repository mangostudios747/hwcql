const { ApolloServer, gql } = require('apollo-server-express');



const express = require('express');
require("dotenv").config();
const client = require('./mongo')
require('./gql-loader')

const { Mutation, getUser } = require('./mutation')
const typeDefs = require('./schema.graphql')
const { EmailAddressResolver, DateTimeResolver, JWTResolver } = require('graphql-scalars');
const cors = require('cors')

const Users = require('./data-sources/users.js')


const resolvers = {
    EmailAddress: EmailAddressResolver,
    DateTime: DateTimeResolver,
    JWT: JWTResolver,
    Query: {
        me: (_, __, { user }) => {
            return user
        }
    },
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
    app.use(cors({origin:['http://localhost:3000', "https://hwc.vercel.app"], credentials: true}))
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
