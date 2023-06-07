const { ApolloServer, gql } = require('apollo-server-express');
const express = require('express');
const { EmailAddressResolver, DateTimeResolver, JWTResolver } = require('graphql-scalars');
const cors = require('cors')
const { createServer } = require('http');
const { ApolloServerPluginDrainHttpServer } = require('@apollo/server/plugin/drainHttpServer')
const { makeExecutableSchema } = require('@graphql-tools/schema');
const { WebSocketServer } = require('ws')
const { useServer } = require('graphql-ws/lib/use/ws');

require("dotenv").config();
const client = require('./mongo')

const { Mutation, Query, Subscription, getUser } = require('./mutations')
const typeDefs = require('./schema')


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
        async space(note) {
            return await client.db().collection("spaces").findOne({ _id: note.spaceID })
        },
        async subNotes({ _id }) {
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
    Mutation,
    Subscription
};


async function startApolloServer(typeDefs, resolvers) {
    const schema = makeExecutableSchema({ typeDefs, resolvers });
    const app = express();
    const httpServer = createServer(app);
    // Creating the WebSocket server
    const wsServer = new WebSocketServer({
        // This is the `httpServer` we created in a previous step.
        server: httpServer,
        // Pass a different path here if app.use
        // serves expressMiddleware at a different path
        path: '/graphqlws',
    });

    // Hand in the schema we just created and have the
    // WebSocketServer start listening.
    const serverCleanup = useServer({ schema, 
        context: async (ctx, msg, args) => {
            const token = (ctx.connectionParams.Authorization || '').split(' ')[1]
            const user = await getUser(token, client);
            // Add the user to the context
            return { user };
        } 
    }, wsServer);
    const server = new ApolloServer({
        schema,
        plugins: [
            // Proper shutdown for the HTTP server.
            ApolloServerPluginDrainHttpServer({ httpServer }),
        
            // Proper shutdown for the WebSocket server.
            {
              async serverWillStart() {
                return {
                  async drainServer() {
                    await serverCleanup.dispose();
                  },
                };
              },
            },
          ],
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
    await server.start();
    app.use(cors({ origin: ['http://localhost:3000', "https://hwc.vercel.app", "https://studio.apollographql.com"], credentials: true }))
    /*app.use((req, res, next)=>{
        console.log(req.path, " from ", req.origin)
        next()
    })*/
    server.applyMiddleware({ app, path: '/graphql', cors: false });

    const listener = httpServer.listen(process.env.PORT || 4000, () => {
        console.log(`🚀 Server is listening on port ${process.env.PORT || 4000}${server.graphqlPath}`);
    })
    //nginx uses a 650 second keep-alive timeout on GAE. Setting it to a bit more here to avoid a race condition between the two timeouts.
    listener.keepAliveTimeout = 700000;

    //ensure the headersTimeout is set higher than the keepAliveTimeout due to this nodejs regression bug: https://github.com/nodejs/node/issues/27363
    listener.headersTimeout = 701000;
}

startApolloServer(typeDefs, resolvers);


