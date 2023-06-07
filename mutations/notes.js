const { v4: uuidv4 } = require("uuid")
const client = require('../mongo')
const { PubSub, withFilter } = require('graphql-subscriptions')
const pubsub = new PubSub();

module.exports = {
    Subscriptions: {
        noteEdited: {
            subscribe(_, { noteID }, { user }){
                return pubsub.asyncIterator(`NOTE_UPDATED:${noteID}`)
            }
        }
    },
    Queries: {
        eventsBetween(_, { startTime, duration }) {

        },
        async noteByID(_, { id: note_id }, { user }) {
            const note = await client.db().collection("notes").findOne({ _id: note_id, })
            const space = await client.db().collection("spaces").findOne({ _id: note.spaceID, "members.user_id": user._id })
            if (!space) { return null }
            return note
        }
    },
    Mutations: {
        async updateNote(_, { id: note_id, options, updateKey }, { user }) {
            const note = await client.db().collection("notes").findOne({ _id: note_id, })
            const space = await client.db().collection("spaces").findOne({ _id: note.spaceID, "members.user_id": user._id })
            if (!space) { return null }
            // user has access
            const { value: doc } = await client.db().collection("notes").findOneAndUpdate({ _id: note_id }, { $set: options }, {returnDocument: "after"})
            await pubsub.publish(`NOTE_UPDATED:${note_id}`, {noteEdited:{updateKey, note: doc}})
            return doc
        },
        async newNote(_, { title, parentID, options, spaceID }, { user }) {
            const space = await client.db().collection("spaces").findOne({ _id: spaceID, "members.user_id": user._id })
            // this way nobody knows if the space doesnt exist or the user lacks access.
            if (!space) {
                return new Error("space does not exist")
            }
            const doc = {
                _id: "N." + uuidv4(),
                title,
                parentNoteID: parentID,
                spaceID,
                createdBy: user._id,
                ...options
            }
            await client.db().collection("notes").insertOne(doc);
            return doc
        }
    }
}