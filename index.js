const { ApolloServer, gql } = require('apollo-server-express');
const jwt = require('jsonwebtoken');
const { MongoClient } = require('mongodb');
const { v4: uuidv4 } = require("uuid")
const express = require('express');
require("dotenv").config();
require('./gql-loader')
const typeDefs = require('./schema.graphql')
const { EmailAddressResolver, DateTimeResolver, JWTResolver } = require('graphql-scalars');
const cors = require('cors')

const Users = require('./data-sources/users.js')

const client = new MongoClient(process.env.MONGO_URL)
client.connect()

const books = [
    {
        title: 'The Great Gatsby',
        author: 'F. Scott Fitzgerald',
    },
    {
        title: 'Wuthering Heigts',
        author: 'Emily Brontë',
    },
];

const resolvers = {
    EmailAddress: EmailAddressResolver,
    DateTime: DateTimeResolver,
    JWT: JWTResolver,
    Query: {
        books: () => {
            return books
        },
        me: (_, __, { user }) => {
            return user
        }
    },
    Mutation: {
        login: async (_, { email, password }, { dataSources: { users } }) => {
            const user = await users.getUserByEmail(email);
            if (user && user.password == password ) {
                return getToken(user._id)
            }
            else return null
        },
        register: async (_, { email, password, username }, { dataSources: { users } }) => {
            const exists = await users.getUserByEmail(email);
            if (!!exists) {
                console.log(exists)
                return exists
            }
            else {
                const doc = {
                    email,
                    password,
                    username,
                    _id: uuidv4()
                }
                await client.db().collection("users").insertOne(doc)
                return getToken(doc._id)
            }
        }
    }
};

async function getUser(token){
    if (!token) return null;
    try {
        const {_id} = jwt.verify(token, process.env.JWT_SECRET)
        return await client.db().collection("users").findOne({_id})
    }
    catch {
        return null
    }
}

function getToken(uid){
    return jwt.sign({_id: uid}, process.env.JWT_SECRET, {expiresIn: '1h'})
}


async function startApolloServer(typeDefs, resolvers) {
    const server = new ApolloServer({
        typeDefs, resolvers,
        context: async ({ req, res }) => {
            // Get the user token from the headers.
            const token = (req.headers.authorization || '').split(' ')[1];
            
            // Try to retrieve a user with the token
            const user = await getUser(token);

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
    app.use(cors({origin:['http://localhost:3000', "https://hwc.vercel.app/"], credentials: true}))
    app.use((req, res, next)=>{
        console.log(req.path)
        next()
    })
    server.applyMiddleware({ app, path: '/', cors: false });


    const listener = app.listen(process.env.PORT, () => {
        console.log(`🚀 Server is listening on port ${process.env.PORT}${server.graphqlPath}`);
    })
    //nginx uses a 650 second keep-alive timeout on GAE. Setting it to a bit more here to avoid a race condition between the two timeouts.
    listener.keepAliveTimeout = 700000; 

//ensure the headersTimeout is set higher than the keepAliveTimeout due to this nodejs regression bug: https://github.com/nodejs/node/issues/27363
    listener.headersTimeout = 701000; 
}

startApolloServer(typeDefs, resolvers);
