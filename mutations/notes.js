const { v4: uuidv4 } = require("uuid")
const client = require('../mongo')



module.exports = {
    Queries: {
        eventsBetween(_, { startTime, duration }) {

        },
        noteByID(_, { id }) {

        }
    },
    Mutations: {
        async newNote(_, { title, parentID, options, spaceID }, { user }) {
            const space = await client.db().collection("spaces").findOne({_id: spaceID, "members.user_id": user._id})
            // this way nobody knows if the space doesnt exist or the user lacks access.
            if (!space) {
                return new Error("space does not exist")
            }
            const doc = {
                _id: "N."+uuidv4(),
                title,
                parentNoteID: parentID,
                spaceID,
                createdBy: user._id,
                ...options
            }
            await client.db().collection("notes").insertOne(doc);
            return doc
        },
        async noteToTask(_, { id }, { user }){
            const note = await client.db().collection("notes").findOne({ _id: id })
            // TODO: make sure that the user has access to the note's space
            
        }
    }
}